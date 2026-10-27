/**
 * test_x2_checkin_nonblocking.mjs
 * Validation X2 : Check-in qui ne bloque plus.
 * Vérifie :
 * 1. Bilan en cours + question hors-sujet -> réponse à la question + rappel unique
 * 2. Pas de rappel répété pour les questions suivantes le même jour
 * 3. Données déjà collectées (humeur, énergie) préservées
 * 4. Déroulement normal jusqu'à l'enregistrement final
 * 5. Report explicite avec "plus tard" / "passer" sans rappel immédiat
 */

global.document = {
    getElementById: () => ({ innerHTML: '', addEventListener: () => {}, classList: { add: () => {}, remove: () => {} }, querySelectorAll: () => [], querySelector: () => null }),
    querySelectorAll: () => [],
    querySelector: () => null,
    body: { className: '', classList: { add: () => {}, remove: () => {} } }
};
global.window = {
    addEventListener: () => {},
    matchMedia: () => ({ matches: false })
};

import { App } from './src/core/App.js';

let passed = 0;
let total = 0;

function assert(cond, msg) {
    total++;
    if (cond) {
        console.log(`✅ PASS: ${msg}`);
        passed++;
    } else {
        console.error(`❌ FAIL: ${msg}`);
        process.exitCode = 1;
    }
}

async function runTests() {
    console.log("=== TESTS X2 : CHECK-IN NON BLOQUANT & REPORTABLE ===");

    const createMockApp = (customDate = '2026-10-27') => {
        const storage = {
            data: {},
            loadData: async (k) => storage.data[k] || null,
            saveData: async (k, v) => { storage.data[k] = v; },
            loadDataSync: (k) => storage.data[k] || null,
            saveDataSync: (k, v) => { storage.data[k] = v; }
        };

        const messages = [];
        const chatHistoryEngine = {
            getConversation: async () => messages,
            getRecentMessages: async () => messages,
            saveMessage: async (msg) => {
                messages.push({ ...msg, timestamp: Date.now() });
                return msg;
            }
        };

        const checkInEngine = {
            savedCheckins: {},
            saveCheckIn: async (d) => {
                checkInEngine.savedCheckins[d.date] = d;
                const checkins = await storage.loadData('daily_checkins') || {};
                checkins[d.date] = d;
                await storage.saveData('daily_checkins', checkins);
            },
            buildDailySummary: async () => ({})
        };

        const app = new App(storage, null, null, checkInEngine, null, null, chatHistoryEngine, null);
        app.router = { render: async () => {} };
        app._todayStr = () => customDate;
        app.getPedagogicalDate = () => customDate;
        app.buildCoachContext = async () => ({ currentDate: customDate, timetableStatus: null, todaySessions: [] });
        app.coachEngine = {
            getInsights: async (ctx, userText) => {
                return [{
                    id: 'coach_reply_1',
                    title: 'Réponse Coach',
                    message: `Réponse à : "${userText}"`,
                    intent: null
                }];
            }
        };
        return { app, storage, messages, checkInEngine };
    };

    // -------------------------------------------------------------
    // Test 1 : Bilan en cours (étape mood) + question hors-sujet
    // -------------------------------------------------------------
    {
        const { app, storage, messages } = createMockApp('2026-10-27');
        // État : check-in déclenché, en attente de l'humeur
        await storage.saveData('pending_checkin_conv', { step: 'mood', date: '2026-10-27', data: {} });

        // L'utilisateur pose une question hors-sujet
        await app.sendChatMessage("Quel temps fait-il sur Mars ?");

        const replies = messages.filter(m => m.role === 'assistant');
        assert(replies.length >= 2, "Le coach a émis la réponse à la question + le rappel");
        assert(replies[0].content.includes('Quel temps fait-il sur Mars'), "Le coach répond à la question utilisateur d'abord");
        assert(replies[1].content.includes('Rappel') || replies[1].content.includes('bilan du jour'), "Le coach émet ensuite un rappel unique du bilan");

        // Vérifier que pending_checkin_conv est intact
        const pending = await storage.loadData('pending_checkin_conv');
        assert(pending && pending.step === 'mood', "L'étape mood est toujours en attente");
        assert(pending.lastRemindedDate === '2026-10-27', "La date de dernier rappel est notée pour aujourd'hui");

        // Deuxième question hors-sujet le même jour
        const countBefore = messages.filter(m => m.role === 'assistant').length;
        await app.sendChatMessage("Et sur Jupiter ?");
        const countAfter = messages.filter(m => m.role === 'assistant').length;
        assert(countAfter === countBefore + 1, "Rappel unique : aucun deuxième rappel n'est envoyé pour la 2ème question hors-sujet");
        const lastReply = messages[messages.length - 1];
        assert(lastReply.content.includes('Jupiter'), "Le coach répond à la 2ème question normalement");
    }

    // -------------------------------------------------------------
    // Test 2 : Réponse d'humeur, puis question hors-sujet à l'étape énergie
    // -------------------------------------------------------------
    {
        const { app, storage, messages } = createMockApp('2026-10-27');
        await storage.saveData('pending_checkin_conv', { step: 'mood', date: '2026-10-27', data: {} });

        // Réponse d'humeur valide
        await app.sendChatMessage("Je suis de bonne humeur aujourd'hui");
        let pending = await storage.loadData('pending_checkin_conv');
        assert(pending && pending.step === 'energy', "Passage à l'étape énergie après réponse humeur valide");
        assert(pending.data.mood === 'high', "Donnée mood: high enregistrée dans pending");

        // Question hors-sujet pendant l'étape énergie
        await app.sendChatMessage("Où est mon prochain cours ?");
        const replies = messages.filter(m => m.role === 'assistant');
        const lastReplies = replies.slice(-2);
        assert(lastReplies[0].content.includes('prochain cours'), "Le coach répond à la question du cours");
        assert(lastReplies[1].content.includes('énergie'), "Le rappel mentionne qu'il reste l'étape énergie");

        pending = await storage.loadData('pending_checkin_conv');
        assert(pending.data.mood === 'high', "L'humeur précédente est restée intacte");
        assert(pending.step === 'energy', "L'étape est toujours énergie");

        // Réponse énergie valide
        await app.sendChatMessage("Énergie moyenne");
        pending = await storage.loadData('pending_checkin_conv');
        assert(pending && pending.step === 'motivation', "Passage à l'étape motivation");
        assert(pending.data.energy === 'medium', "Donnée energy: medium enregistrée");

        // Réponse motivation valide -> Enregistrement final
        await app.sendChatMessage("Motivation forte !");
        const finalPending = await storage.loadData('pending_checkin_conv');
        assert(finalPending === null, "pending_checkin_conv supprimé après validation complète");

        const savedCheckins = await storage.loadData('daily_checkins');
        assert(savedCheckins && savedCheckins['2026-10-27'], "Check-in bien sauvegardé dans daily_checkins");
        assert(savedCheckins['2026-10-27'].mood === 'high' && savedCheckins['2026-10-27'].energy === 'medium' && savedCheckins['2026-10-27'].motivation === 'high', "Toutes les valeurs saisies pas-à-pas sont exactes");
    }

    // -------------------------------------------------------------
    // Test 3 : Report avec "plus tard" / "passer"
    // -------------------------------------------------------------
    {
        const { app, storage, messages } = createMockApp('2026-10-27');
        await storage.saveData('pending_checkin_conv', { step: 'mood', date: '2026-10-27', data: {} });

        // L'utilisateur demande de reporter
        await app.sendChatMessage("plus tard");
        let pending = await storage.loadData('pending_checkin_conv');
        assert(pending && pending.postponedDate === '2026-10-27', "Le check-in est marqué reporté pour aujourd'hui");

        const lastCoach = messages[messages.length - 1];
        assert(lastCoach.content.includes('reporter') || lastCoach.content.includes('plus tard'), "Le coach confirme le report");

        // Question suivante : le coach répond SANS rappel puisque c'est reporté
        const countBefore = messages.filter(m => m.role === 'assistant').length;
        await app.sendChatMessage("Résume mes projets");
        const countAfter = messages.filter(m => m.role === 'assistant').length;
        assert(countAfter === countBefore + 1, "Une seule réponse émise : aucun rappel après report");

        // L'utilisateur décide de reprendre plus tard
        await app.sendChatMessage("faire mon bilan");
        pending = await storage.loadData('pending_checkin_conv');
        assert(pending.postponedDate === null, "Le report est levé lors de la reprise");
        const resumeCoach = messages[messages.length - 1];
        assert(resumeCoach.content.includes('humeur') || resumeCoach.content.includes('bilan'), "Le coach relance la question d'humeur");
    }

    console.log(`\nRÉSULTAT : ${passed} / ${total} assertions validées.`);
    if (passed !== total) process.exitCode = 1;
}

runTests().catch(err => {
    console.error("Erreur inattendue dans le test :", err);
    process.exitCode = 1;
});
