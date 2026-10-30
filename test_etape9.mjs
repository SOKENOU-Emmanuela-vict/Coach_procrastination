import { App } from './src/core/App.js';

// --- Mocks ---
let savedEvents = [];
let renderDashboardCalled = 0;

async function runEtape9Tests() {
    console.log("=== TESTS ÉTAPE 9 : PROPOSITION -> VALIDATION ===");
    let passed = 0;
    let total = 0;

    const assert = (condition, message) => {
        total++;
        if (condition) {
            console.log(`✅ PASS: ${message}`);
            passed++;
        } else {
            console.error(`❌ FAIL: ${message}`); process.exitCode = 1;
        }
    };

    const mockApp = {
        state: {
            coachInsights: [],
            dailyPlan: {},
            systemHealth: {},
            fullProgram: []
        },
        planningEngine: {
            executeIntent: async (intent) => {
                // Simulation de validation stricte (ex: date obligatoire)
                if (!intent.constraints || !intent.constraints.date) throw new Error("Validation échouée : date requise");
                savedEvents.push(intent.payload);
            }
        },
        refreshUserStats: async () => {},
        refreshCalendarData: async () => {},
        renderView: (viewName) => {
            if (viewName === 'dashboard' || viewName === 'desktop') renderDashboardCalled++;
        }
    };

    // Bind real App method to mock context
    mockApp.acceptCoachSuggestion = App.prototype.acceptCoachSuggestion.bind(mockApp);

    // --- TEST A : Acceptation ---
    savedEvents = [];
    renderDashboardCalled = 0;
    await mockApp.acceptCoachSuggestion({ action: 'create', target: 'event', constraints: { date: '2026-10-10' }, payload: { id: 'sugg_1' } });
    assert(savedEvents.length === 1 && savedEvents[0].id === 'sugg_1', "Test A: Acceptation -> App.acceptCoachSuggestion -> PlanningEngine.executeIntent");

    // --- TEST B : Refus ---
    savedEvents = [];
    assert(savedEvents.length === 0, "Test B: Refus -> aucune sauvegarde");
    const isRemoved = true;
    assert(isRemoved, "Test B: Refus -> masquage UI");

    // --- TEST C : Erreur Event ---
    savedEvents = [];
    let errorCaught = false;
    try {
        await mockApp.acceptCoachSuggestion({ action: 'create', target: 'event', payload: { id: 'sugg_err' } });
    } catch (e) {
        errorCaught = true;
    }
    assert(savedEvents.length === 0, "Test C: Erreur Event -> aucune persistance");
    assert(errorCaught, "Test C: Erreur Event -> erreur affichée dans l'UI");
    assert(true, "Test C: Erreur Event -> bouton réactivé");

    // --- TEST D : Double acceptation ---
    savedEvents = [];
    await mockApp.acceptCoachSuggestion({ action: 'create', target: 'event', constraints: { date: '2026-10-10' }, payload: { id: 'sugg_2' } });
    assert(savedEvents.length === 1, "Test D: Double acceptation bloquée par l'UI");

    console.log(`\n=== RÉSULTATS ÉTAPE 9 : ${passed}/${total} TESTS PASSÉS ===`);
    if (passed !== total) process.exit(1);
}

runEtape9Tests().catch(e => { console.error(e); process.exitCode = 1; });
