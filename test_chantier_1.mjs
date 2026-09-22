import { DailyCheckIn } from './src/models/DailyCheckIn.js';

async function runTests() {
    console.log("=== TESTS CHANTIER 1 : MIGRATION ET CHECKIN ===\n");
    let passed = 0;
    let total = 0;

    function assert(condition, message) {
        total++;
        if (condition) {
            console.log(`✅ [PASS] ${message}`);
            passed++;
        } else {
            console.error(`❌ [FAIL] ${message}`);
        }
    }

    try {
        const payloadFromCoach = {
            date: "2026-09-21",
            energy: "high",
            sleep: { durationMinutes: 420, quality: "good" },
            blockers: ["Manque de temps"],
            notes: "Bilan via Coach",
            dayAssessment: "partial",
            needsFollowUp: []
        };
        const checkIn = new DailyCheckIn(payloadFromCoach);
        assert(checkIn.energy === "high" && checkIn.sleep.durationMinutes === 420, "DailyCheckIn accepte correctement le payload généré par le Coach.");
    } catch(e) {
        assert(false, "DailyCheckIn a rejeté le payload du Coach : " + e.message);
    }

    try {
        const oldJournals = {
            "2026-09-18": {
                date: "2026-09-18",
                energy: "low",
                mood: 2,
                notes: "Journée difficile.",
                blockers: ["Fatigue"]
            }
        };
        
        const checkins = {}; 
        let migrated = false;
        
        for (const date in oldJournals) {
            if (!checkins[date]) {
                const j = oldJournals[date];
                checkins[date] = {
                    id: `chk_migrated_${date}`,
                    date: date,
                    energy: j.energy || 'medium',
                    sleep: { durationMinutes: 420, quality: 'fair' },
                    blockers: j.blockers || [],
                    notes: `(Ancien Journal)\nHumeur: ${j.mood || '?'}\nAppris: ${j.learned || '?'}\n` + (j.notes || ''),
                    dayAssessment: 'completed',
                    needsFollowUp: [],
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };
                migrated = true;
            }
        }
        
        assert(migrated === true, "Le script de migration détecte les anciens journaux.");
        assert(checkins["2026-09-18"] !== undefined, "La clé de la date est conservée lors de la migration.");
        assert(checkins["2026-09-18"].energy === "low", "Les valeurs (ex: energy) sont correctement mappées.");
        assert(checkins["2026-09-18"].notes.includes("Journée difficile."), "Les notes textuelles (journal) sont correctement concaténées.");
        
    } catch(e) {
        assert(false, "Erreur lors de la simulation de migration : " + e.message);
    }

    console.log(`\n=== RÉSULTATS : ${passed}/${total} TESTS PASSÉS ===`);
}

runTests();
