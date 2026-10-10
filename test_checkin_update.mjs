import assert from 'assert';
import { DailyCheckIn } from './src/models/DailyCheckIn.js';
import { MemoryProvider } from './src/services/MemoryProvider.js';
import { CheckInEngine } from './src/engines/CheckInEngine.js';
import { PlanningEngine } from './src/engines/PlanningEngine.js';
import { SchedulerEngine } from './src/engines/SchedulerEngine.js';
import { StudyRecordEngine } from './src/engines/StudyRecordEngine.js';

async function testCheckInMigration() {
    console.log("=== TESTS DAILY CHECK-IN EXTENSION ===");
    
    // Test 1: Backward compatibility (old check-in data)
    const oldData = {
        date: '2026-10-10',
        energy: 'high',
        sleep: { durationMinutes: 480, quality: 'good' }
    };
    const oldCheckIn = new DailyCheckIn(oldData);
    assert.strictEqual(oldCheckIn.mood, 'medium', "L'humeur par défaut doit être 'medium'");
    assert.strictEqual(oldCheckIn.motivation, 'medium', "La motivation par défaut doit être 'medium'");
    console.log("✔ Backward compatibility (données anciennes)");

    // Test 2: New check-in data with mood and motivation
    const newData = {
        date: '2026-10-11',
        energy: 'low',
        mood: 'high',
        motivation: 'low',
        sleep: { durationMinutes: 300, quality: 'poor' }
    };
    const newCheckIn = new DailyCheckIn(newData);
    assert.strictEqual(newCheckIn.mood, 'high', "L'humeur doit être conservée");
    assert.strictEqual(newCheckIn.motivation, 'low', "La motivation doit être conservée");
    console.log("✔ Nouveaux attributs mood/motivation pris en compte");

    // Test 3: Validation des nouvelles échelles
    try {
        new DailyCheckIn({ date: '2026-10-12', mood: 'super' });
        assert.fail("Aurait dû lancer une erreur pour humeur invalide");
    } catch (e) {
        assert.ok(e.message.includes('Niveau d\'humeur invalide'), "Validation humeur OK");
    }
    
    try {
        new DailyCheckIn({ date: '2026-10-12', motivation: 'zero' });
        assert.fail("Aurait dû lancer une erreur pour motivation invalide");
    } catch (e) {
        assert.ok(e.message.includes('Niveau de motivation invalide'), "Validation motivation OK");
    }
    console.log("✔ Validation des attributs");

    // Test 4: Engine persistence
    const storage = new MemoryProvider();
    const planningEngine = new PlanningEngine(storage);
    const studyRecordEngine = new StudyRecordEngine(storage);
    const checkInEngine = new CheckInEngine(storage, planningEngine, null, studyRecordEngine);

    const savedCheckIn = await checkInEngine.saveCheckIn(newData);
    const retrievedCheckIn = await checkInEngine.getCheckIn('2026-10-11');
    assert.strictEqual(retrievedCheckIn.mood, 'high');
    assert.strictEqual(retrievedCheckIn.motivation, 'low');
    console.log("✔ Persistance via CheckInEngine OK");

    console.log("=== TOUS LES TESTS SONT AU VERT ===");
}

testCheckInMigration().catch(err => {
    console.error("Test échoué:", err);
    process.exit(1);
});
