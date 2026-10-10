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

        if (data.type !== "recommendation" && data.type !== "planning_intent" && data.type !== "checkin_intent") {
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
            // Seule la création est exécutable par PlanningEngine.executeIntent (pas de déplacement/suppression par l'IA).
            if (data.intent.action !== 'create') {
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

        if (data.type === "checkin_intent") {
            if (!data.intent || typeof data.intent !== 'object') {
                throw new Error("LLMDecision invalide: Intent manquant pour le type checkin_intent.");
            }
            if (data.intent.action !== 'save_checkin') {
                throw new Error("LLMDecision invalide: Action d'intent inconnue pour un bilan (attendu: save_checkin).");
            }
            if (data.intent.target && data.intent.target !== 'checkin') {
                throw new Error("LLMDecision invalide: Target d'intent invalide pour un bilan (attendu: checkin).");
            }
            const p = data.intent.payload;
            if (!p || typeof p !== 'object') {
                throw new Error("LLMDecision invalide: Payload du bilan manquant.");
            }
            if (p.energy !== undefined && !['low', 'medium', 'high'].includes(p.energy)) {
                throw new Error("LLMDecision invalide: Énergie du bilan invalide (low/medium/high).");
            }
            if (p.dayAssessment !== undefined && !['completed', 'partial', 'missed'].includes(p.dayAssessment)) {
                throw new Error("LLMDecision invalide: dayAssessment invalide (completed/partial/missed).");
            }
            if (p.sleep !== undefined && (typeof p.sleep !== 'object' || typeof p.sleep.durationMinutes !== 'number' || p.sleep.durationMinutes < 0)) {
                throw new Error("LLMDecision invalide: sleep.durationMinutes doit être un nombre positif.");
            }
            if (p.blockers !== undefined && !Array.isArray(p.blockers)) {
                throw new Error("LLMDecision invalide: blockers doit être un tableau.");
            }
        }

        return true;
    }
}
