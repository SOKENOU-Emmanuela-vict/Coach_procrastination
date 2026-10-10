// Décisions utilisateur : (a) une note par matière calculée à partir des notes de ses évaluations,
// (b) les cours ne deviennent jamais des sessions Focus.
import { App } from './src/core/App.js';
import { MemoryProvider } from './src/services/MemoryProvider.js';
import { AcademicEngine } from './src/engines/AcademicEngine.js';
import { SchedulerEngine } from './src/engines/SchedulerEngine.js';

let failures = 0;
function assert(cond, msg) {
    if (cond) console.log(`✅ PASS: ${msg}`);
    else { console.error(`❌ FAIL: ${msg}`); failures++; process.exitCode = 1; }
}
global.window = {};
global.document = {
    getElementById: () => ({ innerHTML: '', addEventListener: () => {}, querySelectorAll: () => [], querySelector: () => null }),
    body: { className: '', classList: { add: () => {}, remove: () => {} } }
};

async function run() {
    console.log('=== NOTE PAR MATIÈRE & COURS HORS FOCUS ===\n');
    const storage = new MemoryProvider();
    const engine = new AcademicEngine(storage);
    await storage.saveData('acad_subjects', [
        { id: 'sw', name: 'Pondérée', semesterId: 'sem', gradeCoefficient: 1 },
        { id: 'ss', name: 'Simple', semesterId: 'sem', gradeCoefficient: 1 },
        { id: 'sn', name: 'Sans évaluation', semesterId: 'sem', gradeCoefficient: 1 }
    ]);
    await storage.saveData('acad_assessments', [
        { id: 'a1', subjectId: 'sw', title: 'CC', weight: 0.4, maxScore: 20 },
        { id: 'a2', subjectId: 'sw', title: 'Examen', weight: 0.6, maxScore: 20 },
        { id: 'b1', subjectId: 'ss', title: 'TP1', weight: null, maxScore: 20 },
        { id: 'b2', subjectId: 'ss', title: 'TP2', maxScore: 10 }
    ]);
    await storage.saveData('acad_grades', [
        { id: 'g1', assessmentId: 'a1', score: 12, isFinal: true },
        { id: 'g3', assessmentId: 'b1', score: 10, isFinal: true },
        { id: 'g4', assessmentId: 'b2', score: 8, isFinal: true }
    ]);

    let r = await engine.getSubjectAverage('sw');
    assert(r.status === 'partial' && r.average === 12 && r.gradedCount === 1 && r.assessmentCount === 2, '1. Une seule évaluation notée sur deux : moyenne provisoire, statut partial');
    r = await engine.getSubjectAverage('ss');
    assert(r.status === 'complete' && r.method === 'simple_mean' && r.average === 13, '2. Évaluations sans poids : moyenne simple (10/20 et 8/10 → 13)');
    r = await engine.getSubjectAverage('sn');
    assert(r.status === 'no_assessments' && r.average === null, '3. Matière sans évaluation : pas de note');

    // Chemin des données vers les vues : App.state.academicSubjects[].grade
    const app = new App(storage, null, null, null, null, null, null);
    app.renderView = async () => {};
    await app.saveAssessmentGrade({ assessmentId: 'a2', score: 14 });
    const subjects = app.state.academicSubjects;
    const sw = subjects.find(s => s.id === 'sw');
    assert(sw.grade === 13.2 && sw.gradeStatus === 'complete' && sw.gradeMethod === 'weighted', '4. Toutes les notes saisies : note de matière pondérée (12×0.4 + 14×0.6 = 13.2) exposée à la vue');
    assert(subjects.find(s => s.id === 'sn').grade === null, '5. Pas de note inventée pour une matière sans évaluation');
    await app.saveAssessmentGrade({ assessmentId: 'a2', score: 16 }); // rattrapage : nouvelle note finale
    const grades = await storage.loadData('acad_grades');
    assert(grades.filter(g => g.assessmentId === 'a2' && g.isFinal).length === 1 && app.state.academicSubjects.find(s => s.id === 'sw').grade === 14.4,
        '6. Une nouvelle note finale remplace la précédente (historique conservé, une seule finale)');
    let threw = false;
    try { await app.saveAssessmentGrade({ assessmentId: 'a1', score: 25 }); } catch (e) { threw = true; }
    assert(threw, '7. Une note hors barème est refusée');
    const stored = await storage.loadData('acad_subjects');
    assert(stored.every(s => s.grade === undefined), '8. La note calculée n\'est jamais enregistrée dans acad_subjects');

    // Cours hors Focus
    const today = new Date().toLocaleDateString('fr-CA');
    await storage.saveData('events', [
        { id: 'c1', title: 'Cours Java', type: 'course', date: today, startTime: '08:00', endTime: '10:00', lockStatus: 'locked' },
        { id: 'c2', title: 'Algo', type: 'class', source: 'school_schedule', date: today, startTime: '10:00', endTime: '12:00', lockStatus: 'locked' },
        { id: 'r1', title: 'Révision Maths', type: 'revision', date: today, startTime: '14:00', endTime: '15:30', lockStatus: 'flexible' }
    ]);
    const plan = await new SchedulerEngine(storage).generateDailyPlan(today);
    assert(plan.sessions.length === 1 && plan.sessions[0].id === 'r1', '9. Le plan Focus du jour ne contient que les révisions : les cours (y compris importés) en sont exclus');

    console.log(failures === 0 ? '\n=== TOUS LES TESTS PASSENT ===' : `\n=== ${failures} ÉCHEC(S) ===`);
}
run().catch(e => { console.error(e); process.exitCode = 1; });
