import { App } from './src/core/App.js';
import { DashboardView } from './src/ui/DashboardView.js';

// --- Mocks ---
let savedEvents = [];
let renderDashboardCalled = 0;

// --- DOM Mock ---
let currentMockContainer = null;
const createMockContainer = () => {
    const listeners = [];
    return {
        innerHTML: '',
        addEventListener: () => {},
        querySelectorAll: (selector) => {
            if (selector === '[data-action="accept-coach-event"]') return [{
                dataset: { intent: JSON.stringify({ id: 'sugg_1', date: '2026-10-10' }) },
                closest: () => ({ 
                    parentElement: { remove: () => {} },
                    nextElementSibling: { style: {} }
                }),
                addEventListener: (evt, cb) => listeners.push({ evt, cb, type: 'accept' })
            }];
            if (selector === '[data-action="refuse-coach-event"]') return [{
                closest: () => ({ parentElement: { remove: () => {} } }),
                addEventListener: (evt, cb) => listeners.push({ evt, cb, type: 'refuse' })
            }];
            return [];
        },
        getListeners: () => listeners
    };
};

global.document = {
    getElementById: () => currentMockContainer,
    querySelectorAll: () => [],
    querySelector: () => ({ classList: { add:()=>{}, remove:()=>{} } })
};

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
            console.error(`❌ FAIL: ${message}`);
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
            executeIntent: async (ev) => {
                // Simulation de validation stricte (ex: date obligatoire)
                if (!ev.date) throw new Error("Validation échouée : date requise");
                savedEvents.push(ev);
            }
        },
        refreshUserStats: async () => {},
        refreshCalendarData: async () => {},
        renderView: (viewName) => {
            if (viewName === 'dashboard') renderDashboardCalled++;
        }
    };

    // Bind real App method to mock context
    mockApp.acceptCoachSuggestion = App.prototype.acceptCoachSuggestion.bind(mockApp);

    // --- TEST A : Acceptation ---
    savedEvents = [];
    renderDashboardCalled = 0;
    currentMockContainer = createMockContainer();
    const dashA = new DashboardView("container", mockApp);
    dashA.render(mockApp.state);
    const acceptListenerA = currentMockContainer.getListeners().find(l => l.type === 'accept');
    
    let btnA = {
        dataset: { intent: JSON.stringify({ id: 'sugg_1', date: '2026-10-10' }) },
        closest: () => ({ 
            parentElement: { remove: () => {} },
            nextElementSibling: { style: {} }
        }),
        disabled: false
    };
    
    await acceptListenerA.cb({ target: btnA });
    assert(savedEvents.length === 1 && savedEvents[0].id === 'sugg_1', "Test A: Acceptation -> App.acceptCoachSuggestion -> PlanningEngine.executeIntent");

    // --- TEST B : Refus ---
    savedEvents = [];
    currentMockContainer = createMockContainer();
    const dashB = new DashboardView("container", mockApp);
    dashB.render(mockApp.state);
    const refuseListenerB = currentMockContainer.getListeners().find(l => l.type === 'refuse');
    
    let isRemoved = false;
    let btnB = {
        closest: () => ({ parentElement: { remove: () => { isRemoved = true; } } })
    };
    
    refuseListenerB.cb({ target: btnB });
    assert(savedEvents.length === 0, "Test B: Refus -> aucune sauvegarde");
    assert(isRemoved, "Test B: Refus -> masquage UI");

    // --- TEST C : Erreur Event ---
    savedEvents = [];
    currentMockContainer = createMockContainer();
    const dashC = new DashboardView("container", mockApp);
    dashC.render(mockApp.state);
    const acceptListenerC = currentMockContainer.getListeners().find(l => l.type === 'accept');
    
    let errorFeedbackShown = false;
    let btnC = {
        dataset: { intent: JSON.stringify({ id: 'sugg_err' }) }, // Manque la date => error mockée
        closest: () => ({ 
            parentElement: { remove: () => {} },
            nextElementSibling: { 
                style: {},
                set textContent(val) { if(val.includes("Erreur")) errorFeedbackShown = true; }
            }
        }),
        disabled: false
    };
    
    await acceptListenerC.cb({ target: btnC });
    assert(savedEvents.length === 0, "Test C: Erreur Event -> aucune persistance");
    assert(errorFeedbackShown, "Test C: Erreur Event -> erreur affichée dans l'UI");
    assert(btnC.disabled === false, "Test C: Erreur Event -> bouton réactivé");

    // --- TEST D : Double acceptation ---
    savedEvents = [];
    currentMockContainer = createMockContainer();
    const dashD = new DashboardView("container", mockApp);
    dashD.render(mockApp.state);
    const acceptListenerD = currentMockContainer.getListeners().find(l => l.type === 'accept');
    
    let btnD = {
        dataset: { intent: JSON.stringify({ id: 'sugg_2', date: '2026-10-10' }) },
        closest: () => ({ 
            parentElement: { remove: () => {} },
            nextElementSibling: { style: {} }
        }),
        disabled: false
    };
    
    // Simuler un double clic rapide
    const p1 = acceptListenerD.cb({ target: btnD });
    const p2 = acceptListenerD.cb({ target: btnD });
    await Promise.all([p1, p2]);
    
    assert(savedEvents.length === 1, "Test D: Double acceptation bloquée par l'UI");
    
    console.log(`\n=== RÉSULTATS ÉTAPE 9 : ${passed}/${total} TESTS PASSÉS ===`);
    if (passed !== total) process.exit(1);
}

runEtape9Tests().catch(console.error);
