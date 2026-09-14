/**
 * LLMDecision
 * Contrat strict pour valider la sortie d'un modèle LLM avant qu'elle n'atteigne le reste du système.
 */
export class LLMDecision {
    static validate(data) {
        if (!data) throw new Error("LLMDecision invalide: Données nulles.");
        
        if (data.version !== 1) {
            throw new Error(`LLMDecision invalide: Version non supportée (${data.version}).`);
        }

        if (data.type !== "recommendation" && data.type !== "planning_intent") {
            throw new Error(`LLMDecision invalide: Type inconnu (${data.type}).`);
        }

        if (typeof data.rationale !== 'string' || data.rationale.trim() === '') {
            throw new Error("LLMDecision invalide: Rationale manquant ou vide.");
        }

        if (!Array.isArray(data.evidence)) {
            throw new Error("LLMDecision invalide: Evidence doit être un tableau.");
        }
        
        data.evidence.forEach((ev, i) => {
            if (typeof ev !== 'object' || !ev.documentId) {
                throw new Error(`LLMDecision invalide: Evidence [${i}] malformée.`);
            }
        });

        if (data.type === "planning_intent") {
            if (!data.intent || typeof data.intent !== 'object') {
                throw new Error("LLMDecision invalide: Intent manquant pour le type planning_intent.");
            }
            
            // Basic structural validation of intent before passing to PlanningIntent validator
            if (data.intent.action !== 'create' && data.intent.action !== 'update' && data.intent.action !== 'delete') {
                throw new Error("LLMDecision invalide: Action d'intent inconnue.");
            }
            if (!data.intent.target) {
                throw new Error("LLMDecision invalide: Target d'intent manquant.");
            }
            if (data.intent.constraints) {
                throw new Error("LLMDecision invalide: Le LLM n'a pas l'autorité de fixer des contraintes temporelles (OÙ/QUAND).");
            }
            if (data.intent.payload) {
                const forbiddenKeys = ['date', 'startTime', 'endTime', 'start', 'end', 'constraints'];
                for (const key of forbiddenKeys) {
                    if (key in data.intent.payload) {
                        throw new Error(`LLMDecision invalide: Le champ temporel interdit '${key}' a été détecté dans le payload.`);
                    }
                }
            }
        }

        return true;
    }
}
