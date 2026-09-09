import { MemoryProvider } from './src/services/MemoryProvider.js';
import { AcademicEngine } from './src/engines/AcademicEngine.js';
import { AcademicYear } from './src/models/AcademicYear.js';
import { Semester } from './src/models/Semester.js';
import { Subject } from './src/models/Subject.js';
import { Assessment } from './src/models/Assessment.js';
import { Grade } from './src/models/Grade.js';

async function runTests() {
    console.log("--- DEBUT DES TESTS DU SOCLE ACADEMIQUE ---");
    const memoryStorage = new MemoryProvider();
    const academicEngine = new AcademicEngine(memoryStorage);

    // 1. Création de l'année et du Semestre
    const year = new AcademicYear("year_2026", "L2 IA 2026-2027", "2026-09-01", "2027-06-30");
    await academicEngine.saveYear(year);

    const s4 = new Semester("sem_s4", "year_2026", "S4", "upcoming");
    await academicEngine.saveSemester(s4);

    // 2. Création de la matière Outils Cloud (S4, 70h, CECT 8)
    const components = [
        { name: "Cours", type: "theory", hours: 30 },
        { name: "TP", type: "practice", hours: 40 }
    ];
    const cloudSubject = new Subject("subj_cloud", "sem_s4", "Outils cloud de collecte et traitement", 8, 8, 5, 4, 4, components);
    await academicEngine.saveSubject(cloudSubject);

    // 3. Ajout des évaluations
    const projet = new Assessment("ass_projet", "subj_cloud", "Projet Cloud", "Projet", 0.4, 20, "2027-04-15");
    const examen = new Assessment("ass_exam", "subj_cloud", "Examen Final", "Examen", 0.6, 20, "2027-05-30");
    await academicEngine.saveAssessment(projet);
    await academicEngine.saveAssessment(examen);

    // 4. Ajout des notes avec historique (rattrapage)
    // Note du projet: 12/20
    const gradeProjet = new Grade("gr_projet", "ass_projet", 12, 1, true, "Bon travail");
    await academicEngine.saveGrade(gradeProjet);

    // Note de l'examen: 7/20 (échoué) -> IsFinal = false
    const gradeExam1 = new Grade("gr_exam_1", "ass_exam", 7, 1, false, "Échec");
    await academicEngine.saveGrade(gradeExam1);

    // Note de l'examen rattrapage: 14/20 -> IsFinal = true
    const gradeExam2 = new Grade("gr_exam_2", "ass_exam", 14, 2, true, "Validé au rattrapage");
    await academicEngine.saveGrade(gradeExam2);

    // 5. Calculs et Vérifications
    const cloudAvg = await academicEngine.getSubjectAverage("subj_cloud");
    const s4Avg = await academicEngine.getSemesterAverage("sem_s4");

    console.log(`Moyenne Matière Cloud (attendu: 12*0.4 + 14*0.6 = 13.20): ${cloudAvg}`);
    console.log(`Moyenne Semestre 4: ${s4Avg}`);
    console.log("--- FIN DES TESTS ---");
}

runTests().catch(console.error);
