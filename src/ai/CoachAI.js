import { CoachReasoning } from './CoachReasoning.js';
import { CoachLLMReasoning } from './CoachLLMReasoning.js';

export class CoachAI {
    constructor(llmProvider = null, knowledgeRetriever = null) {
        this.llmReasoning = llmProvider ? new CoachLLMReasoning(llmProvider, knowledgeRetriever) : null;
    }

    /**
     * Analyse la situation (QUOI / POURQUOI) et formule des recommandations.
     * @param {Object} context - Le CoachContext contenant les données brutes
     * @param {string} query - Requête optionnelle pour le LLM/RAG
     * @returns {Promise<Array>} Liste de CoachRecommendation
     */
    async analyze(context, query = null) {
        const recommendations = [];

        // 1. Raisonnement Déterministe (Règles métier dures)
        const deterministicDecisions = CoachReasoning.analyze(context);
        
        for (const item of deterministicDecisions) {
            const decision = item.decision;
            const signal = item.signal;
            
            let rec = {
                id: `coach_det_${decision.type}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                type: decision.severity === 'high' ? 'CRITICAL' : (decision.severity === 'warning' ? 'WARNING' : 'INFO'),
                title: this._getDefaultTitle(decision),
                message: decision.rationale,
                evidence: signal.evidence,
                actionable: false,
                planningRequest: null
            };

            // Mapping spécifique
            if (decision.type === "RECOMMEND_ASSESSMENT_PREPARATION") {
                rec.type = "SUGGESTION";
                rec.actionable = true;
                rec.planningRequest = {
                    action: "create",
                    target: "event",
                    duration: decision.duration || 90,
                    payload: {
                        title: `Révision ${decision.payload.assessment.subjectName || ''}`.trim(),
                        type: "revision",
                        duration: decision.duration || 90,
                        targetDuration: decision.duration || 90,
                        lockStatus: "flexible",
                        priority: decision.priority || "high",
                        subjectId: decision.payload.assessment.subjectId || null,
                        assessmentId: decision.payload.assessment.id,
                        source: "coach"
                    }
                };
                rec.message = `L'évaluation '${decision.payload.assessment.title}' approche. Il est recommandé de planifier une session de révision de ${rec.planningRequest.duration} minutes.`;
            } else if (decision.type === "RELAY_ACADEMIC_ALERT") {
                rec.message = decision.payload.message;
            }

            recommendations.push(rec);
        }

        // 2. Raisonnement LLM (Optionnel, enrichissement ou requêtes complexes)
        if (this.llmReasoning) {
            try {
                const llmDecision = await this.llmReasoning.analyze(context, query);
                
                // On s'attend à ce que le LLM retourne une "recommendation" ou un "planning_intent" (qui devient un planningRequest abstrait)
                let rec = {
                    id: `coach_llm_${Date.now()}`,
                    type: "SUGGESTION",
                    title: "Conseil de l'IA",
                    message: llmDecision.rationale,
                    evidence: (llmDecision.evidence || []).map(e => `doc:${e.documentId}`),
                    actionable: false,
                    planningRequest: null
                };

                if (llmDecision.type === "planning_intent" && llmDecision.intent) {
                    rec.actionable = true;
                    // On retire volontairement toute date ou contrainte stricte que le LLM aurait pu halluciner
                    rec.planningRequest = {
                        action: llmDecision.intent.action,
                        target: llmDecision.intent.target,
                        duration: llmDecision.intent.payload?.duration || 60,
                        payload: llmDecision.intent.payload
                    };
                    rec.message += ` Je recommande de planifier cela (${rec.planningRequest.duration} min).`;
                }

                recommendations.push(rec);
            } catch (e) {
                console.warn("CoachAI: Échec du raisonnement LLM, fallback sur déterministe uniquement.", e);
            }
        }

        return recommendations;
    }

    _getDefaultTitle(decision) {
        switch (decision.type) {
            case "RELAY_ACADEMIC_ALERT": return "Alerte Académique";
            case "RECOMMEND_SECRETARIAT_CONTACT": return "Anomalie Documentaire";
            case "RECOMMEND_SET_ASSESSMENT_DATE": return "Date d'évaluation manquante";
            case "RECOMMEND_ASSESSMENT_PREPARATION": return "Examen imminent";
            case "REVIEW_PAST_DUE_ASSESSMENT": return "Évaluation passée";
            case "RESOLVE_SCHEDULE_CONFLICT": return "Conflit d'agenda";
            case "CONSIDER_AVAILABLE_SLOT": return "Créneau de disponibilité";
            default: return "Recommandation";
        }
    }
}
