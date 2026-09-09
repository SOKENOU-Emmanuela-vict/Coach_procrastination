import { LearningCoachEngine } from './src/engines/LearningCoachEngine.js';

async function runTests() {
    console.log("=== TESTS ÉTAPE 8 : LEARNING COACH V1 ===");
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
            upcomingAssessments: [],
            alerts: [],
            cectStatus: { status: 'ok' }
        },
        temporal: {
            events: [],
            availableSlots: []
        },
        userContext: {
            currentSemesterId: 's4'
        },
        analytics: {}
    };

    // Test 1: Examen dans 3 jours + aucune révision + aucun créneau
    let ctx1 = JSON.parse(JSON.stringify(baseContext));
    ctx1.academicSummary.upcomingAssessments.push({
        id: "eval_maths_1",
        title: "Partiel Maths",
        subjectName: "Mathématiques",
        subjectId: "maths",
        daysRemaining: 3,
        targetDate: "2026-09-11"
    });
    let recs1 = coach.generateInsights(ctx1);
    assert(recs1.some(r => r.id === "eval_eval_maths_1_no_plan" && r.type === "CRITICAL" && !r.actionable), "Test 1: Examen imminent sans créneau -> CRITICAL (R1+R4)");

    // Test 2: Examen dans 3 jours + aucune révision + créneau de 2 heures
    let ctx2 = JSON.parse(JSON.stringify(ctx1));
    ctx2.temporal.availableSlots.push({ date: "2026-09-08", startTime: "18:00", endTime: "20:00", durationMinutes: 120 });
    let recs2 = coach.generateInsights(ctx2);
    let sugg2 = recs2.find(r => r.type === "SUGGESTION" && r.actionable === true);
    assert(sugg2 && sugg2.suggestedEvent !== null && sugg2.suggestedEvent.date === "2026-09-08", "Test 2: Examen imminent avec créneau -> SUGGESTION actionable (R1+R3)");

    // Test 3: Examen avec révision existante
    let ctx3 = JSON.parse(JSON.stringify(ctx2));
    ctx3.temporal.events.push({ id: "evt_rev1", assessmentId: "eval_maths_1", type: "revision" });
    let recs3 = coach.generateInsights(ctx3);
    assert(recs3.some(r => r.type === "SUCCESS" && r.id.includes("planned")), "Test 3: Examen avec vraie révision existante -> SUCCESS (R2)");
    assert(!recs3.some(r => r.type === "CRITICAL" || r.type === "SUGGESTION"), "Test 3: Pas d'alerte de révision (R1) pour cette évaluation");

    // Test 3b: Examen avec Event Examen (même assessmentId mais pas de type revision)
    let ctx3b = JSON.parse(JSON.stringify(ctx2));
    ctx3b.temporal.events.push({ id: "evt_exam", assessmentId: "eval_maths_1", type: "class" });
    let recs3b = coach.generateInsights(ctx3b);
    assert(!recs3b.some(r => r.type === "SUCCESS" && r.id.includes("planned")), "Test 3b: Event examen non reconnu comme révision -> Pas de R2");
    assert(recs3b.some(r => r.type === "SUGGESTION" && r.actionable), "Test 3b: R1+R3 se déclenche tout de même");

    // Test 4: Évaluation sans date
    let ctx4 = JSON.parse(JSON.stringify(baseContext));
    ctx4.academicSummary.upcomingAssessments.push({ id: "eval_nodate", title: "Soutenance", subjectName: "Projet", daysRemaining: null, targetDate: null });
    let recs4 = coach.generateInsights(ctx4);
    assert(recs4.some(r => r.type === "INFO" && r.id.includes("nodate")), "Test 4: Évaluation sans date -> INFO (R6)");

    // Test 5: Alerte académique fournie par AcademicEngine
    let ctx5 = JSON.parse(JSON.stringify(baseContext));
    ctx5.academicSummary.alerts.push({ code: "AVG_LOW", message: "Moyenne critique en Info" });
    let recs5 = coach.generateInsights(ctx5);
    assert(recs5.some(r => r.type === "WARNING" && r.message.includes("Moyenne critique")), "Test 5: Relais de l'alerte académique (R5)");

    // Test 6: Context null / incomplet
    let recs6 = coach.generateInsights(null);
    assert(Array.isArray(recs6) && recs6.length === 0, "Test 6: Contexte null ne crashe pas");
    let recs6b = coach.generateInsights({});
    assert(Array.isArray(recs6b), "Test 6: Contexte vide ne crashe pas");

    // Test 7: Déterminisme
    let recs7a = coach.generateInsights(ctx2);
    let recs7b = coach.generateInsights(ctx2);
    assert(JSON.stringify(recs7a) === JSON.stringify(recs7b), "Test 7: Le moteur est strictement déterministe");

    // Test 8: Absence de mutation
    let ctx8 = JSON.parse(JSON.stringify(ctx2));
    let ctx8StringBefore = JSON.stringify(ctx8);
    coach.generateInsights(ctx8);
    let ctx8StringAfter = JSON.stringify(ctx8);
    assert(ctx8StringBefore === ctx8StringAfter, "Test 8: Le moteur ne mute absolument aucune donnée en entrée");

    // Test 9: Absence de Storage
    const code = coach.generateInsights.toString();
    assert(!code.includes("storage.load") && !code.includes("storage.save") && !code.includes("planningEngine.save"), "Test 9: Le moteur ne dépend pas du Storage ou des mutations");

    console.log(`\n=== RÉSULTATS COACH V1 : ${passed}/${total} TESTS PASSÉS ===`);
    if (passed !== total) process.exit(1);
}

runTests().catch(console.error);
