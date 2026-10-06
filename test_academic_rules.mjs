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
    async getSemesters() {
        return await this.storage.loadData('acad_semesters') || [];
    }
}

async function runTests() {
    console.log("=== NOUVEAUX TESTS ACADÉMIQUES (L2 IA) ===");
    const storage = new MockStorage();
    const engine = new MockAcademicEngine(storage);
    const seeder = new AcademicSeeder(engine);
    
    await seeder.seed();
    
    const subjects = await engine.getSubjects();
    const semesters = await engine.getSemesters();
    
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

    const s3Subjects = subjects.filter(s => s.semesterId === 'sem_s3_26');
    const s4Subjects = subjects.filter(s => s.semesterId === 'sem_s4_27');
    
    // S3 Tests
    assert(s3Subjects.length === 8, "S3: Exactement 8 matières");
    const s3CectTotal = s3Subjects.reduce((acc, s) => acc + s.cect, 0);
    assert(s3CectTotal === 30, "S3: Total de 30 CECT");
    assert(s3Subjects.some(s => s.code === 'MTH1321' && s.name.includes("Structures algébriques")), "S3: Code officiel MTH1321 correct");
    assert(!s3Subjects.some(s => s.name === "Bases de données relationnelles"), "S3: L'ancienne matière fictive (Bases de données relationnelles) n'existe plus");
    
    // S4 Tests
    const s4Sem = semesters.find(s => s.id === 'sem_s4_27');
    assert(s4Subjects.length === 8, "S4: Exactement 8 matières");
    const s4CectTotal = s4Subjects.reduce((acc, s) => acc + s.cect, 0);
    assert(s4CectTotal === 26, "S4: Total détaillé de 26 CECT");
    assert(s4Sem.metadata.officialCectTotal === 30, "S4: Total officiel de 30 CECT");
    assert(s4Sem.metadata.cectDiscrepancy === 4, "S4: Écart de 4 CECT correctement déclaré");
    assert(s4Sem.metadata.cectStatus === 'to_confirm', "S4: Status 'to_confirm' correctement déclaré");
    
    // Recherche par code
    assert(subjects.find(s => s.code === 'INF1424')?.name.includes("apprentissage automatique"), "Recherche par code: INF1424 renvoie la bonne matière");
    assert(subjects.find(s => s.code === 'ANG1428')?.name.includes("Anglais"), "Recherche par code: ANG1428 renvoie la bonne matière");

    console.log(`\\n=== RÉSULTATS : ${passed}/${total} TESTS PASSÉS ===`);
}

runTests();
