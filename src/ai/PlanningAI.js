import { PlanningIntent } from '../models/PlanningIntent.js';
import { buildFlexibleConflictQuestion } from './FlexibleConflictDialog.js';

export class PlanningAI {
    constructor(planningIntelligence) {
        this.planningIntelligence = planningIntelligence;
    }

    /**
     * Calcule le OÙ et le QUAND à partir des recommandations du Coach (QUOI / POURQUOI).
     * Règles : jamais dans le passé (aujourd'hui → à partir de maintenant), jamais après l'échéance,
     * jamais deux recommandations sur le même créneau, jamais sur un événement verrouillé.
     * Créneaux totalement libres d'abord. S'il n'y en a aucun avant l'échéance, le meilleur créneau qui ne
     * chevauche que des événements FLEXIBLES est proposé sous forme de QUESTION (rec.flexibleConflict) :
     * pas d'intent ni de bouton « Accepter », l'utilisateur décide dans le chat (voir App.resolveFlexibleConflict).
     * @param {Array} recommendations - Liste de CoachRecommendation produites par CoachAI
     * @param {Object} planningContext - Le contexte temporel (créneaux disponibles, currentDate, now,
     *   availabilityDates : jours ayant des disponibilités, excludedSlots : créneaux déjà refusés)
     * @returns {Promise<Array>} Liste des recommandations mises à jour avec un intent résolu
     */
    async plan(recommendations, planningContext) {
        const plannedRecommendations = [];
        // créneaux attribués pendant cette passe (+ créneaux déjà refusés par l'utilisateur)
        const excludedSlots = (planningContext && Array.isArray(planningContext.excludedSlots)) ? planningContext.excludedSlots : [];
        const reserved = excludedSlots.map(s => ({ date: s.date, startTime: s.startTime, endTime: s.endTime }));
        const now = (planningContext && planningContext.now instanceof Date) ? planningContext.now : new Date();
        const todayStr = (planningContext && planningContext.currentDate) || now.toLocaleDateString('fr-CA');
        // Marge : on arrondit au quart d'heure suivant
        const nowMinutes = Math.ceil((now.getHours() * 60 + now.getMinutes()) / 15) * 15;
        // Séances d'un même groupe (ex. révisions d'un examen, planningRequest.spreadGroup) : jours différents d'abord
        const usedDatesByGroup = {};
        const spreadOrder = (dates, group) => {
            if (!group || !usedDatesByGroup[group]) return dates;
            const used = usedDatesByGroup[group];
            return dates.filter(d => !used.has(d)).concat(dates.filter(d => used.has(d)));
        };
        const markUsed = (group, date) => {
            if (!group) return;
            (usedDatesByGroup[group] = usedDatesByGroup[group] || new Set()).add(date);
        };

        for (const rec of recommendations) {
            // Clone de la reco pour ne pas muter l'originale
            const updatedRec = { ...rec };
            // Un intent de bilan (save_checkin) est déjà complet : PlanningAI n'a rien à résoudre.
            updatedRec.intent = (rec.intent && rec.intent.action === 'save_checkin') ? rec.intent : null;

            if (rec.actionable && rec.planningRequest && planningContext && planningContext.availableSlots) {
                const req = rec.planningRequest;
                const duration = req.duration || 60;
                const deadline = req.deadline || null; // YYYY-MM-DD de l'évaluation, si connue
                
                // Jamais dans le passé ; jamais après l'échéance : la révision doit avoir lieu AVANT le jour
                // de l'évaluation (exception : évaluation aujourd'hui → seul le reste de la journée est possible).
                const keepDate = (d) => d >= todayStr && (!deadline || d < deadline || (deadline === todayStr && d === todayStr));
                // On récupère toutes les dates uniques où il y a du temps totalement libre
                let uniqueDates = [...new Set(planningContext.availableSlots.map(s => s.date))];
                uniqueDates.sort();
                uniqueDates = uniqueDates.filter(keepDate);
                const group = req.spreadGroup || null;
                uniqueDates = spreadOrder(uniqueDates, group);

                let bestCandidate = null;

                for (const date of uniqueDates) {
                    const res = await this.planningIntelligence.findCandidateSlots({
                        date,
                        duration,
                        notBefore: date === todayStr ? nowMinutes : null,
                        subtractFlexible: true,
                        reserved
                    });
                    if (res.candidates && res.candidates.length > 0) {
                        bestCandidate = res.candidates[0]; // On prend le premier chronologiquement
                        break;
                    }
                }

                // Repli : aucun créneau totalement libre → créneau qui ne chevauche que des événements flexibles
                let flexCandidate = null;
                if (!bestCandidate && typeof this.planningIntelligence.findSlotsOverlappingFlexible === 'function') {
                    const flexDates = spreadOrder([...new Set((planningContext.availabilityDates || []).concat(uniqueDates))].sort().filter(keepDate), group);
                    for (const date of flexDates) {
                        const res = await this.planningIntelligence.findSlotsOverlappingFlexible({
                            date,
                            duration,
                            notBefore: date === todayStr ? nowMinutes : null,
                            reserved,
                            excludeAssessmentId: (req.payload && req.payload.assessmentId) || null
                        });
                        const found = (res.candidates || []).find(c => c.overlappingFlexible && c.overlappingFlexible.length > 0);
                        if (found) { flexCandidate = found; break; }
                    }
                }

                if (bestCandidate) {
                    reserved.push({ date: bestCandidate.date, startTime: bestCandidate.startTime, endTime: bestCandidate.endTime });
                    markUsed(group, bestCandidate.date);
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
                } else if (flexCandidate) {
                    // On ne planifie pas en silence par-dessus un événement flexible : le coach pose la question.
                    reserved.push({ date: flexCandidate.date, startTime: flexCandidate.startTime, endTime: flexCandidate.endTime });
                    markUsed(group, flexCandidate.date);
                    const intent = new PlanningIntent({
                        version: 1,
                        action: req.action || "create",
                        target: req.target || "event",
                        constraints: {
                            date: flexCandidate.date,
                            startTime: flexCandidate.startTime,
                            endTime: flexCandidate.endTime
                        },
                        payload: req.payload
                    });
                    updatedRec.actionable = false; // pas d'acceptation en un clic : la décision se prend dans le chat
                    updatedRec.type = "WARNING";
                    updatedRec.flexibleConflict = {
                        intent: { version: intent.version, action: intent.action, target: intent.target, constraints: intent.constraints, payload: intent.payload },
                        overlappingFlexible: flexCandidate.overlappingFlexible,
                        planningRequest: req,
                        deadline,
                        duration,
                        title: (req.payload && req.payload.title) || rec.title || 'Session',
                        excludedSlots
                    };
                    updatedRec.message += `\n` + buildFlexibleConflictQuestion({ candidate: flexCandidate, deadline, duration, excluded: excludedSlots.length > 0 });
                } else {
                    // Si aucun créneau n'est trouvé, la recommandation devient non-actionable
                    updatedRec.actionable = false;
                    updatedRec.type = "CRITICAL";
                    const other = excludedSlots.length > 0 ? 'aucun autre créneau' : 'aucun créneau';
                    updatedRec.message += deadline
                        ? `\nCependant, ${other} libre de ${duration} minutes n'existe entre maintenant et l'échéance (${deadline}). Ajoute des disponibilités dans le Calendrier.`
                        : `\nCependant, ${other} libre de ${duration} minutes n'est disponible dans les prochains jours. Ajoute des disponibilités dans le Calendrier.`;
                }
            }

            plannedRecommendations.push(updatedRec);
        }

        return plannedRecommendations;
    }
}
