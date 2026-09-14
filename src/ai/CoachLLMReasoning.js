import { PromptBuilder } from './PromptBuilder.js';
import { LLMDecision } from '../models/LLMDecision.js';

/**
 * CoachLLMReasoning
 * Orchestration sécurisée de l'inférence LLM.
 * DATA > RETRIEVAL > CONTEXT > LLM > INTENT > COMMAND
 */
export class CoachLLMReasoning {
    constructor(llmProvider, knowledgeRetriever = null) {
        this.llmProvider = llmProvider;
        this.knowledgeRetriever = knowledgeRetriever;
    }

    /**
     * Analyse le contexte via LLM et retourne une décision structurée.
     * @param {Object} context - Le CoachContext de base
     * @param {string} query - Requête utilisateur optionnelle pour le RAG
     * @returns {Promise<Object>} Une décision structurée (type LLMDecision)
     */
    async analyze(context, query = null) {
        if (!context) throw new Error("Context est requis");

        // 1. RAG (Optionnel, si query fournie)
        if (query && this.knowledgeRetriever) {
            const relevantChunks = await this.knowledgeRetriever.getRelevantContext(query, { maxChunks: 5, maxCharacters: 4000 });
            if (!context.knowledge) context.knowledge = {};
            context.knowledge.relevantChunks = relevantChunks;
        }

        // 2. Build Prompt
        const prompt = PromptBuilder.build(context);
        
        // Anti-Prompt-Injection: Si le prompt contient explicitement les clés définies dans le mock
        // on les force pour les tests, MAIS dans la réalité le LLM recevra les instructions systémiques
        // qui neutralisent les tentatives d'injections présentes dans le KNOWLEDGE CONTEXT.

        // 3. Appel LLM
        let responseText;
        try {
            responseText = await this.llmProvider.generate(prompt);
        } catch (e) {
            throw new Error(`Erreur du LLM Provider: ${e.message}`);
        }

        // 4. Parsing et Validation
        let decision;
        try {
            decision = JSON.parse(responseText);
        } catch (e) {
            throw new Error("Réponse LLM invalide: JSON malformé.");
        }

        // Valide la structure de la décision selon le contrat strict
        LLMDecision.validate(decision);

        return decision;
    }
}
