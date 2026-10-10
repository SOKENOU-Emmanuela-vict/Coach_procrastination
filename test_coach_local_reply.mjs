// Coach sans Gemini (ou Gemini en échec) : réponse construite sur le contexte réel (cours, avancement, examens, notes),
// échec annoncé honnêtement avec son code, pas de bulles répétées, pas d'erreurs techniques qui polluent l'historique.
// Aucun appel réseau.
import { App } from './src/core/App.js';
import { MemoryProvider } from './src/services/MemoryProvider.js';
import { ChatHistoryEngine } from './src/engines/ChatHistoryEngine.js';
import { SchedulerEngine } from './src/engines/SchedulerEngine.js';
import { StudyRecordEngine } from './src/engines/StudyRecordEngine.js';
import { CheckInEngine } from './src/engines/CheckInEngine.js';
import { AcademicSeeder } from './src/data/AcademicSeeder.js';
import { CoachAI } from './src/ai/CoachAI.js';
import { CoachLocalReply } from './src/ai/CoachLocalReply.js';
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
const lastMonday = (() => { const d = addDays(-7); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return ymd(d); })();

class FailingLLM { constructor(err) { this.err = err; } async analyze() { throw this.err; } }
const overloaded = () => { const e = new Error('Erreur du LLM Provider: Erreur API Gemini (code 503) : les serveurs de Gemini sont saturés.'); e.status = 503; e.code = 'OVERLOADED'; return e; };

async function setup() {
    const storage = new MemoryProvider();
    const chat = new ChatHistoryEngine(storage);
    const scheduler = new SchedulerEngine(storage);
    const studyRecordEngine = new StudyRecordEngine(storage);
    const checkInEngine = new CheckInEngine(storage, null, scheduler, studyRecordEngine);
    const app = new App(storage, scheduler, studyRecordEngine, checkInEngine, null, null, chat);
    app.coachEngine.coachAI.llmReasoning = new FailingLLM(overloaded());
    app.renderView = async () => {};
    await new AcademicSeeder(app.academicEngine).seed();
    await storage.saveData('user_profile', { name: 'Emmanuela', currentSemesterId: 'sem_s3_26', groupe: 'Groupe 2' });
    app.state.userProfile = await storage.loadData('user_profile');
    await app.refreshAcademicSubjects();
    return { app, storage, chat };
}

(async () => {
    // --- 1. Import validé : le coach confirme dans le chat et clôt le rappel de la semaine ---
    const { app, storage, chat } = await setup();
    app.timetableImporter.llmProvider = new MockTimetableLLM(shiftedTimetable(lastMonday));
    const preview = await app.timetableImporter.extract({ base64: 'JVBERi0=', mimeType: 'application/pdf', group: 'Groupe 2',
        referenceDate: lastMonday, subjects: await app.academicEngine.getSubjects(), semesterId: 'sem_s3_26' });
    await app.applyTimetableImport(preview, {});
    let msgs = await chat.getConversation('default');
    const confirm = msgs.find(m => m.metadata && m.metadata.proactive === 'timetable_imported');
    assert(confirm && /Bien reçu : emploi du temps de la semaine du/.test(confirm.content) && /cours ajoutés/.test(confirm.content), '1. Import validé : confirmation du coach dans le chat');
    assert(/Avancement : .*h\/\d+ h/.test(confirm.content), '2. La confirmation cite l\'avancement des cours (heures faites / total)');
    const nudges = await storage.loadData('coach_nudges');
    assert(nudges[`timetable_${lastMonday}`] && nudges[`timetable_${lastMonday}`].done === true, '3. Rappel « emploi du temps » de cette semaine clos');

    // --- 2. Chat avec Gemini saturé : réponse locale honnête et contextuelle ---
    await app.refreshUserStats();
    const before = (await chat.getConversation('default')).length;
    await app.sendChatMessage("je fais quoi aujourd'hui ?");
    msgs = await chat.getConversation('default');
    const replies = msgs.slice(before + 1).filter(m => m.role === 'assistant');
    const local = replies[0];
    assert(local && /^Je n'arrive pas à joindre Gemini \(code 503 : les serveurs de Gemini sont saturés\)/.test(local.content), '4. Échec Gemini annoncé honnêtement avec le code 503');
    assert(/Avancement des cours : .*h\/\d+ h/.test(local.content), '5. La réponse locale utilise l\'avancement réel des cours');
    assert(/\?/.test(local.content.split('\n').pop()), '6. La réponse se termine par une question au lieu d\'un message figé');
    assert(!replies.some(m => /Erreur|erreur critique|Calcul impossible/.test(m.content)), '7. Aucune erreur technique ni alerte « Calcul impossible » dans le chat');
    assert(!replies.some(m => m !== local && /emploi du temps/i.test(m.content) && /Importe-le/.test(m.content)), '8. Pas de bulle « importe l\'emploi du temps » en double');
    assert(!msgs.some(m => m.metadata && m.metadata.error), '9. Rien n\'est enregistré comme erreur dans l\'historique');

    // --- 3. Annonce d'examen puis question : la réponse locale cite l'examen et demande la suite ---
    const examDate = addDays(4);
    await app.sendChatMessage(`j'ai examen de Structures algébriques le ${pad(examDate.getDate())}/${pad(examDate.getMonth() + 1)}`);
    await app.refreshUserStats();
    const b2 = (await chat.getConversation('default')).length;
    await app.sendChatMessage('et pour mes examens ?');
    const after = (await chat.getConversation('default')).slice(b2 + 1).filter(m => m.role === 'assistant');
    assert(after[0] && /À venir : Examen — Structures algébriques/.test(after[0].content) && /dans 4 jours/.test(after[0].content), '10. Question sur les examens : l\'examen annoncé est cité en premier');

    // --- 4. CoachAI : comportement inchangé hors chat, Gemini absent, dédoublonnage ---
    const ai = new CoachAI(null);
    const ctx = { currentDate: ymd(new Date()), academic: { upcomingAssessments: [], pastDueAssessments: [], alerts: [{ code: 'INCOMPLETE_SEMESTER', message: 'Calcul impossible: notes ou coefficients manquants' }] },
        planning: { events: [], availableSlots: [], conflicts: [] }, conversation: [],
        courses: { progress: [], bySubject: {}, upcomingSessions: [], gradeRequests: [], timetable: { needsImport: true, targetWeekStart: '2026-10-05', isSunday: false } } };
    const dash = await ai.analyze({ ...ctx, options: { useLLM: false } });
    assert(dash.some(r => r.decisionType === 'REMIND_TIMETABLE_IMPORT') && dash.some(r => r.decisionType === 'RELAY_ACADEMIC_ALERT'), '11. Tableau de bord (sans question) : recommandations inchangées');
    const noLlm = await ai.analyze(ctx, 'salut');
    assert(noLlm[0].decisionType === 'LOCAL_REPLY' && /Gemini n'est pas configuré/.test(noLlm[0].message), '12. Sans clé Gemini : réponse locale qui le dit');
    assert(!noLlm.some(r => r.decisionType === 'RELAY_ACADEMIC_ALERT'), '13. Alerte « semestre incomplet » non répétée dans le chat');
    const okAi = new CoachAI(null);
    okAi.llmReasoning = { analyze: async () => ({ type: 'recommendation', rationale: 'Conseil.', evidence: [] }) };
    const said = await okAi.analyze({ ...ctx, conversation: [{ role: 'assistant', content: "Je n'ai pas encore l'emploi du temps de cette semaine (du 05/10). Importe-le…" }] }, 'salut');
    assert(said.some(r => r.title === "Conseil de l'IA") && !said.some(r => r.decisionType === 'REMIND_TIMETABLE_IMPORT'), '14. Gemini OK : rappel déjà fait dans la conversation non répété');
    assert(okAi.lastLLMStatus && okAi.lastLLMStatus.ok === true, '15. lastLLMStatus = ok après une réponse Gemini');
    assert(CoachLocalReply.topicOf('mes notes ?') === 'grades' && CoachLocalReply.topicOf('quand est mon partiel') === 'exams', '16. Thème de la question reconnu');

    // --- 5. Historique : erreurs non répétées et anciennes erreurs techniques purgées ---
    const s2 = new MemoryProvider();
    const c2 = new ChatHistoryEngine(s2);
    await c2.saveMessage({ role: 'assistant', content: "Erreur lors de l'analyse : Erreur du LLM Provider: HTTP 503", conversationId: 'default' });
    await c2.saveMessage({ role: 'user', content: 'salut', conversationId: 'default' });
    await c2.saveMessage({ role: 'assistant', content: 'Je n\'ai pas pu analyser ta demande (x).', conversationId: 'default', metadata: { error: true } });
    await c2.saveMessage({ role: 'assistant', content: 'Je n\'ai pas pu analyser ta demande (x).', conversationId: 'default', metadata: { error: true } });
    let all = await c2.getAllMessages();
    assert(all.filter(m => m.metadata && m.metadata.error).length === 1, '17. Même erreur deux fois de suite : enregistrée une seule fois');
    const removed = await c2.purgeTechnicalErrors();
    all = await c2.getAllMessages();
    assert(removed === 1 && !all.some(m => /^Erreur lors de l'analyse/.test(m.content)) && all.length === 2, '18. Anciennes erreurs techniques retirées au démarrage');

    if (failures === 0) console.log('\nTous les tests du coach local passent.');
})().catch(e => { console.error('❌ FAIL: exception', e); process.exitCode = 1; });
