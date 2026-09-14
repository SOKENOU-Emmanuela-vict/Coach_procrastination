import { Event } from './src/models/Event.js';

function runTests() {
    console.log("=== TESTS TARGET DURATION ===");
    let passed = 0;
    let total = 0;

    const assert = (condition, message) => {
        total++;
        if (condition) {
            passed++;
        } else {
            console.error(`❌ FAIL: ${message}`);
        }
    };

    // Test 1 — absence
    let e1 = new Event({ id: "e1", type: "Cours", date: "2026-10-01" });
    assert(e1.targetDuration === null, "Test 1 - absence: targetDuration est null");

    // Test 2 — 45 minutes
    let e2 = new Event({ id: "e2", type: "Cours", date: "2026-10-01", targetDuration: 45 });
    assert(e2.targetDuration === 45, "Test 2 - 45 minutes");

    // Test 3 — 90 minutes
    let e3 = new Event({ id: "e3", type: "Cours", date: "2026-10-01", targetDuration: 90 });
    assert(e3.targetDuration === 90, "Test 3 - 90 minutes");

    // Test 4 — 120 minutes
    let e4 = new Event({ id: "e4", type: "Cours", date: "2026-10-01", targetDuration: 120 });
    assert(e4.targetDuration === 120, "Test 4 - 120 minutes");

    // Test 5 — zéro
    let e5Error = false;
    try {
        new Event({ id: "e5", type: "Cours", date: "2026-10-01", targetDuration: 0 });
    } catch(e) {
        e5Error = true;
    }
    assert(e5Error, "Test 5 - zéro: doit être rejeté");

    // Test 6 — négatif
    let e6Error = false;
    try {
        new Event({ id: "e6", type: "Cours", date: "2026-10-01", targetDuration: -30 });
    } catch(e) {
        e6Error = true;
    }
    assert(e6Error, "Test 6 - négatif: doit être rejeté");

    // Test 7 — texte
    let e7Error = false;
    try {
        new Event({ id: "e7", type: "Cours", date: "2026-10-01", targetDuration: "90" });
    } catch(e) {
        e7Error = true;
    }
    assert(e7Error, "Test 7 - texte: doit être rejeté");

    // Test 8 — sans horaire
    let e8 = new Event({ id: "e8", type: "Cours", date: "2026-10-01", targetDuration: 90, startTime: null, endTime: null });
    assert(e8.targetDuration === 90 && e8.startTime === null && e8.endTime === null, "Test 8 - sans horaire: valide");

    // Test 9 — duration
    let e9 = new Event({ id: "e9", type: "Cours", date: "2026-10-01", startTime: "14:00", endTime: "15:30" });
    assert(e9.duration === 90, "Test 9 - duration: 90 minutes à partir de startTime/endTime");

    // Test 10 — indépendance
    let e10 = new Event({ id: "e10", type: "Cours", date: "2026-10-01", startTime: "14:00", endTime: "15:30", targetDuration: 120 });
    assert(e10.duration === 90 && e10.targetDuration === 120, "Test 10 - indépendance: duration (90) != targetDuration (120)");

    console.log(`=> Resultats: ${passed}/${total} assertions PASS`);
    if(passed !== total) process.exit(1);
}

runTests();
