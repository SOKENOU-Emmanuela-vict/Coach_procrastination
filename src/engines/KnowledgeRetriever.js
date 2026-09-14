import { TextNormalizer } from './TextNormalizer.js';

/**
 * KnowledgeRetriever
 * Responsabilité : Recherche, scoring, filtrage et construction de contexte borné.
 * DATA > RETRIEVAL > CONTEXT > COMMAND
 */
export class KnowledgeRetriever {
    constructor(knowledgeEngine) {
        this.knowledgeEngine = knowledgeEngine;
    }

    /**
     * Recherche de base (Scoring Lexical déterministe)
     */
    async search(query, options = {}) {
        if (!query || query.trim() === '') return [];
        
        const allChunks = await this.knowledgeEngine.getChunks();
        const allDocs = await this.knowledgeEngine.getDocuments();
        
        // Normalisation de la query (mots-clés)
        const keywords = TextNormalizer.normalize(query).toLowerCase().split(' ').filter(w => w.length > 2);
        if (keywords.length === 0) return [];

        const results = [];
        
        for (const chunk of allChunks) {
            // Filtrage optionnel
            if (options.subjectId || options.assessmentId || options.projectId || options.taskId) {
                const doc = allDocs.find(d => d.id === chunk.documentId);
                if (!doc || !doc.linkedTo) continue;
                
                if (options.subjectId && doc.linkedTo.subjectId !== options.subjectId) continue;
                if (options.assessmentId && doc.linkedTo.assessmentId !== options.assessmentId) continue;
                if (options.projectId && doc.linkedTo.projectId !== options.projectId) continue;
                if (options.taskId && doc.linkedTo.taskId !== options.taskId) continue;
            }

            // Scoring Lexical (Term Frequency basique)
            const text = chunk.content.toLowerCase();
            let score = 0;
            
            for (const kw of keywords) {
                // Compter les occurrences non-chevauchantes
                const regex = new RegExp(kw, 'g');
                const matches = text.match(regex);
                if (matches) {
                    score += matches.length;
                }
            }
            
            if (score > 0) {
                results.push({
                    chunk: chunk,
                    score: score
                });
            }
        }
        
        // Tri Déterministe: par score, puis par documentId, puis par index
        results.sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score;
            if (a.chunk.documentId !== b.chunk.documentId) return a.chunk.documentId.localeCompare(b.chunk.documentId);
            return a.chunk.index - b.chunk.index;
        });
        
        return results;
    }

    /**
     * Construit un contexte borné pour éviter l'explosion de tokens (maxChunks, maxCharacters)
     */
    async getRelevantContext(query, options = {}) {
        const maxChunks = options.maxChunks || 5;
        const maxCharacters = options.maxCharacters || 4000;
        const searchOptions = {
            subjectId: options.subjectId,
            assessmentId: options.assessmentId,
            projectId: options.projectId,
            taskId: options.taskId
        };
        
        const searchResults = await this.search(query, searchOptions);
        
        const boundedChunks = [];
        let totalChars = 0;
        
        for (const res of searchResults) {
            if (boundedChunks.length >= maxChunks) break;
            if (totalChars + res.chunk.content.length > maxCharacters) break;
            
            boundedChunks.push(res.chunk);
            totalChars += res.chunk.content.length;
        }
        
        return boundedChunks;
    }
}
