// Décision utilisateur : quand un créneau proposé chevauche un événement FLEXIBLE, le coach DEMANDE
// (« on décide ensemble »). Les événements verrouillés bloquent toujours.
import { App } from './src/core/App.js';
import { MemoryProvider } from './src/services/MemoryProvider.js';
import { ChatHistoryEngine } from './src/engines/ChatHistoryEngine.js';
import { PlanningIntent } from './src/models/PlanningIntent.js';

const dayOffset = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toLocaleDateString('fr-CA'); };
const D1 = dayOffset(1), D2 = dayOffset(2), D3 = dayOffset(3), D4 = dayOffset(4);

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

async function setup() {
    const storage = new MemoryProvider();
    await storage.saveData('acad_subjects', [{ id: 'sub_maths', name: 'Maths', semesterId: 'sem' }]);
    await storage.saveData('acad_assessments', [{ id: 'ass_m', subjectId: 'sub_maths', title: 'Partiel Maths', weight: 1, maxScore: 20, targetDate: D3 }]);
    await storage.saveData('availabilities', [
        { id: 'w1', date: D1, startTime: '14:00', endTime: '16:00' },
        { id: 'w2', date: D2, startTime: '18:00', endTime: '21:00' },
        { id: 'w4', date: D4, startTime: '09:00', endTime: '12:00' }
    ]);
    await storage.saveData('events', [
        { id: 'sport', title: 'Sport', type: 'sport', date: D1, startTime: '14:30', endTime: '16:00', lockStatus: 'flexible' },
        { id: 'sortie', title: 'Sortie', type: 'personal', date: D2, startTime: '18:00', endTime: '20:00', lockStatus: 'flexible' },
        { id: 'cours', title: 'Cours Java', type: 'course', date: D2, startTime: '20:00', endTime: '21:00', lockStatus: 'locked' }
    ]);
    const chat = new ChatHistoryEngine(storage);
    const app = new App(storage, null, null, null, null, null, chat);
    app.coachEngine.coachAI.llmReasoning = null; // jamais d'appel réseau dans ce test
    app.renderView = async () => {};
    app.refreshUserStats = async () => {};
    app.state.userProfile = { name: 'Test' };
    app.state.academicSummary = {
        upcomingAssessments: [{ id: 'ass_m', title: 'Partiel Maths', subjectId: 'sub_maths', subjectName: 'Maths', targetDate: D3, daysRemaining: 3 }],
        pastDueAssessments: [], alerts: [], cectStatus: null
    };
    return { app, storage, chat };
}
const lastAssistant = async (chat) => (await chat.getConversation('default')).filter(m => m.role === 'assistant').pop();
const events = async (storage) => (await storage.loadData('events')) || [];

async function run() {
    console.log('=== CHEVAUCHEMENT AVEC UN ÉVÉNEMENT FLEXIBLE : LE COACH DEMANDE ===\n');

    // --- Moteur ---
    {
        const { app, storage } = await setup();
        const intent = (date, s, e) => new PlanningIntent({ action: 'create', target: 'event', constraints: { date, startTime: s, endTime: e },
            payload: { title: 'Révision Maths', type: 'revision', subjectId: 'sub_maths', assessmentId: 'ass_m', lockStatus: 'flexible' } });
        const before = (await events(storage)).length;
        let r = await app.planningEngine.executeIntent(intent(D1, '14:00', '15:30'));
        assert(r.success === false && r.needsConfirmation === true && r.overlappingFlexible[0].id === 'sport' && /CONFLICT/.test(r.reason),
            '1. Sans confirmation, un chevauchement avec un flexible est refusé avec needsConfirmation + événement concerné');
        assert((await events(storage)).length === before, '2. Rien n\'est écrit tant que l\'utilisateur n\'a pas confirmé');
        r = await app.planningEngine.executeIntent(intent(D2, '19:30', '21:00'), { allowFlexibleOverlap: true });
        assert(r.success === false && /CRITICAL_CONFLICT/.test(r.reason), '3. Un événement verrouillé (cours) bloque toujours, même avec allowFlexibleOverlap');
        r = await app.planningEngine.executeIntent(intent(D1, '14:00', '15:30'), { flexibleResolution: 'keep', confirmedFlexibleIds: ['autre'] });
        assert(r.success === false && r.needsConfirmation === true, '4. Une confirmation qui ne porte pas sur cet événement flexible ne suffit pas');
        r = await app.planningEngine.executeIntent(intent(D1, '14:00', '15:30'), { allowFlexibleOverlap: true });
        assert(r.success === true && (await events(storage)).some(e => e.id === 'sport'), '5. Confirmé (garder les deux) : planifié, le flexible reste en place');
        r = await app.planningEngine.executeIntent(intent(D1, '14:00', '15:30'), { allowFlexibleOverlap: true });
        assert(r.success === false && r.duplicate === true, '6. Double acceptation : jamais de doublon de la même révision');
    }

    // --- Coach + chat : question, puis « non » → autre créneau, puis « déplace » ---
    {
        const { app, storage, chat } = await setup();
        const insights = await app.coachEngine.getInsights(await app.buildCoachContext({ useLLM: false }));
        const rec = insights.find(i => i.flexibleConflict);
        assert(rec && rec.actionable === false && !rec.intent, '7. Aucun créneau libre : la proposition devient une question (pas de bouton Accepter, pas d\'intent)');
        assert(rec && rec.flexibleConflict.intent.constraints.date === D1 && rec.flexibleConflict.intent.constraints.startTime === '14:00'
            && rec.flexibleConflict.overlappingFlexible[0].id === 'sport', '8. Le créneau proposé respecte l\'échéance et signale « Sport »');
        assert(rec && /Sport/.test(rec.message) && /« oui »/.test(rec.message) && /« déplace »/.test(rec.message) && /« remplace »/.test(rec.message) && /« non »/.test(rec.message),
            '9. Le message du coach pose la question avec les choix oui / déplace / remplace / non');

        await app.sendChatMessage('Aide-moi à planifier mes révisions');
        let msg = await lastAssistant(chat);
        const all = (await chat.getConversation('default')).filter(m => m.role === 'assistant');
        assert(all.some(m => m.metadata && m.metadata.flexibleConflict && !m.metadata.intent), '10. Dans le chat, la question est enregistrée sans bouton (metadata.flexibleConflict)');

        await app.sendChatMessage('non, un autre créneau');
        msg = await lastAssistant(chat);
        assert(msg.metadata.flexibleConflict && msg.metadata.flexibleConflict.intent.constraints.date === D2
            && msg.metadata.flexibleConflict.overlappingFlexible[0].id === 'sortie' && /Sortie/.test(msg.content),
            '11. « non » : le coach cherche un autre créneau (créneau refusé exclu) et repose la question pour « Sortie »');

        await app.sendChatMessage('déplace-la');
        msg = await lastAssistant(chat);
        const evs = await events(storage);
        const rev = evs.find(e => e.assessmentId === 'ass_m');
        const sortie = evs.find(e => e.id === 'sortie');
        assert(rev && rev.date === D2 && rev.startTime === '18:00' && rev.endTime === '19:30', '12. « déplace » : la révision est planifiée sur le créneau discuté');
        assert(sortie && sortie.date === D4 && sortie.startTime === '09:00' && sortie.endTime === '11:00' && /déplacé/.test(msg.content),
            '13. « déplace » : « Sortie » est décalée sur un créneau totalement libre et le coach le dit');
        assert(evs.find(e => e.id === 'cours').startTime === '20:00', '14. Le cours verrouillé n\'a pas bougé');
    }

    // --- « oui » (garder les deux) et « remplace » ---
    {
        const { app, storage, chat } = await setup();
        await app.sendChatMessage('Planifie mes révisions');
        await app.sendChatMessage('oui vas-y');
        const evs = await events(storage);
        assert(evs.some(e => e.assessmentId === 'ass_m' && e.date === D1 && e.startTime === '14:00') && evs.some(e => e.id === 'sport'),
            '15. « oui » : révision planifiée, « Sport » reste en place');
        const msg = await lastAssistant(chat);
        assert(/reste en place/.test(msg.content) && !msg.metadata.flexibleConflict, '16. Le coach confirme et la question est close');
    }
    {
        const { app, storage, chat } = await setup();
        await app.sendChatMessage('Planifie mes révisions');
        await app.sendChatMessage('remplace le sport');
        const evs = await events(storage);
        assert(evs.some(e => e.assessmentId === 'ass_m' && e.date === D1) && !evs.some(e => e.id === 'sport'),
            '17. « remplace » : révision planifiée et « Sport » retiré de l\'agenda');
    }
    {
        // La question expire dès que le coach a répondu à autre chose
        const { app, storage, chat } = await setup();
        await app.sendChatMessage('Planifie mes révisions');
        await chat.saveMessage({ role: 'user', content: 'Autre sujet', conversationId: 'default' });
        await chat.saveMessage({ role: 'assistant', content: 'Réponse sur autre chose', conversationId: 'default', metadata: { intent: null } });
        const pending = await (async () => { await chat.saveMessage({ role: 'user', content: 'oui', conversationId: 'default' }); return app._findPendingFlexibleConflict(); })();
        assert(pending === null, '18. Une ancienne question n\'est plus en attente après une autre réponse du coach');
    }
    {
        // Créneau libre disponible : proposition classique avec bouton Accepter, aucune question
        const { app, storage } = await setup();
        await storage.saveData('availabilities', [{ id: 'w0', date: D1, startTime: '08:00', endTime: '12:00' }]);
        const insights = await app.coachEngine.getInsights(await app.buildCoachContext({ useLLM: false }));
        const rec = insights.find(i => i.planningRequest);
        assert(rec && rec.intent && !rec.flexibleConflict && rec.intent.constraints.startTime === '08:00', '19. S\'il existe un créneau totalement libre, il est proposé en priorité (sans question)');
    }

    console.log(failures === 0 ? '\n=== TOUS LES TESTS PASSENT ===' : `\n=== ${failures} ÉCHEC(S) ===`);
}
run().catch(e => { console.error(e); process.exitCode = 1; });
