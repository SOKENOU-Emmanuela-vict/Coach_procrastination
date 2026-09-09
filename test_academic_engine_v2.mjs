import { MemoryProvider } from './src/services/MemoryProvider.js';
import { AcademicEngine } from './src/engines/AcademicEngine.js';
import { Subject } from './src/models/Subject.js';
import { Assessment } from './src/models/Assessment.js';
import { Grade } from './src/models/Grade.js';
import { Semester } from './src/models/Semester.js';
import { AcademicSeeder } from './src/data/AcademicSeeder.js';

async function runEngineTests() {
    console.log("=== DEBUT DES TESTS DU MOTEUR ACADEMIQUE ===");
    
    const storage = new MemoryProvider();
    const engine = new AcademicEngine(storage);
    
    // Simulate legacy
    await storage.saveData('bootcamp_program', [{ active: true }]);

    console.log("\n--- TEST 1: Moyenne basique (12/20 p:0.4, 14/20 p:0.6) ---");
    await engine.saveSubject(new Subject('sub_test1', 'sem_test', 'Test 1', 5, null, 5, 4, 4));
    await engine.saveAssessment(new Assessment('ass_1a', 'sub_test1', 'Projet', 'project', 0.4, 20));
    await engine.saveAssessment(new Assessment('ass_1b', 'sub_test1', 'Examen', 'exam', 0.6, 20));
    await engine.saveGrade(new Grade('gr_1a', 'ass_1a', 12, 1, true));
    await engine.saveGrade(new Grade('gr_1b', 'ass_1b', 14, 1, true));
    const res1 = await engine.getSubjectAverage('sub_test1');
    console.log(`Résultat: ${res1.average} | Attendu: 13.2 | Status: ${res1.status}`);

    console.log("\n--- TEST 2: Normalisation (16/20 p:0.5, 80/100 p:0.5) ---");
    await engine.saveSubject(new Subject('sub_test2', 'sem_test', 'Test 2', 5, null, 5, 4, 4));
    await engine.saveAssessment(new Assessment('ass_2a', 'sub_test2', 'TP', 'practice', 0.5, 20));
    await engine.saveAssessment(new Assessment('ass_2b', 'sub_test2', 'QCM', 'exam', 0.5, 100));
    await engine.saveGrade(new Grade('gr_2a', 'ass_2a', 16, 1, true)); // = 16/20
    await engine.saveGrade(new Grade('gr_2b', 'ass_2b', 80, 1, true)); // = 16/20
    const res2 = await engine.getSubjectAverage('sub_test2');
    console.log(`Résultat: ${res2.average} | Attendu: 16 | Status: ${res2.status}`);

    console.log("\n--- TEST 3: Tentatives multiples (7/20, 14/20 final) ---");
    await engine.saveSubject(new Subject('sub_test3', 'sem_test', 'Test 3', 5, null, 5, 4, 4));
    await engine.saveAssessment(new Assessment('ass_3', 'sub_test3', 'Examen', 'exam', 1.0, 20));
    await engine.saveGrade(new Grade('gr_3_fail', 'ass_3', 7, 1, false));
    await engine.saveGrade(new Grade('gr_3_pass', 'ass_3', 14, 2, true));
    const res3 = await engine.getSubjectAverage('sub_test3');
    console.log(`Résultat: ${res3.average} | Attendu: 14 | Tentatives comptées: ${res3.assessmentsUsed.length} (Attendu: 1)`);

    console.log("\n--- TEST 4: Semestre avec Coefficients (Calcul OK) ---");
    await engine.saveSemester(new Semester('sem_ok', 'year', 'Sem OK'));
    await engine.saveSubject(new Subject('sub_4a', 'sem_ok', 'Mat 1', 5, 2, 5, 4, 4));
    await engine.saveAssessment(new Assessment('ass_4a', 'sub_4a', 'Ex', 'exam', 1, 20));
    await engine.saveGrade(new Grade('g_4a', 'ass_4a', 10, 1, true)); // Moyenne: 10, coeff 2 -> 20
    
    await engine.saveSubject(new Subject('sub_4b', 'sem_ok', 'Mat 2', 5, 3, 5, 4, 4));
    await engine.saveAssessment(new Assessment('ass_4b', 'sub_4b', 'Ex', 'exam', 1, 20));
    await engine.saveGrade(new Grade('g_4b', 'ass_4b', 15, 1, true)); // Moyenne: 15, coeff 3 -> 45
    // Total = 65 / 5 = 13
    const res4 = await engine.getSemesterAverage('sem_ok');
    console.log(`Semestre Average: ${res4.average} | Attendu: 13 | Status: ${res4.status}`);

    console.log("\n--- TEST 5 & 6: Semestre sans Coeff (Ne pas utiliser CECT) ---");
    await engine.saveSemester(new Semester('sem_fail', 'year', 'Sem Fail'));
    await engine.saveSubject(new Subject('sub_5', 'sem_fail', 'Mat 1', 5, null, 5, 4, 4)); // CECT = 5, Coeff = null
    await engine.saveAssessment(new Assessment('ass_5', 'sub_5', 'Ex', 'exam', 1, 20));
    await engine.saveGrade(new Grade('g_5', 'ass_5', 15, 1, true));
    const res5 = await engine.getSemesterAverage('sem_fail');
    console.log(`Semestre Average: ${res5.average} | Attendu: null | Status: ${res5.status}`);

    console.log("\n--- TEST 7: Anomalie S4 CECT (Seeder) ---");
    const seeder = new AcademicSeeder(engine);
    await seeder.seed();
    const cectStatus = await engine.getCectStatus('sem_s4_27');
    console.log(`S4 Status: ${cectStatus.status} | Officiel: ${cectStatus.officialCectTotal} | Détaillé: ${cectStatus.calculatedDetailedCectTotal} | Ecart: ${cectStatus.cectDiscrepancy}`);

    console.log("\n--- TEST 8 & 9: Validation Académique (Scores Invalides) ---");
    await engine.saveSubject(new Subject('sub_err', 'sem_test', 'Err', 5, null, 5, 4, 4));
    await engine.saveAssessment(new Assessment('ass_err', 'sub_err', 'Ex', 'exam', 1, 20));
    await engine.saveGrade(new Grade('g_err1', 'ass_err', -5, 1, true)); // Négatif
    await engine.saveGrade(new Grade('g_err2', 'ass_err', 25, 2, true)); // > Max
    const valRes = await engine.validateAcademicData();
    console.log(`Data Valide: ${valRes.isValid} | Erreurs détectées: ${valRes.errors.filter(e => e.includes('negative score') || e.includes('> maxScore')).length === 2}`);

    console.log("\n--- TEST 10: Invalide non supprimée ---");
    const gradesAfterValidation = await engine.getGrades();
    console.log(`Les grades existent toujours: ${gradesAfterValidation.find(g => g.id === 'g_err1') !== undefined}`);

    console.log("\n--- TEST 11: Vérification S3/S4 existant ---");
    const semesters = await engine.getSemesters();
    console.log(`S3 et S4 seedés: ${semesters.find(s=>s.id === 'sem_s3_26') !== undefined && semesters.find(s=>s.id === 'sem_s4_27') !== undefined}`);

    console.log("\n--- TEST 12: Legacy intact ---");
    const legacy = await storage.loadData('bootcamp_program');
    console.log(`Legacy Bootcamp: ${legacy !== null && legacy[0].active === true}`);

    console.log("\n=== FIN DES TESTS ===");
}

runEngineTests().catch(console.error);
