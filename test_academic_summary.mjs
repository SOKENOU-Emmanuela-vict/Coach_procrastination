import { MemoryProvider } from './src/services/MemoryProvider.js';
import { AcademicEngine } from './src/engines/AcademicEngine.js';

async function runAcademicSummaryTests() {
    console.log("=== DEBUT DES TESTS ACADEMIC SUMMARY ===");
    
    const storage = new MemoryProvider();
    const engine = new AcademicEngine(storage);
    
    // Setup
    await engine.saveSemester({ id: 's4', name: 'Semestre S4', yearId: 'y2', metadata: { cectDiscrepancy: 4, officialCectTotal: 30, calculatedDetailedCectTotal: 26, cectStatus: 'to_confirm' } });
    
    // Subject 1: with coeff
    await engine.saveSubject({ id: 'sub_1', semesterId: 's4', name: 'Maths', cect: 5, gradeCoefficient: 2 });
    // Subject 2: NO coeff, but has CECT
    await engine.saveSubject({ id: 'sub_2', semesterId: 's4', name: 'Physique', cect: 4 });
    // Subject 3: NO coeff, NO CECT
    await engine.saveSubject({ id: 'sub_3', semesterId: 's4', name: 'Chimie', cect: null });
    
    // Assessments
    await engine.saveAssessment({ id: 'ass_1', subjectId: 'sub_1', title: 'Exam Maths', type: 'exam', weight: 1, maxScore: 20, targetDate: '2026-10-20' }); // Future
    await engine.saveAssessment({ id: 'ass_2', subjectId: 'sub_1', title: 'TP Maths', type: 'tp', weight: 1, maxScore: 20, targetDate: '2026-10-10' }); // Exact dateRef
    await engine.saveAssessment({ id: 'ass_3', subjectId: 'sub_1', title: 'Quiz', type: 'quiz', weight: 1, maxScore: 20, targetDate: '2026-09-01' }); // Past, no grade
    await engine.saveAssessment({ id: 'ass_4', subjectId: 'sub_1', title: 'Sans Date', type: 'projet', weight: 1, maxScore: 20, targetDate: null }); // No date
    await engine.saveAssessment({ id: 'ass_5', subjectId: 'sub_1', title: 'Passed Graded', type: 'exam', weight: 1, maxScore: 20, targetDate: '2026-11-01' }); // Future but graded final

    // Grades
    await engine.saveGrade({ id: 'g_5', assessmentId: 'ass_5', score: 15, isFinal: true }); // Final grade -> excludes from upcoming
    // A grade for ass_3 to make average < 10 (e.g. 5/20) - wait, ass_3 has no final grade yet. Let's add a final grade.
    await engine.saveGrade({ id: 'g_3', assessmentId: 'ass_3', score: 8, isFinal: true }); // final -> sub_1 average = (15+8)/2 = 11.5 if weights are 1.
    
    const dateRef = '2026-10-10';

    const summary1 = await engine.getSemesterSummary('s4', dateRef);
    const summary2 = await engine.getSemesterSummary('s4', dateRef);

    // 13. Aucune mutation
    console.log(`\n--- TEST 13 : Aucune mutation ---`);
    console.log(`Les deux appels produisent le même résultat: ${JSON.stringify(summary1) === JSON.stringify(summary2)}`);

    // 1 & 2. Coefficients
    console.log(`\n--- TEST 1 & 2 : Coefficients ---`);
    console.log(`totalCoeff ne contient que les coefficients configurés (attendu: 2): ${summary1.average.totalCoeff === 2}`);
    console.log(`Moyenne manquante si coeff manquant: ${summary1.average.status === 'missing_coefficients'}`);
    console.log(`Matières sans coeff listées: ${summary1.average.missingCoefficients.includes('sub_2')}`);

    // 3, 4, 5, 6, 7. Upcoming Assessments
    console.log(`\n--- TEST 3 à 7 : Upcoming Assessments ---`);
    const upcoming = summary1.upcomingAssessments;
    const hasAss1 = upcoming.some(a => a.id === 'ass_1'); // Future
    const hasAss2 = upcoming.some(a => a.id === 'ass_2'); // Exact
    const hasAss3 = upcoming.some(a => a.id === 'ass_3'); // Past, no grade (wait, ass_3 has a final grade so it's doubly excluded)
    const hasAss4 = upcoming.some(a => a.id === 'ass_4'); // No date
    const hasAss5 = upcoming.some(a => a.id === 'ass_5'); // Future but final grade

    console.log(`Test 3: Future présent: ${hasAss1}`);
    console.log(`Test 4: Exactement à dateRef présent: ${hasAss2}`);
    console.log(`Test 5 & 6: Évaluation passée (et/ou notée) exclue: ${!hasAss3}`);
    console.log(`Test 7: Sans date exclue: ${!hasAss4}`);
    console.log(`Évaluation future MAIS avec note finale exclue: ${!hasAss5}`);

    // 8, 9, 10. Seuils configurables
    console.log(`\n--- TEST 8 à 10 : Seuils Configurables ---`);
    const defaultAlerts = summary1.alerts;
    // sub_1 average is (8*1 + 15*1)/(1+1) = 11.5.
    const hasLowAvgAlertDefault = defaultAlerts.some(a => a.code === 'LOW_AVERAGE');
    
    // Force threshold to 15 to trigger alert
    const customSummary = await engine.getSemesterSummary('s4', dateRef, { alertThresholdAverage: 15, imminentDaysThreshold: 15 });
    const hasLowAvgAlertCustom = customSummary.alerts.some(a => a.code === 'LOW_AVERAGE');
    const imminentAlertDefault = defaultAlerts.some(a => a.code === 'IMMINENT_ASSESSMENT' && a.message.includes('ass_1')); // ass_1 is 10 days away. 10 > 7 default, so false.
    const imminentAlertCustom = customSummary.alerts.some(a => a.code === 'IMMINENT_ASSESSMENT' && a.message.includes('Exam Maths')); // 10 <= 15 custom, so true.

    console.log(`Test 8: Seuil moyen par défaut (10) ne s'est pas déclenché (11.5 > 10): ${!hasLowAvgAlertDefault}`);
    console.log(`Test 9: alertThresholdAverage configurable (déclenché à 15): ${hasLowAvgAlertCustom}`);
    console.log(`Test 10: imminentDaysThreshold configurable (déclenché à 15 jours): ${imminentAlertCustom}`);

    // 11. Anomalie S4
    console.log(`\n--- TEST 11 : Anomalie S4 Intacte ---`);
    console.log(summary1.cectStatus);
    console.log(`officialTotal: 30 = ${summary1.cectStatus.officialTotal === 30}`);
    console.log(`detailedTotal: 26 = ${summary1.cectStatus.detailedTotal === 26}`);
    console.log(`discrepancy: 4 = ${summary1.cectStatus.discrepancy === 4}`);
    console.log(`status: to_confirm = ${summary1.cectStatus.status === 'to_confirm'}`);
    const hasCectAlert = summary1.alerts.some(a => a.code === 'CECT_DISCREPANCY');
    console.log(`Alerte documentaire générée: ${hasCectAlert}`);

    // 12. Aucune alerte comportementale
    console.log(`\n--- TEST 12 : Aucune recommandation ---`);
    const isDescriptive = summary1.alerts.every(a => a.type === 'ACADEMIC_STATE' || a.type === 'DOCUMENTARY_STATE');
    console.log(`Les alertes sont strictement descriptives: ${isDescriptive}`);

    // 14. Relations cohérentes
    console.log(`\n--- TEST 14 : Relations cohérentes ---`);
    console.log(`Les noms de matière sont résolus (Maths): ${summary1.subjects[0].name === 'Maths'}`);

    // 15, 16. Méthodes existantes intactes
    console.log(`\n--- TEST 15 & 16 : Legacy ---`);
    const valid = await engine.validateAcademicData();
    console.log(`validateAcademicData fonctionne toujours: ${valid.isValid !== undefined}`);

    console.log("\n=== FIN DES TESTS ===");
}

runAcademicSummaryTests().catch(console.error);
