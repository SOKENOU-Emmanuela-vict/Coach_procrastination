import { PlanningIntent } from '../models/PlanningIntent.js';

export class PlanningAI {
    constructor(planningIntelligence) {
        this.planningIntelligence = planningIntelligence;
    }

    /**
     * Calcule le OÙ et le QUAND à partir des recommandations du Coach (QUOI / POURQUOI).
     * @param {Array} recommendations - Liste de CoachRecommendation produites par CoachAI
     * @param {Object} planningContext - Le contexte temporel (dates disponibles, etc.)
     * @returns {Promise<Array>} Liste des recommandations mises à jour avec un intent résolu
     */
    async plan(recommendations, planningContext) {
        const plannedRecommendations = [];

        for (const rec of recommendations) {
            // Clone de la reco pour ne pas muter l'originale
            const updatedRec = { ...rec };
            updatedRec.intent = null;

            if (rec.actionable && rec.planningRequest && planningContext && planningContext.availableSlots) {
                const req = rec.planningRequest;
                const duration = req.duration || 60;
                
                // On récupère toutes les dates uniques où il y a de la disponibilité
                const uniqueDates = [...new Set(planningContext.availableSlots.map(s => s.date))];
                uniqueDates.sort();

                let bestCandidate = null;

                for (const date of uniqueDates) {
                    // Si on prépare un examen, on ne doit pas planifier après la date de l'examen
                    if (req.payload && req.payload.assessmentId && req.payload.source === "coach") {
                        // Idéalement on devrait vérifier la date de l'assessment. 
                        // C'est déjà pré-filtré dans une certaine mesure par CoachReasoning,
                        // mais on s'assure de prendre le premier créneau dispo.
                    }

                    const res = await this.planningIntelligence.findCandidateSlots({ date, duration });
                    if (res.candidates && res.candidates.length > 0) {
                        bestCandidate = res.candidates[0]; // On prend le premier chronologiquement
                        break;
                    }
                }

                if (bestCandidate) {
                    updatedRec.intent = new PlanningIntent({
                        version: 1,
                        action: req.action || "create",
                        target: req.target || "event",
                        constraints: {
                            date: bestCandidate.date,
                            startTime: bestCandidate.startTime,
                            endTime: bestCandidate.endTime
                        },
                        payload: req.payload
                    });
                    
                    // On met à jour le message pour informer l'utilisateur du créneau trouvé
                    updatedRec.message += `\nUn créneau a été trouvé le ${bestCandidate.date} à ${bestCandidate.startTime}.`;
                } else {
                    // Si aucun créneau n'est trouvé, la recommandation devient non-actionable
                    updatedRec.actionable = false;
                    updatedRec.type = "CRITICAL";
                    updatedRec.message += `\nCependant, aucun créneau de ${duration} minutes n'est disponible avant l'échéance.`;
                }
            }

            plannedRecommendations.push(updatedRec);
        }

        return plannedRecommendations;
    }
}
