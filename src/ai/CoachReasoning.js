export class CoachReasoning {
    /**
     * Analyse le contexte et produit des décisions.
     * @param {Object} context 
     * @returns {Array} Liste d'objets Decision
     */
    static analyze(context) {
        const decisions = [];
        
        if (!context) return decisions;

        const { academic, planning, riskProfile } = context;
        const now = new Date();

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
                        const evTitle = (ev.title || '').toLowerCase();
                        if (ev.type !== 'revision' && ev.type !== 'Revision' && !evTitle.includes('révision') && !evTitle.includes('revision')) return false;
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
                        rationale: `L'évaluation '${ass.title}' (${ass.targetDate}) est passée et n'a pas encore de note. As-tu des notes à me donner pour ${ass.subjectName && ass.subjectName !== 'Unknown Subject' ? ass.subjectName : ass.title} ? Réponds-moi dans le chat (ex. « 14/20 »).`,
                        payload: { assessment: ass }
                    }
                });
            });
        }

        // 4.5. Suivi des Projets (Check-in)
        if (context.projects && context.projects.length > 0) {
            context.projects.forEach(p => {
                if (p.status === 'active' && p.progress < 100) {
                    const isPlanned = planning && planning.events && planning.events.some(ev => ev.projectId === p.id && new Date(ev.date) >= now);
                    if (!isPlanned) {
                        decisions.push({
                            signal: { type: "PROJECT_STAGNATING", projectId: p.id, evidence: ["no_future_events"] },
                            decision: {
                                type: "ASK_PROJECT_STATUS",
                                severity: "info",
                                priority: "low",
                                rationale: `Le projet '${p.title}' est actif mais aucune session n'est planifiée. Où en es-tu ?`,
                                payload: { project: p }
                            }
                        });
                    }
                }
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

        // 7. Boucle cours ↔ évaluations ↔ planning (seulement si l'avancement des cours est fourni par l'App)
        const courses = context.courses || null;
        if (courses) {
            const bySubject = courses.bySubject || {};
            const today = context.currentDate;
            // 7a. Compte à rebours jusqu'à chaque évaluation proche : rappel quotidien jusqu'au jour J
            (academic && academic.upcomingAssessments ? academic.upcomingAssessments : []).forEach(ass => {
                if (!ass.targetDate || ass.daysRemaining === null || ass.daysRemaining === undefined || ass.daysRemaining > 14) return;
                const p = ass.subjectId ? bySubject[ass.subjectId] : null;
                const revisions = (planning && planning.events ? planning.events : []).filter(ev => ev.assessmentId === ass.id
                    && (ev.type === 'revision' || /r[ée]vision/i.test(ev.title || '')) && ev.date && ev.date >= today && ev.date <= ass.targetDate).length;
                const when = ass.daysRemaining <= 0 ? "aujourd'hui" : (ass.daysRemaining === 1 ? 'demain' : `dans ${ass.daysRemaining} jours`);
                const progressTxt = p && p.hoursTotal ? (p.finished ? ` Cours terminé (${p.hoursDone} h / ${p.hoursTotal} h).` : ` Cours : ${p.hoursDone} h / ${p.hoursTotal} h (${p.percent} %).`) : '';
                decisions.push({
                    signal: { type: "EXAM_COUNTDOWN", assessmentId: ass.id, evidence: [`targetDate=${ass.targetDate}`, `revisions=${revisions}`] },
                    decision: {
                        type: "REMIND_UPCOMING_ASSESSMENT",
                        severity: ass.daysRemaining <= 3 ? "warning" : "info",
                        priority: ass.daysRemaining <= 3 ? "high" : "medium",
                        rationale: `Rappel : ${ass.title} ${when} (${ass.targetDate}).${progressTxt} Révisions planifiées d'ici là : ${revisions}.`,
                        payload: { assessment: ass, progress: p || null, revisions }
                    }
                });
            });
            // 7b. Cours terminé sans note : le coach demande les notes (les évaluations passées sont traitées en 4.)
            (courses.gradeRequests || []).filter(r => r.kind === 'finished_course').forEach(r => {
                decisions.push({
                    signal: { type: "GRADE_REQUEST", evidence: [`request=${r.key}`] },
                    decision: {
                        type: "ASK_FOR_GRADES",
                        severity: "info",
                        priority: "medium",
                        rationale: `Le cours ${r.label} est terminé${r.hoursTotal ? ` (${r.hoursTotal} h)` : ''}. As-tu des notes à me donner pour ${r.label} ? Réponds-moi dans le chat (ex. « 14/20 »), ou annonce-moi la date de l'examen.`,
                        payload: { request: r }
                    }
                });
            });
            // 7c. Emploi du temps de la semaine à importer (le dimanche : semaine suivante)
            const tt = courses.timetable || null;
            if (tt && tt.needsImport) {
                const [y, m, d] = String(tt.targetWeekStart || '').split('-');
                const weekLabel = d ? `${d}/${m}` : tt.targetWeekStart;
                decisions.push({
                    signal: { type: "TIMETABLE_IMPORT", evidence: [`week=${tt.targetWeekStart}`] },
                    decision: {
                        type: "REMIND_TIMETABLE_IMPORT",
                        severity: "info",
                        priority: tt.isSunday ? "high" : "medium",
                        rationale: tt.isSunday
                            ? `C'est dimanche : importe l'emploi du temps de la semaine du ${weekLabel} (Planning → « Importer l'emploi du temps (PDF) ») pour que je suive tes cours.`
                            : `Je n'ai pas l'emploi du temps de cette semaine (du ${weekLabel}). Importe-le depuis Planning → « Importer l'emploi du temps (PDF) » pour que je suive tes cours.`,
                        payload: { timetable: tt }
                    }
                });
            }
        }

        // 6. Diagnostic de Procrastination (Risk Engine)
        if (riskProfile && riskProfile.level !== 'LOW') {
            decisions.push({
                signal: {
                    type: "PROCRASTINATION_RISK",
                    evidence: riskProfile.factors.map(f => f.type)
                },
                decision: {
                    type: "ADDRESS_PROCRASTINATION_RISK",
                    severity: riskProfile.level === 'CRITICAL' ? "high" : "warning",
                    priority: riskProfile.level === 'CRITICAL' ? "critical" : "high",
                    rationale: `Risque de procrastination détecté (${riskProfile.level}). Facteurs principaux: ${riskProfile.factors.map(f => f.description).join(', ')}`,
                    payload: { riskProfile }
                }
            });
        }

        // Tri et Priorisation Déterministe
        const priorityMap = {
            "PROCRASTINATION_RISK": 1,
            "PAST_DUE_ASSESSMENT": 2,
            "EXAM_COUNTDOWN": 2.5,
            "GRADE_REQUEST": 2.6,
            "TIMETABLE_IMPORT": 4.5,
            "SCHEDULE_CONFLICT": 3,
            "UNPREPARED_ASSESSMENT": 4,
            "ACADEMIC_ALERT_ACTIVE": 5,
            "CECT_DISCREPANCY": 6,
            "ASSESSMENT_MISSING_DATE": 7,
            "AVAILABLE_TIME_SLOT": 8
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
