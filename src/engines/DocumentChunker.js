/**
 * DocumentChunker
 * Responsabilité : Découper un texte normalisé en chunks déterministes.
 */
export class DocumentChunker {
    /**
     * Découpe le texte en chunks
     * @param {string} text - Le texte normalisé
     * @param {Object} options - Options de chunking
     * @param {number} options.maxLength - Taille max d'un chunk (défaut: 1000)
     * @param {number} options.overlap - Nombre de caractères de chevauchement (défaut: 0, pour la B.7 on garde simple)
     * @returns {Array<{content: string, index: number}>} Les morceaux
     */
    static chunk(text, options = {}) {
        if (!text) return [];
        
        const maxLength = options.maxLength || 1000;
        
        // 1. Découpage par paragraphes
        const paragraphs = text.split('\n\n');
        
        const chunks = [];
        let currentChunk = "";
        let currentIndex = 0;
        
        for (let i = 0; i < paragraphs.length; i++) {
            const para = paragraphs[i];
            
            // Si le paragraphe est plus grand que maxLength, on doit le découper par phrases
            if (para.length > maxLength) {
                // On pousse ce qu'on a déjà accumulé
                if (currentChunk.length > 0) {
                    chunks.push({ content: currentChunk.trim(), index: currentIndex++ });
                    currentChunk = "";
                }
                
                // Découpage très basique par point
                // Attention: ce n'est pas parfait pour les abbréviations, mais suffisant pour B.7
                const sentences = para.split(/(?<=\.|\?|\!)\s+/);
                
                let currentSentenceChunk = "";
                for (let j = 0; j < sentences.length; j++) {
                    const sentence = sentences[j];
                    if (currentSentenceChunk.length + sentence.length + 1 > maxLength) {
                        if (currentSentenceChunk.length > 0) {
                            chunks.push({ content: currentSentenceChunk.trim(), index: currentIndex++ });
                            currentSentenceChunk = "";
                        }
                        // Si une phrase seule dépasse maxLength, on la coupe brutalement (fallback)
                        if (sentence.length > maxLength) {
                            let remaining = sentence;
                            while (remaining.length > maxLength) {
                                chunks.push({ content: remaining.substring(0, maxLength).trim(), index: currentIndex++ });
                                remaining = remaining.substring(maxLength);
                            }
                            currentSentenceChunk = remaining;
                        } else {
                            currentSentenceChunk = sentence;
                        }
                    } else {
                        currentSentenceChunk += (currentSentenceChunk ? " " : "") + sentence;
                    }
                }
                if (currentSentenceChunk.length > 0) {
                    chunks.push({ content: currentSentenceChunk.trim(), index: currentIndex++ });
                }
            } else {
                // Le paragraphe rentre dans maxLength
                if (currentChunk.length + para.length + 2 > maxLength) {
                    chunks.push({ content: currentChunk.trim(), index: currentIndex++ });
                    currentChunk = para;
                } else {
                    currentChunk += (currentChunk ? "\n\n" : "") + para;
                }
            }
        }
        
        if (currentChunk.trim().length > 0) {
            chunks.push({ content: currentChunk.trim(), index: currentIndex++ });
        }
        
        return chunks;
    }
}
