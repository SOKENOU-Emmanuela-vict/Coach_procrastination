/**
 * test_ecart_1_coach_truth_and_checkin.mjs
 * Test dédié pour le point 1 :
 * - Check-in : ne jamais enregistrer de valeur par défaut. Si l'humeur, l'énergie
 *   ou la motivation ne sont pas comprises, les redemander ; ne rien afficher
 *   qu'on n'a pas reçu.
 * - Poser UNE question à la fois : d'abord l'humeur, puis l'énergie, puis la motivation.
 *   Reconnaissance par règles, reformulation brève entre chaque question.
 * - Aucune donnée inventée par le coach.
 */
import { DailyCheckIn } from './src/models/DailyCheckIn.js';
import { App } from './src/core/App.js';
import { CheckInEngine } from './src/engines/CheckInEngine.js';

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
            daily_checkins: {},
            chat_messages: [],
            pending_checkin_conv: null,
            events: [],
            study_history: []
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
    console.log("=== TEST ÉCART 1 : Vérité du Coach & Check-in Conversationnel ===");
    global.document = {
        getElementById: () => ({ addEventListener: () => {}, innerHTML: '', style: {} }),
        querySelector: () => null,
        querySelectorAll: () => []
    };

    // 1. DailyCheckIn ne stocke plus de valeur par défaut inventée
    const blankCheckIn = new DailyCheckIn({ date: '2026-10-11' });
    assert(blankCheckIn.mood === null, "blankCheckIn.mood est null (pas de default inventé)");
    assert(blankCheckIn.energy === null, "blankCheckIn.energy est null (pas de default inventé)");
    assert(blankCheckIn.motivation === null, "blankCheckIn.motivation est null (pas de default inventé)");
    assert(blankCheckIn.sleep === null, "blankCheckIn.sleep est null (pas de 420min inventé)");
    assert(blankCheckIn.dayAssessment === null, "blankCheckIn.dayAssessment est null");

    // 2. Déroulement conversationnel étape par étape avec reformulation et re-demande si incompris
    const storage = new MockStorage();
    const chatMsgsList = [];
    const chatHistoryEngine = {
        saveMessage: async (msg) => {
            chatMsgsList.push(msg);
            await storage.saveData('chat_messages', chatMsgsList);
            return msg;
        },
        getRecentMessages: async () => chatMsgsList,
        getMessages: async () => chatMsgsList
    };

    const checkInEngine = new CheckInEngine(storage, null, null, { getFullHistory: async () => [] });
    const app = new App(
        storage,
        null,
        { getDailyStats: async () => ({}), getFullHistory: async () => [], getMonthlyStats: async () => ({}) },
        checkInEngine,
        null,
        null,
        chatHistoryEngine,
        null
    );
    app.academicEngine = { getSemesterSummary: async () => ({}), getSubjects: async () => [], getGrades: async () => [], getAssessments: async () => [] };
    app.planningEngine = { getEventsForDate: async () => [], getAvailableSlots: async () => [], detectConflicts: async () => [] };
    app.refreshCourseProgress = async () => {};
    app.renderView = () => {};

    // 2.1 L'utilisatrice lance le check-in
    await app.sendChatMessage("Je veux faire mon bilan");
    let lastMsg = chatMsgsList[chatMsgsList.length - 1];
    assert(lastMsg.role === 'assistant', "Le coach répond pour démarrer le bilan");
    assert(lastMsg.content.includes("humeur"), "La 1ère question porte UNIQUEMENT sur l'humeur");
    assert(!lastMsg.content.includes("énergie"), "Ne pose pas la question d'énergie en même temps");

    // 2.2 Réponse incomprise pour l'humeur -> le coach ne devine rien, il redemande
    await app.sendChatMessage("abracadabra météo");
    lastMsg = chatMsgsList[chatMsgsList.length - 1];
    assert(lastMsg.content.includes("pas bien compris ton humeur"), "Le coach redemande l'humeur si incomprise");
    let pending = await storage.loadData('pending_checkin_conv');
    assert(pending.step === 'mood', "Reste à l'étape mood tant que non comprise");

    // 2.3 Réponse valide pour l'humeur -> reformulation brève + question Énergie
    await app.sendChatMessage("Je suis de très bonne humeur, super contente");
    lastMsg = chatMsgsList[chatMsgsList.length - 1];
    assert(lastMsg.content.toLowerCase().includes("bonne humeur"), "Coach reformule l'humeur");
    assert(lastMsg.content.includes("énergie"), "Coach passe à la question sur l'énergie");
    pending = await storage.loadData('pending_checkin_conv');
    assert(pending.data.mood === 'high', "Humeur reconnue comme 'high'");
    assert(pending.step === 'energy', "Étape passée à 'energy'");

    // 2.4 Réponse incomprise pour l'énergie -> redemande l'énergie
    await app.sendChatMessage("je sais pas trop xxxx");
    lastMsg = chatMsgsList[chatMsgsList.length - 1];
    assert(lastMsg.content.includes("pas bien saisi ton niveau d'énergie"), "Coach redemande l'énergie");
    pending = await storage.loadData('pending_checkin_conv');
    assert(pending.step === 'energy', "Reste à l'étape energy");

    // 2.5 Réponse valide pour l'énergie -> reformulation brève + question Motivation
    await app.sendChatMessage("Je me sens un peu fatiguée, énergie basse aujourd'hui");
    lastMsg = chatMsgsList[chatMsgsList.length - 1];
    assert(lastMsg.content.includes("Énergie basse"), "Coach reformule l'énergie");
    assert(lastMsg.content.includes("motivation"), "Coach passe à la question sur la motivation");
    pending = await storage.loadData('pending_checkin_conv');
    assert(pending.data.energy === 'low', "Énergie reconnue comme 'low'");
    assert(pending.step === 'motivation', "Étape passée à 'motivation'");

    // 2.6 Réponse incomprise pour la motivation -> redemande la motivation
    await app.sendChatMessage("peut-être que oui peut-être que non");
    lastMsg = chatMsgsList[chatMsgsList.length - 1];
    assert(lastMsg.content.includes("préciser si ta motivation"), "Coach redemande la motivation");
    pending = await storage.loadData('pending_checkin_conv');
    assert(pending.step === 'motivation', "Reste à l'étape motivation");

    // 2.7 Réponse valide pour la motivation -> enregistrement du check-in réel
    await app.sendChatMessage("Par contre je suis super motivée, à fond pour mes cours !");
    lastMsg = chatMsgsList[chatMsgsList.length - 1];
    assert(lastMsg.content.includes("Ton bilan du jour est enregistré"), "Coach confirme l'enregistrement");
    assert(lastMsg.content.includes("humeur bonne"), "Récapitule humeur bonne");
    assert(lastMsg.content.includes("énergie basse"), "Récapitule énergie basse");
    assert(lastMsg.content.includes("motivation forte"), "Récapitule motivation forte");

    // 2.8 Vérification des données enregistrées en base
    const savedCheckIns = await storage.loadData('daily_checkins');
    const todayStr = app._todayStr();
    const todayCheckIn = savedCheckIns[todayStr];
    assert(todayCheckIn !== undefined, "Check-in bien présent en base");
    assert(todayCheckIn.mood === 'high', "Donnée réelle enregistrée : mood = high");
    assert(todayCheckIn.energy === 'low', "Donnée réelle enregistrée : energy = low");
    assert(todayCheckIn.motivation === 'high', "Donnée réelle enregistrée : motivation = high");

    pending = await storage.loadData('pending_checkin_conv');
    assert(pending === null, "La conversation de check-in est terminée (pending = null)");

    console.log(`\nRésultats: ${passed}/${passed + failed} assertions PASS`);
    if (failed > 0) process.exit(1);
}

run();
