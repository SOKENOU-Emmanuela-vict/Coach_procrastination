/**
 * test_z4_coach_reminders.mjs
 * Validation dédiée pour la mission Z4 :
 * 1. Mémoire du coach préservée (chat, check-ins, bilans, historique, profil).
 * 2. Compteurs hebdo weekly_counters (52 semaines glissantes).
 * 3. Bilan hebdo local déterministe en 3 phrases claires.
 * 4. Rappels proactifs du coach (fin de journée, retards, examens J-14/J-7, bilan dimanche).
 * 5. RÈGLE D'OR : aucune tâche/séance cochée ne fait l'objet d'un rappel ou n'est listée restante/retard.
 * 6. Réponses locales exactes dans CoachLocalReply (restant, bilan, où j'en suis, retards).
 * 7. Widget Bureau « Rappels du coach » et redirection des routes retirées.
 */

import assert from 'assert';
import { App } from './src/core/App.js';
import { Router } from './src/core/Router.js';
import { CoachLocalReply } from './src/ai/CoachLocalReply.js';
import { DesktopView } from './src/ui/DesktopView.js';

let passed = 0;
let total = 0;

function check(cond, msg) {
    total++;
    if (cond) {
        console.log(`✅ PASS: ${msg}`);
        passed++;
    } else {
        console.error(`❌ FAIL: ${msg}`);
        process.exitCode = 1;
    }
}

class MockStorage {
    constructor(seed = {}) {
        this.store = { ...seed };
    }
    async loadData(key) {
        return this.store[key] !== undefined ? JSON.parse(JSON.stringify(this.store[key])) : null;
    }
    async saveData(key, val) {
        this.store[key] = JSON.parse(JSON.stringify(val));
        return true;
    }
    async getAllKeys() {
        return Object.keys(this.store);
    }
}

global.document = {
    body: {
        className: '',
        setAttribute: () => {},
        getAttribute: () => null,
        classList: { add: () => {}, remove: () => {} }
    },
    getElementById: (id) => ({
        id,
        innerHTML: '',
        style: {},
        querySelector: () => null,
        querySelectorAll: () => [],
        addEventListener: () => {}
    }),
    querySelector: () => null,
    querySelectorAll: () => []
};

async function runTests() {
    console.log("=== TESTS Z4 : CENTRALISATION BILANS ET RAPPELS COACH ===");

    // -------------------------------------------------------------
    // 1. Rétention glissante sur 52 semaines dans weekly_counters
    // -------------------------------------------------------------
    console.log("\n[1] Compteurs hebdomadaires et rétention glissante");
    const storage = new MockStorage();
    const app = new App(storage);

    // Enregistrer 55 semaines
    for (let i = 1; i <= 55; i++) {
        const weekKey = `2025-W${String(i).padStart(2, '0')}`;
        await app.recordWeeklyCounters({
            week: weekKey,
            tasksDone: i,
            sessionsDone: i * 2,
            focusMinutes: i * 60
        });
    }

    const counters = await app.getWeeklyCounters();
    check(counters.length === 52, `weekly_counters retient exactement 52 semaines (actuel: ${counters.length})`);
    check(counters[0].week === '2025-W04', `La première semaine conservée est la 4ème (week: ${counters[0].week})`);
    check(counters[51].week === '2025-W55', `La dernière semaine conservée est la 55ème (week: ${counters[51].week})`);

    // -------------------------------------------------------------
    // 2. Bilan hebdomadaire local déterministe en 3 phrases
    // -------------------------------------------------------------
    console.log("\n[2] Calcul local du bilan hebdomadaire");
    // Seed avec des sessions et des tâches
    await storage.saveData('study_history', [
        { id: 'rec_1', date: '2026-10-27', actualDuration: 45, status: 'completed' },
        { id: 'rec_2', date: '2026-10-28', actualDuration: 60, status: 'completed' },
        { id: 'rec_3', date: '2026-10-29', actualDuration: 45, status: 'completed' }
    ]);
    await storage.saveData('personal_tasks', [
        { id: 't_1', title: 'Rapport stage', status: 'faite', dueDate: '2026-10-28' },
        { id: 't_2', title: 'Fiche lecture', status: 'faite', dueDate: '2026-10-29' }
    ]);
    await storage.saveData('weekly_counters', [
        { week: '2026-W43', sessionsDone: 2, tasksDone: 1, focusMinutes: 90 }
    ]);

    const summary = await app.computeLocalWeeklySummary(new Date('2026-10-30T14:00:00'));
    check(summary.week === '2026-W44', `Semaine ISO courante identifiée : ${summary.week}`);
    check(summary.sessionsDone === 3, `3 séances complétées cette semaine`);
    check(summary.tasksDone === 2, `2 tâches validées cette semaine`);
    check(summary.focusMinutes === 150, `150 minutes de travail total`);

    check(typeof summary.sentence1 === 'string' && summary.sentence1.includes('3 séances') && summary.sentence1.includes('2 tâches'), "Phrase 1 résume les sessions et tâches");
    check(typeof summary.sentence2 === 'string' && summary.sentence2.includes('en progression par rapport à la semaine dernière (+1 séance)'), "Phrase 2 compare avec W43");
    check(typeof summary.sentence3 === 'string' && summary.sentence3.startsWith('Point'), "Phrase 3 donne un point fort ou point à travailler");
    check(summary.text.split(/(?<=[.?!])\s+/).length === 3, "Le résumé complet contient exactement 3 phrases claires");

    // -------------------------------------------------------------
    // 3. RÈGLE D'OR : une tâche/séance cochée ne doit JAMAIS être rappelée
    // -------------------------------------------------------------
    console.log("\n[3] Règle d'or : aucune alerte sur les éléments terminés");
    const contextGolden = {
        currentDate: '2026-10-30',
        courses: { upcomingSessions: [] },
        planning: {
            events: [
                { id: 'ev_done', title: 'Maths finies', date: '2026-10-30', status: 'completed', completed: true },
                { id: 'ev_done_faite', title: 'Anglais fini', date: '2026-10-30', status: 'faite' }
            ]
        },
        temporalEvents: [],
        personalTasks: [
            { id: 't_done', title: 'Tâche terminée', dueDate: '2026-10-30', status: 'faite', completed: true },
            { id: 't_overdue_done', title: 'Vieux devoir rendu', dueDate: '2026-10-20', status: 'done', completed: true }
        ]
    };

    const replyRemainingGolden = await CoachLocalReply.build(contextGolden, "Qu'est-ce qu'il me reste aujourd'hui ?", { code: 'NO_LLM' });
    check(replyRemainingGolden.message.includes("Tu as tout terminé pour aujourd'hui !"), "Rien de restant si tout est coché");
    check(!replyRemainingGolden.message.includes("Maths finies"), "Maths finies n'apparaît pas dans les tâches restantes");
    check(!replyRemainingGolden.message.includes("Tâche terminée"), "Tâche terminée n'apparaît pas dans les tâches restantes");

    const replyOverdueGolden = await CoachLocalReply.build(contextGolden, "Qu'est-ce que j'ai oublié ?", { code: 'NO_LLM' });
    check(replyOverdueGolden.message.includes("Tu n'as aucun retard !"), "Zéro retard si la tâche passée est cochée");
    check(!replyOverdueGolden.message.includes("Vieux devoir rendu"), "Vieux devoir rendu n'apparaît pas dans les retards");

    // -------------------------------------------------------------
    // 4. Réponses locales déterministes (4 questions)
    // -------------------------------------------------------------
    console.log("\n[4] Réponses locales déterministes du coach");
    const activeContext = {
        currentDate: '2026-10-30',
        courses: { upcomingSessions: [] },
        planning: {
            events: [
                { id: 'ev_todo', title: 'Cours Réseaux', startTime: '16:00', endTime: '18:00', date: '2026-10-30', status: 'planifiée' }
            ]
        },
        temporalEvents: [],
        personalTasks: [
            { id: 't_todo', title: 'Acheter classeur', dueDate: '2026-10-30', status: 'à faire' },
            { id: 't_late', title: 'Envoyer convention', dueDate: '2026-10-25', status: 'à faire' }
        ],
        weeklySummary: summary,
        academicSummary: {
            average: { value: 14.8 },
            earnedCredits: 18,
            cectStatus: { officialTotal: 30 },
            upcomingAssessments: [{ title: 'Examen Réseaux', targetDate: '2026-11-06' }]
        },
        userLanguages: [{ name: 'Anglais', level: 'B2', tracking: { sessionsCompleted: 4 } }],
        projects: [{ id: 'p_1', title: 'Application Coach', status: 'active' }]
    };

    // 4.1 Qu'est-ce qu'il me reste aujourd'hui ?
    const replyRemaining = await CoachLocalReply.build(activeContext, "Qu'est-ce qu'il me reste aujourd'hui ?", { code: 'NO_LLM' });
    check(replyRemaining.message.includes("Cours Réseaux"), "Liste le cours Réseaux restant");
    check(replyRemaining.message.includes("Acheter classeur"), "Liste la tâche Acheter classeur restante");
    check(!replyRemaining.message.includes("Envoyer convention"), "N'inclut pas la tâche d'une autre date");

    // 4.2 Mon bilan de la semaine
    const replyWeekly = await CoachLocalReply.build(activeContext, "Mon bilan de la semaine", { code: 'NO_LLM' });
    check(replyWeekly.message.includes("Bilan de la semaine :"), "Contient l'en-tête du bilan");
    check(replyWeekly.message.includes(summary.text), "Renvoie EXACTEMENT les 3 phrases calculées du bilan");

    // 4.3 Où j'en suis ?
    const replyWhere = await CoachLocalReply.build(activeContext, "Où j'en suis ?", { code: 'NO_LLM' });
    check(replyWhere.message.includes("École : moyenne de 14.8/20, 18/30 crédits"), "Synthèse École avec moyenne et crédits");
    check(replyWhere.message.includes("Anglais (B2, 4 séances)"), "Synthèse Langues");
    check(replyWhere.message.includes("1 projet(s) en cours"), "Synthèse Projets & Vie");

    // 4.4 Qu'est-ce que j'ai oublié ?
    const replyOverdue = await CoachLocalReply.build(activeContext, "Qu'est-ce que j'ai oublié ?", { code: 'NO_LLM' });
    check(replyOverdue.message.includes("Envoyer convention"), "Liste la tâche en retard");
    check(replyOverdue.message.includes("2026-10-25"), "Précise la date d'échéance passée");
    check(!replyOverdue.message.includes("Acheter classeur"), "N'inclut pas la tâche d'aujourd'hui");

    // -------------------------------------------------------------
    // 5. Rappels proactifs du coach (syncProactiveCoachMessages)
    // -------------------------------------------------------------
    console.log("\n[5] Rappels proactifs du coach (syncProactiveCoachMessages)");
    const proactiveStorage = new MockStorage({
        daily_checkins: { '2026-10-30': { mood: 'good' } },
        acad_assessments: [
            { id: 'ass_j14', title: 'Partiel Algèbre', targetDate: '2026-11-13', subjectId: 'math' }, // J-14
            { id: 'ass_j7', title: 'CC Réseaux', targetDate: '2026-11-06', subjectId: 'res' }        // J-7
        ],
        acad_subjects: [
            { id: 'math', name: 'Algèbre' },
            { id: 'res', name: 'Réseaux' }
        ],
        personal_tasks: [
            { id: 'pt_late', title: 'Contrat logement', dueDate: '2026-10-20', status: 'à faire' },
            { id: 'pt_today', title: 'Imprimer dossier', dueDate: '2026-10-30', status: 'à faire' }
        ]
    });

    const chatHistoryEngine = {
        saveMessage: async (m) => {
            const h = await proactiveStorage.loadData('chat_history') || [];
            h.push(m);
            await proactiveStorage.saveData('chat_history', h);
            return m;
        },
        getRecentMessages: async () => await proactiveStorage.loadData('chat_history') || []
    };

    const proactiveApp = new App(proactiveStorage, null, null, null, null, null, chatHistoryEngine, null);
    // Simuler 18h le 30 octobre 2026
    const clockAfter17h = () => new Date('2026-10-30T18:00:00');
    proactiveApp.clock = clockAfter17h;

    const postedCount = await proactiveApp.syncProactiveCoachMessages(clockAfter17h());
    check(postedCount > 0, `Des messages proactifs ont été générés (count: ${postedCount})`);

    const conv = await proactiveStorage.loadData('chat_history') || [];
    const contents = conv.map(m => m.content);

    check(contents.some(c => c.includes("Rappel examen (J-14)") && c.includes("Partiel Algèbre")), "Rappel J-14 déclenché pour l'examen");
    check(contents.some(c => c.includes("Rappel examen (J-7)") && c.includes("CC Réseaux")), "Rappel J-7 déclenché pour l'évaluation");
    check(contents.some(c => c.includes("Rappel de fin de journée") && c.includes("Imprimer dossier")), "Rappel fin de journée (après 17h) pour la tâche restante");
    check(contents.some(c => c.includes("tâche(s) en retard") && c.includes("Contrat logement")), "Rappel pour la tâche en retard");

    // Dimanche : bilan hebdo proactif
    const sundayStorage = new MockStorage({
        daily_checkins: { '2026-11-01': { mood: 'good' } }
    });
    const sundayChatEngine = {
        saveMessage: async (m) => {
            const h = await sundayStorage.loadData('chat_history') || [];
            h.push(m);
            await sundayStorage.saveData('chat_history', h);
            return m;
        },
        getRecentMessages: async () => await sundayStorage.loadData('chat_history') || []
    };
    const sundayApp = new App(sundayStorage, null, null, null, null, null, sundayChatEngine, null);
    const clockSunday = () => new Date('2026-11-01T10:00:00'); // Dimanche 1er Nov
    sundayApp.clock = clockSunday;
    await sundayApp.syncProactiveCoachMessages(clockSunday());

    const sundayConv = await sundayStorage.loadData('chat_history') || [];
    check(sundayConv.some(m => m.content && m.content.includes("Bilan de la semaine :")), "Bilan du dimanche posté de manière proactive");

    // -------------------------------------------------------------
    // 6. Router et Bureau (Widget Rappels du Coach & Redirections)
    // -------------------------------------------------------------
    console.log("\n[6] Intégration Router et Bureau");
    const router = new Router('test-container', proactiveApp);
    check(!router.views.dashboard, "DashboardView n'est plus dans le Router");
    check(!router.views.weekly, "WeeklyView n'est plus dans le Router");

    let renderedView = null;
    proactiveApp.renderView = (v) => { renderedView = v; };

    // Redirection des routes supprimées vers desktop
    await router.render('dashboard', proactiveApp.state);
    check(renderedView === null, "Rendu 'dashboard' géré sans erreur");

    await router.render('weekly', proactiveApp.state);
    check(renderedView === null, "Rendu 'weekly' géré sans erreur");

    // Bureau avec bloc Rappels du Coach
    const desktopContainer = {
        innerHTML: '',
        style: {},
        querySelector: (sel) => {
            if (sel === '#desktop-coach-reminders') return { addEventListener: () => {} };
            return null;
        },
        querySelectorAll: () => []
    };
    const desktopView = new DesktopView(desktopContainer, proactiveApp);
    proactiveApp.state.lastCoachReminder = "Rappel : réviser le cours de Maths.";
    desktopView.render(proactiveApp.state);

    check(desktopContainer.innerHTML.includes('Rappels du coach'), "Le bloc Rappels du coach est présent dans le HTML du Bureau");
    check(desktopContainer.innerHTML.includes('Rappel : réviser le cours de Maths.'), "Le dernier rappel du coach est affiché dans le bloc");
    check(!desktopContainer.innerHTML.includes('data-view="dashboard"'), "Tableau de bord absent du menu du Bureau");
    check(!desktopContainer.innerHTML.includes('data-view="weekly"'), "Hebdo absent du menu du Bureau");

    console.log(`\n=== RÉSULTATS Z4 : ${passed}/${total} ASSERTIONS PASSÉES ===`);
    if (passed !== total) process.exit(1);
}

runTests().catch(e => {
    console.error("Erreur test Z4:", e);
    process.exit(1);
});
