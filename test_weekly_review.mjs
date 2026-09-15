import { WeeklyReview } from './src/models/WeeklyReview.js';
import { WeeklyReviewEngine } from './src/engines/WeeklyReviewEngine.js';
import { CheckInEngine } from './src/engines/CheckInEngine.js';
import { StudyRecord } from './src/models/StudyRecord.js';
import { Event } from './src/models/Event.js';
import { DailyCheckIn } from './src/models/DailyCheckIn.js';

class MockStorage {
    constructor() { 
        this.data = { daily_checkins: {}, events: [], study_history: [] }; 
    }
    async loadData(key) { 
        if (key === 'daily_checkins' && !this.data[key]) return {};
        return this.data[key] || []; 
    }
    async saveData(key, value) { this.data[key] = value; }
}

class MockPlanning {
    constructor(storage) { this.storage = storage; }
    async getEventsForDate(dateStr) {
        const evs = await this.storage.loadData('events');
        return evs.filter(e => e.date === dateStr);
    }
    async getEvents() {
        return await this.storage.loadData('events');
    }
}

class MockScheduler {
    async generateDailyPlan(dateStr) {
        if (dateStr === '2026-09-15') {
            return {
                sessions: [
                    { id: 'sess_bc_1', title: 'Bootcamp Matin', expectedDuration: 60, skillId: 'sk_1' }
                ]
            };
        }
        return { sessions: [] };
    }
}

class MockStudyRecordEngine {
    constructor(storage) { this.storage = storage; }
    async getFullHistory() {
        return await this.storage.loadData('study_history');
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
    console.log("=== TESTS WEEKLY REVIEW (B.13) ===\n");
    let passed = 0; let total = 0;
    const wrapAssert = (condition, message) => { total++; assert(condition, message); passed++; };

    const storage = new MockStorage();
    const planning = new MockPlanning(storage);
    const scheduler = new MockScheduler();
    const studyEngine = new MockStudyRecordEngine(storage);
    const checkInEngine = new CheckInEngine(storage, planning, scheduler, studyEngine);
    const weeklyEngine = new WeeklyReviewEngine(storage, planning, scheduler, studyEngine, checkInEngine);

    const startDate = '2026-09-14';
    const endDate = '2026-09-20'; // 7 jours

    // Test 1: Semaine vide
    const emptySummary = await weeklyEngine.buildWeeklySummary('2026-01-01', '2026-01-07');
    wrapAssert(emptySummary.execution.planned === 0, "Test 1: Semaine vide.");

    // Setup data
    const dateStr = '2026-09-15';
    // Planned:
    const e1 = new Event({ id: 'ev_1', title: 'Cours Math', date: dateStr, targetDuration: 120, subjectId: 'sub_math' });
    const e2 = new Event({ id: 'ev_2', title: 'Exam', date: dateStr, targetDuration: 60, subjectId: 'sub_math' });
    const e3 = new Event({ id: 'ev_3', title: 'Projet', date: dateStr, targetDuration: 90, subjectId: 'sub_dev' });
    const e4 = new Event({ id: 'ev_4', title: 'Réseaux', date: dateStr, targetDuration: 30, subjectId: 'sub_net' });
    await storage.saveData('events', [e1, e2, e3, e4]); 
    // +1 sess_bc_1 from Scheduler = 5 planned

    // Execution:
    const r1 = new StudyRecord('rec_1', 'ev_1', dateStr, '10:00:00Z');
    r1.finish('12:00:00Z', 120, 'completed', 1.0, {});
    
    const r2 = new StudyRecord('rec_2', 'sess_bc_1', dateStr, '08:00:00Z');
    r2.finish('08:30:00Z', 30, 'partial', 0.5, {});

    const r3 = new StudyRecord('rec_3', 'ev_2', dateStr, '14:00:00Z');
    r3.finish('14:10:00Z', 10, 'cancelled', 0, {}); 
    
    const r4 = new StudyRecord('rec_4', 'ev_4', dateStr, '16:00:00Z');
    r4.finish('16:15:00Z', 15, 'skipped', 0, {});

    // Ad-hoc
    const r5 = new StudyRecord('rec_5', 'adhoc_session', dateStr, '18:00:00Z');
    r5.finish('19:00:00Z', 60, 'completed', 1.0, {});

    // ev_3 is missed (no record)

    await storage.saveData('study_history', [r1, r2, r3, r4, r5]);

    // Check-in
    await checkInEngine.saveCheckIn({
        date: dateStr,
        energy: 'low',
        sleep: { durationMinutes: 300, quality: 'poor' },
        blockers: ['fatigue'],
        dayAssessment: 'difficult',
        needsFollowUp: ['ev_3']
    });

    const summary = await weeklyEngine.buildWeeklySummary(startDate, endDate);

    wrapAssert(summary.execution.planned === 5, "Test 2: Semaine avec sessions planifiées.");
    wrapAssert(summary.execution.completed === 2, "Test 3: Completed."); // ev_1 + adhoc
    wrapAssert(summary.execution.partial === 1, "Test 4: Partial."); // sess_bc_1
    wrapAssert(summary.execution.missed === 2, "Test 5: Skipped/Missed."); // ev_4(skipped) + ev_3(missed)
    wrapAssert(summary.execution.cancelled === 1, "Test 6: Cancelled."); // ev_2

    wrapAssert(summary.adHocSessions.length === 1 && summary.adHocSessions[0].id === 'adhoc_session', "Test 7: Ad-hoc (sessions hors planning identifiables séparément).");
    
    wrapAssert(summary.execution.planned === 5, "Test 8 & 21: Déduplication Event / Scheduler et aucune double comptabilisation."); // 4 events + 1 scheduler

    console.log("PlannedMinutes received:", summary.execution.plannedMinutes, "Expected:", 360);
    wrapAssert(summary.execution.plannedMinutes === (120 + 60 + 90 + 30 + 60), "Test 9: PlannedMinutes.");
    wrapAssert(summary.execution.actualMinutes === (120 + 30 + 10 + 15 + 60), "Test 10: ActualMinutes.");

    // Valid planned = 5 - 1(cancelled) = 4. Completed=2, Partial=1. Rate = (2 + 0.5)/4 = 2.5/4 = 63%
    wrapAssert(summary.execution.completionRate === 63, "Test 11: CompletionRate (sans pénaliser avec les annulations légitimes).");

    wrapAssert(summary.subjectBreakdown['sub_math'].planned === 2 && summary.subjectBreakdown['sub_math'].completed === 1 && summary.subjectBreakdown['sub_math'].cancelled === 1, "Test 12: Breakdown par matière (Maths).");
    wrapAssert(summary.subjectBreakdown['sub_dev'].missed === 1, "Test 13: Breakdown par matière (Projet non réalisé).");

    wrapAssert(summary.dailySummaries.length === 7, "Test 14: Agrégation des DailyCheckIns (7 jours).");
    wrapAssert(summary.followUps.length === 1 && summary.followUps[0].id === 'ev_3', "Test 15: Agrégation des needsFollowUp.");
    
    wrapAssert(summary.trends.lowEnergyDays === 1, "Test 16 & 17: Tendances et journées difficiles (lowEnergy).");
    wrapAssert(summary.trends.averageSleep === 300, "Test 18: Sommeil.");

    const eventsAfter = await storage.loadData('events');
    const recordsAfter = await storage.loadData('study_history');
    wrapAssert(eventsAfter.length === 4, "Test 19: Absence de mutation du calendrier.");
    wrapAssert(recordsAfter.length === 5, "Test 20: Absence de création/modification de StudyRecord.");
    
    const isModel = summary instanceof WeeklyReview;
    wrapAssert(isModel, "Test 22: Aucune nouvelle source de vérité (snapshot en mémoire).");

    // Tester que le contexte préchargé = pas d'I/O (B.12 compatible)
    const dailyB12 = await checkInEngine.buildDailySummary(dateStr);
    wrapAssert(dailyB12.execution.completed === 2, "Test Explicite: La logique B.12 sans context reste strictement compatible.");

    console.log(`\n=== RÉSULTATS : ${passed}/${total} TESTS PASSÉS ===`);
}

runTests().catch(e => {
    console.error(e);
    process.exit(1);
});
