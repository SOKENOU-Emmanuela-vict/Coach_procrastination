/**
 * DocumentExtractor
 * Responsabilité : Extraire le texte brut depuis une source (fichier, chaîne, etc.)
 */
export class DocumentExtractor {
    /**
     * Extrait le texte d'une source
     * Pour B.7, supporte uniquement le texte brut passé directement.
     * @param {string|Object} source - Le contenu brut ou la référence au fichier
     * @returns {Promise<string>} Le texte extrait
     */
    static async extractText(source) {
        if (typeof source === 'string') {
            return source;
        }
        
        if (source && source.type === 'pdf') {
            throw new Error("L'extraction PDF n'est pas encore supportée à cette étape.");
        }
        
        throw new Error("Format de source non supporté.");
    }
}
