import { LLMProvider } from './LLMProvider.js';

/** Modèle principal puis modèles de secours (selon https://ai.google.dev/gemini-api/docs/models) */
export const GEMINI_PRIMARY_MODEL = "gemini-3.8-flash";
export const GEMINI_FALLBACK_MODELS = [
    "gemini-3.6-flash",
    "gemini-3.5-flash-lite",
    "gemini-3.1-flash-lite",
    "gemini-2.5-flash"
];

export const PREFERRED_MODELS = [
    GEMINI_PRIMARY_MODEL,
    ...GEMINI_FALLBACK_MODELS
];

const RETRYABLE_STATUS = [429, 500, 502, 503, 504];

/** Cache mémoire de session pour le modèle sélectionné via ListModels */
let sessionSelectedModel = null;

export function resetSessionModel() {
    sessionSelectedModel = null;
}

/** Écoute de l'événement securitypolicyviolation (CSP) dans le navigateur */
let lastCspViolation = null;

if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('securitypolicyviolation', (e) => {
        const uri = String(e.blockedURI || '');
        if (uri.includes('googleapis.com') || uri.includes('aiplatform') || uri.includes('generativelanguage')) {
            lastCspViolation = { uri, timestamp: Date.now() };
            window.__lastCspViolationForGemini = true;
        }
    });
}

/** Helper de test pour simuler une violation CSP dans Node ou le navigateur */
export function notifyCspViolation(uri = 'https://generativelanguage.googleapis.com') {
    lastCspViolation = { uri, timestamp: Date.now() };
    if (typeof window !== 'undefined') window.__lastCspViolationForGemini = true;
}

export function clearCspViolation() {
    lastCspViolation = null;
    if (typeof window !== 'undefined') window.__lastCspViolationForGemini = false;
}

/**
 * Sonde de connectivité réseau vers Google via fetch({ mode: 'no-cors' }).
 * Dans un navigateur, un échec de fetch normal donne un "TypeError: Failed to fetch"
 * opaque qui ne distingue pas DNS, coupure réseau, VPN ou CORS.
 * En tentant une requête en mode 'no-cors' vers l'origine :
 * - Si elle échoue aussi : le navigateur n'arrive pas à établir la connexion (réseau, DNS, proxy, antivirus).
 * - Si elle réussit (réponse opaque sans erreur) : le serveur Google est joignable, l'échec initial est un refus applicatif (CORS ou clé bloquée).
 */
export async function probeGoogleReachability(key = '') {
    const isAq = typeof key === 'string' && key.trim().startsWith('AQ.');
    const targets = isAq
        ? ['https://generativelanguage.googleapis.com/', 'https://aiplatform.googleapis.com/']
        : ['https://generativelanguage.googleapis.com/'];

    for (const target of targets) {
        try {
            await fetch(target, { mode: 'no-cors', method: 'GET' });
            return true;
        } catch (_) {
            // Échec sur cette cible
        }
    }
    return false;
}

/**
 * Diagnostic honnête d'un échec de fetch (status 0).
 * Ne prétend pas distinguer ce qu'un navigateur ne peut pas distinguer :
 * 1. Cas réellement détectables :
 *    - Événement securitypolicyviolation (CSP)
 *    - navigator.onLine === false (appareil déconnecté)
 *    - Timeout (délai dépassé / signal abort)
 * 2. Sonde no-cors :
 *    - Échoue -> problème d'accès réseau/DNS/antivirus/VPN
 *    - Réussit -> Google est joignable mais refuse l'appel (CORS ou clé AQ.)
 */
export async function diagnoseNetworkFailure(error, key = '') {
    const raw = String((error && error.message) || error || '');

    // 1. Violation de la CSP détectée
    const recentCsp = (lastCspViolation && (Date.now() - lastCspViolation.timestamp < 10000)) ||
                      (typeof window !== 'undefined' && window.__lastCspViolationForGemini);
    const isCsp = recentCsp || /securitypolicyviolation|content security policy|csp/i.test(raw) || (error && error.name === 'SecurityError');
    if (isCsp) {
        return {
            code: 'CSP_BLOCKED',
            message: "Requête bloquée par la politique de sécurité (CSP) du navigateur."
        };
    }

    // 2. Navigateur hors-ligne
    if ((typeof navigator !== 'undefined' && navigator && navigator.onLine === false) || /navigator\.onLine === false|hors-ligne|offline/i.test(raw)) {
        return {
            code: 'OFFLINE',
            message: "Navigateur hors-ligne : ton appareil n'est pas connecté à Internet."
        };
    }

    // 3. Timeout / Délai dépassé
    if (/timeout|délai|abort/i.test(raw)) {
        return {
            code: 'TIMEOUT',
            message: "Gemini n'a pas répondu à temps (délai dépassé)."
        };
    }

    // 4. Sonde no-cors pour déterminer la joignabilité
    const reachable = await probeGoogleReachability(key);
    if (!reachable) {
        return {
            code: 'NETWORK',
            message: "Ton navigateur n'arrive pas à joindre Google (connexion, DNS, VPN/proxy, antivirus ou extension). Essaie une fenêtre privée, un autre réseau, ou change le DNS."
        };
    }

    return {
        code: 'CORS_OR_AQ',
        message: "Google est joignable mais refuse l'appel depuis le navigateur (CORS ou clé de type AQ.). Utilise une clé AIza créée dans Google AI Studio."
    };
}

/**
 * Erreur Gemini lisible : status HTTP (0 = réseau / délai dépassé), code court et message en français pour l'utilisatrice.
 * Les messages ne contiennent jamais la clé.
 */
export class GeminiError extends Error {
    constructor(message, { status = 0, code = 'UNKNOWN', model = null, detail = null } = {}) {
        super(message);
        this.name = 'GeminiError';
        this.status = status;
        this.code = code;
        this.model = model;
        this.detail = detail;
    }
}

/** Code court + explication en français selon le status HTTP (ou l'absence de réponse). */
export function describeGeminiFailure(status, rawMessage = '', context = {}) {
    const raw = String(rawMessage || '');
    if (/sk-|openai/i.test(raw)) return { code: 'AUTH', text: 'cette clé commence par « sk- » (clé OpenAI) ; utilise une clé Google (AI Studio ou Vertex AI « AQ.… »)' };
    if (status === 503 || /high demand|overloaded|unavailable/i.test(raw)) return { code: 'OVERLOADED', text: 'les serveurs de Gemini sont saturés' };
    if (status === 429 || /quota|rate limit|resource.?exhausted/i.test(raw)) return { code: 'QUOTA', text: 'le quota gratuit de la clé est épuisé pour le moment' };
    if (status === 401) {
        return { code: 'AUTH', text: 'la clé Gemini est refusée (invalide ou révoquée)' };
    }
    if (status === 403) {
        if (/has not been used|disabled|PERMISSION_DENIED|API not enabled|not activated|SERVICE_DISABLED/i.test(raw)) {
            return { code: 'AUTH', text: "l'API Gemini n'est pas activée sur ce projet Google Cloud (active l'API dans la console Google Cloud)" };
        }
        return { code: 'AUTH', text: 'la clé Gemini est refusée (invalide ou révoquée)' };
    }
    if (status === 404 || /not found|no longer available/i.test(raw)) return { code: 'MODEL', text: "le modèle Gemini demandé n'est pas disponible" };
    if (status === 400) return { code: 'BAD_REQUEST', text: 'Gemini a refusé la requête' };
    if (status >= 500) return { code: 'SERVER', text: 'Gemini a rencontré une erreur interne' };
    if (status === 0 && /timeout|délai|abort/i.test(raw)) return { code: 'TIMEOUT', text: "Gemini n'a pas répondu à temps" };
    if (status === 0) {
        if (context.message) {
            return { code: context.code || 'NETWORK', text: context.message };
        }
        return { code: 'NETWORK', text: raw || "ton navigateur n'arrive pas à joindre Google (connexion, DNS, VPN/proxy, antivirus ou extension)" };
    }
    return { code: 'UNKNOWN', text: 'erreur inattendue de Gemini' };
}

const wait = (ms) => new Promise(r => setTimeout(r, ms));

export class GeminiProvider extends LLMProvider {
    /**
     * @param {string} apiKey - Clé API Gemini (si absente, génèrera une erreur lors de l'appel)
     */
    constructor(apiKey) {
        super();
        this.apiKey = typeof apiKey === 'string' ? apiKey.trim() : apiKey;
        // Réglages de résilience (modifiables dans les tests)
        this.primaryModel = GEMINI_PRIMARY_MODEL;
        this.fallbackModels = GEMINI_FALLBACK_MODELS.slice();
        this.retryDelayMs = 1500;
        this.timeoutMs = 45000;
        this.fileTimeoutMs = 120000;
        this.lastModelUsed = null;
        this.selectedModel = null;
    }

    /** Détecte une clé Google Cloud Vertex AI Express Mode (préfixe « AQ. »). */
    isVertexExpressKey() {
        return typeof this.apiKey === 'string' && this.apiKey.startsWith('AQ.');
    }

    _url(model, useStudioFallback = false) {
        const keyParam = encodeURIComponent(this.apiKey);
        if (this.isVertexExpressKey() && !useStudioFallback) {
            return `https://aiplatform.googleapis.com/v1/publishers/google/models/${model}:generateContent?key=${keyParam}`;
        }
        return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${keyParam}`;
    }

    _modelsUrl(candidateKey = null) {
        const key = candidateKey || this.apiKey;
        const keyParam = encodeURIComponent(key);
        return `https://generativelanguage.googleapis.com/v1beta/models?key=${keyParam}`;
    }

    _safe(text, keyOverride = null) {
        let s = String(text || '');
        const key = keyOverride || this.apiKey;
        if (key) {
            s = s.split(key).join('[HIDDEN_API_KEY]');
            const encoded = encodeURIComponent(key);
            if (encoded !== key) {
                s = s.split(encoded).join('[HIDDEN_API_KEY]');
            }
        }
        return s;
    }

    /**
     * Appelle l'endpoint ListModels et ne retient que les modèles supportant generateContent.
     * @param {string} candidateKey - Clé optionnelle à tester
     * @param {number} timeoutMs - Délai maximal
     * @returns {Promise<string[]>} Liste des identifiants normalisés (ex: "gemini-3.8-flash")
     */
    async listAvailableModels(candidateKey = null, timeoutMs = 10000) {
        const key = candidateKey || this.apiKey;
        if (!key) throw new GeminiError("Clé API manquante.", { status: 0, code: 'AUTH' });
        if (/^sk-/i.test(key)) {
            throw new GeminiError("Cette clé commence par « sk- » (clé OpenAI) ; utilise une clé Google.", { status: 401, code: 'AUTH' });
        }

        const controller = typeof AbortController === 'function' ? new AbortController() : null;
        const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
        const targetUrl = this._modelsUrl(key);
        let response;
        try {
            response = await fetch(targetUrl, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' },
                ...(controller ? { signal: controller.signal } : {})
            });
        } catch (e) {
            const aborted = e && (e.name === 'AbortError' || /abort/i.test(String(e.message)));
            const raw = aborted ? 'timeout' : e;
            const diag = await diagnoseNetworkFailure(raw, key);
            throw new GeminiError(diag.message, { status: 0, code: diag.code, detail: this._safe(String((e && e.message) || e), key) });
        } finally {
            if (timer) clearTimeout(timer);
        }

        if (!response.ok) {
            let raw = `HTTP error ${response.status}`;
            try {
                const err = await response.json();
                if (err && err.error && err.error.message) raw = err.error.message;
            } catch (_) {}
            const d = describeGeminiFailure(response.status, raw);
            throw new GeminiError(d.text, { status: response.status, code: d.code, detail: this._safe(raw, key) });
        }

        const data = await response.json();
        const models = Array.isArray(data && data.models) ? data.models : [];
        return models
            .filter(m => {
                const methods = m.supportedGenerationMethods;
                return Array.isArray(methods) ? methods.includes('generateContent') : true;
            })
            .map(m => String(m.name || '').replace(/^models\//, ''))
            .filter(Boolean);
    }

    /**
     * Résout le modèle à utiliser à partir de ListModels et de la liste de préférence.
     * Mémorise le modèle pour toute la session.
     */
    async resolveModel() {
        if (this.selectedModel) return this.selectedModel;
        if (sessionSelectedModel) {
            this.selectedModel = sessionSelectedModel;
            return this.selectedModel;
        }

        try {
            const available = await this.listAvailableModels();
            const preferred = PREFERRED_MODELS.find(p => available.includes(p));
            if (preferred) {
                this.selectedModel = preferred;
                sessionSelectedModel = preferred;
                return preferred;
            }
            if (available.length > 0) {
                this.selectedModel = available[0];
                sessionSelectedModel = available[0];
                return available[0];
            }
        } catch (_) {
            // Repli gracieux en cas d'échec de ListModels (ex: mode dégradé, proxy ou mock)
        }

        this.selectedModel = GEMINI_PRIMARY_MODEL;
        sessionSelectedModel = GEMINI_PRIMARY_MODEL;
        return GEMINI_PRIMARY_MODEL;
    }

    /**
     * Teste la clé et choisit le meilleur modèle disponible.
     * N'affiche ni ne logue jamais la clé.
     * @param {string} candidateKey - Clé optionnelle
     * @returns {Promise<{ ok: boolean, model?: string, status?: number, code?: string, message: string }>}
     */
    async testKey(candidateKey = null) {
        const key = candidateKey !== null && candidateKey !== undefined ? String(candidateKey).trim() : this.apiKey;
        if (!key) {
            return { ok: false, status: 0, code: 'AUTH', message: "Colle ta clé API avant de tester." };
        }
        if (/^sk-/i.test(key)) {
            return { ok: false, status: 401, code: 'AUTH', message: "Erreur 401 : Cette clé commence par « sk- » (clé OpenAI) ; utilise une clé Google (AI Studio ou Vertex AI « AQ.… »)." };
        }

        // Cas d'une clé AQ. (Vertex AI Express Mode) :
        // 1. Tente l'adresse aiplatform.
        // 2. Tente l'autre adresse generativelanguage.
        // 3. Si les deux échouent : vérifie la joignabilité via la sonde no-cors.
        if (key.startsWith('AQ.')) {
            let aiplatformErr = null;
            let studioErr = null;

            // Essai 1 : aiplatform.googleapis.com
            try {
                const urlPlatform = `https://aiplatform.googleapis.com/v1/publishers/google/models/${GEMINI_PRIMARY_MODEL}:generateContent?key=${encodeURIComponent(key)}`;
                const res = await fetch(urlPlatform, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: 'test' }] }] })
                });
                if (res.ok) {
                    this.selectedModel = GEMINI_PRIMARY_MODEL;
                    sessionSelectedModel = GEMINI_PRIMARY_MODEL;
                    return { ok: true, model: GEMINI_PRIMARY_MODEL, message: `OK (modèle retenu : ${GEMINI_PRIMARY_MODEL})` };
                } else {
                    aiplatformErr = new Error(`HTTP ${res.status}`);
                    aiplatformErr.status = res.status;
                }
            } catch (e) {
                aiplatformErr = e;
            }

            // Essai 2 : generativelanguage.googleapis.com
            try {
                const available = await this.listAvailableModels(key);
                const chosen = PREFERRED_MODELS.find(p => available.includes(p)) || available[0] || GEMINI_PRIMARY_MODEL;
                this.selectedModel = chosen;
                sessionSelectedModel = chosen;
                return { ok: true, model: chosen, message: `OK (modèle retenu : ${chosen})` };
            } catch (e) {
                studioErr = e;
            }

            // Les deux ont échoué : sonde no-cors pour distinguer coupure réseau vs refus Google
            const diag = await diagnoseNetworkFailure(aiplatformErr || studioErr, key);
            return {
                ok: false,
                status: (aiplatformErr && aiplatformErr.status) || (studioErr && studioErr.status) || 0,
                code: diag.code,
                message: diag.message
            };
        }

        // Clé standard (AIza ou autre)
        try {
            const available = await this.listAvailableModels(key);
            const chosen = PREFERRED_MODELS.find(p => available.includes(p)) || available[0] || GEMINI_PRIMARY_MODEL;
            this.selectedModel = chosen;
            sessionSelectedModel = chosen;
            return { ok: true, model: chosen, message: `OK (modèle retenu : ${chosen})` };
        } catch (err) {
            const status = err.status || 0;
            const code = err.code || 'UNKNOWN';
            const detail = String(err.detail || err.message || '');
            let msg = err.message || '';

            if (status === 403) {
                if (/has not been used|disabled|PERMISSION_DENIED|API not enabled|not activated|SERVICE_DISABLED/i.test(detail)) {
                    msg = `Erreur 403 : API Gemini non activée sur ce projet Google Cloud.`;
                } else {
                    msg = `Erreur 403 : Clé API invalide ou refusée.`;
                }
            } else if (status === 400) {
                msg = `Erreur 400 : Clé API invalide ou refusée.`;
            } else if (status === 429) {
                msg = `Erreur 429 : Quota gratuit ou limite de requêtes dépassé.`;
            } else if (status === 404) {
                msg = `Erreur 404 : Modèle ou service Google introuvable.`;
            } else if (status === 0) {
                // Utilise le diagnostic réseau honnête
                const diag = await diagnoseNetworkFailure(err, key);
                msg = diag.message;
            } else {
                msg = `Erreur ${status || code} : ${msg}`;
            }

            return { ok: false, status, code, message: msg };
        }
    }

    /**
     * Un appel generateContent sur UN modèle. Lève une GeminiError (status, code) en cas d'échec.
     */
    async _callOnce(model, body, timeoutMs, useStudioFallback = false) {
        const controller = typeof AbortController === 'function' ? new AbortController() : null;
        const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
        const targetUrl = this._url(model, useStudioFallback);
        let response;
        try {
            response = await fetch(targetUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
                ...(controller ? { signal: controller.signal } : {})
            });
        } catch (e) {
            if (timer) clearTimeout(timer);
            // Repli transparent sur l'autre adresse si clé AQ.
            if (this.isVertexExpressKey() && !useStudioFallback) {
                try {
                    return await this._callOnce(model, body, timeoutMs, true);
                } catch (_) {}
            }

            const aborted = e && (e.name === 'AbortError' || /abort/i.test(String(e.message)));
            const raw = aborted ? 'timeout' : e;
            const diag = await diagnoseNetworkFailure(raw, this.apiKey);
            throw new GeminiError(diag.message, { status: 0, code: diag.code, model, detail: this._safe(String((e && e.message) || e)) });
        } finally {
            if (timer) clearTimeout(timer);
        }

        if (!response.ok) {
            let raw = `HTTP error ${response.status}`;
            try {
                const err = await response.json();
                if (err && err.error && err.error.message) raw = err.error.message;
            } catch (e) { /* ignore parse error on error response */ }

            // Si c'est une clé AQ. qui échoue sur aiplatform, repli immédiat sur generativelanguage
            if (this.isVertexExpressKey() && !useStudioFallback) {
                try {
                    return await this._callOnce(model, body, timeoutMs, true);
                } catch (_) {
                    // Si le repli AI Studio échoue également, on continue vers le traitement d'erreur normal
                }
            }

            const d = describeGeminiFailure(response.status, raw);
            throw new GeminiError(d.text, { status: response.status, code: d.code, model, detail: this._safe(raw) });
        }

        const data = await response.json();
        const parts = data && data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts;
        if (!Array.isArray(parts) || parts.length === 0) {
            throw new GeminiError("Gemini a retourné une réponse vide", { status: response.status || 200, code: 'EMPTY', model });
        }
        return parts.map(p => p.text || '').join('').replace(/```json/g, '').replace(/```/g, '').trim();
    }

    /**
     * Appel résilient : modèle résolu ou imposé (1 nouvelle tentative si saturé) puis modèles de secours.
     * Les erreurs non transitoires (clé refusée, requête invalide) arrêtent tout de suite.
     */
    async _callWithFallback(body, { model = null, timeoutMs }) {
        if (typeof this.apiKey === 'string' && /^sk-/i.test(this.apiKey)) {
            const d = describeGeminiFailure(401, 'sk- openai key');
            throw this._finalError(new GeminiError(d.text, { status: 401, code: d.code }));
        }

        const startingModel = model || this.selectedModel || sessionSelectedModel || this.primaryModel;
        const models = [startingModel].concat(model ? [] : this.fallbackModels)
            .filter((m, i, a) => m && a.indexOf(m) === i);

        let lastError = null;
        for (let mi = 0; mi < models.length; mi++) {
            const attempts = mi === 0 ? 2 : 1;
            for (let attempt = 0; attempt < attempts; attempt++) {
                try {
                    const text = await this._callOnce(models[mi], body, timeoutMs);
                    this.lastModelUsed = models[mi];
                    return text;
                } catch (e) {
                    lastError = e;
                    const transient = RETRYABLE_STATUS.includes(e.status) || e.code === 'TIMEOUT' || e.code === 'MODEL' || e.code === 'EMPTY';
                    if (!transient) throw this._finalError(e);
                    if (e.code === 'MODEL' || e.code === 'TIMEOUT') break; // modèle absent / trop lent : modèle suivant directement
                    if (attempt + 1 < attempts && this.retryDelayMs > 0) await wait(this.retryDelayMs);
                }
            }
        }
        throw this._finalError(lastError);
    }

    _finalError(e) {
        if (!(e instanceof GeminiError)) {
            return new GeminiError(`Erreur API Gemini: ${this._safe(e && e.message)}`, { code: 'UNKNOWN' });
        }
        const codePart = e.status ? `code ${e.status}` : e.code;
        const out = new GeminiError(`Erreur API Gemini (${codePart}) : ${e.message}.`, { status: e.status, code: e.code, model: e.model, detail: e.detail });
        return out;
    }

    /**
     * Envoie le prompt au modèle Gemini et retourne la réponse.
     * @param {string} prompt 
     * @param {Object} options - { model } (un modèle imposé désactive les modèles de secours)
     * @returns {Promise<string>}
     */
    async generate(prompt, options = {}) {
        if (!this.apiKey) {
            throw new Error("Erreur GeminiProvider : Clé API manquante.");
        }
        return this._callWithFallback({ contents: [{ role: 'user', parts: [{ text: prompt }] }] },
            { model: options.model || null, timeoutMs: options.timeoutMs || this.timeoutMs });
    }

    /**
     * Lecture d'un fichier (PDF ou image) par Gemini, réponse JSON imposée.
     * @param {Object} params
     * @returns {Promise<string>}
     */
    async generateFromFile({ prompt, mimeType, data, responseSchema = null, model = null, temperature = 0 } = {}) {
        if (!this.apiKey) {
            throw new Error("Erreur GeminiProvider : Clé API manquante.");
        }
        if (!data || !mimeType) {
            throw new Error("Erreur GeminiProvider : fichier manquant.");
        }
        const generationConfig = { temperature, responseMimeType: 'application/json' };
        if (responseSchema) generationConfig.responseSchema = responseSchema;
        return this._callWithFallback({
            contents: [{
                role: 'user',
                parts: [
                    { inlineData: { mimeType, data } },
                    { text: prompt || '' }
                ]
            }],
            generationConfig
        }, { model, timeoutMs: this.fileTimeoutMs });
    }
}
