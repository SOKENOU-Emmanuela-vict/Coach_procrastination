import { AppLogger } from './src/utils/AppLogger.js';

class MockStorage {
    constructor() {
        this.data = {
            'bootcamp_program_version': '2.8_eloquence_no_ted',
            'acad_grades': [
                { id: 'grd_ass_s3_math_alg', score: 14, isFinal: true },
                { id: 'grd_real_grade', score: 12, isFinal: true }
            ],
            'acad_assessments': [
                { id: 'ass_s3_math_alg', title: 'Fake Exam' },
                { id: 'ass_real_assessment', title: 'Real Exam' }
            ]
        };
    }
    async loadData(key) { return this.data[key] || null; }
    async saveData(key, value) { this.data[key] = value; }
    async clearData(key) { delete this.data[key]; }
}

async function testCleanup() {
    const storage = new MockStorage();
    
    // Extrait direct de la logique Bootstrap
    const grades = await storage.loadData('acad_grades');
    if (grades && grades.some(g => g.id.startsWith('grd_ass_s3_'))) {
        console.log("Nettoyage des fausses notes et évaluations académiques...");
        const cleanGrades = grades.filter(g => !g.id.startsWith('grd_ass_s3_'));
        await storage.saveData('acad_grades', cleanGrades);

        const assessments = await storage.loadData('acad_assessments');
        if (assessments) {
            const cleanAssessments = assessments.filter(a => !a.id.startsWith('ass_s3_'));
            await storage.saveData('acad_assessments', cleanAssessments);
        }
    }

    console.log("DUMP POST-CLEANUP acad_grades:");
    console.log(JSON.stringify(await storage.loadData('acad_grades'), null, 2));

    console.log("DUMP POST-CLEANUP acad_assessments:");
    console.log(JSON.stringify(await storage.loadData('acad_assessments'), null, 2));
}

testCleanup();
