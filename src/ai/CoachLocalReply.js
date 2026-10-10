import { describeGeminiFailure } from './GeminiProvider.js';

/**
 * Réponse du coach SANS LLM, construite uniquement à partir du contexte réel de l'App
 * (emploi du temps importé, avancement des cours, évaluations, notes à donner, créneaux libres).
 * Utilisée dans le chat quand Gemini est absent ou en échec : le coach sait quoi dire et quoi demander
 * sans dépendre du modèle, et l'échec de Gemini est annoncé honnêtement (avec son code).
 */
export class CoachLocalReply {
    /** Phrase honnête sur l'état de Gemini (null si Gemini a répondu). */
    static llmStatusLine(llmStatus) {
        if (!llmStatus || llmStatus.ok) return null;
        if (llmStatus.code === 'NO_LLM') return "Gemini n'est pas configuré : je te réponds avec ce que je sais déjà de ton planning.";
        if (llmStatus.code === 'INVALID_JSON') return "Gemini m'a répondu dans un format illisible : je te réponds avec ce que je sais déjà de ton planning.";
        const status = Number.isFinite(llmStatus.status) && llmStatus.status > 0 ? llmStatus.status : null;
        const d = describeGeminiFailure(status || 0, llmStatus.message || '');
        const code = status ? `code ${status}` : d.code;
        return `Je n'arrive pas à joindre Gemini (${code} : ${d.text}). Je te réponds avec ce que je sais déjà de ton planning.`;
    }

    static _frDay(dateStr) {
        const [y, m, d] = String(dateStr || '').split('-').map(Number);
        if (!y || !m || !d) return String(dateStr || '');
        return new Date(y, m - 1, d).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
    }

    static _when(days) {
        if (days <= 0) return "aujourd'hui";
        if (days === 1) return 'demain';
        return `dans ${days} jours`;
    }

    static _short(name, max = 40) {
        const s = String(name || '').trim();
        return s.length > max ? s.slice(0, max - 1) + '…' : s;
    }

    /** Thème de la question de l'utilisatrice (pour mettre la bonne information en premier). */
    static topicOf(query) {
        const q = String(query || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        if (/\bnotes?\b|moyenne|\/20/.test(q)) return 'grades';
        if (/exam|evaluation|devoir|partiel|interro|\bcc\b|controle/.test(q)) return 'exams';
        if (/cours|emploi du temps|edt|seance|avancement/.test(q)) return 'courses';
        if (/libre|creneau|disponib|temps pour|quand/.test(q)) return 'slots';
        if (/\btache|faire|\bto(-|\s)?do\b/.test(q)) return 'tasks';
        if (/\blire|livre|lecture|page/.test(q)) return 'books';
        return 'general';
    }

    /**
     * @param {Object} context - CoachContext (CoachContextBuilder.build)
     * @param {string} query - message de l'utilisatrice
     * @param {Object} llmStatus - { ok, status, code, message } ; null = LLM non sollicité
     * @returns {{ message: string, question: string|null, facts: Object }}
     */
    static build(context = {}, query = '', llmStatus = null) {
        const today = context.currentDate || new Date().toLocaleDateString('fr-CA');
        const courses = context.courses || null;
        const academic = context.academic || {};
        const planning = context.planning || {};
        const sessions = courses && Array.isArray(courses.upcomingSessions) ? courses.upcomingSessions : [];
        const progress = courses && Array.isArray(courses.progress) ? courses.progress : [];
        const gradeRequests = courses && Array.isArray(courses.gradeRequests) ? courses.gradeRequests : [];
        const timetable = courses ? courses.timetable : null;
        const exams = (academic.upcomingAssessments || [])
            .filter(a => a && a.targetDate && typeof a.daysRemaining === 'number' && a.daysRemaining >= 0 && a.daysRemaining <= 14)
            .sort((a, b) => a.daysRemaining - b.daysRemaining);
        const undated = (academic.upcomingAssessments || []).filter(a => a && !a.targetDate);
        const slots = (planning.availableSlots || []).filter(s => (s.durationMinutes || 0) >= 45);
        
        const stagnatingProjects = (context.projects || []).filter(p => {
            if (p.status !== 'active' || p.progress >= 100) return false;
            const isPlanned = planning && planning.events && planning.events.some(ev => ev.projectId === p.id && new Date(ev.date) >= new Date(today));
            return !isPlanned;
        });
        // Parmi les stagnants, ceux à faible détermination (pas de session récente ET pas de retour coach)
        const lowDeterminationProjects = stagnatingProjects.filter(p => !p.determination || p.determination.score < 40);
        const tasks = context.personalTasks || [];
        const books = context.books || [];

        const overdueTasks = tasks.filter(pt => pt.status !== 'faite' && pt.dueDate && new Date(pt.dueDate) < new Date(today));
        const postponedTasks = tasks.filter(pt => pt.status !== 'faite' && pt.reportsCount >= 3);
        const neglectedBooks = books.filter(b => b.status !== 'finished' && b.lastProgressDate && Math.floor((new Date(today) - new Date(b.lastProgressDate)) / (1000 * 60 * 60 * 24)) >= 5);

        const lines = {};
        // Cours (emploi du temps importé)
        const todaySessions = sessions.filter(s => s.date === today);
        if (todaySessions.length > 0) {
            lines.courses = `Aujourd'hui tu as cours : ${todaySessions.map(s => `${CoachLocalReply._short(s.title)} (${s.startTime}–${s.endTime})`).join(', ')}.`;
        } else if (sessions.length > 0) {
            const n = sessions[0];
            lines.courses = `Pas de cours aujourd'hui. Prochain cours : ${CoachLocalReply._short(n.title)} ${CoachLocalReply._frDay(n.date)} à ${n.startTime}.`;
        }
        const withHours = progress.filter(p => p && p.hoursTotal);
        if (withHours.length > 0) {
            const parts = withHours.slice(0, 4).map(p => `${CoachLocalReply._short(p.componentName || p.subjectName || p.title, 32)} ${p.hoursDone} h/${p.hoursTotal} h${p.finished ? ' (terminé)' : ''}`);
            lines.progress = `Avancement des cours : ${parts.join(' ; ')}.`;
        }
        if (timetable && timetable.needsImport) {
            const [, m, d] = String(timetable.targetWeekStart || '').split('-');
            lines.timetable = `Il me manque l'emploi du temps de la semaine du ${d}/${m} (Planning → « Importer l'emploi du temps (PDF) »).`;
        }
        // Évaluations
        if (exams.length > 0) {
            lines.exams = `À venir : ${exams.slice(0, 3).map(a => `${a.title} ${CoachLocalReply._when(a.daysRemaining)} (${CoachLocalReply._frDay(a.targetDate)})`).join(' ; ')}.`;
        }
        // Créneaux libres
        if (slots.length > 0) {
            const s = slots[0];
            lines.slots = `Prochain créneau libre : ${s.date === today ? "aujourd'hui" : CoachLocalReply._frDay(s.date)} à ${s.startTime} (${s.durationMinutes} min).`;
        }
        // Livres et Tâches
        if (overdueTasks.length > 0) {
            lines.tasks = `Tâches en retard : ${overdueTasks.map(t => CoachLocalReply._short(t.title)).join(', ')}.`;
        } else if (postponedTasks.length > 0) {
            lines.tasks = `Tâches reportées 3 fois : ${postponedTasks.map(t => CoachLocalReply._short(t.title)).join(', ')}.`;
        }
        if (neglectedBooks.length > 0) {
            lines.books = `Livres délaissés depuis 5+ jours : ${neglectedBooks.map(b => CoachLocalReply._short(b.title)).join(', ')}.`;
        }

        // Question : ce dont le coach a le plus besoin, dans l'ordre
        let question = null;
        const gradeAsk = gradeRequests[0];
        if (gradeAsk) {
            question = `As-tu des notes à me donner pour ${gradeAsk.label} ? Réponds-moi ici (ex. « 14/20 »), ou « pas encore ».`;
        } else if (timetable && timetable.needsImport && sessions.length === 0) {
            question = "Peux-tu importer ton emploi du temps de la semaine ? Je pourrai alors suivre tes cours et te rappeler tes examens.";
        } else if (undated.length > 0) {
            question = `Quelle est la date de « ${undated[0].title} » ? Dis-le-moi (ex. « examen de ${CoachLocalReply._short(undated[0].subjectName && undated[0].subjectName !== 'Unknown Subject' ? undated[0].subjectName : 'la matière', 30)} le 15/10 »).`;
        } else if (neglectedBooks.length > 0) {
            question = `Tu n'as lu aucune page de « ${CoachLocalReply._short(neglectedBooks[0].title, 30)} » depuis 5 jours. On s'y remet ?`;
        } else if (postponedTasks.length > 0) {
            question = `La tâche « ${CoachLocalReply._short(postponedTasks[0].title, 30)} » a été reportée plusieurs fois. Veux-tu la faire aujourd'hui ou l'abandonner ?`;
        } else if (stagnatingProjects.length > 0) {
            const p0 = lowDeterminationProjects[0] || stagnatingProjects[0];
            const detScore = p0.determination ? p0.determination.score : null;
            const detHint = detScore !== null && detScore < 40 ? ` (score de détermination : ${detScore}/100)` : '';
            question = `Où en es-tu sur le projet « ${CoachLocalReply._short(p0.title, 30)} »${detHint} ? Aucune session n'est planifiée.`;
        } else if (exams.length === 0) {
            question = "As-tu un examen ou un devoir bientôt ? Dis-le-moi, par exemple : « examen de Structures algébriques le 15/10 ».";
        } else if (slots.length > 0) {
            question = `Tu veux que je te propose une séance de révision pour ${exams[0]?.subjectName && exams[0]?.subjectName !== 'Unknown Subject' ? exams[0].subjectName : (exams[0]?.title || 'ton prochain examen')} ?`;
        }

        const orderByTopic = {
            grades: ['exams', 'progress', 'courses', 'timetable', 'slots', 'tasks', 'books'],
            exams: ['exams', 'progress', 'courses', 'timetable', 'slots', 'tasks', 'books'],
            courses: ['courses', 'progress', 'timetable', 'exams', 'slots', 'tasks', 'books'],
            slots: ['slots', 'courses', 'exams', 'timetable', 'progress', 'tasks', 'books'],
            tasks: ['tasks', 'books', 'courses', 'exams', 'slots', 'progress', 'timetable'],
            books: ['books', 'tasks', 'courses', 'exams', 'slots', 'progress', 'timetable'],
            general: ['courses', 'exams', 'timetable', 'progress', 'slots', 'tasks', 'books']
        };
        const topic = CoachLocalReply.topicOf(query);
        const body = orderByTopic[topic].map(k => lines[k]).filter(Boolean);
        if (body.length === 0) body.push("Je n'ai encore aucune donnée de cours ni d'évaluation pour cette semaine.");

        const statusLine = CoachLocalReply.llmStatusLine(llmStatus);
        const message = [statusLine, ...body, question].filter(Boolean).join('\n');
        return { message, question, facts: { topic, todaySessions: todaySessions.length, exams: exams.length, gradeRequests: gradeRequests.length, needsImport: !!(timetable && timetable.needsImport) } };
    }
}
