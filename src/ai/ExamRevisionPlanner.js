/**
 * Règles de préparation d'une évaluation (QUOI / COMBIEN) ; PlanningAI décide ensuite OÙ / QUAND.
 * Plus le cours est avancé (heures faites selon l'emploi du temps), plus il y a de matière à réviser :
 *  - cours terminé ou ≥ 80 % : 3 séances de 90 min ;
 *  - ≥ 40 % (ou ≥ 10 h faites) : 2 séances de 90 min ;
 *  - < 40 % : 1 séance de 60 min ;
 *  - avancement inconnu (emploi du temps non importé) : 2 séances de 60 min.
 * Jamais plus de séances que de jours disponibles avant l'évaluation (au moins 1).
 */
export class ExamRevisionPlanner {
    static target({ daysRemaining = null, progress = null } = {}) {
        let sessions, duration, emphasis;
        if (!progress || !(progress.hoursTotal > 0)) {
            sessions = 2; duration = 60; emphasis = 'unknown';
        } else if (progress.finished || progress.percent >= 80) {
            sessions = 3; duration = 90; emphasis = 'high';
        } else if (progress.percent >= 40 || progress.hoursDone >= 10) {
            sessions = 2; duration = 90; emphasis = 'medium';
        } else {
            sessions = 1; duration = 60; emphasis = 'low';
        }
        if (Number.isFinite(daysRemaining)) sessions = Math.max(1, Math.min(sessions, daysRemaining));
        return { sessions, duration, emphasis };
    }

    static progressText(progress) {
        if (!progress || !(progress.hoursTotal > 0)) return "Je n'ai pas encore l'avancement de ce cours (importe ton emploi du temps pour que j'en tienne compte).";
        if (progress.finished) return `Le cours est terminé (${progress.hoursDone} h / ${progress.hoursTotal} h) : il y a tout le programme à revoir.`;
        return `Le cours en est à ${progress.hoursDone} h sur ${progress.hoursTotal} (${progress.percent} %).`;
    }

    /**
     * Recommandations de révision (une par séance), prêtes pour PlanningAI.plan().
     * @param {Object} params - { assessment: {id, title, subjectId, targetDate}, subjectName, progress, daysRemaining,
     *   alreadyPlanned: nombre de révisions futures déjà au planning pour cette évaluation }
     * @returns {{ recs: Array, target: Object, missing: number }}
     */
    static buildRecommendations({ assessment, subjectName = '', progress = null, daysRemaining = null, alreadyPlanned = 0 }) {
        const target = ExamRevisionPlanner.target({ daysRemaining, progress });
        const missing = Math.max(0, target.sessions - (alreadyPlanned || 0));
        const recs = [];
        for (let i = 0; i < missing; i++) {
            const n = (alreadyPlanned || 0) + i + 1;
            recs.push({
                id: `coach_exam_${assessment.id}_${n}_${Date.now()}`,
                type: 'SUGGESTION',
                title: `Révision ${subjectName}`.trim(),
                message: `Révision ${n}/${target.sessions} — ${subjectName || assessment.title} (${target.duration} min).`,
                evidence: [`assessment=${assessment.id}`, `targetDate=${assessment.targetDate}`, `emphasis=${target.emphasis}`],
                actionable: true,
                planningRequest: {
                    action: 'create',
                    target: 'event',
                    duration: target.duration,
                    deadline: assessment.targetDate || null,
                    spreadGroup: assessment.id, // séances réparties sur des jours différents quand c'est possible
                    payload: {
                        title: `Révision ${subjectName || ''}`.trim(),
                        type: 'revision',
                        duration: target.duration,
                        targetDuration: target.duration,
                        lockStatus: 'flexible',
                        priority: 'high',
                        subjectId: assessment.subjectId || null,
                        assessmentId: assessment.id,
                        source: 'coach'
                    }
                }
            });
        }
        return { recs, target, missing };
    }
}
