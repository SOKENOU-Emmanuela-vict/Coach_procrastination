/**
 * test_ecart_4_project_determination.mjs
 * Test dédié pour le point 4 :
 * calculateProjectDetermination : ajouter séances faites vs prévues dans le score.
 */
import { ProjectEngine } from './src/engines/ProjectEngine.js';
import { Project } from './src/models/Project.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
    if (condition) {
        console.log(`✅ PASS: ${message}`);
        passed++;
    } else {
        console.error(`❌ FAIL: ${message}`);
        failed++;
    }
}

class MockStorage {
    constructor() {
        this.data = {
            projects: [],
            events: [],
            study_history: []
        };
    }
    async loadData(key) {
        return this.data[key] !== undefined ? JSON.parse(JSON.stringify(this.data[key])) : null;
    }
    async saveData(key, val) {
        this.data[key] = JSON.parse(JSON.stringify(val));
    }
}

async function run() {
    console.log("=== TEST ÉCART 4 : calculateProjectDetermination avec Séances Faites vs Prévues ===");
    const storage = new MockStorage();
    const engine = new ProjectEngine(storage);

    // 1. Projet sans séances
    const p1 = new Project({ id: 'proj1', title: 'Projet Test 1', coachAssessments: [{ score: 80 }] });
    await engine.saveProject(p1);

    const det1 = await engine.calculateProjectDetermination('proj1');
    assert(det1.sessionsPart === 0, "det1.sessionsPart est 0 quand aucune séance");
    assert(det1.sessionsDone === 0, "det1.sessionsDone = 0");
    assert(det1.sessionsPlanned === 0, "det1.sessionsPlanned = 0");
    assert(det1.coachPart === 24, `det1.coachPart = 24 (80 * 0.3) got ${det1.coachPart}`);
    assert(det1.score === 24, `det1.score total = 24 got ${det1.score}`);

    // 2. Projet avec 4 séances prévues (events) et 2 séances faites (study_history) -> 50%
    const p2 = new Project({ id: 'proj2', title: 'Projet Test 2', coachAssessments: [{ score: 80 }] });
    await engine.saveProject(p2);

    await storage.saveData('events', [
        { id: 'ev1', projectId: 'proj2', title: 'Session 1' },
        { id: 'ev2', projectId: 'proj2', title: 'Session 2' },
        { id: 'ev3', projectId: 'proj2', title: 'Session 3' },
        { id: 'ev4', projectId: 'proj2', title: 'Session 4' }
    ]);
    await storage.saveData('study_history', [
        { id: 'rec1', projectId: 'proj2', date: '2026-10-10', status: 'completed' },
        { id: 'rec2', projectId: 'proj2', date: '2026-10-09', status: 'completed' }
    ]);

    const det2 = await engine.calculateProjectDetermination('proj2');
    assert(det2.sessionsPlanned === 4, `det2.sessionsPlanned = 4 (got ${det2.sessionsPlanned})`);
    assert(det2.sessionsDone === 2, `det2.sessionsDone = 2 (got ${det2.sessionsDone})`);
    // 2 faites / 4 prévues = 50% -> 50% de 20 pts = 10 pts
    assert(det2.sessionsPart === 10, `det2.sessionsPart = 10 pts (50% de 20 max, got ${det2.sessionsPart})`);
    assert(det2.score >= 10, "Le score global intègre bien les 10 pts des séances faites vs prévues");

    // 3. Projet avec 5 séances prévues et 5 séances faites -> 100% (20 pts)
    const p3 = new Project({
        id: 'proj3',
        title: 'Projet Test 3',
        sessionsPlanned: 5,
        sessionsDone: 5,
        coachAssessments: [{ score: 100 }]
    });
    await engine.saveProject(p3);

    const det3 = await engine.calculateProjectDetermination('proj3');
    assert(det3.sessionsPlanned === 5, `det3.sessionsPlanned = 5`);
    assert(det3.sessionsDone === 5, `det3.sessionsDone = 5`);
    assert(det3.sessionsPart === 20, `det3.sessionsPart = 20 pts (100% de 20 max, got ${det3.sessionsPart})`);
    assert(det3.coachPart === 30, `det3.coachPart = 30 pts (100 * 0.3)`);

    // 4. Projet avec séances faites directement marquées dans les events
    const p4 = new Project({ id: 'proj4', title: 'Projet Test 4' });
    await engine.saveProject(p4);
    await storage.saveData('events', [
        { id: 'ev41', projectId: 'proj4', status: 'completed' },
        { id: 'ev42', projectId: 'proj4', status: 'planned' },
        { id: 'ev43', projectId: 'proj4', status: 'planned' }
    ]);
    await storage.saveData('study_history', []);

    const det4 = await engine.calculateProjectDetermination('proj4');
    assert(det4.sessionsPlanned === 3, `det4.sessionsPlanned = 3`);
    assert(det4.sessionsDone === 1, `det4.sessionsDone = 1`);
    // 1 / 3 = 33% -> 33 * 0.2 = 7 pts
    assert(det4.sessionsPart === 7, `det4.sessionsPart = 7 pts (got ${det4.sessionsPart})`);

    console.log(`\nResultats: ${passed}/${passed + failed} assertions PASS`);
    if (failed > 0) process.exit(1);
}

run();
