import { MemoryProvider } from './src/services/MemoryProvider.js';
import { AcademicEngine } from './src/engines/AcademicEngine.js';
import { AcademicSeeder } from './src/data/AcademicSeeder.js';

async function runSeederTests() {
    console.log("--- TEST DU SEEDER L2 IA ---");
    const memoryStorage = new MemoryProvider();
    
    // Simulate legacy data
    await memoryStorage.saveData('bootcamp_program', [{ week: 1, days: [] }]);
    await memoryStorage.saveData('study_history', [{ id: 'record_1' }]);

    const academicEngine = new AcademicEngine(memoryStorage);
    const seeder = new AcademicSeeder(academicEngine);

    // 1ère Initialisation
    console.log("Exécution Initiale...");
    const result1 = await seeder.seed();
    console.log(`Résultat initialisation 1: ${result1 ? "SUCCESS" : "SKIPPED"}`);

    // 2ème Initialisation (Test d'idempotence)
    console.log("Exécution Secondaire (Test Doublons)...");
    const result2 = await seeder.seed();
    console.log(`Résultat initialisation 2: ${!result2 ? "SKIPPED (CORRECT)" : "ERROR (OVERWRITTEN)"}`);

    // Vérifications
    const years = await academicEngine.getYears();
    const semesters = await academicEngine.getSemesters();
    const subjects = await academicEngine.getSubjects();

    console.log(`\n--- RESULTATS ---`);
    console.log(`1. Année 2026-2027 présente: ${years.some(y => y.id === 'year_l2_ia_2627')}`);
    console.log(`2. S3 présent: ${semesters.some(s => s.id === 'sem_s3_26')}`);
    console.log(`3. S4 présent: ${semesters.some(s => s.id === 'sem_s4_27')}`);

    const s3Subjects = subjects.filter(s => s.semesterId === 'sem_s3_26');
    const s4Subjects = subjects.filter(s => s.semesterId === 'sem_s4_27');
    console.log(`4. Nombre de matières S3: ${s3Subjects.length} (Attendu: 8)`);
    console.log(`4. Nombre de matières S4: ${s4Subjects.length} (Attendu: 8)`);

    const totalCectS3 = s3Subjects.reduce((acc, s) => acc + s.cect, 0);
    const totalCectS4 = s4Subjects.reduce((acc, s) => acc + s.cect, 0);
    console.log(`5. CECT détaillés S3 corrects: ${totalCectS3 === 30} (Total: ${totalCectS3})`);
    console.log(`5. CECT détaillés S4 corrects: ${totalCectS4 === 26} (Total: ${totalCectS4})`);

    const s4Semester = semesters.find(s => s.id === 'sem_s4_27');
    console.log(`-  Total officiel S4: ${s4Semester.metadata.officialCectTotal}`);
    console.log(`-  Écart S4: ${s4Semester.metadata.cectDiscrepancy}`);

    const expectedS4Codes = ['INF1421', 'INF1422', 'INF1423', 'INF1424', 'INF1425', 'GES1426', 'MGT1427', 'ANG1428'];
    const s4Codes = s4Subjects.map(s => s.code);
    const hasAllCodes = expectedS4Codes.every(code => s4Codes.includes(code));
    console.log(`6. Présence exacte des 8 codes S4: ${hasAllCodes}`);

    const inf1421 = s4Subjects.find(s => s.code === 'INF1421');
    const inf1421Hours = inf1421 ? inf1421.components.reduce((acc, c) => acc + c.hours, 0) : 0;
    console.log(`6.5 Composantes S4 correctement présentes (Ex: INF1421 50h attendues): ${inf1421Hours === 50}`);

    console.log(`7. Relations: Matière ${s4Subjects[0].name} liée à ${s4Subjects[0].semesterId}`);
    console.log(`8. Absence de doublons (Total matières=16): ${subjects.length === 16}`);

    const legacy1 = await memoryStorage.loadData('bootcamp_program');
    const legacy2 = await memoryStorage.loadData('study_history');
    console.log(`9. Legacy Intact (Bootcamp non touché): ${legacy1 !== null && legacy2 !== null}`);
}

runSeederTests().catch(console.error);
