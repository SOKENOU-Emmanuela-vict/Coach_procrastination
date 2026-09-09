export class LearningCoachEngine {
    constructor() {}

    generateInsights(context) {
        const recommendations = [];

        if (!context) return recommendations;

        const { academicSummary, temporal, userContext, analytics } = context;

        // --- Règles Analytics (Ancien Coach V0) ---
        if (analytics) {
            if (analytics.regularity >= 6) {
                recommendations.push({
                    id: "analytics_regularity_high",
                    type: "SUCCESS",
                    title: "Régularité exemplaire",
                    message: "Continue comme ça !",
                    actionable: false,
                    suggestedEvent: null
                });
            } else if (analytics.regularity < 3) {
                recommendations.push({
                    id: "analytics_regularity_low",
                    type: "WARNING",
                    title: "Attention à la régularité",
                    message: "Essaie de faire au moins 15 min par jour pour maintenir l'élan.",
                    actionable: false,
                    suggestedEvent: null
                });
            }

            const skillDistribution = analytics.skillDistribution || {};
            if (skillDistribution['cyber_linux'] && skillDistribution['cyber_linux'] > 120 && (!skillDistribution['english_speaking'] || skillDistribution['english_speaking'] < 30)) {
                recommendations.push({
                    id: "analytics_skill_imbalance",
                    type: "WARNING",
                    title: "Déséquilibre de compétences",
                    message: "Tu as beaucoup pratiqué Linux cette semaine, mais l'Anglais a été négligé.",
                    actionable: false,
                    suggestedEvent: null
                });
            }
        }

        // --- Règles Académiques & Temporelles (Coach V1) ---

        // R5: Relais des alertes académiques
        if (academicSummary && academicSummary.alerts) {
            academicSummary.alerts.forEach(al => {
                recommendations.push({
                    id: `acad_alert_${al.code}`,
                    type: "WARNING", // Relayons en WARNING par précaution
                    title: "Alerte Académique",
                    message: al.message,
                    actionable: false,
                    suggestedEvent: null
                });
            });
        }
        
        if (academicSummary && academicSummary.cectStatus && academicSummary.cectStatus.status === 'to_confirm') {
            recommendations.push({
                id: "acad_cect_discrepancy",
                type: "WARNING",
                title: "Anomalie Documentaire",
                message: "Rapproche-toi du secrétariat : tes CECT comportent des anomalies.",
                actionable: false,
                suggestedEvent: null
            });
        }

        if (academicSummary && academicSummary.upcomingAssessments) {
            academicSummary.upcomingAssessments.forEach(ass => {
                // R6: Évaluation sans date
                if (ass.targetDate === null || ass.targetDate === undefined) {
                    recommendations.push({
                        id: `eval_nodate_${ass.title.replace(/\s+/g, '_')}`,
                        type: "INFO",
                        title: `Date manquante : ${ass.title}`,
                        message: `N'oublie pas de saisir la date de ton prochain examen de ${ass.subjectName}.`,
                        actionable: false,
                        suggestedEvent: null
                    });
                    return; // Passe au suivant
                }

                // Check if imminent
                if (ass.daysRemaining !== null && ass.daysRemaining <= 5) {
                    // Check if already planned (must be a revision event)
                    const existingEvents = temporal && temporal.events ? temporal.events : [];
                    const isPlanned = existingEvents.some(ev => ev.assessmentId === ass.id && (ev.type === 'revision' || ev.type === 'Revision'));

                    if (isPlanned) {
                        // R2: Évaluation déjà planifiée
                        recommendations.push({
                            id: `eval_${ass.id}_planned`,
                            type: "SUCCESS",
                            title: `Révision planifiée : ${ass.title}`,
                            message: `Tu as prévu tes révisions pour ${ass.subjectName}, bien joué.`,
                            actionable: false,
                            suggestedEvent: null
                        });
                    } else {
                        // R1: Évaluation imminente sans révision
                        
                        // Cherche un créneau dispo (R3 + R10)
                        let suggestedSlot = null;
                        if (temporal && temporal.availableSlots && temporal.availableSlots.length > 0) {
                            // R10.1 & R10.3: Filtrer durée suffisante et date avant l'évaluation
                            let candidates = temporal.availableSlots.filter(s => {
                                if (s.durationMinutes < 60) return false;
                                const diff = new Date(ass.targetDate) - new Date(s.date);
                                return diff >= 0; // Le créneau doit être avant ou le jour même de l'évaluation
                            });

                            if (candidates.length > 0) {
                                // Tri selon R10.4, R10.1, R10.5
                                candidates.sort((a, b) => {
                                    // 1. Proximité avec l'évaluation (R10.4) - Ascendant
                                    const diffA = new Date(ass.targetDate) - new Date(a.date);
                                    const diffB = new Date(ass.targetDate) - new Date(b.date);
                                    if (diffA !== diffB) return diffA - diffB;
                            
                                    // 2. Durée (R10.1) - Descendant
                                    if (a.durationMinutes !== b.durationMinutes) return b.durationMinutes - a.durationMinutes;
                            
                                    // 3. Égalité date (R10.5) - Ascendant
                                    const dateComp = a.date.localeCompare(b.date);
                                    if (dateComp !== 0) return dateComp;
                            
                                    // 4. Égalité heure (R10.5) - Ascendant
                                    return a.startTime.localeCompare(b.startTime);
                                });

                                suggestedSlot = candidates[0];
                            }
                        }

                        if (suggestedSlot) {
                            // R3: Proposition d'un créneau
                            recommendations.push({
                                id: `eval_${ass.id}_no_plan`,
                                type: "SUGGESTION",
                                title: `Examen imminent : ${ass.title}`,
                                message: `Examen dans ${ass.daysRemaining} jours sans révision. Un créneau optimal est disponible le ${suggestedSlot.date} à ${suggestedSlot.startTime}. Veux-tu planifier une session ?`,
                                actionable: true,
                                suggestedEvent: {
                                    id: `suggested_rev_${ass.id}_${suggestedSlot.date}_${suggestedSlot.startTime.replace(':','')}`,
                                    type: "revision",
                                    date: suggestedSlot.date,
                                    startTime: suggestedSlot.startTime,
                                    endTime: suggestedSlot.endTime,
                                    lockStatus: "flexible",
                                    priority: "high",
                                    subjectId: ass.subjectId || null,
                                    assessmentId: ass.id,
                                    semesterId: userContext && userContext.currentSemesterId ? userContext.currentSemesterId : null,
                                    source: "coach"
                                }
                            });
                            
                        } else {
                            // R4: Agenda saturé
                            recommendations.push({
                                id: `eval_${ass.id}_no_plan`,
                                type: "CRITICAL",
                                title: `Urgence : ${ass.title}`,
                                message: `Alerte : Examen proche dans ${ass.daysRemaining} jours mais aucun créneau de travail exploitable n'est actuellement disponible. Envisage de libérer du temps !`,
                                actionable: false,
                                suggestedEvent: null
                            });
                        }
                    }
                }
            });
        }

        return recommendations;
    }
}
