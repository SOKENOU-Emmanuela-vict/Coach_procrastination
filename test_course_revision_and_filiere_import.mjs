/**
 * test_course_revision_and_filiere_import.mjs
 * Test dédié pour :
 * 1. La reconnaissance des filières (SI, GL, IA, SEIoT...) et cours multi-filières dans TimetableImportEngine.
 * 2. L'extraction et l'aperçu sans perte pour la filière SI.
 * 3. La planification automatique des révisions de cours (CourseRevisionScheduler) dans les créneaux libres.
 * 4. La détection de l'intention dans le chat ("planifie mes révisions").
 * 5. Le service de notifications locales et rappels (NotificationService).
 */

import { TimetableImportEngine } from './src/engines/TimetableImportEngine.js';
import { CourseRevisionScheduler } from './src/engines/CourseRevisionScheduler.js';
import { NotificationService } from './src/services/NotificationService.js';
import { parseCourseRevisionIntent } from './src/ai/ChatIntentParser.js';
import { CoachLocalReply } from './src/ai/CoachLocalReply.js';
import { PlanningEngine } from './src/engines/PlanningEngine.js';
import { PlanningIntelligence } from './src/engines/PlanningIntelligence.js';
import { Event } from './src/models/Event.js';

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
        this.data = { events: [], acad_subjects: [], timetable_imports: [] };
    }
    async loadData(key) {
        return this.data[key] !== undefined ? JSON.parse(JSON.stringify(this.data[key])) : null;
    }
    async saveData(key, val) {
        this.data[key] = JSON.parse(JSON.stringify(val));
    }
}

async function runTests() {
    console.log("=== DÉBUT DES TESTS : RÉVISIONS DE COURS & EMPLOI DU TEMPS FILIÈRES ===");

    // -------------------------------------------------------------
    // TEST 1 : Normalisation et correspondance des filières
    // -------------------------------------------------------------
    assert(TimetableImportEngine.matchesGroup('SI', 'SI'), "1a. matchesGroup('SI', 'SI') === true");
    assert(TimetableImportEngine.matchesGroup('GL&IM&IA', 'IA'), "1b. matchesGroup('GL&IM&IA', 'IA') === true (cours combiné)");
    assert(TimetableImportEngine.matchesGroup('GL&IM&IA', 'GL'), "1c. matchesGroup('GL&IM&IA', 'GL') === true");
    assert(!TimetableImportEngine.matchesGroup('SI', 'IA'), "1d. matchesGroup('SI', 'IA') === false (filières séparées)");
    assert(TimetableImportEngine.matchesGroup('@tous', 'SI'), "1e. matchesGroup('@tous', 'SI') === true (tronc commun)");
    assert(TimetableImportEngine.groupLabel('si') === 'SI', "1f. groupLabel('si') renvoie 'SI'");
    assert(TimetableImportEngine.groupLabel('seiot') === 'SE&IoT', "1g. groupLabel('seiot') renvoie 'SE&IoT'");

    // -------------------------------------------------------------
    // TEST 2 : Extraction et Aperçu d'un emploi du temps avec filières
    // -------------------------------------------------------------
    const storage = new MockStorage();
    const planningEngine = new PlanningEngine(storage);
    const importer = new TimetableImportEngine({ storage, planningEngine });

    const rawMockData = {
        documentDate: '2026-11-16',
        entries: [
            { group: 'SI', date: '2026-11-16', startTime: '14:00', endTime: '19:00', title: 'Administration systèmes et réseaux sous Linux', hoursDone: 10, hoursTotal: 20, teacher: 'M. Natus FAGLA' },
            { group: 'GL', date: '2026-11-16', startTime: '14:00', endTime: '19:00', title: 'Programmation graphique en QT/C++', hoursDone: 15, hoursTotal: 20, teacher: 'M. Armad ACCROMBESSI' },
            { group: 'SI', date: '2026-11-17', startTime: '08:00', endTime: '13:00', title: 'Administration systèmes et réseaux sous Windows', hoursDone: 15, hoursTotal: 20, teacher: 'Mme. Miranda GNONLONFOUN' },
            { group: 'IA', date: '2026-11-18', startTime: '08:00', endTime: '13:00', title: 'Concepts et Applications de IA', hoursDone: 15, hoursTotal: 30, teacher: 'Mme. Mélène TONOU' },
            { group: 'SI', date: '2026-11-19', startTime: '08:00', endTime: '13:00', title: 'Administration systèmes et réseaux sous Windows', hoursDone: 20, hoursTotal: 20, teacher: 'Mme. Miranda GNONLONFOUN' },
            { group: 'SI', date: '2026-11-20', startTime: '08:00', endTime: '13:00', title: 'Sécurité des réseaux : Etude des protocoles', hoursDone: 5, hoursTotal: 10, teacher: 'M. Honorat BIBI' },
            { group: 'SI', date: '2026-11-20', startTime: '14:00', endTime: '19:00', title: 'Administration systèmes et réseaux sous Linux', hoursDone: 15, hoursTotal: 20, teacher: 'M. Natus FAGLA' },
            { group: 'SI', date: '2026-11-21', startTime: '08:00', endTime: '13:00', title: 'Sécurité des réseaux : Etude des protocoles', hoursDone: 10, hoursTotal: 10, teacher: 'M. Honorat BIBI' }
        ]
    };

    const previewSI = importer.buildPreview(rawMockData, { group: 'SI', referenceDate: '2026-11-16' });
    assert(previewSI.rows.length === 6, `2a. Aperçu SI contient exactement les 6 cours SI (obtenu: ${previewSI.rows.length})`);
    assert(previewSI.group === 'SI', `2b. Groupe de l'aperçu est 'SI' (obtenu: ${previewSI.group})`);
    assert(!previewSI.rows.some(r => r.title.includes('QT/C++')), "2c. Aucun cours GL (QT/C++) ne pollue l'emploi du temps SI");
    assert(!previewSI.rows.some(r => r.title.includes('Concepts et Applications de IA')), "2d. Aucun cours IA ne pollue l'emploi du temps SI");

    // Valider et enregistrer l'emploi du temps SI
    const applyRes = await importer.apply(previewSI);
    assert(applyRes.success === true, "2e. Enregistrement des cours SI réussi");
    assert(applyRes.count === 6, `2f. Exactement 6 cours enregistrés dans le planning (obtenu: ${applyRes.count})`);

    // -------------------------------------------------------------
    // TEST 3 : Planification automatique des révisions de cours
    // -------------------------------------------------------------
    const intelligence = new PlanningIntelligence(planningEngine);
    const revScheduler = new CourseRevisionScheduler({
        planningEngine,
        planningIntelligence: intelligence,
        storage
    });

    const revRes = await revScheduler.scheduleWeeklyRevisions({
        weekStart: '2026-11-16',
        weekEnd: '2026-11-22',
        durationMinutes: 60
    });

    assert(revRes.success === true, "3a. CourseRevisionScheduler termine avec succès");
    assert(revRes.count === 3, `3b. 3 séances de révision planifiées pour les 3 matières SI (obtenu: ${revRes.count})`);
    
    // Vérifier les 3 matières
    const titles = revRes.scheduled.map(s => s.title);
    assert(titles.some(t => t.includes('Linux')), "3c. Révision planifiée pour Administration Linux");
    assert(titles.some(t => t.includes('Windows')), "3d. Révision planifiée pour Administration Windows");
    assert(titles.some(t => t.includes('Sécurité des réseaux')), "3e. Révision planifiée pour Sécurité des réseaux");

    // Vérifier l'absence de chevauchement avec les cours
    const savedEvents = await planningEngine.getEvents();
    const courses = savedEvents.filter(e => e.type === 'course');
    const revisions = savedEvents.filter(e => e.type === 'revision');

    let collision = false;
    for (const rev of revisions) {
        const sameDayCourses = courses.filter(c => c.date === rev.date);
        for (const c of sameDayCourses) {
            const revStart = parseInt(rev.startTime.replace(':', ''), 10);
            const revEnd = parseInt(rev.endTime.replace(':', ''), 10);
            const cStart = parseInt(c.startTime.replace(':', ''), 10);
            const cEnd = parseInt(c.endTime.replace(':', ''), 10);
            if (revStart < cEnd && cStart < revEnd) {
                collision = true;
                console.error(`Collision détectée entre ${rev.title} (${rev.startTime}-${rev.endTime}) et ${c.title} (${c.startTime}-${c.endTime}) le ${rev.date}`);
            }
        }
    }
    assert(!collision, "3f. Aucune séance de révision ne chevauche un cours obligatoire");

    // Idempotence : une 2ème passe ne duplique pas les séances
    const revRes2 = await revScheduler.scheduleWeeklyRevisions({
        weekStart: '2026-11-16',
        weekEnd: '2026-11-22',
        durationMinutes: 60
    });
    assert(revRes2.count === 0, `3g. Ré-exécution n'ajoute pas de doublons (obtenu: ${revRes2.count})`);

    // -------------------------------------------------------------
    // TEST 4 : Reconnaissance de l'intention dans le chat
    // -------------------------------------------------------------
    assert(parseCourseRevisionIntent("planifie mes révisions"), "4a. 'planifie mes révisions' reconnu");
    assert(parseCourseRevisionIntent("programme mes révisions de cours"), "4b. 'programme mes révisions de cours' reconnu");
    assert(parseCourseRevisionIntent("révisions de la semaine"), "4c. 'révisions de la semaine' reconnu");
    assert(parseCourseRevisionIntent("pose mes révisions"), "4d. 'pose mes révisions' reconnu");
    assert(!parseCourseRevisionIntent("bonjour comment vas tu"), "4e. 'bonjour' non reconnu comme révision");

    // Réponse du coach avec intent plan_course_revisions
    const reply = CoachLocalReply.build({
        planning: { events: savedEvents },
        currentDate: '2026-11-18'
    }, "planifie mes révisions");
    assert(reply.message.includes('séance') && reply.message.includes('Planning'), "4f. Le coach liste les séances de révision dans le chat");

    // -------------------------------------------------------------
    // TEST 5 : Service de Notifications
    // -------------------------------------------------------------
    const notifService = new NotificationService();
    assert(typeof notifService.scheduleReminder === 'function', "5a. NotificationService.scheduleReminder est une fonction");
    assert(typeof notifService.scheduleWeekReminders === 'function', "5b. NotificationService.scheduleWeekReminders est une fonction");

    // Test de programmation d'un événement futur (demain à 08:00)
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 1);
    const dateStr = futureDate.toISOString().slice(0, 10);
    const dummyEvent = {
        id: 'ev_dummy_1',
        title: 'Administration systèmes Linux',
        date: dateStr,
        startTime: '08:00',
        type: 'course'
    };

    const scheduledOk = await notifService.scheduleReminder(dummyEvent, 15);
    // En environnement Node.js (sans window/Capacitor), scheduleReminder renvoie false proprement sans planter
    assert(typeof scheduledOk === 'boolean', "5c. scheduleReminder s'exécute proprement sans crash en environnement serveur/test");

    console.log(`\n=== BILAN : ${passed}/${passed + failed} assertions validées ===\n`);
    if (failed > 0) process.exit(1);
}

runTests().catch(err => {
    console.error("Erreur fatale de test :", err);
    process.exit(1);
});
