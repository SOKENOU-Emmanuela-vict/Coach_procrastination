/**
 * Abstraction du fournisseur LLM.
 * Définit le contrat strict pour la génération.
 */
export class LLMProvider {
    /**
     * @param {string} prompt - Le prompt formaté (Système + Contexte)
     * @param {Object} options - Options (température, max_tokens, etc.)
     * @returns {Promise<string>} La réponse textuelle du modèle (généralement du JSON text)
     */
    async generate(prompt, options = {}) {
        throw new Error("Method 'generate()' must be implemented.");
    }
}
