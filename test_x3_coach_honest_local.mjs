/**
 * test_x3_coach_honest_local.mjs
 * Test dédié pour la tâche X3 :
 * - Réponses locales exactes, déterministes et vraies sans clé Gemini
 * - Les 4 questions exactes :
 *   1. « Qu'est-ce que j'ai aujourd'hui ? » (avec et sans événements)
 *   2. « Quel est mon prochain examen ? » (avec et sans devoirs/examens)
 *   3. « Où j'en suis en anglais ? » (avec et sans langue configurée)
 *   4. « Combien de livres j'ai lus ? » (avec et sans livres lus)
 * - Question hors sujet sans clé Gemini : réponse honnête sans blabla ni risque inventé
 * - Alerte emploi du temps : silencieuse si >= 1 événement existe dans la semaine
 * - Phrase "Gemini n'est pas configuré" discrète (1 ligne) et affichée au plus UNE fois par session
 */
import { CoachLocalReply } from './src/ai/CoachLocalReply.js';
import { CoachAI } from './src/ai/CoachAI.js';
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

global.window = {};
global.document = {
    getElementById: () => ({ addEventListener: () => {}, innerHTML: '', style: {} }),
    querySelector: () => null,
    querySelectorAll: () => []
};

async function runTests() {
    console.log("=== TESTS X3 : COACH SANS CLÉ (RÉPONSES LOCALES DÉTERMINISTES) ===");

    // -----------------------------------------------------------------
    // 1. Question 1 : Qu'est-ce que j'ai aujourd'hui ?
    // -----------------------------------------------------------------
    console.log("\n--- 1. Qu'est-ce que j'ai aujourd'hui ? ---");
    CoachLocalReply.resetSessionNotice();

    // 1.1 Avec événements aujourd'hui
    const ctxWithToday = {
        currentDate: '2026-10-27',
        planning: {
            events: [
                { id: 'ev1', date: '2026-10-27', startTime: '14:00', endTime: '16:00', title: 'Cours Réseau' },
                { id: 'ev2', date: '2026-10-27', startTime: '09:00', endTime: '11:00', title: 'Algorithmique L2' },
                { id: 'ev3', date: '2026-10-28', startTime: '10:00', endTime: '12:00', title: 'Demain' }
            ]
        },
        courses: { upcomingSessions: [], progress: [], timetable: null }
    };
    const rep1 = CoachLocalReply.build(ctxWithToday, "Qu'est-ce que j'ai aujourd'hui ?", { code: 'NO_LLM' });
    assert(rep1.message.includes("Aujourd'hui :"), "1.1 Mentionne 'Aujourd'hui :'");
    assert(rep1.message.includes("09:00 - 11:00 : Algorithmique L2"), "1.1 Liste le cours du matin chronologiquement en premier");
    assert(rep1.message.includes("14:00 - 16:00 : Cours Réseau"), "1.1 Liste le cours de l'après-midi en second");
    assert(!rep1.message.includes("Demain"), "1.1 N'inclut pas les événements des autres jours");

    // 1.2 Sans événement aujourd'hui
    const ctxEmptyToday = {
        currentDate: '2026-10-27',
        planning: { events: [] },
        courses: { upcomingSessions: [], progress: [], timetable: null }
    };
    const rep2 = CoachLocalReply.build(ctxEmptyToday, "Qu'est-ce que j'ai aujourd'hui ?", { code: 'NO_LLM' });
    assert(rep2.message.includes("Rien de prévu aujourd'hui"), "1.2 Répond 'Rien de prévu aujourd'hui.' si aucun événement");

    // -----------------------------------------------------------------
    // 2. Question 2 : Quel est mon prochain examen ?
    // -----------------------------------------------------------------
    console.log("\n--- 2. Quel est mon prochain examen ? ---");
    // 2.1 Avec examen à venir
    const ctxWithExam = {
        currentDate: '2026-10-27',
        academic: {
            upcomingAssessments: [
                { id: 'a1', title: 'Partiel Algèbre', subjectName: 'Mathématiques', targetDate: '2026-10-31', daysRemaining: 4 }
            ]
        }
    };
    const repExam = CoachLocalReply.build(ctxWithExam, "Quel est mon prochain examen ?", { code: 'NO_LLM' });
    assert(repExam.message.includes("Partiel Algèbre"), "2.1 Nom de l'examen présent");
    assert(repExam.message.includes("Mathématiques"), "2.1 Matière présente");
    assert(repExam.message.includes("dans 4 jours") || repExam.message.includes("samedi 31 octobre"), "2.1 Date et délai présents");

    // 2.2 Sans examen prévu
    const ctxNoExam = {
        currentDate: '2026-10-27',
        academic: { upcomingAssessments: [] }
    };
    const repNoExam = CoachLocalReply.build(ctxNoExam, "Quel est mon prochain examen ?", { code: 'NO_LLM' });
    assert(repNoExam.message.includes("Aucun examen prévu prochainement"), "2.2 Répond honnêtement 'Aucun examen prévu prochainement'");

    // -----------------------------------------------------------------
    // 3. Question 3 : Où j'en suis en anglais ? (ou autre langue)
    // -----------------------------------------------------------------
    console.log("\n--- 3. Où j'en suis en anglais ? ---");
    // 3.1 Avec langue configurée
    const ctxWithLang = {
        currentDate: '2026-10-27',
        userLanguages: [
            {
                name: 'Anglais',
                level: 'B2',
                goal: 'Préparer le TOEIC',
                tracking: { minutesStudied: 120 }
            }
        ],
        planning: {
            events: [
                { id: 'lang_ev', title: 'Cours Anglais oral', date: '2026-10-29', startTime: '15:00', endTime: '16:00' }
            ]
        }
    };
    const repLang = CoachLocalReply.build(ctxWithLang, "Où j'en suis en anglais ?", { code: 'NO_LLM' });
    assert(repLang.message.includes("niveau actuel B2"), "3.1 Niveau de langue exact");
    assert(repLang.message.includes("Préparer le TOEIC"), "3.1 Objectif cité");
    assert(repLang.message.includes("2h") || repLang.message.includes("120 min"), "3.1 Temps révisé calculé");
    assert(repLang.message.includes("15:00") && repLang.message.includes("29 octobre"), "3.1 Prochain cours de langue détecté dans le planning");

    // 3.2 Sans langue configurée
    const ctxNoLang = {
        currentDate: '2026-10-27',
        userLanguages: []
    };
    const repNoLang = CoachLocalReply.build(ctxNoLang, "Où j'en suis en anglais ?", { code: 'NO_LLM' });
    assert(repNoLang.message.includes("Tu n'as pas encore renseigné de langue"), "3.2 Indique qu'aucune langue n'est renseignée");

    // -----------------------------------------------------------------
    // 4. Question 4 : Combien de livres j'ai lus ?
    // -----------------------------------------------------------------
    console.log("\n--- 4. Combien de livres j'ai lus ? ---");
    // 4.1 Avec livres lus
    const ctxWithBooks = {
        currentDate: '2026-10-27',
        books: [
            { id: 'b1', title: 'Clean Architecture', status: 'finished', totalPages: 300, pagesRead: 300 },
            { id: 'b2', title: 'Refactoring', status: 'finished', totalPages: 400, pagesRead: 400 },
            { id: 'b3', title: 'The Pragmatic Programmer', status: 'reading', totalPages: 350, pagesRead: 100 }
        ]
    };
    const repBooks = CoachLocalReply.build(ctxWithBooks, "Combien de livres j'ai lus ?", { code: 'NO_LLM' });
    assert(repBooks.message.includes("Tu as lu 2 livre(s)"), "4.1 Décompte exact (2 livres terminés)");
    assert(repBooks.message.includes("Clean Architecture") && repBooks.message.includes("Refactoring"), "4.1 Cité les titres des livres finis");
    assert(!repBooks.message.includes("The Pragmatic Programmer"), "4.1 N'inclut pas les livres encore en cours de lecture");

    // 4.2 Sans livre lu (0 livre)
    const ctxNoBooks = {
        currentDate: '2026-10-27',
        books: [
            { id: 'b3', title: 'En cours', status: 'reading', totalPages: 100, pagesRead: 20 }
        ]
    };
    const repNoBooks = CoachLocalReply.build(ctxNoBooks, "Combien de livres j'ai lus ?", { code: 'NO_LLM' });
    assert(repNoBooks.message.includes("0 livre") || repNoBooks.message.includes("aucun livre terminé"), "4.2 Répond 0 livre lu sans inventer de données");

    // -----------------------------------------------------------------
    // 5. Question hors sujet sans clé Gemini : réponse honnête sans blabla
    // -----------------------------------------------------------------
    console.log("\n--- 5. Question hors des 4 types sans clé Gemini ---");
    const ctxGeneral = {
        currentDate: '2026-10-27',
        planning: { events: [{ id: 'e1', date: '2026-10-27', startTime: '08:00', title: 'Cours' }] },
        courses: { progress: [{ title: 'Maths', hoursDone: 10, hoursTotal: 30 }], timetable: { needsImport: true, targetWeekStart: '2026-10-26' } }
    };
    const repOffTopic = CoachLocalReply.build(ctxGeneral, "Quel temps fait-il à Paris ?", { code: 'NO_LLM' });
    assert(repOffTopic.message.includes("Je n'ai pas cette information dans tes données"), "5.1 Réponse honnête sur l'absence de l'information");
    assert(repOffTopic.message.includes("En mode local sans clé Gemini, je peux te renseigner sur"), "5.1 Indique les capacités disponibles en local");
    assert(!repOffTopic.message.includes("Avancement des cours"), "5.1 Aucun monologue non demandé sur l'avancement des cours");
    assert(!repOffTopic.message.includes("procrastination"), "5.1 Aucun risque de procrastination inventé");

    // -----------------------------------------------------------------
    // 6. Alerte emploi du temps : silencieuse si événements >= 1
    // -----------------------------------------------------------------
    console.log("\n--- 6. Alerte emploi du temps et présence d'événements ---");
    // 6.1 Avec 1 événement dans la semaine cible
    const ctxWeekWithEvents = {
        currentDate: '2026-10-27',
        courses: {
            upcomingSessions: [{ date: '2026-10-27', startTime: '10:00', title: 'Algo' }],
            timetable: { needsImport: true, targetWeekStart: '2026-10-26' }
        },
        planning: { events: [] }
    };
    const repWithWeekEvents = CoachLocalReply.build(ctxWeekWithEvents, "Raconte-moi une blague", null);
    assert(!repWithWeekEvents.message.includes("Il me manque l'emploi du temps"), "6.1 Alerte emploi du temps silencieuse car 1 événement existe");

    // 6.2 Avec 0 événement dans la semaine cible
    const ctxWeekZeroEvents = {
        currentDate: '2026-10-27',
        courses: {
            upcomingSessions: [],
            timetable: { needsImport: true, targetWeekStart: '2026-10-26' }
        },
        planning: { events: [] }
    };
    const repZeroWeekEvents = CoachLocalReply.build(ctxWeekZeroEvents, "Raconte-moi une blague", null);
    assert(repZeroWeekEvents.message.includes("Il me manque l'emploi du temps de la semaine du 26/10"), "6.2 Alerte emploi du temps active uniquement car 0 événement");

    // -----------------------------------------------------------------
    // 7. Notice "Gemini n'est pas configuré" : au plus UNE fois par session
    // -----------------------------------------------------------------
    console.log("\n--- 7. Notice 'Gemini n'est pas configuré' au plus une fois ---");
    CoachLocalReply.resetSessionNotice();
    const notice1 = CoachLocalReply.llmStatusLine({ code: 'NO_LLM' });
    assert(notice1 && notice1.includes("Gemini n'est pas configuré"), "7.1 Premier appel : notice présente");
    assert(notice1.split('\n').length === 1, "7.1 La notice est discrète et tient sur 1 ligne");

    const notice2 = CoachLocalReply.llmStatusLine({ code: 'NO_LLM' });
    assert(notice2 === null, "7.2 Deuxième appel : notice est null (non répétée)");

    const notice3 = CoachLocalReply.llmStatusLine({ code: 'NO_LLM' });
    assert(notice3 === null, "7.3 Troisième appel : toujours null");

    // -----------------------------------------------------------------
    // 8. CoachAI : Pas de bulle de procrastination quand sans clé
    // -----------------------------------------------------------------
    console.log("\n--- 8. Intégration CoachAI sans clé ---");
    const ai = new CoachAI(null);
    const recs = await ai.analyze({
        currentDate: '2026-10-27',
        planning: { events: [{ id: 'ev1', date: '2026-10-27', startTime: '10:00', title: 'Cours' }] },
        academic: { upcomingAssessments: [] },
        analytics: { presenceStats: { missedSessions: 10 } } // Pourrait déclencher procrastination risk
    }, "Qu'est-ce que j'ai aujourd'hui ?");

    assert(recs.length === 1 && recs[0].decisionType === 'LOCAL_REPLY', "8.1 Une seule réponse émise (LOCAL_REPLY)");
    assert(!recs.some(r => r.decisionType === 'ADDRESS_PROCRASTINATION_RISK'), "8.2 Aucun ADDRESS_PROCRASTINATION_RISK en réponse au chat");
    assert(recs[0].message.includes("10:00 : Cours"), "8.3 Contient le planning exact du jour");

    console.log(`\n======================================================`);
    console.log(`RÉSULTAT X3 : ${passed} / ${total} assertions validées.`);
    console.log(`======================================================`);
}

runTests().catch(err => {
    console.error("Erreur fatale test X3 :", err);
    process.exit(1);
});
