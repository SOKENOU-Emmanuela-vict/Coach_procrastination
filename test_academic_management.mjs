import assert from 'assert';
import { AcademicEngine } from './src/engines/AcademicEngine.js';
import { AcademicSeeder } from './src/data/AcademicSeeder.js';
import { AcademicView } from './src/ui/AcademicView.js';

class MockStorage {
    constructor() {
        this.data = {};
    }
    async loadData(key) {
        return this.data[key] || null;
    }
    async saveData(key, val) {
        this.data[key] = JSON.parse(JSON.stringify(val));
    }
}

class MockApp {
    constructor() {
        this.storage = new MockStorage();
        this.academicEngine = new AcademicEngine(this.storage);
        this.state = {
            academicSubjects: [],
            academicSemesters: [],
            academicAssessments: [],
            academicGrades: [],
            userProfile: { name: 'Etudiant Test' }
        };
    }

    async refreshAcademicSubjects() {
        this.state.academicSubjects = await this.academicEngine.getSubjects();
        this.state.academicSemesters = await this.academicEngine.getSemesters();
        this.state.academicAssessments = await this.academicEngine.getAssessments();
        this.state.academicGrades = await this.academicEngine.getGrades();
    }

    async saveSemester(semData) {
        const id = semData.id || `sem_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        const sem = { id, name: semData.name || 'Semestre' };
        await this.academicEngine.saveSemester(sem);
        await this.refreshAcademicSubjects();
        return sem;
    }

    async deleteSemester(id) {
        await this.academicEngine.deleteSemester(id);
        await this.refreshAcademicSubjects();
    }

    async saveAssessment(assData) {
        const id = assData.id || `ass_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        const ass = {
            id,
            subjectId: assData.subjectId,
            title: assData.title,
            type: assData.type || 'Examen',
            weight: assData.weight || 1.0,
            maxScore: assData.maxScore || 20,
            targetDate: assData.targetDate || null
        };
        await this.academicEngine.saveAssessment(ass);
        await this.refreshAcademicSubjects();
        return ass;
    }

    async deleteAssessment(id) {
        await this.academicEngine.deleteAssessment(id);
        await this.refreshAcademicSubjects();
    }

    async saveAssessmentGrade({ assessmentId, score, isFinal = true }) {
        const grade = {
            id: `gr_${Date.now()}`,
            assessmentId,
            score,
            isFinal
        };
        await this.academicEngine.saveGrade(grade);
        await this.refreshAcademicSubjects();
        return grade;
    }

    async deleteGrade(id) {
        await this.academicEngine.deleteGrade(id);
        await this.refreshAcademicSubjects();
    }

    async saveSubjectGrade(subjectId, score) {
        let assessments = (await this.academicEngine.getAssessments()).filter(a => a.subjectId === subjectId);
        let targetAss = assessments[0];
        if (!targetAss) {
            targetAss = await this.saveAssessment({
                subjectId,
                title: "Note globale",
                type: "Examen",
                weight: 1.0,
                maxScore: 20
            });
        }
        return await this.saveAssessmentGrade({
            assessmentId: targetAss.id,
            score,
            isFinal: true
        });
    }

    async deleteSubjectGrade(subjectId) {
        const assessments = (await this.academicEngine.getAssessments()).filter(a => a.subjectId === subjectId);
        const grades = await this.academicEngine.getGrades();
        for (const ass of assessments) {
            const assGrades = grades.filter(g => g.assessmentId === ass.id);
            for (const g of assGrades) {
                await this.academicEngine.deleteGrade(g.id);
            }
        }
        await this.refreshAcademicSubjects();
    }

    async importAcademicExample() {
        const seeder = new AcademicSeeder(this.academicEngine);
        await seeder.seed();
        await this.refreshAcademicSubjects();
        return true;
    }
}

async function runTests() {
    console.log("--- TEST SUITE: Academic CRUD & View ---");
    const app = new MockApp();

    // 1. Empty state view test
    const mockContainer = { innerHTML: '', querySelectorAll: () => [], querySelector: () => null };
    const view = new AcademicView(mockContainer, app);
    view.render(app.state);
    assert(mockContainer.innerHTML.includes("Ton cursus est vide"), "Should display empty state when no subjects");
    assert(mockContainer.innerHTML.includes("Ajouter ta première matière"), "Should offer button to add first subject");
    assert(mockContainer.innerHTML.includes("Exemple"), "Should offer button to import example");
    console.log("✅ 1. Empty state view test passed");

    // 2. Semesters CRUD
    const sem1 = await app.saveSemester({ name: "Semestre 1 (S1)" });
    assert(sem1.id, "Semester should have an ID");
    assert.strictEqual(app.state.academicSemesters.length, 1, "Should have 1 semester");
    assert.strictEqual(app.state.academicSemesters[0].name, "Semestre 1 (S1)");

    await app.saveSemester({ id: sem1.id, name: "Semestre 1 Modifié" });
    assert.strictEqual(app.state.academicSemesters[0].name, "Semestre 1 Modifié", "Semester should be updated");

    const sem2 = await app.saveSemester({ name: "Semestre 2 (S2)" });
    assert.strictEqual(app.state.academicSemesters.length, 2);

    await app.deleteSemester(sem2.id);
    assert.strictEqual(app.state.academicSemesters.length, 1, "Semester 2 should be deleted");
    console.log("✅ 2. Semesters CRUD passed");

    // 3. Subjects & Assessments CRUD
    await app.academicEngine.saveSubject({
        id: "sub_maths",
        name: "Mathématiques pour l'IA",
        code: "MATH201",
        cect: 6,
        semesterId: sem1.id
    });
    await app.refreshAcademicSubjects();
    assert.strictEqual(app.state.academicSubjects.length, 1);

    const ass1 = await app.saveAssessment({
        subjectId: "sub_maths",
        title: "Partiel Algèbre",
        type: "Partiel",
        weight: 1.5,
        maxScore: 20
    });
    assert.strictEqual(app.state.academicAssessments.length, 1);
    assert.strictEqual(app.state.academicAssessments[0].title, "Partiel Algèbre");

    await app.saveAssessment({
        id: ass1.id,
        subjectId: "sub_maths",
        title: "Partiel Algèbre & Analyse",
        type: "Partiel",
        weight: 2.0,
        maxScore: 20
    });
    assert.strictEqual(app.state.academicAssessments[0].title, "Partiel Algèbre & Analyse");
    console.log("✅ 3. Assessments CRUD passed");

    // 4. Grades CRUD
    const grade1 = await app.saveAssessmentGrade({
        assessmentId: ass1.id,
        score: 16.5,
        isFinal: true
    });
    assert.strictEqual(app.state.academicGrades.length, 1);
    assert.strictEqual(app.state.academicGrades[0].score, 16.5);

    await app.deleteGrade(grade1.id);
    assert.strictEqual(app.state.academicGrades.length, 0, "Grade should be deleted");

    // Subject Direct Grade test
    await app.saveSubjectGrade("sub_maths", 14);
    assert.strictEqual(app.state.academicGrades.length, 1);
    assert.strictEqual(app.state.academicGrades[0].score, 14);

    await app.deleteSubjectGrade("sub_maths");
    assert.strictEqual(app.state.academicGrades.length, 0);
    console.log("✅ 4. Grades CRUD passed");

    // 5. Example / Seeder Import test
    await app.importAcademicExample();
    assert(app.state.academicSubjects.length > 5, "Seeder should import multiple subjects");
    assert(app.state.academicSemesters.length >= 2, "Seeder should import semesters S3 & S4");
    assert(app.state.academicAssessments.length > 0, "Seeder should import assessments");

    view.render(app.state);
    assert(mockContainer.innerHTML.includes("Mathématiques"), "View should render imported subjects");
    assert(mockContainer.innerHTML.includes("btn-edit-semester"), "View should have semester edit buttons");
    assert(mockContainer.innerHTML.includes("btn-add-subject-to-sem"), "View should have add subject button per semester");
    console.log("✅ 5. Seeder and AcademicView render passed");

    console.log("\nALL ACADEMIC TESTS PASSED! 🎉");
}

runTests().catch(err => {
    console.error("Test failed:", err);
    process.exit(1);
});
