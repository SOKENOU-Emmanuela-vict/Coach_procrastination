import { AcademicEngine } from './src/engines/AcademicEngine.js';
import { AcademicSeeder } from './src/data/AcademicSeeder.js';

class MockStorage {
    constructor() { this.data = {}; }
    async loadData(key) { return this.data[key] || null; }
    async saveData(key, value) { this.data[key] = value; }
    async clearData(key) { delete this.data[key]; }
}

async function run() {
    const storage = new MockStorage();
    const academicEngine = new AcademicEngine(storage);
    const seeder = new AcademicSeeder(academicEngine);
    
    await seeder.seed();
    
    const summary = await academicEngine.getSemesterSummary('sem_s3_26', new Date().toLocaleDateString('fr-CA'));
    console.log(JSON.stringify(summary, null, 2));
}

run().catch(console.error);
