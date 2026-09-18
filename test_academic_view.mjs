import { App } from './src/core/App.js';
import { User } from './src/models/User.js';
import { AcademicView } from './src/ui/AcademicView.js';

// Mocks environnement DOM
global.document = {
    getElementById: () => ({ innerHTML: '' }),
    querySelectorAll: () => [],
    querySelector: () => ({ classList: { add:()=>{}, remove:()=>{} } })
};

async function runTests() {
    console.log("=== TESTS ÉTAPE 7 : ESPACE ACADÉMIQUE & PROFIL ===");
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

    // 1. Tests User Model
    const user = new User('u1', 'Test Name');
    assert(user.name === 'Test Name' && user.id === 'u1', "Modèle User : champs existants conservés (id, name)");
    assert(user.streak === 0 && user.preferences.theme === 'dark', "Modèle User : gamification et prefs intacts");
    assert(user.formation === null && user.niveau === null && user.currentSemesterId === null, "Modèle User : nouveaux champs initialisés à null");
    
    user.formation = 'Licence Pro IA';
    user.currentSemesterId = 's4';
    assert(user.formation === 'Licence Pro IA' && user.currentSemesterId === 's4', "Modèle User : mutation des nouveaux champs fonctionnelle");

    // Mock Storage
    const mockDb = { 'user_profile': user };
    const mockStorage = {
        loadData: async (k) => mockDb[k] || null,
        saveData: async (k, v) => { mockDb[k] = v; }
    };

    // 2. Mock Engines pour App
    // constructor(storage, scheduler, studyRecordEngine, checkInEngine, aiEngine, weeklyReviewEngine, chatHistoryEngine)
    const mockApp = new App(
        mockStorage, 
        {}, // scheduler
        { getDailyStats: async()=>({}), getJournal: async()=>({}), getFullHistory: async()=>([]), getMonthlyStats: async()=>({}) }, // studyRecordEngine
        { buildDailySummary: async()=>({}), getCheckIn: async()=>({}) }, // checkInEngine
        { generateInsights: async()=>({}), generateHealth: async()=>({}), generateMonthlyReport: async()=>({}) }, // aiEngine
        { generateInsights: ()=>({}) }, // weeklyReviewEngine
        {} // chatHistoryEngine
    );
    
    // Stub AcademicEngine pour tester le passage du currentSemesterId
    let requestedSemester = null;
    mockApp.academicEngine = {
        getSemesterSummary: async (semId, date) => {
            requestedSemester = semId;
            return {
                semester: { id: semId, name: 'Test Semester' },
                average: { value: 15, status: 'complete' },
                cectStatus: { officialTotal: 30, detailedTotal: 26, discrepancy: 4, status: 'to_confirm' },
                subjects: [],
                upcomingAssessments: [],
                alerts: []
            };
        }
    };
    mockApp.planningEngine = { getEventsForDate: async ()=>[], getEvents: async()=>[], getAvailabilityWindows: async()=>[], getAvailableSlots: async()=>[], detectConflicts: async ()=>[] };
    mockApp.learningGraphEngine = { evaluateGraph: async()=>({}) };
    mockApp.reflectionEngine = { analyzeJournalTrends: async()=>({}) };
    mockApp.scheduler = { getFullProgram: async()=>[] };

    // 3. Test App Routing & currentSemesterId
    await mockApp.refreshUserStats();
    assert(requestedSemester === 's4', "App : currentSemesterId ('s4') est bien extrait du profil et transmis à getSemesterSummary");
    assert(mockApp.state.academicSummary.cectStatus.discrepancy === 4, "App : Le cas S4 (30/26/4/to_confirm) est préservé et transmis dans le state");

    // Test avec un autre semestre
    user.currentSemesterId = 's3';
    await mockApp.refreshUserStats();
    assert(requestedSemester === 's3', "App : la dépendance au 's4' hardcodé est retirée, suit le currentSemesterId");

    // 4. Test UI Isolation
    const view = new AcademicView('dummy', mockApp);
    assert(typeof view.render === 'function', "AcademicView : la vue existe et a une méthode render");
    
    const viewCode = view.render.toString() + view._renderSummary.toString() + view._renderProfile.toString();
    const hasStorage = viewCode.includes('storage.loadData') || viewCode.includes('storage.saveData');
    const hasEngineCall = viewCode.includes('academicEngine.') || viewCode.includes('getSemesterAverage');
    assert(!hasStorage && !hasEngineCall, "AcademicView : UI isolée (READ-ONLY), aucun appel Storage ou Engine direct");

    // Test Rendu
    let fakeContainer = { innerHTML: '' };
    view.container = fakeContainer;
    view.render(mockApp.state);
    assert(fakeContainer.innerHTML.includes('s3') && fakeContainer.innerHTML.includes('30 officiels') && fakeContainer.innerHTML.includes('15/20'), "AcademicView : rendu effectue l'affichage correct des données de l'App (READ-ONLY)");

    console.log(`\n=== RÉSULTATS : ${passed}/${total} TESTS PASSÉS ===`);
    if (passed !== total) process.exit(1);
}

runTests().catch(console.error);
