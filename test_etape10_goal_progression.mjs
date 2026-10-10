import { App } from './src/core/App.js';
import { Goal } from './src/models/Goal.js';

async function runTests() {
    console.log("=== TESTS ÉTAPE 10 : Goal Progression ===");

    const memory = {};
    const storage = {
        saveData: async (k, v) => { memory[k] = v; },
        loadData: async (k) => memory[k],
        getAllKeys: async () => Object.keys(memory)
    };

    // Mock document
    global.document = {
        getElementById: () => ({ addEventListener: () => {} }),
        querySelector: () => ({}),
        querySelectorAll: () => []
    };

    // Setup App with dependencies
    const app = new App(
        storage,
        null, // scheduler
        { getDailyStats: async () => ({}), getFullHistory: async () => [], getMonthlyStats: async () => ({}) }, // studyRecordEngine
        { buildDailySummary: async () => ({}), getCheckIn: async () => ({}) }, // checkInEngine
        null, null, null, null
    );

    // Mocks for other engines created in App
    app.academicEngine = {
        getSemesterSummary: async () => ({}),
        getSubjects: async () => [],
        getGrades: async () => [],
        getAssessments: async () => []
    };
    app.planningEngine = {
        getEventsForDate: async () => []
    };
    app.refreshCalendarData = async () => {};
    app.buildCoachContext = async () => ({});
    app.coachEngine = { getInsights: async () => [] };

    // Setup goals via projectEngine
    await app.projectEngine.saveGoal(new Goal({ id: 'g1', title: 'Goal', autoMetric: { type: 'tasks', target: 2 } }));
    
    // Setup data via projectEngine
    await app.projectEngine.savePersonalTask({ id: 't1', title: 'Task 1', status: 'faite' });
    await app.projectEngine.savePersonalTask({ id: 't2', title: 'Task 2', status: 'faite' });
    app.state.userProfile = { streak: 0 };
    
    // Call refreshUserStats which calculates goal progress
    await app.refreshUserStats(new Date());

    const updatedGoals = await app.projectEngine.getGoals();
    const g1 = updatedGoals.find(g => g.id === 'g1');
    console.assert(g1.progress === 100, `Progress should be 100%, got ${g1?.progress}`);
    
    console.log("✅ Progression automatique des objectifs fonctionnelle (type tasks).");
    
    // Test milestone nudges
    // Mock for chat engine and sayCoach
    let sayCoachCalled = false;
    let toastEventCalled = false;
    
    app._sayCoach = async (msg) => {
        if (msg.includes('Félicitations')) sayCoachCalled = true;
    };
    app.chatHistoryEngine = { saveMessage: async () => {} };
    
    // mock window for toast/badge
    global.window = {
        dispatchEvent: (event) => {
            if (event.type === 'toast' || event.type === 'badge') toastEventCalled = true;
        }
    };
    
    await app.syncProactiveCoachMessages(new Date());
    
    console.assert(sayCoachCalled, "sayCoach should have been called for 100% milestone");
    console.assert(toastEventCalled, "window.dispatchEvent for toast/badge should have been called");
    console.log("✅ Alertes de réussite par jalon fonctionnelles.");
    
    console.log("Tests terminés.");
}

runTests().catch(console.error);
