import { LLMProvider } from './LLMProvider.js';

/**
 * Mock déterministe pour tester la fondation LLM.
 */
export class MockLLMProvider extends LLMProvider {
    constructor() {
        super();
    }

    async generate(prompt, options = {}) {
        // Le mock analyse la présence de mots-clés dans le prompt pour retourner des cas précis.
        
        if (prompt.includes("SCENARIO_JSON_INVALID")) {
            return "{ type: 'planning_intent', rationale: "; // Malformed JSON
        }
        
        if (prompt.includes("SCENARIO_VERSION_INVALID")) {
            return JSON.stringify({
                version: 99,
                type: "recommendation",
                rationale: "Mauvaise version",
                evidence: []
            });
        }
        
        if (prompt.includes("SCENARIO_INTENT_INVALID")) {
            return JSON.stringify({
                version: 1,
                type: "planning_intent",
                rationale: "L'action est inconnue",
                evidence: [],
                intent: {
                    action: "unknown_action",
                    target: "event"
                }
            });
        }
        
        if (prompt.includes("SCENARIO_INTENT_REJECTED")) {
            // Intent formellement valide, mais qui sera rejeté par PlanningEngine
            // (ex: sujet inexistant)
            return JSON.stringify({
                version: 1,
                type: "planning_intent",
                rationale: "Création d'un intent qui échouera à l'exécution",
                evidence: [],
                intent: {
                    action: "create",
                    target: "event",
                    payload: {
                        title: "Révision Inconnue",
                        subjectId: "sub_invalid", // Sujet inexistant
                        duration: 60
                    }
                }
            });
        }

        if (prompt.includes("SCENARIO_CONFLICT")) {
            return JSON.stringify({
                version: 1,
                type: "planning_intent",
                rationale: "Création avec contrainte temporelle (INTERDIT)",
                evidence: [],
                intent: {
                    action: "create",
                    target: "event",
                    constraints: { // DOIT ÊTRE REJETÉ PAR LLMDecision
                        date: "2026-09-12",
                        startTime: "09:00"
                    },
                    payload: {
                        title: "Révision Conflit",
                        duration: 60,
                        isFlexible: false
                    }
                }
            });
        }

        if (prompt.includes("SCENARIO_EVIDENCE")) {
            return JSON.stringify({
                version: 1,
                type: "recommendation",
                rationale: "Selon le document, voici une explication.",
                evidence: [
                    { documentId: "doc_mock", pageStart: 5, pageEnd: 5 }
                ],
                intent: null
            });
        }
        
        if (prompt.includes("SCENARIO_VALID_INTENT")) {
            return JSON.stringify({
                version: 1,
                type: "planning_intent",
                rationale: "Création d'un événement valide",
                evidence: [],
                intent: {
                    action: "create",
                    target: "event",
                    payload: {
                        title: "Révision Générée par LLM",
                        duration: 60,
                        isFlexible: true
                    }
                }
            });
        }

        // SCENARIO_A : Recommandation valide par défaut
        return JSON.stringify({
            version: 1,
            type: "recommendation",
            rationale: "Ceci est une recommandation générale générée par le Mock.",
            evidence: [],
            intent: null
        });
    }
}
