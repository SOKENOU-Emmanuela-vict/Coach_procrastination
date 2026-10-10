/**
 * test_ecart_3_weekly_review_and_coach_nudge.mjs
 * Test dédié pour le point 3 :
 * - Afficher la phrase de tendance dans la Weekly Review.
 * - Faire dire au coach dans le chat quand la tendance change nettement
 *   (une seule fois par changement, via coach_nudges).
 * - Si insufficientData : le dire, ne pas conclure.
 */
import { WeeklyReviewEngine } from './src/engines/WeeklyReviewEngine.js';
import { WeeklyView } from './src/ui/WeeklyView.js';
import { DailySnapshotEngine } from './src/engines/DailySnapshotEngine.js';
import { App } from './src/core/App.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
    if (condition) {
        console.log(`✅ PASS: ${message}`);
        passed++;
    } else {
        console.error(`❌ FAIL: ${message}`);
        failed++;
    }
}

class MockStorage {
    constructor() {
        this.data = {
            daily_snapshots: [],
            daily_checkins: {},
            events: [],
            study_history: [],
            coach_nudges: {},
            chat_messages: []
        };
    }
    async loadData(key) {
        return this.data[key] !== undefined ? JSON.parse(JSON.stringify(this.data[key])) : null;
    }
    async saveData(key, val) {
        this.data[key] = JSON.parse(JSON.stringify(val));
    }
}

async function run() {
    console.log("=== TEST ÉCART 3 : Weekly Review & Coach Nudges sur Tendance ===");
    const storage = new MockStorage();

    // -------------------------------------------------------------
    // PARTIE 1 : Weekly Review Engine & View (Affichage de la phrase)
    // -------------------------------------------------------------
    const mockPlanning = {
        getEvents: async () => []
    };
    const mockStudyRecords = {
        getFullHistory: async () => []
    };
    const mockCheckIn = {
        getCheckIns: async () => [],
        buildDailySummary: async (date) => ({
            date,
            planned: { totalSessions: 0, minutes: 0, items: [] },
            actual: { minutes: 0, items: [] },
            execution: { completed: 0, partial: 0, missed: 0, cancelled: 0 },
            declarative: null
        })
    };

    const weeklyEngine = new WeeklyReviewEngine(storage, mockPlanning, null, mockStudyRecords, mockCheckIn);

    // 1.1 Cas sans données suffisantes (< 21 jours)
    const summary1 = await weeklyEngine.buildWeeklySummary('2026-10-01', '2026-10-07');
    assert(typeof summary1.trendSentence === 'string', "summary1.trendSentence est présent");
    assert(summary1.trendSentence.includes("Données insuffisantes"), "Weekly Review : dit données insuffisantes si < 21 jours");
    assert(!summary1.trendSentence.includes("tu t'améliores"), "Weekly Review : ne conclut pas prématurément");

    // Simuler le rendu WeeklyView
    const fakeContainer = { innerHTML: '', addEventListener: () => {} };
    global.document = {
        getElementById: () => fakeContainer
    };
    const weeklyView = new WeeklyView('fake-id', { renderView: () => {} });
    weeklyView.render(summary1);
    assert(fakeContainer.innerHTML.includes("Tendance de Fond"), "WeeklyView contient le bloc Tendance de Fond");
    assert(fakeContainer.innerHTML.includes("Données insuffisantes"), "WeeklyView affiche la phrase données insuffisantes");

    // 1.2 Cas avec 21 jours de snapshots (14 jours de base à 62, 7 jours récents à 48)
    const snapshotEngine = new DailySnapshotEngine(storage);
    for (let i = 1; i <= 14; i++) {
        await snapshotEngine.saveSnapshot({
            date: `2026-09-${String(i).padStart(2, '0')}`,
            risk: 62,
            completion: 40
        });
    }
    for (let i = 15; i <= 21; i++) {
        await snapshotEngine.saveSnapshot({
            date: `2026-09-${String(i).padStart(2, '0')}`,
            risk: 48,
            completion: 80
        });
    }

    const summary2 = await weeklyEngine.buildWeeklySummary('2026-09-15', '2026-09-21');
    assert(summary2.trendSentence.includes("-14 points"), "Weekly Review : affiche la phrase chiffrée (-14 points)");
    assert(summary2.trendSentence.toLowerCase().includes("tu t'améliores"), "Weekly Review : affiche l'amélioration");

    weeklyView.render(summary2);
    assert(fakeContainer.innerHTML.includes("-14 points"), "WeeklyView affiche bien la phrase chiffrée dans le DOM");

    // -------------------------------------------------------------
    // PARTIE 2 : Coach Nudges dans le Chat (une seule fois par changement net)
    // -------------------------------------------------------------
    const appStorage = new MockStorage();
    const chatMsgsList = [];
    const chatHistoryEngine = {
        saveMessage: async (msg) => {
            chatMsgsList.push(msg);
            await appStorage.saveData('chat_messages', chatMsgsList);
            return msg;
        },
        getMessages: async () => chatMsgsList
    };

    const app = new App(
        appStorage,
        null,
        { getDailyStats: async () => ({}), getFullHistory: async () => [], getMonthlyStats: async () => ({}) },
        { buildDailySummary: async () => ({}), getCheckIn: async () => ({}) },
        null,
        null,
        chatHistoryEngine,
        null
    );

    app.academicEngine = {
        getSemesterSummary: async () => ({}),
        getSubjects: async () => [],
        getGrades: async () => [],
        getAssessments: async () => []
    };
    app.planningEngine = {
        getEventsForDate: async () => []
    };
    app.refreshCourseProgress = async () => {};

    // 2.1 Premier appel avec snapshots vides -> insufficientData
    // Le coach doit dire que les données sont insuffisantes (sans conclure)
    let postedCount1 = await app.syncProactiveCoachMessages(new Date('2026-10-10T10:00:00'));
    let chatMsgs = await appStorage.loadData('chat_messages') || [];
    let trendMsgs = chatMsgs.filter(m => m.metadata?.proactive === 'trend');
    assert(trendMsgs.length === 1, "Coach parle 1 fois pour annoncer données insuffisantes");
    assert(trendMsgs[0].content.includes("Données insuffisantes"), "Coach dit que les données sont insuffisantes");
    assert(!trendMsgs[0].content.includes("tu t'améliores"), "Coach ne conclut pas");

    // Vérification que le state est bien dans coach_nudges
    let nudges = await appStorage.loadData('coach_nudges');
    assert(nudges.trend_state?.lastState === 'insufficient_data', "coach_nudges a mémorisé 'insufficient_data'");

    // 2.2 Deuxième appel le même jour ou lendemain (toujours insufficient_data)
    let postedCount2 = await app.syncProactiveCoachMessages(new Date('2026-10-11T10:00:00'));
    chatMsgs = await appStorage.loadData('chat_messages') || [];
    trendMsgs = chatMsgs.filter(m => m.metadata?.proactive === 'trend');
    assert(trendMsgs.length === 1, "Coach ne répète PAS le message si la tendance n'a pas changé");

    // 2.3 On alimente 21 jours avec une nette amélioration (risque 62 -> 48)
    const appSnapEngine = new DailySnapshotEngine(appStorage);
    for (let i = 1; i <= 14; i++) {
        await appSnapEngine.saveSnapshot({
            date: `2026-09-${String(i).padStart(2, '0')}`,
            risk: 62,
            completion: 40
        });
    }
    for (let i = 15; i <= 21; i++) {
        await appSnapEngine.saveSnapshot({
            date: `2026-09-${String(i).padStart(2, '0')}`,
            risk: 48,
            completion: 80
        });
    }

    // Le coach détecte un changement net vers 'improving'
    let postedCount3 = await app.syncProactiveCoachMessages(new Date('2026-09-21T10:00:00'));
    chatMsgs = await appStorage.loadData('chat_messages') || [];
    trendMsgs = chatMsgs.filter(m => m.metadata?.proactive === 'trend');
    assert(trendMsgs.length === 2, "Coach parle une 2ème fois car la tendance a nettement changé ('improving')");
    assert(trendMsgs[1].content.includes("-14 points"), "Coach cite les chiffres (-14 points)");
    assert(trendMsgs[1].content.toLowerCase().includes("tu t'améliores"), "Coach annonce l'amélioration");

    nudges = await appStorage.loadData('coach_nudges');
    assert(nudges.trend_state?.lastState === 'improving', "coach_nudges a mémorisé le nouvel état 'improving'");

    // 2.4 Appel ultérieur sans changement d'état : ne doit pas re-notifier
    await app.syncProactiveCoachMessages(new Date('2026-09-22T10:00:00'));
    chatMsgs = await appStorage.loadData('chat_messages') || [];
    trendMsgs = chatMsgs.filter(m => m.metadata?.proactive === 'trend');
    assert(trendMsgs.length === 2, "Coach ne re-notifie pas si l'état reste 'improving'");

    // 2.5 Changement vers dégradation ('worsening') : risque monte à 75
    for (let i = 22; i <= 28; i++) {
        await appSnapEngine.saveSnapshot({
            date: `2026-09-${String(i).padStart(2, '0')}`,
            risk: 75,
            completion: 20
        });
    }
    await app.syncProactiveCoachMessages(new Date('2026-09-28T10:00:00'));
    chatMsgs = await appStorage.loadData('chat_messages') || [];
    trendMsgs = chatMsgs.filter(m => m.metadata?.proactive === 'trend');
    assert(trendMsgs.length === 3, "Coach parle une 3ème fois car la tendance a basculé vers 'worsening'");
    assert(trendMsgs[2].content.toLowerCase().includes("tu procrastines plus qu'avant"), "Coach annonce la hausse de procrastination sans jugement dur");
    nudges = await appStorage.loadData('coach_nudges');
    assert(nudges.trend_state?.lastState === 'worsening', "coach_nudges a mémorisé le nouvel état 'worsening'");

    console.log(`\nResultats: ${passed}/${passed + failed} assertions PASS`);
    if (failed > 0) process.exit(1);
}

run();
