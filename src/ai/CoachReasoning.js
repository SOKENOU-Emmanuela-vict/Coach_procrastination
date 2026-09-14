export class CoachReasoning {
    /**
     * Analyse le contexte et produit des décisions.
     * @param {Object} context 
     * @returns {Array} Liste d'objets Decision
     */
    static analyze(context) {
        const decisions = [];
        
        if (!context) return decisions;

        const { academic, planning } = context;

        // 1. Relais des alertes académiques
        if (academic && academic.alerts) {
            academic.alerts.forEach(al => {
                decisions.push({
                    signal: {
                        type: "ACADEMIC_ALERT_ACTIVE",
                        evidence: [`alert_code_${al.code}`]
                    },
                    decision: {
                        type: "RELAY_ACADEMIC_ALERT",
                        severity: "warning",
                        priority: "high",
                        rationale: `L'alerte académique ${al.code} est active et doit être communiquée à l'utilisateur.`,
                        payload: { message: al.message }
                    }
                });
            });
        }
        
        // 2. Anomalie documentaire (CECT)
        if (academic && academic.cectStatus && academic.cectStatus.status === 'to_confirm') {
            decisions.push({
                signal: {
                    type: "CECT_DISCREPANCY",
                    evidence: ["cect_status_to_confirm"]
                },
                decision: {
                    type: "RECOMMEND_SECRETARIAT_CONTACT",
                    severity: "warning",
                    priority: "medium",
                    rationale: "Le CECT est en attente de confirmation (statut 'to_confirm'). Un contact avec le secrétariat est recommandé.",
                    payload: {}
                }
            });
        }

        // 3. Préparation aux évaluations (La nouvelle capacité structurée)
        if (academic && academic.upcomingAssessments) {
            academic.upcomingAssessments.forEach(ass => {
                // Évaluation sans date (Ignorée proprement pour la planification de révision)
                if (ass.targetDate === null || ass.targetDate === undefined) {
                    decisions.push({
                        signal: {
                            type: "ASSESSMENT_MISSING_DATE",
                            assessmentId: ass.id,
                            evidence: ["targetDate_null"]
                        },
                        decision: {
                            type: "RECOMMEND_SET_ASSESSMENT_DATE",
                            severity: "info",
                            priority: "low",
                            rationale: "L'évaluation n'a pas de date cible définie. Il est impossible d'anticiper la révision.",
                            payload: { assessment: ass }
                        }
                    });
                    return; // On arrête l'analyse pour cette évaluation
                }

                // Examen imminent sans préparation
                // Le seuil est fixé à 5 jours selon la règle d'origine
                if (ass.daysRemaining !== null && ass.daysRemaining <= 5) {
                    // Limite métier documentée : la règle vérifie seulement l'existence d'un Event de révision
                    // lié à cet assessmentId, sans vérifier si l'événement est dans le passé ou s'il est suffisamment long.
                    const isPlanned = planning && planning.events && planning.events.some(ev => {
                        if (ev.assessmentId !== ass.id) return false;
                        if (ev.type !== 'revision' && ev.type !== 'Revision' && !ev.title.toLowerCase().includes('révision') && !ev.title.toLowerCase().includes('revision')) return false;
                        if (!ev.date) return false; // Ne peut pas juger si c'est avant l'examen
                        // Vérifier que la révision a bien lieu avant ou le jour de l'examen
                        return new Date(ev.date) <= new Date(ass.targetDate);
                    });

                    if (!isPlanned) {
                        decisions.push({
                            signal: {
                                type: "UNPREPARED_ASSESSMENT",
                                assessmentId: ass.id,
                                evidence: ["assessment_within_threshold", "no_prior_preparation_event"]
                            },
                            decision: {
                                type: "RECOMMEND_ASSESSMENT_PREPARATION",
                                assessmentId: ass.id,
                                priority: "high",
                                severity: "high",
                                duration: 90, // targetDuration for the preparation
                                rationale: `L'évaluation '${ass.title}' a lieu dans ${ass.daysRemaining} jours et aucune session de révision n'est planifiée avant cette date.`,
                                payload: { assessment: ass }
                            }
                        });
                    }
                }
            });
        }

        // 4. Évaluations en retard (PAST_DUE_ASSESSMENT)
        if (academic && academic.pastDueAssessments) {
            academic.pastDueAssessments.forEach(ass => {
                decisions.push({
                    signal: {
                        type: "PAST_DUE_ASSESSMENT",
                        assessmentId: ass.id,
                        evidence: [
                            `targetDate=${ass.targetDate}`,
                            `currentDate=${context.currentDate}`
                        ]
                    },
                    decision: {
                        type: "REVIEW_PAST_DUE_ASSESSMENT",
                        severity: "high",
                        priority: "high",
                        rationale: `La date cible de l'évaluation '${ass.title}' (${ass.targetDate}) est dépassée par rapport à la date actuelle (${context.currentDate}).`,
                        payload: { assessment: ass }
                    }
                });
            });
        }

        // 5. Conflits d'agenda (SCHEDULE_CONFLICT)
        if (planning && planning.conflicts) {
            planning.conflicts.forEach(conflict => {
                if (conflict.type === 'CRITICAL_CONFLICT' || conflict.type === 'WARNING_CONFLICT') {
                    if (conflict.events && conflict.events.length === 2) {
                        decisions.push({
                            signal: {
                                type: "SCHEDULE_CONFLICT",
                                evidence: [
                                    `eventA=${conflict.events[0].id}`,
                                    `eventB=${conflict.events[1].id}`,
                                    `severity=${conflict.type}`
                                ]
                            },
                            decision: {
                                type: "RESOLVE_SCHEDULE_CONFLICT",
                                severity: conflict.type === 'CRITICAL_CONFLICT' ? 'high' : 'warning',
                                priority: conflict.type === 'CRITICAL_CONFLICT' ? 'high' : 'medium',
                                rationale: `Conflit d'agenda détecté entre '${conflict.events[0].title}' et '${conflict.events[1].title}'.`,
                                payload: { conflict }
                            }
                        });
                    }
                }
            });
        }

        // 6. Créneau de disponibilité (AVAILABLE_TIME_SLOT)
        if (planning && planning.availableSlots) {
            planning.availableSlots.forEach(slot => {
                if (slot.durationMinutes >= 45) {
                    decisions.push({
                        signal: {
                            type: "AVAILABLE_TIME_SLOT",
                            evidence: [
                                `date=${slot.date}`,
                                `startTime=${slot.startTime}`,
                                `endTime=${slot.endTime}`,
                                `duration=${slot.durationMinutes}`
                            ]
                        },
                        decision: {
                            type: "CONSIDER_AVAILABLE_SLOT",
                            severity: "info",
                            priority: "low",
                            rationale: `Un créneau de disponibilité de ${slot.durationMinutes} minutes a été identifié le ${slot.date} à ${slot.startTime}.`,
                            payload: { slot }
                        }
                    });
                }
            });
        }

        // Tri et Priorisation Déterministe
        const priorityMap = {
            "PAST_DUE_ASSESSMENT": 1,
            "SCHEDULE_CONFLICT": 2,
            "UNPREPARED_ASSESSMENT": 3,
            "ACADEMIC_ALERT_ACTIVE": 4,
            "CECT_DISCREPANCY": 5,
            "ASSESSMENT_MISSING_DATE": 6,
            "AVAILABLE_TIME_SLOT": 7
        };

        decisions.sort((a, b) => {
            const pA = priorityMap[a.signal.type] || 99;
            const pB = priorityMap[b.signal.type] || 99;
            if (pA !== pB) return pA - pB;
            // Si priorité égale, trier par evidence (déterministe)
            return a.signal.evidence.join('').localeCompare(b.signal.evidence.join(''));
        });

        return decisions;
    }
}
