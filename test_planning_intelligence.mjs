import fs from 'fs';
import path from 'path';
import { Event } from './src/models/Event.js';
import { AvailabilityWindow } from './src/models/AvailabilityWindow.js';
import { PlanningEngine } from './src/engines/PlanningEngine.js';
import { PlanningIntelligence } from './src/engines/PlanningIntelligence.js';

// --- MOCK STORAGE ---
class MockStorage {
    constructor() {
        this.data = {
            events: [],
            availabilities: []
        };
        this.writeCount = 0;
    }
    async loadData(key) { return this.data[key] || []; }
    async saveData(key, val) { 
        this.data[key] = val; 
        this.writeCount++;
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
    console.log("=== TESTS PLANNING INTELLIGENCE ===\n");
    let passed = 0;
    let total = 0;

    const wrapAssert = (condition, message) => {
        total++;
        assert(condition, message);
        passed++;
    };

    const storage = new MockStorage();
    const planningEngine = new PlanningEngine(storage);
    const planningIntelligence = new PlanningIntelligence(planningEngine);

    const DATE = "2026-09-15";

    // Setup initial data
    await storage.saveData('availabilities', [
        new AvailabilityWindow({ id: 'w1', date: DATE, startTime: '08:00', endTime: '10:00' }), // 120m
        new AvailabilityWindow({ id: 'w2', date: DATE, startTime: '14:00', endTime: '16:00' }), // 120m
        new AvailabilityWindow({ id: 'w3', date: DATE, startTime: '18:00', endTime: '19:00' })  // 60m
    ]);
    
    let initialWrites = storage.writeCount;

    // Test 10: Une durée invalide est rejetée proprement
    let res = await planningIntelligence.findCandidateSlots({ date: DATE, duration: -10 });
    wrapAssert(res.candidates.length === 0 && res.reason === "INVALID_DURATION", "10. Une durée invalide est rejetée proprement.");

    // Test 1: Un créneau suffisamment long produit une proposition (et Test 6: 90 produit 90)
    res = await planningIntelligence.findCandidateSlots({ date: DATE, duration: 90 });
    wrapAssert(res.candidates.length > 0 && res.reason === "SUCCESS", "1. Un créneau suffisamment long produit une proposition.");
    wrapAssert(res.candidates[0].duration === 90, "6. targetDuration = 90 produit une proposition de 90 minutes.");
    wrapAssert(res.candidates[0].endTime === "09:30", "11. La proposition respecte les limites de la AvailabilityWindow (08:00 -> 09:30).");

    // Test 3: Deux créneaux valides produisent deux candidats (et Test 12: ordonnés)
    wrapAssert(res.candidates.length === 2, "3. Deux créneaux valides (w1, w2) produisent deux candidats.");
    wrapAssert(res.candidates[0].startTime === "08:00" && res.candidates[1].startTime === "14:00", "12. Les candidats sont déterministes et ordonnés chronologiquement.");

    // Test 2: Un créneau trop court est rejeté
    res = await planningIntelligence.findCandidateSlots({ date: DATE, duration: 150 });
    wrapAssert(res.candidates.length === 0 && res.reason === "NO_SLOT_LONG_ENOUGH", "2. Un créneau trop court est rejeté.");

    // Test 4: Un Event locked bloque correctement le créneau via PlanningEngine
    // On ajoute un event locked de 09:00 à 10:00. Il ne reste que 08:00-09:00 (60m) et 14:00-16:00 (120m) et 18:00-19:00 (60m).
    let lockedEvent = new Event({ id: 'e1', type: 'Examen', date: DATE, startTime: '09:00', endTime: '10:00', lockStatus: 'locked' });
    await planningEngine.saveEvent(lockedEvent);
    initialWrites = storage.writeCount; // Reset count
    
    res = await planningIntelligence.findCandidateSlots({ date: DATE, duration: 90 });
    wrapAssert(res.candidates.length === 1 && res.candidates[0].startTime === "14:00", "4. Un Event locked bloque correctement le créneau via PlanningEngine.");

    // Test 5: Un Event flexible ne supprime pas le créneau disponible
    // On ajoute un event flexible de 14:00 à 15:00. Il ne doit PAS réduire les slots dispos.
    let flexEvent = new Event({ id: 'e2', type: 'Révision', date: DATE, startTime: '14:00', endTime: '15:00', lockStatus: 'flexible' });
    await planningEngine.saveEvent(flexEvent);
    initialWrites = storage.writeCount; // Reset count

    res = await planningIntelligence.findCandidateSlots({ date: DATE, duration: 90 });
    wrapAssert(res.candidates.length === 1 && res.candidates[0].startTime === "14:00", "5. Un Event flexible ne supprime pas le créneau disponible.");

    // Test 7: Aucun créneau disponible retourne une réponse explicite
    // On efface les dispo
    await storage.saveData('availabilities', []);
    res = await planningIntelligence.findCandidateSlots({ date: DATE, duration: 30 });
    wrapAssert(res.candidates.length === 0 && res.reason === "NO_AVAILABLE_SLOT", "7. Aucun créneau disponible retourne une réponse explicite.");

    // Test 8: Aucune modification du Storage n'est effectuée
    // On remet les data pour le test 8 et 9
    await storage.saveData('availabilities', [new AvailabilityWindow({ id: 'w1', date: DATE, startTime: '08:00', endTime: '10:00' })]);
    initialWrites = storage.writeCount;
    res = await planningIntelligence.findCandidateSlots({ date: DATE, duration: 60 });
    wrapAssert(storage.writeCount === initialWrites, "8. Aucune modification du Storage n'est effectuée.");

    // Test 9: Aucun Event existant n'est déplacé
    let e1After = (await planningEngine.getEventsForDate(DATE)).find(e => e.id === 'e1');
    wrapAssert(e1After.startTime === "09:00" && e1After.endTime === "10:00", "9. Aucun Event existant n'est déplacé.");

    console.log(`\n=== RÉSULTATS : ${passed}/${total} TESTS PASSÉS ===`);
    if (passed !== total) process.exit(1);
}

runTests().catch(e => {
    console.error(e);
    process.exit(1);
});
