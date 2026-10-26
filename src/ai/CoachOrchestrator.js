import { CoachContextBuilder } from './CoachContext.js';
import { CoachAI } from './CoachAI.js';
import { PlanningAI } from './PlanningAI.js';
import { GeminiProvider } from './GeminiProvider.js';

export class CoachOrchestrator {
    constructor(planningIntelligence, knowledgeRetriever = null, riskEngine = null) {
        this.riskEngine = riskEngine;
        let apiKey = null;
        if (typeof window !== 'undefined' && window.localStorage && typeof window.localStorage.getItem === 'function' && window.localStorage.getItem('gemini_api_key')) {
            apiKey = String(window.localStorage.getItem('gemini_api_key')).trim() || null;
        } else if (typeof process !== 'undefined' && process.env && process.env.GEMINI_API_KEY) {
            apiKey = String(process.env.GEMINI_API_KEY).trim() || null;
        }

        const llmProvider = apiKey ? new GeminiProvider(apiKey) : null;
        this.llmProvider = llmProvider; // réutilisé pour la lecture de l'emploi du temps (même clé, aucune nouvelle source)
        this.coachAI = new CoachAI(llmProvider, knowledgeRetriever); 
        this.planningAI = new PlanningAI(planningIntelligence);
    }

    /**
     * Point d'entrée principal de l'intelligence du Coach.
     * Construit le contexte, raisonne, et produit des recommandations.
     * @param {Object} data - Les données brutes fournies par l'application
     * @param {string} query - Requête utilisateur (optionnelle)
     * @returns {Promise<Array>} Liste de recommandations actionnables ou informatives
     */
    async getInsights(data, query = null) {
        // 1. Snapshot du contexte
        const context = CoachContextBuilder.build(data);
        
        // 1.5 Diagnostic de Procrastination (Risk Engine)
        if (this.riskEngine) {
            context.riskProfile = await this.riskEngine.evaluateRisk(context);
        }
        
        // 2. CoachAI détermine QUOI faire et POURQUOI
        const rawRecommendations = await this.coachAI.analyze(context, query);
        
        // 3. PlanningAI détermine OÙ et QUAND (résolution temporelle)
        const actionableRecommendations = await this.planningAI.plan(rawRecommendations, context.planning);
        
        return actionableRecommendations;
    }
}
