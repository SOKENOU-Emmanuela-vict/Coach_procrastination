import { ScheduleIngestionEngine } from './src/engines/ScheduleIngestionEngine.js';
import { PlanningEngine } from './src/engines/PlanningEngine.js';
import { ScheduleImportEntry } from './src/models/ScheduleImportEntry.js';
import { Event } from './src/models/Event.js';

class MockStorage {
    constructor() { 
        this.data = { 
            events: [], 
            academic_schedule: [],
            acad_subjects: [
                { id: 'sub_1', name: 'Algèbre Linéaire', code: 'MATH101' },
                { id: 'sub_2', name: 'Programmation', code: 'INF101' }
            ] 
        }; 
    }
    async loadData(key) { return this.data[key] || []; }
    async saveData(key, value) { this.data[key] = value; }
}

function assert(condition, message) {
    if (!condition) {
        console.error(`❌ FAIL: ${message}`);
        process.exit(1);
    }
    console.log(`✅ PASS: ${message}`);
}

async function runTests() {
    console.log("=== TESTS INGESTION EMPLOI DU TEMPS (B.11) ===\n");
    let passed = 0; let total = 0;
    const wrapAssert = (condition, message) => { total++; assert(condition, message); passed++; };

    const engine = new ScheduleIngestionEngine();
    const storage = new MockStorage();
    const planning = new PlanningEngine(storage);

    const subjects = [
        { id: 'sub_1', name: 'Algèbre Linéaire', code: 'MATH101' },
        { id: 'sub_2', name: 'Programmation', code: 'INF101' }
    ];

    // 1, 2, 3. Parsing, Normalisation horaire et jours
    const input1 = `
Lundi 08h00-10:00 INF101
Mardi:
14h-16h Algèbre Linéaire
    `;
    const parsed1 = engine.parseSchedule(input1);
    wrapAssert(parsed1.length === 2, "1. Parsing basique fonctionnel (2 entrées trouvées).");
    wrapAssert(parsed1[0].dayOfWeek === 'monday' && parsed1[1].dayOfWeek === 'tuesday', "3. Normalisation jours (Lundi->monday).");
    wrapAssert(parsed1[0].startTime === '08:00' && parsed1[1].endTime === '16:00', "2. Normalisation horaire (08h00->08:00, 16h->16:00).");

    // 4. Association matière
    const resolved = engine.resolveSubjects(parsed1, subjects);
    wrapAssert(resolved[0].subjectId === 'sub_2', "4. Association matière par code (INF101 -> sub_2).");
    wrapAssert(resolved[1].subjectId === 'sub_1', "4. Association matière par nom (Algèbre Linéaire -> sub_1).");

    // 5. Matière inconnue non inventée + AMBIGUOUS
    const input2 = `Lundi 10:00-12:00 Inconnue`;
    const parsed2 = engine.resolveSubjects(engine.parseSchedule(input2), subjects);
    wrapAssert(parsed2[0].subjectId === null, "5. Matière inconnue non inventée (subjectId = null).");
    wrapAssert(parsed2[0].status === 'ambiguous', "10. Détection AMBIGUOUS pour matière inconnue.");

    // AMBIGUOUS horaires
    const inputAmbiguous = `Lundi 14:00-10:00 INF101`;
    const parsedAmbiguous = engine.parseSchedule(inputAmbiguous);
    wrapAssert(parsedAmbiguous[0].status === 'ambiguous', "10. Détection AMBIGUOUS pour horaires incohérents.");

    // INVALID
    const inputInvalid = `Lundi 25h00-30h00 Impossible`;
    const parsedInvalid = engine.parseSchedule(inputInvalid);
    wrapAssert(parsedInvalid[0].status === 'invalid', "Détection INVALID pour horaires non parsables.");

    // 11. Prévention des doublons
    const inputDupe = `Lundi 08:00-10:00 INF101\nLundi 08:00-10:00 INF101`;
    const parsedDupe = engine.createScheduleImport(inputDupe, [], subjects);
    wrapAssert(parsedDupe.changes.length === 1, "11. Prévention des doublons dans le nouvel import.");

    // 6, 7, 8, 9. Détection NEW, REMOVED, MOVED, UNCHANGED
    const previousEntries = [
        new ScheduleImportEntry({ dayOfWeek: 'monday', startTime: '08:00', endTime: '10:00', title: 'INF101', subjectId: 'sub_2' }), // UNCHANGED
        new ScheduleImportEntry({ dayOfWeek: 'tuesday', startTime: '10:00', endTime: '12:00', title: 'MATH101', subjectId: 'sub_1' }), // MOVED (nouveau = 14:00-16:00)
        new ScheduleImportEntry({ dayOfWeek: 'wednesday', startTime: '08:00', endTime: '10:00', title: 'Physique', subjectId: 'sub_3' }) // REMOVED
    ];

    const inputNew = `
Monday 08:00-10:00 INF101
Tuesday 14:00-16:00 MATH101
Thursday 16:00-18:00 INF101
    `;
    const changesObj = engine.createScheduleImport(inputNew, previousEntries, subjects);
    const cTypes = changesObj.changes.map(c => c.type);
    
    wrapAssert(cTypes.includes('UNCHANGED'), "9. Détection UNCHANGED.");
    wrapAssert(cTypes.includes('MOVED'), "8. Détection MOVED.");
    wrapAssert(cTypes.includes('REMOVED'), "7. Détection REMOVED.");
    wrapAssert(cTypes.includes('NEW'), "6. Détection NEW.");

    // 12. Proposition sans mutation Storage
    const eventsBefore = await storage.loadData('events');
    wrapAssert(eventsBefore.length === 0, "12. La proposition ne mute pas le Storage (events vide).");

    // 13. Validation utilisateur -> Application possible (Legacy Compat + Auth)
    // Application de validEntries
    const validEntries = changesObj.changes.filter(c => c.newEntry).map(c => c.newEntry);
    const startDate = '2026-09-14'; // Lundi
    const applyRes = await planning.applyScheduleImport(validEntries, startDate);
    if (!applyRes.success) console.error("APPLY FAILED:", applyRes.reason);
    wrapAssert(applyRes.success, "13. Application de l'import validé réussie.");
    
    const eventsAfter = await storage.loadData('events');
    wrapAssert(eventsAfter.length > 0, "15. PlanningEngine reste l'autorité finale (événements instanciés).");
    wrapAssert(eventsAfter[0] instanceof Event, "17. Compatibilité Legacy (Objets de type Event).");
    wrapAssert(eventsAfter.some(e => e.date === '2026-09-15' && e.startTime === '14:00'), "17b. Déploiement exact sur le bon jour de la semaine.");

    // 14. Conflit locked/locked -> Rejet
    // Ajoutons un event locked externe qui va bloquer
    await planning.saveEvent(new Event({
        id: 'external_locked', title: 'Rdv Médical', date: '2026-09-22', // Le mardi suivant
        startTime: '14:30', endTime: '15:30', lockStatus: 'locked'
    }));
    
    // On réessaie d'appliquer le même import, ça devrait échouer sur le MATH101 (Mardi 14:00-16:00)
    const conflictRes = await planning.applyScheduleImport(validEntries, startDate);
    wrapAssert(!conflictRes.success && conflictRes.reason.includes("Conflit critique"), "14. Conflit locked/locked -> Rejet (Atomicité assurée).");

    console.log(`\n=== RÉSULTATS : ${passed}/${total} TESTS PASSÉS ===`);
}

runTests().catch(e => {
    console.error(e);
    process.exit(1);
});
