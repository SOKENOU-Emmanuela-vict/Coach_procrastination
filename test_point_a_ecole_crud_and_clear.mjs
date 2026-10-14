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
            userProfile: { name: 'Emmanuela' },
            currentView: 'academic'
        };
    }

    async refreshAcademicSubjects() {
        this.state.academicSubjects = await this.academicEngine.getSubjects();
        this.state.academicSemesters = await this.academicEngine.getSemesters();
        this.state.academicAssessments = await this.academicEngine.getAssessments();
        this.state.academicGrades = await this.academicEngine.getGrades();
    }

    async importAcademicExample() {
        const seeder = new AcademicSeeder(this.academicEngine);
        await seeder.seed();
        await this.refreshAcademicSubjects();
        return true;
    }

    async clearAcademicExample() {
        await this.academicEngine.clearAllData();
        await this.refreshAcademicSubjects();
        return true;
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
            weight: parseFloat(assData.weight) || 1.0,
            maxScore: parseFloat(assData.maxScore) || 20,
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

    async saveAssessmentGrade(gradeData) {
        const id = gradeData.id || `gr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        const grade = {
            id,
            assessmentId: gradeData.assessmentId,
            score: parseFloat(gradeData.score) || 0,
            isFinal: true
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
        const assessments = (await this.academicEngine.getAssessments()).filter(a => a.subjectId === subjectId);
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
        const grades = (await this.academicEngine.getGrades()).filter(g => g.assessmentId === targetAss.id);
        let grade = grades[0];
        if (grade) {
            grade.score = score;
        } else {
            grade = {
                id: `gr_${Date.now()}`,
                assessmentId: targetAss.id,
                score,
                isFinal: true
            };
        }
        await this.academicEngine.saveGrade(grade);
        const sub = (await this.academicEngine.getSubjects()).find(s => s.id === subjectId);
        if (sub) {
            sub.grade = score;
            await this.academicEngine.saveSubject(sub);
        }
        await this.refreshAcademicSubjects();
    }

    async deleteSubjectGrade(subjectId) {
        const sub = (await this.academicEngine.getSubjects()).find(s => s.id === subjectId);
        if (sub) {
            sub.grade = null;
            await this.academicEngine.saveSubject(sub);
        }
        const assessments = (await this.academicEngine.getAssessments()).filter(a => a.subjectId === subjectId);
        for (const ass of assessments) {
            const grades = (await this.academicEngine.getGrades()).filter(g => g.assessmentId === ass.id);
            for (const g of grades) {
                await this.academicEngine.deleteGrade(g.id);
            }
        }
        await this.refreshAcademicSubjects();
    }
}

async function run() {
    console.log("=== TEST POINT A: ÉCOLE / ACADÉMIQUE CRUD & EFFACER EXEMPLE ===");
    let passed = 0;
    const check = (cond, msg) => {
        assert(cond, msg);
        console.log(`✅ PASS: ${msg}`);
        passed++;
    };

    const app = new MockApp();
    const mockContainer = { innerHTML: '', querySelectorAll: () => [], querySelector: () => null };
    const view = new AcademicView(mockContainer, app);

    // 1. État initial vide
    view.render(app.state);
    check(mockContainer.innerHTML.includes('id="academic-empty-state"'), "1. État vide propre rendu au départ");
    check(mockContainer.innerHTML.includes('Ton cursus est vide'), "1b. Message explicite d'état vide");
    check(mockContainer.innerHTML.includes('id="btn-empty-add-subject"'), "1c. Bouton ajouter première matière présent");

    // 2. Ajout, modification et suppression de semestres
    const sem1 = await app.saveSemester({ name: "Semestre 1 (S1)" });
    check(app.state.academicSemesters.length === 1 && app.state.academicSemesters[0].name === "Semestre 1 (S1)", "2a. Semestre ajouté");
    
    await app.saveSemester({ id: sem1.id, name: "Semestre 1 — Modifié" });
    check(app.state.academicSemesters[0].name === "Semestre 1 — Modifié", "2b. Semestre modifié");

    const sem2 = await app.saveSemester({ name: "Semestre 2 (S2)" });
    check(app.state.academicSemesters.length === 2, "2c. Deuxième semestre ajouté");
    await app.deleteSemester(sem2.id);
    check(app.state.academicSemesters.length === 1, "2d. Deuxième semestre supprimé");

    // 3. Ajout, modification et suppression de matières
    await app.academicEngine.saveSubject({
        id: "sub_1",
        name: "Maths Générales",
        code: "MATH101",
        cect: 6,
        semesterId: sem1.id
    });
    await app.refreshAcademicSubjects();
    check(app.state.academicSubjects.length === 1, "3a. Matière ajoutée");

    await app.academicEngine.saveSubject({
        id: "sub_1",
        name: "Maths Appliquées",
        code: "MATH102",
        cect: 8,
        semesterId: sem1.id
    });
    await app.refreshAcademicSubjects();
    check(app.state.academicSubjects[0].name === "Maths Appliquées" && app.state.academicSubjects[0].cect === 8, "3b. Matière modifiée");

    // 4. Évaluations / Examens : ajout, modification, suppression
    const exam1 = await app.saveAssessment({
        subjectId: "sub_1",
        title: "Partiel Écrit",
        type: "Partiel",
        weight: 1.0,
        maxScore: 20
    });
    check(app.state.academicAssessments.length === 1 && app.state.academicAssessments[0].title === "Partiel Écrit", "4a. Évaluation ajoutée");

    await app.saveAssessment({
        id: exam1.id,
        subjectId: "sub_1",
        title: "Examen Final Écrit",
        type: "Examen",
        weight: 2.0,
        maxScore: 20
    });
    check(app.state.academicAssessments[0].title === "Examen Final Écrit" && app.state.academicAssessments[0].weight === 2, "4b. Évaluation modifiée");

    // 5. Notes : ajout, modification, suppression
    await app.saveSubjectGrade("sub_1", 15.5);
    check(app.state.academicSubjects[0].grade === 15.5, "5a. Note directe matière ajoutée");

    await app.saveSubjectGrade("sub_1", 17);
    check(app.state.academicSubjects[0].grade === 17, "5b. Note directe matière modifiée");

    await app.deleteSubjectGrade("sub_1");
    check(app.state.academicSubjects[0].grade === null, "5c. Note directe matière supprimée");

    // 6. Rendu complet avec boutons visibles
    view.render(app.state);
    check(mockContainer.innerHTML.includes('id="btn-clear-example"'), "6a. Bouton Effacer les données d'exemple présent");
    check(mockContainer.innerHTML.includes('Effacer les données d\'exemple'), "6b. Texte 'Effacer les données d\'exemple' présent");
    check(mockContainer.innerHTML.includes('id="btn-add-semester"'), "6c. Bouton + Semestre présent et visible");
    check(mockContainer.innerHTML.includes('id="btn-add-subject-top"'), "6d. Bouton + Matière présent et visible");
    check(mockContainer.innerHTML.includes('btn-edit-semester'), "6e. Bouton modifier semestre présent");
    check(mockContainer.innerHTML.includes('btn-delete-semester'), "6f. Bouton supprimer semestre présent");
    check(mockContainer.innerHTML.includes('btn-edit-item'), "6g. Bouton modifier matière présent");
    check(mockContainer.innerHTML.includes('btn-delete-item'), "6h. Bouton supprimer matière présent");
    check(mockContainer.innerHTML.includes('btn-add-grade'), "6i. Bouton ajouter note présent");

    // 7. Suppression de matière
    await app.academicEngine.deleteSubject("sub_1");
    await app.refreshAcademicSubjects();
    check(app.state.academicSubjects.length === 0, "7a. Matière supprimée avec succès");

    // 8. Import de l'exemple puis « Effacer les données d'exemple »
    await app.importAcademicExample();
    check(app.state.academicSubjects.length > 5, "8a. Import exemple a injecté les matières");
    check(app.state.academicSemesters.length >= 2, "8b. Import exemple a injecté les semestres");

    // Action Effacer les données d'exemple
    await app.clearAcademicExample();
    check(app.state.academicSubjects.length === 0, "8c. Effacer a vidé toutes les matières");
    check(app.state.academicSemesters.length === 0, "8d. Effacer a vidé tous les semestres");
    check(app.state.academicAssessments.length === 0, "8e. Effacer a vidé toutes les évaluations");
    check(app.state.academicGrades.length === 0, "8f. Effacer a vidé toutes les notes");

    view.render(app.state);
    check(mockContainer.innerHTML.includes('Ton cursus est vide'), "8g. Retour immédiat à l'état vide propre après effacement");

    console.log(`\n🎉 TOUS LES ${passed} TESTS DU POINT A ONT RÉUSSI !`);
}

run();
