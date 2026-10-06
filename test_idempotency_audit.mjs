import { AcademicSeeder } from './src/data/AcademicSeeder.js';

class MockStorage {
    constructor() { this.data = {}; }
    async loadData(key) { return this.data[key] || null; }
    async saveData(key, value) { this.data[key] = value; }
}

class MockAcademicEngine {
    constructor(storage) { this.storage = storage; }
    async getYears() { return await this.storage.loadData('acad_years') || []; }
    async saveYear(y) { 
        let items = await this.getYears(); 
        items.push(y); 
        await this.storage.saveData('acad_years', items); 
    }
    async saveSemester(s) {
        let items = await this.storage.loadData('acad_semesters') || [];
        items.push(s);
        await this.storage.saveData('acad_semesters', items);
    }
    async saveSubject(s) {
        let items = await this.storage.loadData('acad_subjects') || [];
        items.push(s);
        await this.storage.saveData('acad_subjects', items);
    }
    async getSubjects() {
        return await this.storage.loadData('acad_subjects') || [];
    }
}

async function auditIdempotency() {
    console.log("=== AUDIT IDEMPOTENCE SEEDER ===");
    const storage = new MockStorage();
    const engine = new MockAcademicEngine(storage);
    const seeder = new AcademicSeeder(engine);
    
    // Pass 1
    await seeder.seed();
    let count1 = (await engine.getSubjects()).length;
    console.log(`Passe 1 : ${count1} matières`);
    
    // Pass 2
    await seeder.seed();
    let count2 = (await engine.getSubjects()).length;
    console.log(`Passe 2 : ${count2} matières`);
    
    // Pass 3
    await seeder.seed();
    let count3 = (await engine.getSubjects()).length;
    console.log(`Passe 3 : ${count3} matières`);
    
    if (count1 === 16 && count2 === 16 && count3 === 16) {
        console.log("✅ Idempotence stricte confirmée : Aucun doublon.");
    } else {
        console.error("❌ ERREUR : Doublons détectés !");
    }
}

auditIdempotency().catch(console.error);
