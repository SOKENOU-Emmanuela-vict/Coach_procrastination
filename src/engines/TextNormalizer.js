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

    /**
     * Forme de comparaison : minuscules, sans accents ni ponctuation, espaces simples.
     * Ex. « Structures algébriques — (03H/20H) » → « structures algebriques 03h 20h »
     * @param {string} text
     * @returns {string}
     */
    static forMatching(text) {
        if (!text) return "";
        return String(text)
            .toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/[’']/g, ' ')
            .replace(/c\+\+/g, 'cpp')
            .replace(/[^a-z0-9]+/g, ' ')
            .trim();
    }

    /**
     * Mots significatifs (sans mots vides), ramenés à une racine simple (pluriel, « e » final)
     * pour rapprocher « Structures algébriques » et « structure algebrique ».
     * @param {string} text
     * @returns {Array<string>}
     */
    static tokens(text) {
        const stop = new Set(['de', 'des', 'du', 'd', 'et', 'la', 'le', 'les', 'l', 'en', 'avec', 'a', 'au', 'aux',
            'pour', 'par', 'sur', 'leur', 'leurs', 'un', 'une', 'dans', 'son', 'ses', 'mon', 'ma', 'mes', 'tous']);
        return TextNormalizer.forMatching(text).split(' ')
            .filter(t => t && !stop.has(t) && (t.length > 1 || t === 'c' || t === 'r'))
            .map(t => (t.length > 3 ? t.replace(/(es|s|x)$/, '').replace(/e+$/, '') : t));
    }
}
