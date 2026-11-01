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
export function describeGeminiFailure(status, rawMessage = '') {
    const raw = String(rawMessage || '');
    if (/sk-|openai/i.test(raw)) return { code: 'AUTH', text: 'cette clé commence par « sk- » (clé OpenAI) ; utilise une clé Google (AI Studio ou Vertex AI « AQ.… »)' };
    if (status === 503 || /high demand|overloaded|unavailable/i.test(raw)) return { code: 'OVERLOADED', text: 'les serveurs de Gemini sont saturés' };
    if (status === 429 || /quota|rate limit|resource.?exhausted/i.test(raw)) return { code: 'QUOTA', text: 'le quota gratuit de la clé est épuisé pour le moment' };
    if (status === 401 || status === 403 || /api key|permission|unauthori[sz]ed/i.test(raw)) {
        if (/API not enabled|not activated|SERVICE_DISABLED/i.test(raw)) {
            return { code: 'AUTH', text: "l'API Gemini n'est pas activée sur ce projet Google Cloud" };
        }
        return { code: 'AUTH', text: 'la clé Gemini est refusée (invalide ou révoquée)' };
    }
    if (status === 404 || /not found|no longer available/i.test(raw)) return { code: 'MODEL', text: "le modèle Gemini demandé n'est pas disponible" };
    if (status === 400) return { code: 'BAD_REQUEST', text: 'Gemini a refusé la requête' };
    if (status >= 500) return { code: 'SERVER', text: 'Gemini a rencontré une erreur interne' };
    if (status === 0 && /timeout|délai|abort/i.test(raw)) return { code: 'TIMEOUT', text: "Gemini n'a pas répondu à temps" };
    if (status === 0) return { code: 'NETWORK', text: 'pas de connexion à Internet (ou Gemini injoignable)' };
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
        let response;
        try {
            response = await fetch(this._modelsUrl(key), {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' },
                ...(controller ? { signal: controller.signal } : {})
            });
        } catch (e) {
            const aborted = e && (e.name === 'AbortError' || /abort/i.test(String(e.message)));
            const raw = aborted ? 'timeout' : String((e && e.message) || e);
            const d = describeGeminiFailure(0, raw);
            throw new GeminiError(d.text, { status: 0, code: d.code, detail: this._safe(raw, key) });
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

        try {
            const available = await this.listAvailableModels(key);
            const chosen = PREFERRED_MODELS.find(p => available.includes(p)) || available[0] || GEMINI_PRIMARY_MODEL;
            this.selectedModel = chosen;
            sessionSelectedModel = chosen;
            return { ok: true, model: chosen, message: `OK (modèle retenu : ${chosen})` };
        } catch (err) {
            const status = err.status || 0;
            const code = err.code || 'UNKNOWN';
            const detail = String(err.detail || '');
            let msg = err.message || '';

            if (status === 400 || status === 403) {
                if (/API not enabled|not activated|SERVICE_DISABLED/i.test(detail)) {
                    msg = `Erreur ${status} : API non activée dans la console Google Cloud.`;
                } else {
                    msg = `Erreur ${status} : Clé API invalide ou refusée.`;
                }
            } else if (status === 429) {
                msg = `Erreur 429 : Quota gratuit ou limite de requêtes dépassé.`;
            } else if (status === 404) {
                msg = `Erreur 404 : Modèle ou service Google introuvable.`;
            } else if (status === 0) {
                msg = `Erreur réseau : Connexion impossible ou délai dépassé.`;
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
        let response;
        try {
            response = await fetch(this._url(model, useStudioFallback), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
                ...(controller ? { signal: controller.signal } : {})
            });
        } catch (e) {
            const aborted = e && (e.name === 'AbortError' || /abort/i.test(String(e.message)));
            const raw = aborted ? 'timeout' : String((e && e.message) || e);
            const d = describeGeminiFailure(0, raw);
            throw new GeminiError(`${d.text}`, { status: 0, code: d.code, model, detail: this._safe(raw) });
        } finally {
            if (timer) clearTimeout(timer);
        }

        if (!response.ok) {
            let raw = `HTTP error ${response.status}`;
            try {
                const err = await response.json();
                if (err && err.error && err.error.message) raw = err.error.message;
            } catch (e) { /* ignore parse error on error response */ }

            // Si c'est une clé AQ. qui échoue sur aiplatform (ex. 403 API disabled ou 404),
            // repli transparent et immédiat sur Google AI Studio (generativelanguage.googleapis.com)
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
