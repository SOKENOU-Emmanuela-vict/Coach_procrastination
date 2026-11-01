// Mock minimal DOM for Node.js test environment
global.document = {
    body: { className: '', setAttribute: () => {}, classList: { add: () => {}, remove: () => {} } },
    getElementById: () => ({ style: {}, querySelector: () => null, querySelectorAll: () => [] }),
    querySelector: () => null,
    querySelectorAll: () => []
};

import assert from 'assert';
import { CoachLocalReply } from './src/ai/CoachLocalReply.js';
import { App } from './src/core/App.js';

class MockStorage {
    constructor(initial = {}) {
        this.data = { ...initial };
    }
    async loadData(key) {
        return this.data[key] !== undefined ? JSON.parse(JSON.stringify(this.data[key])) : null;
    }
    async saveData(key, val) {
        this.data[key] = JSON.parse(JSON.stringify(val));
    }
}

console.log("=== TESTS U2-0 : VÉRIFICATION DU BILAN HEBDO SANS COMPLIMENT INVENTÉ ===");

let passed = 0;
function check(cond, msg) {
    assert(cond, msg);
    console.log(`✅ PASS: ${msg}`);
    passed++;
}

// -------------------------------------------------------------------------
// SCÉNARIO 1 : BASE TOTALEMENT VIDE
// -------------------------------------------------------------------------
console.log("\n[1] Scénario 1 : Base vide (0 séance, 0 tâche, 0 historique)");
{
    const storageEmpty = new MockStorage({});
    const appEmpty = new App(storageEmpty, null, null, null, null, null, null, null);
    appEmpty.clock = () => new Date('2026-11-01T10:00:00'); // Dimanche 1er Nov 2026

    const summaryEmpty = await appEmpty.computeLocalWeeklySummary(appEmpty.clock());
    console.log("--- Réponse computeLocalWeeklySummary (base vide) : ---");
    console.log(summaryEmpty.text);

    check(summaryEmpty.sessionsDone === 0, "0 séance faite");
    check(summaryEmpty.tasksDone === 0, "0 tâche faite");
    check(summaryEmpty.text.includes("Rien d'enregistré cette semaine pour l'instant."), "Dit explicitement qu'il n'y a rien d'enregistré");
    check(summaryEmpty.text.includes("Pense à planifier"), "Propose une suggestion concrète");
    check(!summaryEmpty.text.includes("dynamique positive"), "Aucun compliment inventé 'dynamique positive'");
    check(!summaryEmpty.text.includes("régulier par rapport à la semaine précédente"), "Aucune comparaison inventée");
    check(!summaryEmpty.text.includes("Point fort :"), "Pas de 'Point fort' sans réalisation");

    // Test de la question directe dans le chat via CoachLocalReply
    const emptyContext = {
        currentDate: '2026-11-01',
        tasks: [],
        sessions: [],
        weeklySummary: summaryEmpty
    };
    const chatReplyEmpty = await CoachLocalReply.build(emptyContext, "Mon bilan de la semaine", { code: 'NO_LLM' });
    console.log("--- Réponse Chat 'Mon bilan de la semaine' (base vide) : ---");
    console.log(chatReplyEmpty.message);
    check(chatReplyEmpty.message.includes("Rien d'enregistré cette semaine pour l'instant."), "Le chat répond honnêtement sur base vide");
    check(!chatReplyEmpty.message.includes("Point fort"), "Le chat ne donne aucun Point fort inventé");

    // Test sans weeklySummary précalculé (repli direct de CoachLocalReply)
    const chatFallbackEmpty = await CoachLocalReply.build({ currentDate: '2026-11-01', tasks: [], sessions: [] }, "Mon bilan de la semaine", { code: 'NO_LLM' });
    console.log("--- Réponse Chat fallback sans weeklySummary (base vide) : ---");
    console.log(chatFallbackEmpty.message);
    check(chatFallbackEmpty.message.includes("Rien d'enregistré cette semaine pour l'instant."), "Le fallback direct répond honnêtement sur base vide");
    check(!chatFallbackEmpty.message.includes("Point fort"), "Le fallback direct ne donne aucun Point fort inventé");
}

// -------------------------------------------------------------------------
// SCÉNARIO 2 : UNE SEULE SÉANCE / TÂCHE (Activité légère)
// -------------------------------------------------------------------------
console.log("\n[2] Scénario 2 : Activité légère (1 séance, 1 tâche)");
{
    const storage1 = new MockStorage({
        study_history: [
            { id: 'h1', date: '2026-10-28', actualDuration: 45, status: 'completed' }
        ],
        personal_tasks: [
            { id: 't1', title: 'Lire chapitre 1', status: 'faite' }
        ]
    });
    const app1 = new App(storage1, null, null, null, null, null, null, null);
    app1.clock = () => new Date('2026-11-01T10:00:00');

    const summary1 = await app1.computeLocalWeeklySummary(app1.clock());
    console.log("--- Réponse computeLocalWeeklySummary (1 séance, 1 tâche) : ---");
    console.log(summary1.text);

    check(summary1.sessionsDone === 1, "1 séance accomplie");
    check(summary1.tasksDone === 1, "1 tâche validée");
    check(summary1.text.includes("1 séance et validé 1 tâche"), "Mentionne exactement les chiffres réels");
    check(summary1.text.includes("première semaine de suivi"), "Mentionne première semaine sans inventer de progression");
    check(!summary1.text.includes("Point fort :"), "Pas de 'Point fort' car seuil d'assiduité (>=3) non atteint");
    check(summary1.text.includes("Suggestion :"), "Donne un encouragement mesuré sous forme de suggestion");
}

// -------------------------------------------------------------------------
// SCÉNARIO 3 : PLUSIEURS SEMAINES AVEC VRAIE PROGRESSION ET RETARDS
// -------------------------------------------------------------------------
console.log("\n[3] Scénario 3 : Plusieurs semaines avec historique réel et comparaison");
{
    const storageMulti = new MockStorage({
        weekly_counters: [
            { week: '2026-W43', sessionsDone: 2, tasksDone: 1, focusMinutes: 90 }
        ],
        study_history: [
            { id: 'h1', date: '2026-10-27', actualDuration: 60, status: 'completed' },
            { id: 'h2', date: '2026-10-29', actualDuration: 60, status: 'completed' },
            { id: 'h3', date: '2026-10-31', actualDuration: 60, status: 'completed' },
            { id: 'h4', date: '2026-11-01', actualDuration: 60, status: 'completed' }
        ],
        personal_tasks: [
            { id: 't1', title: 'Devoir Maths', status: 'faite' },
            { id: 't2', title: 'Fiche Réseau', status: 'faite' },
            { id: 't3', title: 'Rapport Stage', dueDate: '2026-10-25', status: 'à faire' } // En retard
        ]
    });
    const appMulti = new App(storageMulti, null, null, null, null, null, null, null);
    appMulti.clock = () => new Date('2026-11-01T10:00:00');

    const summaryMulti = await appMulti.computeLocalWeeklySummary(appMulti.clock());
    console.log("--- Réponse computeLocalWeeklySummary (plusieurs semaines, 4 séances, 2 faites, 1 retard) : ---");
    console.log(summaryMulti.text);

    check(summaryMulti.sessionsDone === 4, "4 séances accomplies");
    check(summaryMulti.tasksDone === 2, "2 tâches faites");
    check(summaryMulti.text.includes("progression par rapport à la semaine dernière (+2 séances)"), "Calcule la vraie progression vs W43");
    check(summaryMulti.text.includes("Point à travailler : tu as 1 tâche en retard"), "Identifie le point à travailler justifié par la tâche en retard");
    check(!summaryMulti.text.includes("Point fort :"), "Privilégie le point d'alerte sur la tâche en retard");
}

// -------------------------------------------------------------------------
// SCÉNARIO 4 : SYNTHÈSE GLOBALE "Où j'en suis ?"
// -------------------------------------------------------------------------
console.log("\n[4] Scénario 4 : Synthèse globale 'Où j'en suis ?' sans affirmation inventée");
{
    const emptySynthContext = {
        academicSummary: null,
        userLanguages: [],
        projects: [],
        tasks: []
    };
    const replySynthEmpty = await CoachLocalReply.build(emptySynthContext, "Où j'en suis ?", { code: 'NO_LLM' });
    console.log("--- Réponse 'Où j'en suis ?' (base vide) : ---");
    console.log(replySynthEmpty.message);

    check(replySynthEmpty.message.includes("moyenne en cours de calcul"), "Précise honnêtement qu'il n'y a pas encore de note");
    check(replySynthEmpty.message.includes("aucune langue enregistrée"), "Indique aucune langue enregistrée");
    check(replySynthEmpty.message.includes("0 projet(s) en cours"), "Indique 0 projet");
    check(!replySynthEmpty.message.includes("dynamique positive"), "Zéro affirmation inventée");
}

console.log(`\n🎉 TOUS LES TESTS U2-0 SONT PASSÉS AVEC SUCCÈS (${passed} assertions) !`);
