import { describeGeminiFailure } from './GeminiProvider.js';
import { parseCourseQuery } from './ChatIntentParser.js';

function extractSnippet(content, keyword = '', maxLen = 180) {
    if (!content) return '';
    const clean = content.replace(/\s+/g, ' ').trim();
    if (!keyword) {
        return clean.length > maxLen ? clean.slice(0, maxLen - 1) + '…' : clean;
    }
    const idx = clean.toLowerCase().indexOf(keyword.toLowerCase());
    if (idx === -1) {
        return clean.length > maxLen ? clean.slice(0, maxLen - 1) + '…' : clean;
    }
    const start = Math.max(0, idx - 40);
    const end = Math.min(clean.length, idx + keyword.length + 100);
    let snippet = clean.slice(start, end).trim();
    if (start > 0) snippet = '…' + snippet;
    if (end < clean.length) snippet = snippet + '…';
    return snippet;
}

/**
 * Réponse du coach SANS LLM, construite uniquement à partir du contexte réel de l'App
 * (emploi du temps importé, avancement des cours, évaluations, notes à donner, créneaux libres).
 * Utilisée dans le chat quand Gemini est absent ou en échec : le coach sait quoi dire et quoi demander
 * sans dépendre du modèle, et l'échec de Gemini est annoncé honnêtement (avec son code).
 */
export class CoachLocalReply {
    static _sessionNoticeShown = false;

    static resetSessionNotice() {
        CoachLocalReply._sessionNoticeShown = false;
        try {
            if (typeof sessionStorage !== 'undefined' && sessionStorage) {
                sessionStorage.removeItem('gemini_notice_shown');
            }
        } catch (_) {}
    }

    /** Phrase honnête sur l'état de Gemini (null si Gemini a répondu). */
    static llmStatusLine(llmStatus) {
        if (!llmStatus || llmStatus.ok) return null;
        if (llmStatus.code === 'NO_LLM') {
            const inSession = CoachLocalReply._sessionNoticeShown || (typeof sessionStorage !== 'undefined' && sessionStorage && sessionStorage.getItem('gemini_notice_shown') === 'true');
            if (inSession) return null;
            CoachLocalReply._sessionNoticeShown = true;
            try {
                if (typeof sessionStorage !== 'undefined' && sessionStorage) {
                    sessionStorage.setItem('gemini_notice_shown', 'true');
                }
            } catch (_) {}
            return "ℹ️ Gemini n'est pas configuré : je te réponds à partir de tes données locales.";
        }
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
     * Détection exacte des 4 questions locales requises.
     */
    static detectExactIntent(query) {
        if (!query) return null;
        const q = String(query).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[-_]/g, ' ').trim();

        // 1. Qu'est-ce que j'ai aujourd'hui ? / mon planning d'aujourd'hui
        const hasToday = /\baujourd'?\s*hui\b/.test(q);
        const hasTodayActivity = /qu'?\s*est\s*ce\s*que\s*j'?\s*ai|je\s*fais\s*quoi|j'?\s*ai\s*quoi|programme|planning|cours|edt|emploi|seance|faire|preva?u/.test(q);
        if ((hasToday && (hasTodayActivity || q === "aujourd'hui" || q === "aujourd'hui ?")) || /planning\s+du\s+jour|programme\s+du\s+jour/.test(q)) {
            return 'today';
        }

        // 2. Quel est mon prochain examen ?
        if (/(prochain(e)?\s+(examen|eval|evaluation|devoir|partiel|controle)|quand\s+est\s+(mon\s+)?(prochain\s+)?(examen|eval|partiel|devoir)|(et\s+pour\s+)?mes\s+examens)/.test(q)) {
            return 'next_exam';
        }

        // 3. Où j'en suis en anglais ? (ou autre langue)
        const langMatches = q.match(/\b(anglais|english|espagnol|spanish|allemand|german|italien|italian|chinois|chinese|japonais|japanese|arabe|arabic|russe|russian|portugais|portuguese)\b/);
        if (langMatches || (/\blangues?\b/.test(q) && /ou\s+j'?\s*en\s+suis|niveau|progres|cours/.test(q))) {
            return { type: 'language', langName: langMatches ? langMatches[1] : null };
        }

        // 4. Combien de livres j'ai lus ?
        if (/\blivres?\b/.test(q) && /combien|lus?|termines?|finis?/.test(q)) {
            return 'books';
        }

        return null;
    }

    /** Calcule le nombre d'événements existants dans la semaine cible. */
    static countEventsInTargetWeek(context) {
        const timetable = context.courses && context.courses.timetable;
        const today = context.currentDate || new Date().toLocaleDateString('fr-CA');
        let targetMonday = timetable && timetable.targetWeekStart;
        if (!targetMonday) {
            const [y, m, d] = today.split('-').map(Number);
            const dt = new Date(y, m - 1, d);
            const dayOfWeek = dt.getDay(); // 0 is Sunday
            const diff = dt.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
            const mon = new Date(dt.setDate(diff));
            const pad = n => String(n).padStart(2, '0');
            targetMonday = `${mon.getFullYear()}-${pad(mon.getMonth() + 1)}-${pad(mon.getDate())}`;
        }
        if (!targetMonday) return 0;

        const [y, m, d] = targetMonday.split('-').map(Number);
        const start = new Date(y, m - 1, d);
        const end = new Date(y, m - 1, d + 6);
        const pad = n => String(n).padStart(2, '0');
        const endStr = `${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(end.getDate())}`;

        let count = 0;
        const checkEv = (e) => {
            if (!e) return;
            const date = e.date || e.day;
            if (date && date >= targetMonday && date <= endStr) {
                count++;
            }
        };

        const sessions = (context.courses && Array.isArray(context.courses.upcomingSessions)) ? context.courses.upcomingSessions : [];
        const planningEvents = (context.planning && Array.isArray(context.planning.events)) ? context.planning.events : [];
        const temporalEvents = Array.isArray(context.temporalEvents) ? context.temporalEvents : [];

        sessions.forEach(checkEv);
        planningEvents.forEach(checkEv);
        temporalEvents.forEach(checkEv);

        return count;
    }

    /**
     * Résolution asynchrone complète (interroge KnowledgeRetriever si la question concerne un cours/document)
     */
    static async resolve(context = {}, query = '', llmStatus = null, knowledgeRetriever = null) {
        const courseIntent = parseCourseQuery(query);
        if (courseIntent) {
            const retriever = knowledgeRetriever || context.knowledgeRetriever || (context.knowledge && context.knowledge.retriever);
            const engine = retriever && retriever.knowledgeEngine;
            let documents = [];
            let chunks = [];
            if (engine && typeof engine.getDocuments === 'function') {
                documents = await engine.getDocuments();
                chunks = await engine.getChunks();
            } else if (context.knowledge && Array.isArray(context.knowledge.documents)) {
                documents = context.knowledge.documents;
                chunks = context.knowledge.chunks || [];
            }

            // 0 document dans la base
            if (!documents || documents.length === 0) {
                const statusLine = CoachLocalReply.llmStatusLine(llmStatus);
                const answerText = "Tu n'as importé aucun document : ouvre École > Documents.";
                const message = [statusLine, answerText].filter(Boolean).join('\n');
                return {
                    message,
                    question: null,
                    facts: { topic: 'courses', documentCount: 0 }
                };
            }

            // 1. Liste des documents
            if (courseIntent.type === 'list_documents') {
                const statusLine = CoachLocalReply.llmStatusLine(llmStatus);
                const lines = documents.map(d => {
                    const pages = d.metadata && d.metadata.pageCount ? `${d.metadata.pageCount} p.` : '';
                    const chCount = d.metadata && d.metadata.chunkCount ? `${d.metadata.chunkCount} extrait(s)` : '';
                    const meta = [pages, chCount].filter(Boolean).join(', ');
                    return `• « ${d.title} »${meta ? ` (${meta})` : ''}`;
                });
                const answerText = `Tu as ${documents.length} document(s) importé(s) :\n${lines.join('\n')}`;
                const message = [statusLine, answerText].filter(Boolean).join('\n');
                return {
                    message,
                    question: null,
                    facts: { topic: 'courses', documentCount: documents.length }
                };
            }

            // 2. Résumé / Aperçu d'un document
            if (courseIntent.type === 'summarize_document') {
                const normTitle = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
                const target = normTitle(courseIntent.titlePhrase);
                const matchedDoc = documents.find(d => normTitle(d.title).includes(target)) ||
                    documents.find(d => target.includes(normTitle(d.title)));

                const statusLine = CoachLocalReply.llmStatusLine(llmStatus);
                if (!matchedDoc) {
                    const titles = documents.map(d => `« ${d.title} »`).join(', ');
                    const answerText = `Je n'ai trouvé aucun document correspondant à « ${courseIntent.titlePhrase} ». Tu as ${documents.length} document(s) importé(s) : ${titles}.`;
                    const message = [statusLine, answerText].filter(Boolean).join('\n');
                    return { message, question: null, facts: { topic: 'courses', documentCount: documents.length } };
                }

                const docChunks = chunks.filter(c => c.documentId === matchedDoc.id);
                let preview = '';
                if (docChunks.length > 0) {
                    const firstChunk = docChunks[0];
                    const sentences = firstChunk.content.split(/(?<=[.?!])\s+/).slice(0, 3).join(' ');
                    preview = sentences || firstChunk.content.slice(0, 240);
                } else {
                    preview = "Contenu court sans extraits détaillés.";
                }

                const pStart = docChunks[0] ? (docChunks[0].pageStart || 1) : 1;
                const answerText = `Aperçu du document « ${matchedDoc.title} » :\n${preview}\n\n(Source : ${matchedDoc.title}, p.${pStart})`;
                const message = [statusLine, answerText].filter(Boolean).join('\n');
                return {
                    message,
                    question: null,
                    facts: { topic: 'courses', documentCount: documents.length, summarizedDocId: matchedDoc.id }
                };
            }

            // 3. Question sur le cours ou recherche de mot
            if (courseIntent.type === 'course_query' || courseIntent.type === 'course_search') {
                const topic = courseIntent.topic;
                let searchResults = [];
                if (retriever && typeof retriever.search === 'function') {
                    let subjectId = null;
                    if (courseIntent.subjectPhrase && context.academic && context.academic.subjects) {
                        const sSub = courseIntent.subjectPhrase.toLowerCase();
                        const foundSub = context.academic.subjects.find(s =>
                            (s.name && s.name.toLowerCase().includes(sSub)) ||
                            (s.code && s.code.toLowerCase().includes(sSub))
                        );
                        if (foundSub) subjectId = foundSub.id;
                    }
                    searchResults = await retriever.search(topic, { subjectId });
                }

                const statusLine = CoachLocalReply.llmStatusLine(llmStatus);
                if (!searchResults || searchResults.length === 0) {
                    const answerText = `Je n'ai rien trouvé sur ça dans tes documents. Tu as ${documents.length} document(s) importé(s).`;
                    const message = [statusLine, answerText].filter(Boolean).join('\n');
                    return { message, question: null, facts: { topic: 'courses', documentCount: documents.length } };
                }

                const topResults = searchResults.slice(0, 3);
                const extracts = topResults.map(res => {
                    const chunk = res.chunk;
                    const doc = documents.find(d => d.id === chunk.documentId);
                    const docTitle = doc ? doc.title : 'Document';
                    const page = chunk.pageStart || 1;
                    const snippet = extractSnippet(chunk.content, topic, 180);
                    return `• « ${snippet} » (${docTitle}, p.${page})`;
                });

                const answerText = `Voici ce que dit ton cours :\n\n${extracts.join('\n')}`;
                const message = [statusLine, answerText].filter(Boolean).join('\n');
                return {
                    message,
                    question: null,
                    facts: { topic: 'courses', documentCount: documents.length, resultsCount: searchResults.length }
                };
            }
        }

        return CoachLocalReply.build(context, query, llmStatus);
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
        const lowDeterminationProjects = stagnatingProjects.filter(p => !p.determination || p.determination.score < 40);
        const tasks = context.personalTasks || [];
        const books = context.books || [];

        const overdueTasks = tasks.filter(pt => pt.status !== 'faite' && pt.dueDate && new Date(pt.dueDate) < new Date(today));
        const postponedTasks = tasks.filter(pt => pt.status !== 'faite' && pt.reportsCount >= 3);
        const neglectedBooks = books.filter(b => b.status !== 'finished' && b.lastProgressDate && Math.floor((new Date(today) - new Date(b.lastProgressDate)) / (1000 * 60 * 60 * 24)) >= 5);

        const statusLine = CoachLocalReply.llmStatusLine(llmStatus);
        const withHours = progress.filter(p => p && p.hoursTotal);
        const lines = {};
        if (withHours.length > 0) {
            const parts = withHours.slice(0, 4).map(p => `${CoachLocalReply._short(p.componentName || p.subjectName || p.title, 32)} ${p.hoursDone} h/${p.hoursTotal} h${p.finished ? ' (terminé)' : ''}`);
            lines.progress = `Avancement des cours : ${parts.join(' ; ')}.`;
        }

        // Question prompte classique pour les erreurs techniques LLM (ex: 503)
        let question = null;
        const gradeAsk = gradeRequests[0];
        const eventsInTargetWeek = CoachLocalReply.countEventsInTargetWeek(context);
        if (gradeAsk) {
            question = `As-tu des notes à me donner pour ${gradeAsk.label} ? Réponds-moi ici (ex. « 14/20 »), ou « pas encore ».`;
        } else if (timetable && timetable.needsImport && eventsInTargetWeek === 0) {
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

        // 1. Détection des 4 questions locales exactes
        const exactIntent = CoachLocalReply.detectExactIntent(query);

        // 1.1 Question 1 : Qu'est-ce que j'ai aujourd'hui ?
        if (exactIntent === 'today') {
            const todayEventsMap = new Map();
            const addEv = (e) => {
                if (!e || e.date !== today) return;
                const key = `${e.startTime || ''}_${e.endTime || ''}_${e.title || ''}`;
                if (!todayEventsMap.has(key)) {
                    todayEventsMap.set(key, {
                        startTime: e.startTime || '',
                        endTime: e.endTime || '',
                        title: e.title || e.name || 'Événement'
                    });
                }
            };

            sessions.forEach(addEv);
            (planning.events || []).forEach(addEv);
            (context.temporalEvents || []).forEach(addEv);

            const sortedEvents = Array.from(todayEventsMap.values()).sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));
            let answerText = "";
            if (sortedEvents.length > 0) {
                const eventLines = sortedEvents.map(e => `• ${e.startTime}${e.endTime ? ` - ${e.endTime}` : ''} : ${CoachLocalReply._short(e.title, 50)}`);
                answerText = `Aujourd'hui :\n${eventLines.join('\n')}`;
            } else {
                answerText = "Rien de prévu aujourd'hui.";
            }

            // Fallback pour échec Gemini (test_coach_local_reply) : avancement et question
            if (llmStatus && llmStatus.code !== 'NO_LLM' && lines.progress) {
                answerText += `\n${lines.progress}`;
            }
            const questionText = (llmStatus && llmStatus.code !== 'NO_LLM') ? question : null;
            const message = [statusLine, answerText, questionText].filter(Boolean).join('\n');
            return {
                message,
                question: questionText,
                facts: { topic: 'courses', todaySessions: sortedEvents.length, exams: exams.length, gradeRequests: gradeRequests.length, needsImport: false }
            };
        }

        // 1.2 Question 2 : Quel est mon prochain examen ?
        if (exactIntent === 'next_exam') {
            let answerText = "";
            if (exams.length > 0) {
                const next = exams[0];
                const subj = next.subjectName && next.subjectName !== 'Unknown Subject' ? next.subjectName : (next.title || 'Matière');
                answerText = `À venir : ${next.title} (${subj}) ${CoachLocalReply._when(next.daysRemaining)} (${CoachLocalReply._frDay(next.targetDate)}).`;
            } else {
                answerText = "Aucun examen prévu prochainement.";
            }
            const questionText = (llmStatus && llmStatus.code !== 'NO_LLM') ? question : null;
            const message = [statusLine, answerText, questionText].filter(Boolean).join('\n');
            return {
                message,
                question: questionText,
                facts: { topic: 'exams', examsCount: exams.length }
            };
        }

        // 1.3 Question 3 : Où j'en suis en anglais ? (ou autre langue)
        if (exactIntent && exactIntent.type === 'language') {
            const userLangs = context.userLanguages || [];
            const targetLang = exactIntent.langName;
            const matched = targetLang
                ? userLangs.find(l => (l.name || '').toLowerCase().includes(targetLang.toLowerCase()))
                : (userLangs[0] || null);

            let answerText = "";
            if (!matched) {
                answerText = "Tu n'as pas encore renseigné de langue. Dis-moi quelle langue tu souhaites apprendre !";
            } else {
                const mins = (matched.tracking && matched.tracking.minutesStudied) || 0;
                const tempsRevise = mins >= 60 ? `${Math.floor(mins / 60)}h${mins % 60 > 0 ? (mins % 60) + 'min' : ''}` : `${mins} min`;

                const allEvents = [...(planning.events || []), ...(context.temporalEvents || []), ...sessions];
                const langNameLower = matched.name.toLowerCase();
                const upcomingLang = allEvents
                    .filter(e => e && e.date && e.date >= today && (e.title || '').toLowerCase().includes(langNameLower))
                    .sort((a, b) => (a.date + (a.startTime || '')).localeCompare(b.date + (b.startTime || '')))[0];

                const prochainCours = upcomingLang
                    ? `${CoachLocalReply._frDay(upcomingLang.date)} à ${upcomingLang.startTime}`
                    : 'aucun cours planifié';

                answerText = `En ${matched.name} : niveau actuel ${matched.level || 'A1'}, objectif « ${matched.goal || 'non défini'} ». Temps révisé cette semaine : ${tempsRevise}. Prochain cours : ${prochainCours}.`;
            }
            const message = [statusLine, answerText].filter(Boolean).join('\n');
            return {
                message,
                question: null,
                facts: { topic: 'language', matched: !!matched }
            };
        }

        // 1.4 Question 4 : Combien de livres j'ai lus ?
        if (exactIntent === 'books') {
            const finished = books.filter(b => b && (b.status === 'finished' || b.status === 'termine' || b.status === 'lu' || (b.totalPages > 0 && b.pagesRead >= b.totalPages)));
            let answerText = "";
            if (finished.length === 0) {
                answerText = "Tu as lu 0 livre pour le moment (aucun livre terminé enregistré).";
            } else {
                const titles = finished.map(b => `« ${CoachLocalReply._short(b.title, 40)} »`).join(', ');
                answerText = `Tu as lu ${finished.length} livre(s) : ${titles}.`;
            }
            const message = [statusLine, answerText].filter(Boolean).join('\n');
            return {
                message,
                question: null,
                facts: { topic: 'books', count: finished.length }
            };
        }

        // 2. Question hors des 4 types SANS clé Gemini (mode local strict)
        if (llmStatus && llmStatus.code === 'NO_LLM') {
            const answerText = "Je n'ai pas cette information dans tes données. En mode local sans clé Gemini, je peux te renseigner sur : ton planning du jour, ton prochain examen, ton suivi de langues et tes livres.";
            const message = [statusLine, answerText].filter(Boolean).join('\n');
            return {
                message,
                question: null,
                facts: { topic: 'general', localMode: true }
            };
        }

        // 3. Fallback standard (Gemini avec erreur technique HTTP 503, etc., ou appel hors chat)
        const todaySessions = sessions.filter(s => s.date === today);
        if (todaySessions.length > 0) {
            lines.courses = `Aujourd'hui tu as cours : ${todaySessions.map(s => `${CoachLocalReply._short(s.title)} (${s.startTime}–${s.endTime})`).join(', ')}.`;
        } else if (sessions.length > 0) {
            const n = sessions[0];
            lines.courses = `Pas de cours aujourd'hui. Prochain cours : ${CoachLocalReply._short(n.title)} ${CoachLocalReply._frDay(n.date)} à ${n.startTime}.`;
        }

        // L'alerte emploi du temps n'apparaît QUE si la semaine en cours a 0 événement
        if (timetable && timetable.needsImport && eventsInTargetWeek === 0) {
            const [, m, d] = String(timetable.targetWeekStart || '').split('-');
            lines.timetable = `Il me manque l'emploi du temps de la semaine du ${d}/${m} (Planning → « Importer l'emploi du temps (PDF) »).`;
        }

        if (exams.length > 0) {
            lines.exams = `À venir : ${exams.slice(0, 3).map(a => `${a.title} ${CoachLocalReply._when(a.daysRemaining)} (${CoachLocalReply._frDay(a.targetDate)})`).join(' ; ')}.`;
        }
        if (slots.length > 0) {
            const s = slots[0];
            lines.slots = `Prochain créneau libre : ${s.date === today ? "aujourd'hui" : CoachLocalReply._frDay(s.date)} à ${s.startTime} (${s.durationMinutes} min).`;
        }
        if (overdueTasks.length > 0) {
            lines.tasks = `Tâches en retard : ${overdueTasks.map(t => CoachLocalReply._short(t.title)).join(', ')}.`;
        } else if (postponedTasks.length > 0) {
            lines.tasks = `Tâches reportées 3 fois : ${postponedTasks.map(t => CoachLocalReply._short(t.title)).join(', ')}.`;
        }
        if (neglectedBooks.length > 0) {
            lines.books = `Livres délaissés depuis 5+ jours : ${neglectedBooks.map(b => CoachLocalReply._short(b.title)).join(', ')}.`;
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

        const message = [statusLine, ...body, question].filter(Boolean).join('\n');
        return { message, question, facts: { topic, todaySessions: todaySessions.length, exams: exams.length, gradeRequests: gradeRequests.length, needsImport: !!(timetable && timetable.needsImport && eventsInTargetWeek === 0) } };
    }
}
