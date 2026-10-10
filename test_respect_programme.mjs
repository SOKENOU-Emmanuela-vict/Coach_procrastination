import assert from 'assert';
import { MemoryProvider } from './src/services/MemoryProvider.js';
import { StudyRecordEngine } from './src/engines/StudyRecordEngine.js';
import { PlanningEngine } from './src/engines/PlanningEngine.js';
import { CheckInEngine } from './src/engines/CheckInEngine.js';
import { WeeklyReviewEngine } from './src/engines/WeeklyReviewEngine.js';
import { Event } from './src/models/Event.js';

async function testRespectProgramme() {
    console.log("=== TESTS RESPECT DU PROGRAMME ===");
    
    const storage = new MemoryProvider();
    const planningEngine = new PlanningEngine(storage);
    const studyRecordEngine = new StudyRecordEngine(storage);
    const checkInEngine = new CheckInEngine(storage, planningEngine, null, studyRecordEngine);
    const weeklyReviewEngine = new WeeklyReviewEngine(storage, planningEngine, null, studyRecordEngine, checkInEngine);
    
    const today = new Date();
    const dateStr = today.toLocaleDateString('fr-CA');

    // 1. Setup events
    await planningEngine.executeIntent({
        validateStructure: () => ({ valid: true }),
        target: 'event', action: 'create',
        constraints: { date: dateStr, startTime: '10:00', endTime: '11:00' },
        payload: { title: 'Session A', lockStatus: 'flexible', type: 'personal' }
    });
    
    await planningEngine.executeIntent({
        validateStructure: () => ({ valid: true }),
        target: 'event', action: 'create',
        constraints: { date: dateStr, startTime: '14:00', endTime: '15:00' },
        payload: { title: 'Session B', lockStatus: 'flexible', type: 'personal' }
    });

    const events = await planningEngine.getEventsForDate(dateStr);
    const sessionA = events.find(e => e.title === 'Session A');
    const sessionB = events.find(e => e.title === 'Session B');

    // 2. Report de la Session A
    // Pour simuler, on modifie manuellement postponedCount comme si l'UI ou un process l'avait fait
    // ou via la nouvelle logique (qui le ferait via move). Mais pour tester l'agrégation, on l'injecte :
    let allEvents = await storage.loadData('events');
    const evA = allEvents.find(e => e.id === sessionA.id);
    evA.postponedCount = 2; // Reporté 2 fois
    await storage.saveData('events', allEvents);

    // 3. Réalisation de la Session B en retard
    // startTime prévu 14:00. On simule un record créé à 14:30.
    const fakeRecordStartTime = new Date();
    fakeRecordStartTime.setHours(14, 30, 0); // 30 min de retard
    
    const record = await studyRecordEngine.completeSession(
        { id: sessionB.id, title: sessionB.title, startTime: sessionB.startTime, expectedDuration: 60, skillId: 'test' },
        { actualDuration: 60, status: 'completed' },
        dateStr
    );
    // On force le record.startTime pour simuler le moment de création
    let history = await storage.loadData('study_history');
    history[0].startTime = fakeRecordStartTime.toISOString();
    await storage.saveData('study_history', history);
    
    // On rappelle complete pour qu'il recalcule delayMinutes en lisant history ? 
    // Non, completeSession utilise new Date().toISOString() au moment de l'appel.
    // Alors on peut juste modifier metrics.delayMinutes via completeSession :
    // Refaisons : completeSession injecte le delayMinutes basé sur new Date() vs session.startTime.
    // On va modifier notre script d'engine temporairement pour lire fakeRecordStartTime ? Non,
    // le delayMinutes a déjà été calculé à 0 parce que new Date() n'est pas 14:30.
    
    // Pour être propre, on recalcule le délai manuellement dans l'historique juste pour ce test:
    history[0].delayMinutes = 30;
    await storage.saveData('study_history', history);

    // 4. Test CheckInEngine (Daily Summary)
    const daily = await checkInEngine.buildDailySummary(dateStr);
    
    assert.strictEqual(daily.execution.totalPostponedCount, 2, "2 reports attendus (Session A)");
    assert.strictEqual(daily.execution.totalDelayMinutes, 30, "30 minutes de retard attendues (Session B)");

    // 5. Test WeeklyReviewEngine
    const weekly = await weeklyReviewEngine.buildWeeklySummary(dateStr, dateStr);
    assert.strictEqual(weekly.execution.totalPostponedCount, 2, "Weekly Review : 2 reports");
    assert.strictEqual(weekly.execution.totalDelayMinutes, 30, "Weekly Review : 30 minutes de retard");

    console.log("✔ Agrégation des retards et reports OK");
    console.log("=== TOUS LES TESTS SONT AU VERT ===");
}

testRespectProgramme().catch(err => {
    console.error("Test échoué:", err);
    process.exit(1);
});
