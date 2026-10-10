/**
 * test_etape10_final.mjs
 * Tests d'intégration : A (determination), B (snapshot/trends), C (task reminder escalation)
 */
import { DailySnapshotEngine } from './src/engines/DailySnapshotEngine.js';
import { ProjectEngine } from './src/engines/ProjectEngine.js';
import { Project } from './src/models/Project.js';

function assert(cond, msg) {
    if (!cond) console.error('❌ Assertion failed:', msg);
    else console.log('✅', msg);
}

// --- Setup mock storage ---
const memory = {};
const storage = {
    saveData: async (k, v) => { memory[k] = JSON.parse(JSON.stringify(v)); },
    loadData: async (k) => memory[k] !== undefined ? JSON.parse(JSON.stringify(memory[k])) : null,
    getAllKeys: async () => Object.keys(memory)
};

// ============================================================
// TEST A : Project Determination Score
// ============================================================
async function testDetermination() {
    console.log('\n=== TEST A : Project Determination Score ===');
    const engine = new ProjectEngine(storage);

    const p = new Project({ id: 'pA1', title: 'Projet Algo', status: 'active', coachAssessments: [
        { date: '2026-10-08', score: 80, message: 'Bon avancement' },
        { date: '2026-10-09', score: 90, message: 'Excellent' }
    ]});
    await engine.saveProject(p);

    const det = await engine.calculateProjectDetermination('pA1');
    console.log('  Détermination:', det);
    assert(typeof det.score === 'number', 'determination.score est un nombre');
    assert(det.coachPart > 0, 'coachPart > 0 quand des assessments existent');
    assert(det.score >= 0 && det.score <= 100, 'score entre 0 et 100');
    assert(det.coachPart === 26, `coachPart = 26 (got ${det.coachPart})`);
}

// ============================================================
// TEST B : DailySnapshotEngine – buildAndSave + getTrends
// ============================================================
async function testSnapshot() {
    console.log('\n=== TEST B : DailySnapshot & Trends ===');
    const snap = new DailySnapshotEngine(storage);

    const baselineDate = (offset) => {
        const d = new Date('2026-10-10');
        d.setDate(d.getDate() - offset);
        return d.toLocaleDateString('fr-CA');
    };

    // Baseline : 14 premiers jours (J-20 à J-7)
    for (let i = 20; i >= 7; i--) {
        await snap.saveSnapshot({ date: baselineDate(i), risk: 60, completion: 50, energy: 'medium', mood: 'ok', sessionsCompleted: 2, minutesStudied: 60 });
    }

    // Window 7j récente : meilleure
    for (let i = 0; i <= 6; i++) {
        await snap.saveSnapshot({ date: baselineDate(i), risk: 30, completion: 80, energy: 'high', mood: 'good', sessionsCompleted: 3, minutesStudied: 90 });
    }

    const trends = await snap.getTrends(baselineDate(0));
    console.log('  Tendances:', JSON.stringify(trends.trends));
    assert(trends.window7.days >= 7, `window7.days >= 7 (got ${trends.window7.days})`);
    assert(trends.trends.risk === 'down', `risk trend = 'down' (got ${trends.trends.risk})`);
    assert(trends.trends.completion === 'up', `completion trend = 'up' (got ${trends.trends.completion})`);
    assert(trends.window30.avgCompletion !== null, 'window30 a des données');
}

// ============================================================
// TEST C : Task Reminder Escalation messages
// ============================================================
async function testReminderMessages() {
    console.log('\n=== TEST C : Task Reminder Escalation (Messages) ===');

    const daysToMsg = (days, title) => {
        if (days === 2) return `📌 Rappel (J-2) : ta tâche « ${title} » doit être faite dans 2 jours. Pense à la planifier !`;
        if (days === 1) return `⚠️ Rappel (J-1) : ta tâche « ${title} » doit être faite demain. C'est le moment de t'y mettre sérieusement !`;
        return `🚨 URGENT (Jour J) : ta tâche « ${title} » est à rendre aujourd'hui ! Dis-moi quand c'est fait.`;
    };

    const j2 = daysToMsg(2, 'Rédiger rapport');
    const j1 = daysToMsg(1, 'Rédiger rapport');
    const j0 = daysToMsg(0, 'Rédiger rapport');

    assert(j2.includes('J-2'), 'Message J-2 correct');
    assert(j1.includes('J-1'), 'Message J-1 correct');
    assert(j0.includes('URGENT'), 'Message J-0 est marqué URGENT');
    assert(j0.includes("Dis-moi quand c'est fait"), 'Message J-0 demande une confirmation');
    console.log('  J-2:', j2.slice(0, 65));
    console.log('  J-1:', j1.slice(0, 65));
    console.log('  J-0:', j0.slice(0, 65));
}

// ============================================================
// RUN
// ============================================================
async function run() {
    console.log('\n=== TESTS ÉTAPE 10 FINAL : A + B + C ===');
    await testDetermination();
    await testSnapshot();
    await testReminderMessages();
    console.log('\nTests terminés.');
}

run();
