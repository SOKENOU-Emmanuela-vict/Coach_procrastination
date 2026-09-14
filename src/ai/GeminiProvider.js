import { LLMProvider } from './LLMProvider.js';

export class GeminiProvider extends LLMProvider {
    /**
     * @param {string} apiKey - Clé API Gemini (si absente, génèrera une erreur lors de l'appel)
     */
    constructor(apiKey) {
        super();
        this.apiKey = apiKey;
    }

    /**
     * Envoie le prompt au modèle Gemini et retourne la réponse.
     * @param {string} prompt 
     * @param {Object} options 
     * @returns {Promise<string>}
     */
    async generate(prompt, options = {}) {
        if (!this.apiKey) {
            throw new Error("Erreur GeminiProvider : Clé API manquante.");
        }

        const model = options.model || "gemini-1.5-flash";
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.apiKey}`;

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [{ text: prompt }]
                    }]
                })
            });

            if (!response.ok) {
                let errMessage = `HTTP error ${response.status}`;
                try {
                    const err = await response.json();
                    if (err && err.error && err.error.message) {
                        errMessage = err.error.message;
                    }
                } catch (e) { /* ignore parse error on error response */ }
                throw new Error(errMessage);
            }

            const data = await response.json();
            
            if (!data.candidates || data.candidates.length === 0) {
                throw new Error("Gemini API a retourné une réponse vide.");
            }

            let textContent = data.candidates[0].content.parts[0].text;
            
            // Nettoyage Markdown
            textContent = textContent.replace(/```json/g, '').replace(/```/g, '').trim();
            
            return textContent;
        } catch (e) {
            // Ne pas exposer la clé API dans le message d'erreur
            const safeMessage = e.message.replace(this.apiKey, '[HIDDEN_API_KEY]');
            throw new Error(`Erreur API Gemini: ${safeMessage}`);
        }
    }
}
