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
    assert(s4CectTotal === 30, "S4: Total détaillé de 30 CECT");
    assert(s4Sem.metadata.officialCectTotal === 30, "S4: Total officiel de 30 CECT");
    assert(s4Sem.metadata.calculatedDetailedCectTotal === 30, "S4: Total détaillé déclaré = 30");
    assert(s4Sem.metadata.cectDiscrepancy === 0, "S4: Aucun écart de CECT");
    assert(s4Sem.metadata.cectStatus === 'verified', "S4: Status 'verified'");
    const s3Sem = semesters.find(s => s.id === 'sem_s3_26');
    assert(s3Sem.metadata && s3Sem.metadata.officialCectTotal === 30 && s3Sem.metadata.cectDiscrepancy === 0 && s3Sem.metadata.cectStatus === 'verified', "S3: 30 CECT officiels, écart 0, 'verified'");

    // Cursus officiel L2 IA (liste fournie par l'étudiante) : code, intitulé, CECT et enseignant(s) exacts
    const OFFICIAL = [
        ['sem_s3_26', 'MTH1321', 'Structures algébriques et applications', 5, 'Houénou'],
        ['sem_s3_26', 'INF1322', 'Approche orientée objet (Java/C++)', 6, 'Ratheil & Accrombessi'],
        ['sem_s3_26', 'INF1323', 'Structures de données et applications C/Python', 5, 'Ratheil'],
        ['sem_s3_26', 'MTH1324', 'Statistiques et probabilités', 4, 'Ratheil & Peace Souand'],
        ['sem_s3_26', 'INF1325', "Concepts et applications de l'IA", 4, 'Ratheil'],
        ['sem_s3_26', 'INF1326', 'Aspects avancés des technologies web', 2, 'Wahabou'],
        ['sem_s3_26', 'INF1327', 'Bases du génie logiciel (Agile Scrum/Test)', 3, 'John'],
        ['sem_s3_26', 'INF1328', 'Maintenance des appareils électroniques', 1, 'Akpaoka'],
        ['sem_s4_27', 'INF1421', 'Programmation avancée en Python et R', 4, 'John'],
        ['sem_s4_27', 'INF1422', 'Big Data', 4, 'Eric Adjé'],
        ['sem_s4_27', 'INF1423', 'Outils cloud de collecte et traitement', 8, 'Dako Sidoine'],
        ['sem_s4_27', 'INF1424', "Concepts de l'apprentissage automatique (Machine Learning)", 4, 'Ratheil'],
        ['sem_s4_27', 'INF1425', 'Résolution de problème par la recherche', 4, 'Ratheil'],
        ['sem_s4_27', 'GES1426', 'Gestion des projets', 3, 'Azombakin'],
        ['sem_s4_27', 'MGT1427', 'Communication managériale', 2, 'Colomb'],
        ['sem_s4_27', 'ANG1428', 'Anglais pour la communication scientifique', 1, 'Zanklan Pascal']
    ];
    assert(subjects.length === OFFICIAL.length, "Cursus: exactement 16 matières (aucune en trop)");
    for (const [semId, code, name, cect, teacher] of OFFICIAL) {
        const sub = subjects.find(s => s.code === code);
        assert(!!sub && sub.semesterId === semId && sub.name === name && sub.cect === cect && sub.teacher === teacher,
            `Cursus: ${code} = « ${name} », ${cect} CECT, ${teacher}` + (sub ? '' : ' (absente)'));
    }
    const years = await engine.getYears();
    assert(years[0] && typeof years[0].seedVersion === 'number' && years[0].seedVersion >= 2, "Année: seedVersion enregistré (pas de migration inutile au démarrage suivant)");
    
    // Recherche par code
    assert(subjects.find(s => s.code === 'INF1424')?.name.includes("apprentissage automatique"), "Recherche par code: INF1424 renvoie la bonne matière");
    assert(subjects.find(s => s.code === 'ANG1428')?.name.includes("Anglais"), "Recherche par code: ANG1428 renvoie la bonne matière");

    console.log(`\\n=== RÉSULTATS : ${passed}/${total} TESTS PASSÉS ===`);
}

runTests();
