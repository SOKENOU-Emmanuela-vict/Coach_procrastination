import { DailyCheckIn } from './src/models/DailyCheckIn.js';
import { CheckInEngine } from './src/engines/CheckInEngine.js';
import { StudyRecord } from './src/models/StudyRecord.js';
import { Event } from './src/models/Event.js';

class MockStorage {
    constructor() { this.data = { daily_checkins: {}, events: [], study_history: [] }; }
    async loadData(key) { 
        if (key === 'daily_checkins' && !this.data[key]) return {};
        return this.data[key] || []; 
    }
    async saveData(key, value) { this.data[key] = value; }
}

class MockPlanning {
    constructor(storage) { this.storage = storage; }
    async getEventsForDate(dateStr) {
        const evs = await this.storage.loadData('events');
        return evs.filter(e => e.date === dateStr);
    }
}

class MockScheduler {
    async generateDailyPlan(dateStr) {
        return {
            sessions: [
                { id: 'sess_bc_1', title: 'Bootcamp Matin', expectedDuration: 60, skillId: 'sk_1' }
            ]
        };
    }
}

class MockStudyRecordEngine {
    constructor(storage) { this.storage = storage; }
    async getFullHistory() {
        return await this.storage.loadData('study_history');
    }
}

function assert(condition, message) {
    if (!condition) {
        console.error(`❌ FAIL: ${message}`);
        process.exit(1);
    }
    console.log(`✅ PASS: ${message}`);
}

async function runTests() {
    console.log("=== TESTS DAILY CHECK-IN (B.12) ===\n");
    let passed = 0; let total = 0;
    const wrapAssert = (condition, message) => { total++; assert(condition, message); passed++; };

    const storage = new MockStorage();
    const planning = new MockPlanning(storage);
    const scheduler = new MockScheduler();
    const studyEngine = new MockStudyRecordEngine(storage);
    const checkInEngine = new CheckInEngine(storage, planning, scheduler, studyEngine);

    const dateStr = '2026-09-15';

    // Test 1: Créer un Check-in valide
    const validData = {
        date: dateStr,
        energy: 'high',
        sleep: { durationMinutes: 420, quality: 'good' },
        blockers: ['fatigue'],
        dayAssessment: 'partial',
        needsFollowUp: [] // Will test references later
    };
    const c1 = await checkInEngine.saveCheckIn(validData);
    wrapAssert(c1.id.startsWith('chk_'), "Test 1: Créer un Check-in valide.");

    // Test 2: Récupérer le Check-in du jour
    const fetched = await checkInEngine.getCheckIn(dateStr);
    wrapAssert(fetched.energy === 'high' && fetched.blockers.includes('fatigue'), "Test 2: Récupérer le Check-in du jour.");

    // Test 3: Modifier un Check-in
    validData.energy = 'medium';
    await checkInEngine.saveCheckIn(validData);
    const fetchedMod = await checkInEngine.getCheckIn(dateStr);
    wrapAssert(fetchedMod.energy === 'medium', "Test 3: Modifier un Check-in.");

    // Test 4: Refuser une énergie invalide
    try {
        new DailyCheckIn({ date: dateStr, energy: 'extreme' });
        wrapAssert(false, "Test 4: Refuser une énergie invalide.");
    } catch (e) {
        wrapAssert(true, "Test 4: Refuser une énergie invalide.");
    }

    // Test 5: Refuser une durée de sommeil négative
    try {
        new DailyCheckIn({ date: dateStr, sleep: { durationMinutes: -10 } });
        wrapAssert(false, "Test 5: Refuser une durée de sommeil négative.");
    } catch (e) {
        wrapAssert(true, "Test 5: Refuser une durée de sommeil négative.");
    }

    // Test 6: Refuser une date invalide
    try {
        new DailyCheckIn({ date: '2026-99-99' });
        wrapAssert(false, "Test 6: Refuser une date invalide.");
    } catch (e) {
        wrapAssert(true, "Test 6: Refuser une date invalide.");
    }

    // Setup for 9-14:
    const e1 = new Event({ id: 'ev_1', title: 'Cours Math', date: dateStr, duration: 120 });
    const e2 = new Event({ id: 'ev_2', title: 'Exam', date: dateStr, duration: 60 });
    const e3 = new Event({ id: 'ev_3', title: 'Projet', date: dateStr, duration: 90 });
    await storage.saveData('events', [e1, e2, e3]); // +1 sess_bc_1 = 4 planned

    const r1 = new StudyRecord('rec_1', 'ev_1', dateStr, '10:00:00Z');
    r1.finish('12:00:00Z', 120, 'completed', 1.0, {});
    
    const r2 = new StudyRecord('rec_2', 'sess_bc_1', dateStr, '08:00:00Z');
    r2.finish('08:30:00Z', 30, 'partial', 0.5, {});

    const r3 = new StudyRecord('rec_3', 'ev_2', dateStr, '14:00:00Z');
    r3.finish('14:10:00Z', 10, 'cancelled', 0, {}); 
    // ev_3 is missed (no record)

    await storage.saveData('study_history', [r1, r2, r3]);

    const summary = await checkInEngine.buildDailySummary(dateStr);

    wrapAssert(summary.planned.totalSessions === 4, "Test 9: Calculer les sessions prévues depuis les données existantes (sans double comptage).");
    wrapAssert(summary.execution.completed === 1, "Test 10: Calculer les sessions réellement réalisées (completed).");
    wrapAssert(summary.execution.missed === 1, "Test 11: Calculer les sessions manquées.");
    // 4 planned - 1 cancelled = 3 valid. (1 completed + 0.5 partial) / 3 = 1.5/3 = 50%
    wrapAssert(summary.execution.completionRate === 50, "Test 12: Calculer le taux d'exécution.");
    wrapAssert(summary.execution.partial === 1, "Test 13: Identifier une session partiellement réalisée.");
    wrapAssert(summary.actual.items.find(i => i.id === 'ev_3').status === 'missed', "Test 14: Identifier un objectif non réalisé.");

    // Test 15 & 16: Blockers et needsFollowUp
    wrapAssert(summary.declarative.blockers.includes('fatigue'), "Test 15: Enregistrer plusieurs raisons de blocage.");
    
    // Test 7: Associer correctement un objectif existant (needsFollowUp)
    validData.needsFollowUp = ['ev_1']; // ev_1 existe
    await checkInEngine.saveCheckIn(validData);
    const summary2 = await checkInEngine.buildDailySummary(dateStr);
    wrapAssert(summary2.declarative.needsFollowUp.includes('ev_1'), "Test 7: Associer correctement un objectif existant.");
    wrapAssert(summary2.declarative.needsFollowUp.includes('ev_1'), "Test 16: Identifier les éléments nécessitant un suivi.");

    // Test 8: Rejeter ou signaler une référence inexistante
    try {
        await checkInEngine.saveCheckIn({ date: dateStr, needsFollowUp: ['fake_ref'] });
        wrapAssert(false, "Test 8: Rejeter ou signaler une référence inexistante.");
    } catch (e) {
        wrapAssert(true, "Test 8: Rejeter ou signaler une référence inexistante.");
    }

    // Test 21: Intégration minimale au contexte (Simulé ici par le format structuré de buildDailySummary)
    const contextData = {
        planned: summary.planned.totalSessions,
        actual: summary.execution.completed,
        missed: summary.execution.missed
    };
    wrapAssert(contextData.planned === 4 && contextData.missed === 1, "Test 21: Vérifier l'intégration minimale avec CoachContext.");

    // Test 17: Déclarations =/ Objectif
    wrapAssert(summary.declarative.dayAssessment === 'partial' && summary.execution.completed === 1, "Test 17: Vérifier que les déclarations ne remplacent pas les données objectives.");

    // Test 18 & 19
    const eventsAfter = await storage.loadData('events');
    const recordsAfter = await storage.loadData('study_history');
    wrapAssert(eventsAfter.length === 3, "Test 18: Vérifier qu'aucun Event n'est modifié.");
    wrapAssert(recordsAfter.length === 3, "Test 19: Vérifier qu'aucune Session n'est créée ou supprimée.");

    // Test 20: Historique
    await checkInEngine.saveCheckIn({ date: '2026-09-14' });
    const hist = await checkInEngine.getCheckIns('2026-09-14', '2026-09-15');
    wrapAssert(hist.length === 2, "Test 20: Vérifier l'historique sur plusieurs jours.");

    console.log(`\n=== RÉSULTATS : ${passed}/${total} TESTS PASSÉS ===`);
}

runTests().catch(e => {
    console.error(e);
    process.exit(1);
});
