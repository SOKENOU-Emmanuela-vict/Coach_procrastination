import { LLMProvider } from './LLMProvider.js';

/** Modèle principal puis modèles de secours, essayés dans l'ordre quand Gemini est saturé (503/429/500/504) ou absent (404). */
export const GEMINI_PRIMARY_MODEL = "gemini-2.5-flash";
export const GEMINI_FALLBACK_MODELS = ["gemini-2.0-flash", "gemini-1.5-flash"];
const RETRYABLE_STATUS = [429, 500, 502, 503, 504];

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
    if (status === 401 || status === 403 || /api key|permission|unauthori[sz]ed/i.test(raw)) return { code: 'AUTH', text: 'la clé Gemini est refusée (invalide ou révoquée)' };
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
        this.fallbackModels = GEMINI_FALLBACK_MODELS.slice();
        this.retryDelayMs = 1500;
        this.timeoutMs = 45000;
        this.fileTimeoutMs = 120000;
        this.lastModelUsed = null;
    }

    /** Détecte une clé Google Cloud Vertex AI Express Mode (préfixe « AQ. »). */
    isVertexExpressKey() {
        return typeof this.apiKey === 'string' && this.apiKey.startsWith('AQ.');
    }

    _url(model) {
        const keyParam = encodeURIComponent(this.apiKey);
        if (this.isVertexExpressKey()) {
            return `https://aiplatform.googleapis.com/v1/publishers/google/models/${model}:generateContent?key=${keyParam}`;
        }
        return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${keyParam}`;
    }

    /**
     * Un appel generateContent sur UN modèle. Lève une GeminiError (status, code) en cas d'échec.
     */
    async _callOnce(model, body, timeoutMs) {
        const controller = typeof AbortController === 'function' ? new AbortController() : null;
        const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
        let response;
        try {
            response = await fetch(this._url(model), {
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

    _safe(text) {
        let s = String(text || '');
        if (this.apiKey) {
            s = s.split(this.apiKey).join('[HIDDEN_API_KEY]');
            const encoded = encodeURIComponent(this.apiKey);
            if (encoded !== this.apiKey) {
                s = s.split(encoded).join('[HIDDEN_API_KEY]');
            }
        }
        return s;
    }

    /**
     * Appel résilient : modèle demandé (1 nouvelle tentative si saturé) puis modèles de secours.
     * Les erreurs non transitoires (clé refusée, requête invalide) arrêtent tout de suite.
     */
    async _callWithFallback(body, { model = null, timeoutMs }) {
        if (typeof this.apiKey === 'string' && /^sk-/i.test(this.apiKey)) {
            const d = describeGeminiFailure(401, 'sk- openai key');
            throw this._finalError(new GeminiError(d.text, { status: 401, code: d.code }));
        }
        const models = [model || GEMINI_PRIMARY_MODEL].concat(model ? [] : this.fallbackModels)
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
     * Le fichier est envoyé tel quel en inlineData (Gemini lit les PDF scannés page par page) : aucune dépendance
     * de rendu PDF dans le navigateur.
     * @param {Object} params - { prompt, mimeType ('application/pdf', 'image/png'…), data (base64 sans en-tête),
     *   responseSchema (facultatif), model, temperature }
     * @returns {Promise<string>} le texte JSON renvoyé par le modèle
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
