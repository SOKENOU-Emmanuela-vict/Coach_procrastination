import fs from 'fs';
import path from 'path';
import { PlanningIntent } from './src/models/PlanningIntent.js';
import { CoachContextBuilder } from './src/ai/CoachContext.js';
import { CoachReasoning } from './src/ai/CoachReasoning.js';
import { CoachAI } from './src/ai/CoachAI.js';
import { PlanningAI } from './src/ai/PlanningAI.js';
import { CoachOrchestrator } from './src/ai/CoachOrchestrator.js';
import { PlanningEngine } from './src/engines/PlanningEngine.js';

// --- MOCK PlanningIntelligence ---
class MockPlanningIntelligence {
    async findCandidateSlots({ date, duration }) {
        if (date === "2026-09-12" && duration <= 90) {
            return {
                candidates: [
                    { date: "2026-09-12", startTime: "18:00", endTime: "19:30", duration: 90 }
                ],
                reason: "SUCCESS"
            };
        }
        return { candidates: [], reason: "NO_SLOT" };
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
    console.log("=== TESTS COACH AI & PLANNING AI (PHASE B.9) ===\n");
    let passed = 0;
    let total = 0;

    const wrapAssert = (condition, message) => {
        total++;
        assert(condition, message);
        passed++;
    };

    // --- PlanningIntent ---
    const validIntent = new PlanningIntent({
        version: 1,
        action: 'create',
        target: 'event',
        constraints: { date: '2026-09-12' },
        payload: { title: 'Revision' }
    });
    wrapAssert(validIntent.validateStructure().valid, "1. Intent valide");

    const invalidAction = new PlanningIntent({ version: 1, action: 'destroy', target: 'event' });
    wrapAssert(!invalidAction.validateStructure().valid, "2. Action invalide");

    const invalidStruct = new PlanningIntent({ version: 2, action: 'create', target: 'event', constraints: {} });
    wrapAssert(!invalidStruct.validateStructure().valid, "3. Structure invalide (version incorrecte)");

    wrapAssert(validIntent.payload.title === 'Revision', "4. Payload/constraints acceptés sans validation métier");
    wrapAssert(typeof validIntent.save === 'undefined', "5. Aucune connexion Storage");

    // --- CoachContext ---
    const rawData = {
        userProfile: { name: "Bob" },
        academicSummary: { alerts: [] },
        temporalEvents: [{ id: 'e1' }],
        availableSlots: [{ date: '2026-09-12' }],
        analytics: { score: 10 }
    };
    
    let ctx1 = CoachContextBuilder.build(rawData);
    wrapAssert(ctx1.user.name === "Bob" && ctx1.planning.events.length === 1, "6. Construction correcte du contexte");
    
    let ctx2 = CoachContextBuilder.build(rawData);
    wrapAssert(JSON.stringify(ctx1) === JSON.stringify(ctx2), "7. Déterminisme du ContextBuilder");
    
    wrapAssert(rawData.temporalEvents.length === 1, "8. Aucune mutation des données d'entrée");
    wrapAssert(typeof CoachContextBuilder.saveData === 'undefined', "9. Aucune écriture Storage dans Context");

    // --- CoachReasoning (Déterministe) ---
    let reasonCtx = {
        academic: {
            upcomingAssessments: [
                { id: "eval1", title: "Maths", daysRemaining: 3, targetDate: "2026-09-15" }
            ]
        },
        planning: { events: [] }
    };
    
    let decisions = CoachReasoning.analyze(reasonCtx);
    wrapAssert(decisions.length === 1, "10. Détection d'un examen imminent (signal détecté)");
    let d1 = decisions[0];
    wrapAssert(d1.signal && d1.signal.type === "UNPREPARED_ASSESSMENT", "11. Présence d'un Signal explicite");
    wrapAssert(d1.signal.evidence.includes("assessment_within_threshold"), "12. Production correcte de Evidence");
    wrapAssert(d1.decision && d1.decision.type === "RECOMMEND_ASSESSMENT_PREPARATION", "13. Présence d'une Decision explicite");

    // --- CoachAI (QUOI / POURQUOI) ---
    const coachAI = new CoachAI();
    let recs = await coachAI.analyze(reasonCtx);
    wrapAssert(recs.length === 1 && recs[0].type === "SUGGESTION", "14. CoachAI convertit la décision en Recommendation");
    wrapAssert(recs[0].actionable === true && recs[0].planningRequest, "15. CoachAI produit un planningRequest abstrait (QUOI)");
    wrapAssert(recs[0].planningRequest.duration === 90 && !recs[0].planningRequest.constraints, "16. planningRequest ne contient aucune contrainte temporelle (OÙ/QUAND)");

    // --- PlanningAI (OÙ / QUAND) ---
    const mockPI = new MockPlanningIntelligence();
    const planningAI = new PlanningAI(mockPI);
    
    // Contexte avec créneau dispo
    const planningCtxDispo = { availableSlots: [{ date: "2026-09-12" }] };
    let plannedRecs = await planningAI.plan(recs, planningCtxDispo);
    wrapAssert(plannedRecs.length === 1 && plannedRecs[0].intent instanceof PlanningIntent, "17. PlanningAI trouve un créneau et crée un PlanningIntent (OÙ/QUAND)");
    wrapAssert(plannedRecs[0].intent.constraints.date === "2026-09-12", "18. L'Intent contient bien la date trouvée");
    
    // Contexte sans créneau dispo
    const planningCtxNoDispo = { availableSlots: [{ date: "2026-09-30" }] }; // no slot match the mockPI logic
    let plannedRecsNoSlot = await planningAI.plan(recs, planningCtxNoDispo);
    wrapAssert(plannedRecsNoSlot.length === 1 && plannedRecsNoSlot[0].type === "CRITICAL" && !plannedRecsNoSlot[0].intent, "19. PlanningAI gère l'absence de créneau (Recommendation devient CRITICAL, sans intent)");

    // --- Orchestrator ---
    const orchestrator = new CoachOrchestrator(mockPI);
    let rawInput = {
        academicSummary: {
            upcomingAssessments: [
                { id: "eval2", title: "Physique", daysRemaining: 2, targetDate: "2026-09-14" }
            ]
        },
        availableSlots: [{ date: "2026-09-12" }],
        temporalEvents: []
    };
    
    let finalRecs = await orchestrator.getInsights(rawInput);
    wrapAssert(finalRecs.length === 1, "20. Context → CoachAI → PlanningAI (Pipeline complet)");
    wrapAssert(finalRecs[0].title.includes("Examen imminent"), "21. Recommendation correcte depuis l'orchestrateur");
    wrapAssert(finalRecs[0].intent && finalRecs[0].intent.target === "event", "22. Recommendation finale contenant un Intent");

    // --- Sécurité ---
    const codeCoachAI = fs.readFileSync(path.join(process.cwd(), 'src/ai/CoachAI.js'), 'utf8');
    const codePlanningAI = fs.readFileSync(path.join(process.cwd(), 'src/ai/PlanningAI.js'), 'utf8');
    const codeOrchestrator = fs.readFileSync(path.join(process.cwd(), 'src/ai/CoachOrchestrator.js'), 'utf8');
    
    wrapAssert(!codeCoachAI.includes("planningEngine.saveEvent") && !codePlanningAI.includes("planningEngine.saveEvent"), "23. Aucun bypass PlanningEngine (sauvegarde directe)");
    wrapAssert(!codeCoachAI.includes("storage.") && !codePlanningAI.includes("storage."), "24. Aucun accès direct Storage depuis les IA");

    // --- 25. Test Intent -> PlanningEngine ---
    class MockStorage {
        constructor() { this.data = { events: [] }; }
        async loadData(key) { return this.data[key] || []; }
        async saveData(key, value) { this.data[key] = value; }
    }
    const mockStorage = new MockStorage();
    const testPlanningEngine = new PlanningEngine(mockStorage);
    
    // Validate subject missing
    const intentMissingSubj = new PlanningIntent({ version: 1, action: 'create', target: 'event', payload: { subjectId: "ghost" } });
    const resMiss = await testPlanningEngine.executeIntent(intentMissingSubj);
    wrapAssert(!resMiss.success && resMiss.reason.includes("not found"), "25a. executeIntent rejette correctement un intent avec reference métier manquante");
    
    // Conflict locked validation
    mockStorage.data.events = [{ id: "eLocked", lockStatus: "locked", date: "2026-09-12", startTime: "10:00", endTime: "11:00" }];
    const intentConflict = new PlanningIntent({
        version: 1, action: "create", target: "event",
        constraints: { date: "2026-09-12", startTime: "10:30", endTime: "11:30" },
        payload: { lockStatus: "locked" }
    });
    const resConf = await testPlanningEngine.executeIntent(intentConflict);
    wrapAssert(!resConf.success && resConf.reason.includes("CRITICAL_CONFLICT"), "25b. executeIntent rejette correctement un conflit de type locked vs locked");

    await testPlanningEngine.executeIntent(validIntent);
    
    const savedEvents = await mockStorage.loadData('events');
    wrapAssert(savedEvents.length === 2, "26. PlanningEngine a bien persisté un Event via l'intent (2 events au total: 1 locked test + 1 nouveau)");
    wrapAssert(savedEvents[1].date === "2026-09-12" && savedEvents[1].title === "Revision", "27. Les données de l'Event créé correspondent à l'intent");
    wrapAssert(savedEvents[1].id && savedEvents[1].source === "system", "28. L'Event est correctement structuré par PlanningEngine");

    console.log(`\n=== RÉSULTATS : ${passed}/${total} TESTS PASSÉS ===`);
    if (passed !== total) process.exit(1);
}

runTests().catch(e => {
    console.error(e);
    process.exit(1);
});
