import { CoachReasoning } from './CoachReasoning.js';
import { CoachLLMReasoning } from './CoachLLMReasoning.js';
import { CoachLocalReply } from './CoachLocalReply.js';

// Informations que la réponse locale (CoachLocalReply) résume déjà : pas de bulle séparée dans le chat
const COVERED_BY_LOCAL_REPLY = ['REMIND_TIMETABLE_IMPORT', 'REMIND_UPCOMING_ASSESSMENT', 'ASK_FOR_GRADES', 'CONSIDER_AVAILABLE_SLOT', 'RECOMMEND_SET_ASSESSMENT_DATE'];
// Alertes académiques sans intérêt dans une conversation (début de semestre : aucune note = normal)
const CHAT_SILENT_ALERTS = ['INCOMPLETE_SEMESTER', 'IMMINENT_ASSESSMENT'];

export class CoachAI {
    constructor(llmProvider = null, knowledgeRetriever = null) {
        this.llmReasoning = llmProvider ? new CoachLLMReasoning(llmProvider, knowledgeRetriever) : null;
        this.lastLLMStatus = null; // { ok, status, code, message } du dernier appel (null = LLM non sollicité)
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
                planningRequest: null,
                decisionType: decision.type,
                payload: decision.payload || null,
                alertCode: (signal.evidence || []).map(e => String(e)).find(e => e.startsWith('alert_code_'))?.slice('alert_code_'.length) || null
            };

            // Mapping spécifique
            if (decision.type === "RECOMMEND_ASSESSMENT_PREPARATION") {
                rec.type = "SUGGESTION";
                rec.actionable = true;
                rec.planningRequest = {
                    action: "create",
                    target: "event",
                    duration: decision.duration || 90,
                    deadline: decision.payload.assessment.targetDate || null,
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
            } else if (decision.type === "RECOMMEND_SET_ASSESSMENT_DATE" && decision.payload && decision.payload.assessment) {
                const a = decision.payload.assessment;
                const subj = a.subjectName && a.subjectName !== 'Unknown Subject' ? a.subjectName : 'la matière';
                rec.message = `Je n'ai pas la date de « ${a.title} ». Dis-la-moi (ex. « examen de ${subj} le 15/10 ») pour que je planifie tes révisions.`;
            } else if (decision.type === "RELAY_ACADEMIC_ALERT") {
                rec.message = decision.payload.message;
            } else if (decision.type === "ADDRESS_PROCRASTINATION_RISK") {
                rec.message = decision.rationale;
                // Si critique, on pourrait forcer un Check-in ou un appel à l'action
                if (decision.severity === "high") {
                    rec.actionable = false; // Pas d'action de planning direct, mais c'est un signal fort
                }
            }

            recommendations.push(rec);
        }

        // 2. Raisonnement LLM (Optionnel, enrichissement ou requêtes complexes)
        // Le LLM n'est appelé qu'à la demande (ex: message du chat), pas à chaque rafraîchissement de l'interface.
        const llmAllowed = !(context && context.options && context.options.useLLM === false);
        let llmStatus = null;
        if (!this.llmReasoning && llmAllowed && query) llmStatus = { ok: false, status: null, code: 'NO_LLM', message: '' };
        if (this.llmReasoning && llmAllowed) {
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
                    // Le LLM ne fixe jamais la date : PlanningAI la calcule. On borne par l'échéance si l'évaluation est connue.
                    const payload = { ...(llmDecision.intent.payload || {}) };
                    const linkedAssessment = payload.assessmentId
                        ? ((context.academic && context.academic.upcomingAssessments) || []).find(a => a.id === payload.assessmentId)
                        : null;
                    rec.planningRequest = {
                        action: llmDecision.intent.action,
                        target: llmDecision.intent.target,
                        duration: payload.duration || 60,
                        deadline: linkedAssessment ? linkedAssessment.targetDate : null,
                        payload: payload
                    };
                    rec.message += ` Je recommande de planifier cela (${rec.planningRequest.duration} min).`;
                } else if (llmDecision.type === "checkin_intent" && llmDecision.intent) {
                    // Bilan du soir complet : on propose de l'enregistrer (la date est injectée par l'App, jamais par le LLM)
                    const payload = { ...(llmDecision.intent.payload || {}) };
                    delete payload.date;
                    rec.title = "Bilan du soir";
                    rec.actionable = true;
                    rec.intent = { version: 1, action: 'save_checkin', target: 'checkin', payload };
                }

                recommendations.push(rec);
                llmStatus = { ok: true };
            } catch (e) {
                console.warn("CoachAI: Échec du raisonnement LLM, fallback sur déterministe uniquement.", e);
                llmStatus = { ok: false, status: e && e.status !== undefined ? e.status : null, code: (e && e.code) || 'LLM_ERROR', message: (e && e.message) || '' };
            }
        }
        this.lastLLMStatus = llmStatus;

        if (!query) return recommendations;
        return this._shapeChatReply(recommendations, context, query, llmStatus);
    }

    /**
     * Réponse de chat (une question de l'utilisatrice) :
     *  - Gemini absent ou en échec : une réponse locale construite sur le contexte réel (cours, examens, notes, créneaux),
     *    annonçant honnêtement l'échec (code), à la place des bulles d'information répétitives ;
     *  - dans tous les cas, on ne répète pas une information déjà dite telle quelle dans la conversation récente.
     * Les recommandations actionnables (révision à planifier, conflit à régler) sont toujours conservées.
     */
    _shapeChatReply(recommendations, context, query, llmStatus) {
        let recs = recommendations.filter(r => !(r.decisionType === 'RELAY_ACADEMIC_ALERT' && CHAT_SILENT_ALERTS.includes(r.alertCode)));
        if (llmStatus && !llmStatus.ok) {
            const hasGradeRequests = !!(context && context.courses && Array.isArray(context.courses.gradeRequests) && context.courses.gradeRequests.length > 0);
            recs = recs.filter(r => !COVERED_BY_LOCAL_REPLY.includes(r.decisionType)
                && !(hasGradeRequests && r.decisionType === 'REVIEW_PAST_DUE_ASSESSMENT'));
            const local = CoachLocalReply.build(context, query, llmStatus);
            recs.unshift({
                id: `coach_local_${Date.now()}`,
                type: 'INFO',
                title: 'Point du coach',
                message: local.message,
                evidence: [`llm=${llmStatus.code || 'error'}`],
                actionable: false,
                planningRequest: null,
                decisionType: 'LOCAL_REPLY',
                llmStatus
            });
        }
        const assistantTexts = ((context && context.conversation) || []).filter(m => m && m.role === 'assistant').map(m => String(m.content || '').trim());
        const said = new Set(assistantTexts);
        return recs.filter(r => r.actionable || r.decisionType === 'LOCAL_REPLY'
            || (!said.has(String(r.message || '').trim()) && !CoachAI._alreadySaidTopic(r, assistantTexts)));
    }

    /** Même sujet déjà abordé récemment par le coach (formulation différente : rappel proactif du jour, etc.). */
    static _alreadySaidTopic(rec, assistantTexts) {
        const p = rec.payload || {};
        const any = (fn) => assistantTexts.some(fn);
        if (rec.decisionType === 'REMIND_TIMETABLE_IMPORT' && p.timetable && p.timetable.targetWeekStart) {
            const [, m, d] = String(p.timetable.targetWeekStart).split('-');
            return any(t => /emploi du temps/i.test(t) && t.includes(`${d}/${m}`));
        }
        if (rec.decisionType === 'REMIND_UPCOMING_ASSESSMENT' && p.assessment && p.assessment.title) {
            return any(t => t.includes(p.assessment.title) && /Rappel/i.test(t));
        }
        if (rec.decisionType === 'ASK_FOR_GRADES' && p.request && p.request.label) {
            return any(t => t.includes(`notes à me donner pour ${p.request.label}`));
        }
        return false;
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
            case "ADDRESS_PROCRASTINATION_RISK": return "Alerte Procrastination";
            case "REMIND_UPCOMING_ASSESSMENT": return "Examen à venir";
            case "ASK_FOR_GRADES": return "Notes à renseigner";
            case "REMIND_TIMETABLE_IMPORT": return "Emploi du temps de la semaine";
            default: return "Recommandation";
        }
    }
}
