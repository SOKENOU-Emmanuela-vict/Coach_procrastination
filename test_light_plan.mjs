import assert from 'assert';
import { MemoryProvider } from './src/services/MemoryProvider.js';
import { PlanningEngine } from './src/engines/PlanningEngine.js';

async function testLightPlan() {
    console.log("=== TESTS PLAN ALLÉGÉ ===");
    
    const storage = new MemoryProvider();
    
    // Setup mock assessments
    const today = new Date();
    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() + 3); // Dans 3 jours
    
    await storage.saveData('acad_assessments', [
        { id: 'ass_close', targetDate: targetDate.toLocaleDateString('fr-CA') }
    ]);

    const planningEngine = new PlanningEngine(storage);
    const dateStr = today.toLocaleDateString('fr-CA');

    // Add Events
    await planningEngine.executeIntent({
        validateStructure: () => ({ valid: true }),
        target: 'event', action: 'create',
        constraints: { date: dateStr, startTime: '08:00', endTime: '10:00' },
        payload: { title: 'Cours Locked', lockStatus: 'locked', type: 'course' }
    });

    await planningEngine.executeIntent({
        validateStructure: () => ({ valid: true }),
        target: 'event', action: 'create',
        constraints: { date: dateStr, startTime: '10:00', endTime: '11:00' },
        payload: { title: 'Revision Proche', lockStatus: 'flexible', type: 'revision', assessmentId: 'ass_close' }
    });

    await planningEngine.executeIntent({
        validateStructure: () => ({ valid: true }),
        target: 'event', action: 'create',
        constraints: { date: dateStr, startTime: '14:00', endTime: '14:30' }, // 30 min
        payload: { title: 'Small Flexible', lockStatus: 'flexible', type: 'personal' }
    });

    await planningEngine.executeIntent({
        validateStructure: () => ({ valid: true }),
        target: 'event', action: 'create',
        constraints: { date: dateStr, startTime: '15:00', endTime: '17:00' }, // 120 min
        payload: { title: 'Long Flexible', lockStatus: 'flexible', type: 'personal' }
    });

    let events = await planningEngine.getEventsForDate(dateStr);
    assert.strictEqual(events.length, 4, "Initialement 4 événements");

    // Alléger
    const res = await planningEngine.lightenDailyPlan(dateStr);
    
    assert.strictEqual(res.removedCount, 1, "Un événement retiré (small flexible)");
    assert.strictEqual(res.shortenedCount, 1, "Un événement raccourci (long flexible)");

    events = await planningEngine.getEventsForDate(dateStr);
    assert.strictEqual(events.length, 3, "Il reste 3 événements (1 retiré)");

    const locked = events.find(e => e.title === 'Cours Locked');
    assert.ok(locked, "Locked conservé");
    
    const protectedRev = events.find(e => e.title === 'Revision Proche');
    assert.ok(protectedRev, "Révision protégée conservée");
    assert.strictEqual(protectedRev.endTime, '11:00', "Durée révision intacte");

    const small = events.find(e => e.title === 'Small Flexible');
    assert.strictEqual(small, undefined, "Small supprimé");

    const long = events.find(e => e.title === 'Long Flexible');
    assert.ok(long, "Long conservé mais raccourci");
    assert.strictEqual(long.endTime, '16:00', "Durée réduite par 2 (de 15h-17h -> 15h-16h)");

    console.log("✔ Logique plan allégé OK");
    console.log("=== TOUS LES TESTS SONT AU VERT ===");
}

testLightPlan().catch(err => {
    console.error("Test échoué:", err);
    process.exit(1);
});
