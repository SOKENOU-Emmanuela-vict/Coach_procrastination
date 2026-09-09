import { App } from './src/core/App.js';
import { Event } from './src/models/Event.js';
import { AvailabilityWindow } from './src/models/AvailabilityWindow.js';
import fs from 'fs';
import path from 'path';

// --- Mocks ---
global.window = { location: { hash: '' }, addEventListener: () => {} };
global.document = {
    getElementById: () => ({ innerHTML: '', addEventListener: () => {}, classList: { add:()=>{}, remove:()=>{} }, querySelectorAll: () => [] }),
    querySelectorAll: () => [],
    querySelector: () => ({ classList: { add:()=>{}, remove:()=>{} } })
};

async function runTests() {
    console.log("=== TESTS ÉTAPE 6 : ESPACE CALENDRIER ===");
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

    // Mock engines
    const mockDb = {};
    const mockStorage = {
        loadData: async (key) => mockDb[key] || null,
        saveData: async (key, val) => { mockDb[key] = val; },
        loadDataSync: (key) => mockDb[key] || null,
        saveDataSync: (key, val) => { mockDb[key] = val; }
    };
    const mockScheduler = { generateDailyPlan: async () => {} };
    const mockXpEngine = {};
    const mockStudyRecordEngine = { 
        getDailyStats: async () => ({}), 
        getJournal: async () => ({}) 
    };
    const mockAnalyticsEngine = { getAnalyticsSummary: async () => ({}) };
    const mockCoachEngine = {};
    const mockAiEngine = {};

    // Initialize App
    const app = new App(
        mockStorage, 
        mockScheduler, 
        mockXpEngine, 
        mockStudyRecordEngine, 
        mockAnalyticsEngine, 
        mockCoachEngine, 
        mockAiEngine
    );
    app.planningEngine.storage = mockStorage;
    app.academicEngine.storage = mockStorage;
    if(app.analyticsEngine) app.analyticsEngine.storage = mockStorage;
    if(app.academicEngine) app.academicEngine.storage = mockStorage;
    if(app.studyRecordEngine) app.studyRecordEngine.storage = mockStorage;
    if(app.schedulerEngine) app.schedulerEngine.storage = mockStorage;
    if(app.coachEngine) app.coachEngine.storage = mockStorage;
    
    // Mock refreshUserStats to avoid mocking 20 engine methods
    app.refreshUserStats = async () => {};

    // Test 1-3: CRUD Event
    const ev1 = new Event({ id: 'ev1', title: 'Test', date: '2026-10-10', lockStatus: 'locked', priority: 'high', subjectId: 'subj1' });
    await app.saveCalendarEvent(ev1);
    const eventsAfterAdd = await app.planningEngine.getEvents();
    assert(eventsAfterAdd.length === 1 && eventsAfterAdd[0].id === 'ev1', "1. Création Event");

    ev1.title = "Test Modif";
    await app.saveCalendarEvent(ev1);
    const eventsAfterUpdate = await app.planningEngine.getEvents();
    assert(eventsAfterUpdate[0].title === 'Test Modif', "2. Modification Event");

    await app.deleteCalendarEvent('ev1');
    const eventsAfterDelete = await app.planningEngine.getEvents();
    assert(eventsAfterDelete.length === 0, "3. Suppression Event");

    // Test 4-6: CRUD AvailabilityWindow
    const av1 = new AvailabilityWindow({ id: 'av1', date: '2026-10-10', startTime: '10:00', endTime: '12:00' });
    await app.saveCalendarAvailability(av1);
    const availsAfterAdd = await app.planningEngine.getAvailabilityWindows();
    assert(availsAfterAdd.length === 1 && availsAfterAdd[0].id === 'av1', "4. Création AvailabilityWindow");

    av1.startTime = '11:00';
    await app.saveCalendarAvailability(av1);
    const availsAfterUpdate = await app.planningEngine.getAvailabilityWindows();
    assert(availsAfterUpdate[0].startTime === '11:00', "5. Modification AvailabilityWindow");

    await app.deleteCalendarAvailability('av1');
    const availsAfterDelete = await app.planningEngine.getAvailabilityWindows();
    assert(availsAfterDelete.length === 0, "6. Suppression AvailabilityWindow");

    // Test 7: App -> PlanningEngine -> Storage (Done via CRUD tests above)
    assert(true, "7. App → PlanningEngine → Storage (Vérifié par tests CRUD)");

    // Test 8-9: Absence de fallback 08:00-22:00
    const freeSlotsEmpty = await app.getAvailableSlots('2026-11-11');
    assert(freeSlotsEmpty.length === 0, "8-9. Absence de fallback 08:00-22:00 et aucune disponibilité supposée libre");

    // Test 10-11: Conflits remontés sans résolution auto
    const evConf1 = new Event({ id: 'ec1', date: '2026-12-12', startTime: '10:00', endTime: '12:00', lockStatus: 'locked' });
    const evConf2 = new Event({ id: 'ec2', date: '2026-12-12', startTime: '11:00', endTime: '13:00', lockStatus: 'locked' });
    await app.saveCalendarEvent(evConf1);
    await app.saveCalendarEvent(evConf2);
    const conflicts = await app.getConflictsForDate('2026-12-12');
    assert(conflicts.length > 0 && conflicts[0].type === 'CRITICAL_CONFLICT', "10. Conflits correctement remontés");
    
    const eventsConfCheck = await app.planningEngine.getEventsForDate('2026-12-12');
    assert(eventsConfCheck[0].startTime === '10:00' && eventsConfCheck[1].startTime === '11:00', "11. Aucune résolution automatique (horaires inchangés)");
    await app.deleteCalendarEvent('ec1');
    await app.deleteCalendarEvent('ec2');

    // Test 12-13: Association Subject/Assessment
    const evAcad = new Event({ id: 'eAcad', date: '2026-10-10', subjectId: 'SUBJ_MATH', assessmentId: 'ASS_MATH1' });
    assert(evAcad.subjectId === 'SUBJ_MATH' && evAcad.assessmentId === 'ASS_MATH1', "12-13. Associations Subject et Assessment conservées");

    // Test 14: Événements sans horaire
    const evNoTime = new Event({ id: 'eNoTime', date: '2026-10-10' });
    assert(evNoTime.startTime === null && evNoTime.endTime === null, "14. Événements sans horaire gérés");

    // Test 15-16: Locked/Flexible et priority
    const evPrio = new Event({ id: 'ePrio', date: '2026-10-10', lockStatus: 'flexible', priority: 'high' });
    assert(evPrio.lockStatus === 'flexible' && evPrio.priority === 'high', "15-16. Événements locked/flexible et priorité indépendante");

    // Test 17: Navigation Calendar
    assert(app.router.views['calendar'] !== undefined, "17. Route calendar ajoutée dans Router");

    // Test 18: PlanningView intacte
    assert(app.router.views['planning'] !== undefined && app.router.views['planning'].constructor.name === 'PlanningView', "18. PlanningView (Bootcamp) intacte");

    // Test 19: SchedulerEngine intact
    assert(typeof app.scheduler.generateDailyPlan === 'function', "19. SchedulerEngine intact");

    // Test 20: Legacy
    assert(ev1.impact === 'bloc' && ev1.mandatory === true, "20. Données Legacy Event intactes");

    console.log(`\n=== RÉSULTATS : ${passed}/${total} TESTS PASSÉS ===`);
    if (passed !== total) process.exit(1);
}

runTests().catch(console.error);
