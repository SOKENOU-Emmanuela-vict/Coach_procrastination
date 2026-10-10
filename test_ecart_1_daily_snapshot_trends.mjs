/**
 * test_ecart_1_daily_snapshot_trends.mjs
 * Test dédié pour le point 1 :
 * - Ligne de base = les 14 PREMIERS jours de snapshots (pas J-44->J-30).
 * - Tant que moins de 21 jours de données (14 de base + 7 récents), retourner insufficientData=true.
 */
import { DailySnapshotEngine } from './src/engines/DailySnapshotEngine.js';

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
        this.data = {};
    }
    async loadData(key) {
        return this.data[key] || null;
    }
    async saveData(key, val) {
        this.data[key] = JSON.parse(JSON.stringify(val));
    }
}

async function run() {
    console.log("=== TEST ÉCART 1 : DailySnapshotEngine Baseline 14j & InsufficientData < 21j ===");
    const storage = new MockStorage();
    const engine = new DailySnapshotEngine(storage);

    // 1. Test avec 0 jour
    const t0 = await engine.getTrends('2026-10-10');
    assert(t0.insufficientData === true, "0 snapshot -> insufficientData = true");
    assert(t0.baseline14.insufficientData === true, "0 snapshot -> baseline14.insufficientData = true");

    // 2. Test avec 14 jours (14 de base, mais pas encore 7 récents distincts, total 14 < 21)
    for (let day = 1; day <= 14; day++) {
        const dStr = `2026-09-${String(day).padStart(2, '0')}`;
        await engine.saveSnapshot({
            date: dStr,
            risk: 70,
            completion: 40,
            energy: 'low',
            mood: 'bad',
            sessionsCompleted: 1,
            minutesStudied: 30
        });
    }

    const t14 = await engine.getTrends('2026-09-14');
    assert(t14.insufficientData === true, "14 snapshots (< 21) -> insufficientData = true");
    assert(t14.baseline14.insufficientData === true, "14 snapshots -> baseline14.insufficientData = true");

    // 3. Test avec 20 jours (toujours < 21)
    for (let day = 15; day <= 20; day++) {
        const dStr = `2026-09-${String(day).padStart(2, '0')}`;
        await engine.saveSnapshot({
            date: dStr,
            risk: 50,
            completion: 60,
            energy: 'medium',
            mood: 'ok',
            sessionsCompleted: 2,
            minutesStudied: 60
        });
    }

    const t20 = await engine.getTrends('2026-09-20');
    assert(t20.insufficientData === true, "20 snapshots (< 21) -> insufficientData = true");

    // 4. Test avec exactement 21 jours (14 de base + 7 récents)
    await engine.saveSnapshot({
        date: '2026-09-21',
        risk: 30,
        completion: 90,
        energy: 'high',
        mood: 'good',
        sessionsCompleted: 3,
        minutesStudied: 90
    });

    const t21 = await engine.getTrends('2026-09-21');
    assert(t21.insufficientData === false, "21 snapshots (>= 21) -> insufficientData = false");
    assert(t21.baseline14.insufficientData === false, "21 snapshots -> baseline14.insufficientData = false");
    assert(t21.baseline14.days === 14, "baseline14 compte exactement 14 jours");
    assert(t21.window7.days === 7, "window7 compte exactement 7 jours récents");

    // Vérification que la baseline14 = les 14 PREMIERS jours
    // Les 14 premiers jours (du 01 au 14) avaient un risk de 70
    assert(t21.baseline14.avgRisk === 70, `Baseline avgRisk est calculé sur les 14 premiers jours (attendu 70, reçu ${t21.baseline14.avgRisk})`);
    assert(t21.baseline14.avgCompletion === 40, `Baseline avgCompletion = 40 (reçu ${t21.baseline14.avgCompletion})`);

    // Les 7 jours récents (du 15 au 21) ont eu 6 jours à 50 et 1 jour à 30 => avg (6*50 + 30)/7 = 330/7 ~ 47
    assert(t21.window7.avgRisk < 50, `Window 7 jours récents bien calculée sur les derniers jours (avgRisk = ${t21.window7.avgRisk})`);
    assert(t21.trends.risk === 'down', `Tendance de risque en baisse (down)`);
    assert(t21.trends.completion === 'up', `Tendance de complétion en hausse (up)`);

    console.log(`\nResultats: ${passed}/${passed + failed} assertions PASS`);
    if (failed > 0) process.exit(1);
}

run();
