import { App } from './src/core/App.js';
import { AcademicEngine } from './src/engines/AcademicEngine.js';

class MockStorage {
    constructor() {
        this.data = {};
    }
    async loadData(key) {
        return this.data[key] || null;
    }
    async saveData(key, val) {
        this.data[key] = val;
    }
}

class MockScheduler {
    async generateDailyPlan() {
        return { habits: [], sessions: [] };
    }
}

// Global mocks for DOM
global.document = {
    getElementById: () => ({
        innerHTML: '',
        style: {},
        querySelectorAll: () => [],
        querySelector: () => null
    }),
    querySelectorAll: () => [],
    querySelector: () => null
};

async function testBootstrap() {
    console.log("=== AUDIT BOOTSTRAP ACADEMIQUE ===");
    
    // 1. Premier lancement (Storage vide)
    console.log("\n--- PREMIER LANCEMENT ---");
    const storage1 = new MockStorage();
    const mockEngine = { getDailyStats: async()=>null, getFullHistory: async()=>[], getMonthlyStats: async()=>null };
    const mockCheckIn = { buildDailySummary: async()=>null, getCheckIn: async()=>null };
    const mockCoach = { getInsights: async()=>null };
    const app1 = new App(storage1, new MockScheduler(), mockEngine, mockCheckIn, null, null, null);
    app1.coachEngine = mockCoach;
    app1.planningEngine = { getEventsForDate: async()=>[], detectConflicts: async()=>[], getAvailableSlots: async()=>[], getEvents: async()=>[], getAvailabilityWindows: async()=>[] };
    
    await app1.start();
    
    const subjects1 = app1.state.academicSubjects;
    console.log(`academicSubjects (array) : ${Array.isArray(subjects1)}`);
    console.log(`academicSubjects (length) : ${subjects1.length}`);
    
    let s3Count1 = subjects1.filter(s => s.semesterId === 'sem_s3_26').length;
    let s4Count1 = subjects1.filter(s => s.semesterId === 'sem_s4_27').length;
    console.log(`S3 = ${s3Count1}`);
    console.log(`S4 = ${s4Count1}`);
    console.log(`Présence INF1322 : ${!!subjects1.find(s => s.code === 'INF1322')}`);
    console.log(`Présence INF1424 : ${!!subjects1.find(s => s.code === 'INF1424')}`);
    console.log(`Présence ANG1428 : ${!!subjects1.find(s => s.code === 'ANG1428')}`);
    
    if (subjects1.length !== 0) {
        console.error("❌ ERREUR: Le premier lancement doit avoir un écran vide (0 matières).");
        process.exitCode = 1;
        return;
    }
    console.log("✅ Premier lancement vide (0 matières)");

    // Import de l'exemple facultatif
    await app1.importAcademicExample();
    const subjectsSeeded = app1.state.academicSubjects;
    s3Count1 = subjectsSeeded.filter(s => s.semesterId === 'sem_s3_26').length;
    s4Count1 = subjectsSeeded.filter(s => s.semesterId === 'sem_s4_27').length;
    if (subjectsSeeded.length !== 16 || s3Count1 !== 8 || s4Count1 !== 8) {
        console.error("❌ ERREUR: L'import exemple n'a pas produit exactement 16 matières.");
        process.exitCode = 1;
        return;
    }

    // 2. Deuxième lancement (Storage conservé)
    console.log("\n--- SECOND LANCEMENT ---");
    const app2 = new App(storage1, new MockScheduler(), mockEngine, mockCheckIn, null, null, null);
    app2.coachEngine = mockCoach;
    app2.planningEngine = { getEventsForDate: async()=>[], detectConflicts: async()=>[], getAvailableSlots: async()=>[], getEvents: async()=>[], getAvailabilityWindows: async()=>[] };
    await app2.start();
    
    const subjects2 = app2.state.academicSubjects;
    console.log(`academicSubjects (length) : ${subjects2.length}`);
    if (subjects2.length !== 16) {
        console.error(`❌ ERREUR: Doublons détectés au second lancement (${subjects2.length} matières).`);
        process.exitCode = 1;
        return;
    }
    
    console.log("\n✅ BOOTSTRAP ACADÉMIQUE OK : Le flux Seeder -> Engine -> App.state fonctionne.");
}

testBootstrap().catch(e => {
    console.error(e);
    process.exitCode = 1;
});
