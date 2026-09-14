/**
 * TextNormalizer
 * Responsabilité : Nettoyer le texte avant chunking tout en préservant sa structure sémantique.
 */
export class TextNormalizer {
    /**
     * Normalise le texte
     * @param {string} text - Le texte brut
     * @returns {string} Le texte normalisé
     */
    static normalize(text) {
        if (!text) return "";
        
        let normalized = text;
        
        // Supprimer les espaces multiples (espaces, tabulations) mais conserver les sauts de ligne
        normalized = normalized.replace(/[ \t]+/g, ' ');
        
        // Supprimer les lignes vides excessives (plus de 2 sauts de ligne deviennent 2 sauts de ligne)
        normalized = normalized.replace(/\n\s*\n\s*\n+/g, '\n\n');
        
        // Supprimer les espaces en début et fin de chaîne
        normalized = normalized.trim();
        
        return normalized;
    }
}
