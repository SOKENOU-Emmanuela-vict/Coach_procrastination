import { LearningCoachEngine } from './src/engines/LearningCoachEngine.js';

async function runEtape10Tests() {
    console.log("=== TESTS ÉTAPE 10 : PRIORISATION TEMPORELLE ===");
    let passed = 0;
    let total = 0;

    const assert = (condition, message) => {
        total++;
        if (condition) {
            console.log(`✅ PASS: ${message}`);
            passed++;
        } else {
            console.error(`❌ FAIL: ${message}`);
        }
    };

    const coach = new LearningCoachEngine();
    const baseContext = {
        dateRef: "2026-09-08",
        academicSummary: {
            upcomingAssessments: [
                {
                    id: "eval_1",
                    title: "Partiel",
                    subjectName: "Maths",
                    daysRemaining: 3,
                    targetDate: "2026-09-11"
                }
            ],
            alerts: []
        },
        temporal: {
            events: [],
            availableSlots: []
        },
        userContext: {},
        analytics: {}
    };

    // Test A — plusieurs créneaux, Test B — durée, Test C — date, Test D — proximité
    let ctx1 = JSON.parse(JSON.stringify(baseContext));
    ctx1.temporal.availableSlots = [
        { date: "2026-09-08", startTime: "10:00", endTime: "12:00", durationMinutes: 120 }, // J, trop loin
        { date: "2026-09-10", startTime: "14:00", endTime: "15:00", durationMinutes: 60 },  // J+2, proche mais durée moyenne
        { date: "2026-09-10", startTime: "16:00", endTime: "18:00", durationMinutes: 120 }, // J+2, proche ET longue durée -> MEILLEUR
        { date: "2026-09-09", startTime: "08:00", endTime: "11:00", durationMinutes: 180 }, // J+1, très long mais moins proche
        { date: "2026-09-12", startTime: "10:00", endTime: "12:00", durationMinutes: 120 }, // J+4, APRÈS l'examen -> IGNORÉ
        { date: "2026-09-10", startTime: "08:00", endTime: "08:30", durationMinutes: 30 }   // J+2, trop court -> IGNORÉ
    ];

    let recs1 = coach.generateInsights(ctx1);
    let sugg1 = recs1.find(r => r.actionable);

    assert(sugg1 !== undefined, "Test A: Une recommandation est produite");
    assert(sugg1.suggestedEvent.date === "2026-09-10", "Test C/D: Date respectée et la plus proche de l'évaluation choisie (J+2)");
    assert(sugg1.suggestedEvent.startTime === "16:00", "Test B: Le créneau de 120min est préféré à celui de 60min le même jour");
    assert(sugg1.suggestedEvent.durationMinutes === undefined, "Test G: La pureté de suggestedEvent est préservée");

    // Test E — égalité
    let ctx2 = JSON.parse(JSON.stringify(baseContext));
    ctx2.temporal.availableSlots = [
        { date: "2026-09-10", startTime: "16:00", endTime: "18:00", durationMinutes: 120 },
        { date: "2026-09-10", startTime: "10:00", endTime: "12:00", durationMinutes: 120 }
    ];
    let recs2 = coach.generateInsights(ctx2);
    let sugg2 = recs2.find(r => r.actionable);
    
    assert(sugg2.suggestedEvent.startTime === "10:00", "Test E: Égalité départagée par l'heure de début (croissante)");

    // Test F — aucun créneau
    let ctx3 = JSON.parse(JSON.stringify(baseContext));
    ctx3.temporal.availableSlots = [
        { date: "2026-09-10", startTime: "08:00", endTime: "08:30", durationMinutes: 30 }, // Trop court
        { date: "2026-09-12", startTime: "10:00", endTime: "12:00", durationMinutes: 120 }  // Après l'examen
    ];
    let recs3 = coach.generateInsights(ctx3);
    assert(recs3.some(r => r.type === "CRITICAL" && !r.actionable), "Test F: Aucun créneau éligible -> R4 CRITICAL");

    // Test G/H — pureté et aucun storage
    let ctx4Str = JSON.stringify(ctx2);
    coach.generateInsights(ctx2);
    assert(JSON.stringify(ctx2) === ctx4Str, "Test G/H: Le contexte d'entrée n'est pas muté et Storage n'est pas utilisé");

    console.log(`\n=== RÉSULTATS ÉTAPE 10 : ${passed}/${total} TESTS PASSÉS ===`);
    if (passed !== total) process.exit(1);
}

runEtape10Tests().catch(console.error);
