// Boucle coach ↔ planning ↔ académique à partir de l'emploi du temps importé :
// avancement des cours → annonce d'examen dans le chat → évaluation + révisions proposées (plus si le cours est avancé)
// → rappels quotidiens → « As-tu des notes à me donner ? » → note enregistrée → note de la matière.
// Aucun appel réseau (Gemini simulé, LLM du coach désactivé).
import { App } from './src/core/App.js';
import { MemoryProvider } from './src/services/MemoryProvider.js';
import { ChatHistoryEngine } from './src/engines/ChatHistoryEngine.js';
import { SchedulerEngine } from './src/engines/SchedulerEngine.js';
import { StudyRecordEngine } from './src/engines/StudyRecordEngine.js';
import { CheckInEngine } from './src/engines/CheckInEngine.js';
import { AcademicSeeder } from './src/data/AcademicSeeder.js';
import { TimetableImportEngine } from './src/engines/TimetableImportEngine.js';
import { ExamRevisionPlanner } from './src/ai/ExamRevisionPlanner.js';
import { CoachContextBuilder } from './src/ai/CoachContext.js';
import { PromptBuilder } from './src/ai/PromptBuilder.js';
import { PlanningIntent } from './src/models/PlanningIntent.js';
import { parseExamAnnouncement } from './src/ai/ChatIntentParser.js';
import { MockTimetableLLM, shiftedTimetable } from './mock_timetable_gemini.mjs';

let failures = 0;
function assert(cond, msg) {
    if (cond) console.log(`✅ PASS: ${msg}`);
    else { console.error(`❌ FAIL: ${msg}`); failures++; process.exitCode = 1; }
}

global.window = {};
global.document = {
    getElementById: () => ({ innerHTML: '', addEventListener: () => {}, querySelectorAll: () => [], querySelector: () => null }),
    body: { className: '', classList: { add: () => {}, remove: () => {} } },
    querySelectorAll: () => [],
    querySelector: () => null
};

const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (n, base = new Date()) => { const d = new Date(base); d.setDate(d.getDate() + n); return d; };
const today = ymd(new Date());
const lastMonday = (() => { const d = addDays(-7); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return ymd(d); })();
const dm = (dateStr) => `${dateStr.slice(8, 10)}/${dateStr.slice(5, 7)}`;
const toMin = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };

async function setup() {
    const storage = new MemoryProvider();
    const chat = new ChatHistoryEngine(storage);
    const scheduler = new SchedulerEngine(storage);
    const studyRecordEngine = new StudyRecordEngine(storage);
    const checkInEngine = new CheckInEngine(storage, null, scheduler, studyRecordEngine);
    const app = new App(storage, scheduler, studyRecordEngine, checkInEngine, null, null, chat);
    app.coachEngine.coachAI.llmReasoning = null; // jamais d'appel réseau
    app.renderView = async () => {};
    await new AcademicSeeder(app.academicEngine).seed();
    await storage.saveData('user_profile', { name: 'Emmanuela', currentSemesterId: 'sem_s3_26', groupe: 'Groupe 2' });
    app.state.userProfile = await storage.loadData('user_profile');
    await app.refreshAcademicSubjects();
    // Emploi du temps de la semaine dernière (toutes les séances passées) ; Structure de données terminée (25 h / 25)
    app.timetableImporter.llmProvider = new MockTimetableLLM(shiftedTimetable(lastMonday, { 4: { hoursDone: 25, hoursTotal: 25 } }));
    const preview = await app.timetableImporter.extract({ base64: 'JVBERi0=', mimeType: 'application/pdf', group: 'Groupe 2',
        referenceDate: lastMonday, subjects: await app.academicEngine.getSubjects(), semesterId: 'sem_s3_26' });
    await app.applyTimetableImport(preview, {});
    return { app, storage, chat };
}
const assistantMsgs = async (chat) => (await chat.getConversation('default')).filter(m => m.role === 'assistant');

async function run() {
    console.log('=== BOUCLE COACH ↔ PLANNING ↔ ACADÉMIQUE (EMPLOI DU TEMPS) ===\n');
    let { app, storage, chat } = await setup();

    // --- Avancement dans l'état et le contexte du coach ---
    await app.refreshCourseProgress();
    const bs = app.state.courseProgress.bySubject;
    assert(bs.mth1321.hoursDone === 9 && bs.mth1321.percent === 45 && bs.inf1323.finished === true && bs.inf1322.hoursDone === 14,
        '1. Avancement exposé : Structures algébriques 9 h / 20 (45 %), Structure de données terminée, Analyse et conception 14 h');
    const ctxData = await app.buildCoachContext({ useLLM: false });
    const ctx = CoachContextBuilder.build(ctxData);
    assert(ctx.courses && ctx.courses.progress.length === 3 && ctx.courses.timetable && ctx.courses.timetable.needsImport === true,
        '2. Contexte du coach : avancement des cours + emploi du temps de la semaine à importer');
    assert(ctx.courses.gradeRequests.some(r => r.kind === 'finished_course' && r.subjectId === 'inf1323'),
        '3. Cours terminé sans note → demande de notes prévue pour Structure de données');
    const prompt = PromptBuilder.build(ctx, 'test');
    assert(/=== COURS/.test(prompt) && /hoursDone/.test(prompt), '4. Le prompt du LLM (facultatif) reçoit la section COURS');
    assert(app.planningEngine.defaultStudyWindow && app.planningEngine.defaultStudyWindow.startTime === '08:00',
        '5. Sans disponibilité saisie, une fenêtre par défaut 08:00-21:00 est utilisée après le 1er import');

    // --- Tableau de bord : rappels du coach (règles, sans LLM) ---
    await app.refreshUserStats();
    const titles = (app.state.coachInsights || []).map(i => i.title);
    assert(titles.includes('Emploi du temps de la semaine') && titles.includes('Notes à renseigner'),
        '6. Tableau de bord : rappel d\'import de l\'emploi du temps + « Notes à renseigner »');

    // --- Annonce d'examen dans le chat ---
    const examDate = ymd(addDays(6));
    // un cours verrouillé demain 08:00-12:00 : les révisions proposées ne doivent jamais le chevaucher
    await app.planningEngine.saveEvent({ id: 'cours_demain', title: 'Cours officiel', type: 'course', date: ymd(addDays(1)), startTime: '08:00', endTime: '12:00', lockStatus: 'locked', source: 'school_schedule' });
    const before = (await assistantMsgs(chat)).length;
    await app.sendChatMessage(`J'ai examen de structures algébriques le ${dm(examDate)}`);
    const assessments = await app.academicEngine.getAssessments();
    const exam = assessments.find(a => a.subjectId === 'mth1321' && a.targetDate === examDate);
    assert(exam && exam.type === 'Examen' && exam.maxScore === 20 && exam.weight === 1, '7. « j\'ai examen de X le JJ/MM » → évaluation créée pour Structures algébriques à la bonne date');
    const evs = (await storage.loadData('events')) || [];
    assert(evs.some(e => e.assessmentId === exam.id && e.type === 'exam' && e.lockStatus === 'locked' && e.date === examDate),
        '8. L\'examen apparaît dans le planning (événement verrouillé)');
    const newMsgs = (await assistantMsgs(chat)).slice(before);
    assert(/C'est noté/.test(newMsgs[0].content) && /9 h sur 20 \(45 %\)/.test(newMsgs[0].content) && /2 séances de révision de 90 min/.test(newMsgs[0].content),
        '9. Le coach confirme, cite l\'avancement du cours (45 %) et annonce 2 séances de 90 min');
    const proposals = newMsgs.filter(m => m.metadata && (m.metadata.intent || m.metadata.flexibleConflict));
    const slots = proposals.map(m => (m.metadata.intent || m.metadata.flexibleConflict.intent).constraints);
    assert(proposals.length === 2 && slots.every(c => c.date >= today && c.date < examDate),
        '10. Deux révisions proposées (bouton Accepter), entre maintenant et la veille de l\'examen');
    assert(slots[0].date !== slots[1].date, '11. Les deux séances sont réparties sur des jours différents');
    const lockedEvents = ((await storage.loadData('events')) || []).filter(e => e.lockStatus === 'locked' && e.startTime);
    assert(slots.every(c => !lockedEvents.some(l => l.date === c.date && toMin(c.startTime) < toMin(l.endTime) && toMin(l.startTime) < toMin(c.endTime))),
        '12. Aucune révision proposée sur un cours verrouillé');
    const intent = proposals[0].metadata.intent;
    const r = await app.acceptCoachSuggestion(new PlanningIntent(intent)).catch(e => e);
    const rev = ((await storage.loadData('events')) || []).find(e => e.assessmentId === exam.id && e.type === 'revision');
    assert(!(r instanceof Error) && rev && rev.lockStatus === 'flexible' && rev.subjectId === 'mth1321', '13. Une révision acceptée est enregistrée (flexible, liée à l\'examen)');
    await app.sendChatMessage(`j'ai examen de structures algébriques le ${dm(examDate)}`);
    assert((await app.academicEngine.getAssessments()).filter(a => a.subjectId === 'mth1321' && a.targetDate === examDate).length === 1,
        '14. Examen annoncé deux fois : pas de doublon d\'évaluation');
    const last = (await assistantMsgs(chat)).slice(-3).map(m => m.content).join(' ');
    assert(/Révision 2\/2/.test(last) && !/Révision 1\/2/.test(last), '15. Re-annonce : seules les révisions manquantes sont reproposées (1 déjà planifiée)');

    // --- Emphase selon l'avancement ---
    const tFinished = ExamRevisionPlanner.target({ daysRemaining: 6, progress: { hoursDone: 25, hoursTotal: 25, percent: 100, finished: true } });
    const tLow = ExamRevisionPlanner.target({ daysRemaining: 6, progress: { hoursDone: 3, hoursTotal: 20, percent: 15, finished: false } });
    const tShort = ExamRevisionPlanner.target({ daysRemaining: 1, progress: { hoursDone: 25, hoursTotal: 25, percent: 100, finished: true } });
    assert(tFinished.sessions === 3 && tFinished.duration === 90 && tLow.sessions === 1 && tLow.duration === 60 && tShort.sessions === 1,
        '16. Plus d\'heures faites → plus de révision (terminé : 3 × 90 min ; 15 % : 1 × 60 min ; jamais plus que de jours restants)');

    // --- Rappels quotidiens jusqu'à l'examen ---
    const nBefore = (await assistantMsgs(chat)).length;
    const posted1 = await app.syncProactiveCoachMessages();
    const after1 = (await assistantMsgs(chat)).slice(nBefore);
    assert(after1.some(m => /^Rappel : Examen — Structures algébriques/.test(m.content)), '17. Rappel quotidien de l\'examen dans le chat');
    assert(after1.some(m => /dimanche|cette semaine/.test(m.content) && m.metadata.proactive === 'timetable'), '18. Rappel d\'import de l\'emploi du temps de la semaine');
    const gradeMsg = after1.find(m => m.metadata && m.metadata.gradeRequest);
    assert(gradeMsg && /As-tu des notes à me donner pour Structure de données/.test(gradeMsg.content), '19. « As-tu des notes à me donner pour X ? » quand le cours est terminé');
    const posted2 = await app.syncProactiveCoachMessages();
    assert(posted1 >= 3 && posted2 === 0, '20. Une seule fois par jour : pas de répétition le même jour');
    const realClock = app.clock;
    app.clock = () => addDays(1);
    const n2 = (await assistantMsgs(chat)).length;
    await app.syncProactiveCoachMessages(addDays(1));
    assert((await assistantMsgs(chat)).slice(n2).some(m => /^Rappel : Examen — Structures algébriques/.test(m.content) && /dans 5 jours/.test(m.content)),
        '21. Le lendemain, nouveau rappel (dans 5 jours)');
    app.clock = realClock;
    const insights = await app.coachEngine.getInsights(await app.buildCoachContext({ useLLM: false }));
    assert(insights.some(i => i.title === 'Examen à venir' && /Rappel/.test(i.message)), '22. Rappel aussi sur le tableau de bord (« Examen à venir »)');

    // --- Réponse « 14/20 » → note de l'évaluation → note de la matière ---
    await app.syncProactiveCoachMessages(addDays(4)); // nouvelle question sur les notes (redemandée tous les 3 jours)
    await app.sendChatMessage('14/20');
    await app.refreshAcademicSubjects();
    const sdd = app.state.academicSubjects.find(s => s.id === 'inf1323');
    const sddAss = (await app.academicEngine.getAssessments()).filter(a => a.subjectId === 'inf1323');
    assert(sddAss.length === 1 && sdd.grade === 14 && sdd.gradeStatus === 'complete', '23. « 14/20 » → évaluation notée → note de Structure de données = 14/20');
    let lastMsg = (await assistantMsgs(chat)).pop();
    assert(/Merci ! J'ai enregistré 14\/20 pour Structure de données/.test(lastMsg.content) && /14\/20/.test(lastMsg.content), '24. Le coach confirme la note et la note de la matière');
    assert(!(await app.computeGradeRequests()).some(r => r.subjectId === 'inf1323'), '25. La question n\'est plus posée une fois la note donnée');

    // --- Évaluation passée sans note → question → note donnée avec la matière ---
    await app.academicEngine.saveAssessment({ id: 'ass_stats', subjectId: 'mth1324', title: 'CC Statistiques', type: 'CC', weight: 1, maxScore: 20, targetDate: ymd(addDays(-2)) });
    await app.academicEngine.saveAssessment({ id: 'ass_stats2', subjectId: 'mth1324', title: 'Examen Statistiques', type: 'Examen', weight: 2, maxScore: 20, targetDate: ymd(addDays(30)) });
    await app.refreshUserStats();
    const pastRec = (app.state.coachInsights || []).find(i => i.title === 'Évaluation passée');
    assert(pastRec && /As-tu des notes à me donner pour Statistiques et probabilités/.test(pastRec.message), '26. Évaluation passée sans note : le coach demande la note');
    await app.syncProactiveCoachMessages();
    await app.sendChatMessage("j'ai eu 12 en stats");
    await app.refreshAcademicSubjects();
    const stats = app.state.academicSubjects.find(s => s.id === 'mth1324');
    assert(stats.provisionalGrade === 12 && stats.gradeStatus === 'partial' && stats.grade === null, '27. « j\'ai eu 12 en stats » → CC noté, moyenne provisoire 12 (examen encore à venir)');

    // --- « pas encore » → redemandé plus tard ---
    await app.academicEngine.saveAssessment({ id: 'ass_web', subjectId: 'inf1326', title: 'TP Web', type: 'Devoir', weight: 1, maxScore: 20, targetDate: ymd(addDays(-1)) });
    await app.syncProactiveCoachMessages();
    await app.sendChatMessage('pas encore');
    lastMsg = (await assistantMsgs(chat)).pop();
    const nudges = await storage.loadData('coach_nudges');
    assert(/redemanderai dans 3 jours/.test(lastMsg.content) && nudges['ass_ass_web'] && nudges['ass_ass_web'].snoozedUntil > today, '28. « pas encore » : le coach redemandera dans 3 jours');
    const n3 = (await assistantMsgs(chat)).length;
    await app.syncProactiveCoachMessages(addDays(1));
    assert(!(await assistantMsgs(chat)).slice(n3).some(m => m.metadata.gradeRequest && m.metadata.gradeRequest.assessmentId === 'ass_web'), '29. Pas de nouvelle question pendant le report');

    // --- Matière inconnue / ambiguë, date manquante ---
    await app.sendChatMessage(`j'ai examen de cuisine le ${dm(examDate)}`);
    assert(/pas reconnu la matière/.test((await assistantMsgs(chat)).pop().content), '30. Matière inconnue : le coach demande de préciser');
    await app.sendChatMessage(`j'ai examen de structures le ${dm(examDate)}`);
    assert(/quelle matière/.test((await assistantMsgs(chat)).pop().content), '31. « structures » (algébriques ou de données ?) : le coach demande laquelle');
    await app.sendChatMessage("j'ai un examen de POO");
    assert(/Quelle est la date/.test((await assistantMsgs(chat)).pop().content), '32. Date manquante : le coach la demande');

    // --- Dimanche : rappel d'import de la semaine suivante (installation neuve, sans rappel déjà posté) ---
    ({ app, storage, chat } = await setup());
    const sunday = addDays((7 - new Date().getDay()) % 7 || 7);
    sunday.setHours(10, 0, 0, 0);
    const st = TimetableImportEngine.timetableStatus(await storage.loadData('timetable_imports'), sunday);
    const n4 = (await assistantMsgs(chat)).length;
    await app.syncProactiveCoachMessages(sunday);
    const sundayMsg = (await assistantMsgs(chat)).slice(n4).find(m => m.metadata.proactive === 'timetable');
    assert(st.isSunday && sundayMsg && /C'est dimanche/.test(sundayMsg.content) && sundayMsg.content.includes(dm(st.targetWeekStart)),
        '33. Le dimanche : « Envoie-moi l\'emploi du temps de la semaine du … »');

    // --- Les messages ordinaires ne sont pas détournés ---
    assert(parseExamAnnouncement('Aide-moi à planifier mes révisions') === null && parseExamAnnouncement('quand est mon examen ?') === null,
        '34. « Aide-moi à planifier mes révisions » / « quand est mon examen ? » restent des demandes au coach');

    console.log(failures === 0 ? '\nBoucle coach ↔ planning ↔ académique : tous les tests passent.' : `\n${failures} échec(s).`);
}

run().catch(e => { console.error('❌ FAIL: exception', e); process.exitCode = 1; });
