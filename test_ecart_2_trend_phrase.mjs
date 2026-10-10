/**
 * test_ecart_2_trend_phrase.mjs
 * Test dédié pour le point 2 :
 * Produire une phrase en français, chiffrée et sans jugement dur :
 * « tu t'améliores » / « stable » / « tu procrastines plus qu'avant »,
 * ex. « Ton risque moyen est passé de 62 à 48 sur 7 jours (-14 points) ».
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
    constructor() { this.data = {}; }
    async loadData(key) { return this.data[key] || null; }
    async saveData(key, val) { this.data[key] = JSON.parse(JSON.stringify(val)); }
}

async function run() {
    console.log("=== TEST ÉCART 2 : Phrase tendance chiffrée et sans jugement dur ===");
    const storage = new MockStorage();
    const engine = new DailySnapshotEngine(storage);

    // 1. Cas données insuffisantes (< 21 jours)
    const phraseInsufficient = engine.formatTrendSentence({ insufficientData: true });
    assert(phraseInsufficient.includes("Données insuffisantes"), "Phrase si données insuffisantes mentionne le manque de données");
    assert(!phraseInsufficient.includes("tu t'améliores") && !phraseInsufficient.includes("tu procrastines plus qu'avant"), "Ne conclut pas prématurément quand données insuffisantes");

    // 2. Cas amélioration (risque passe de 62 à 48 -> -14 points)
    const phraseImprove = engine.formatTrendSentence({
        insufficientData: false,
        baseline14: { avgRisk: 62 },
        window7: { avgRisk: 48 }
    });
    console.log("  Amélioration :", phraseImprove);
    assert(phraseImprove.toLowerCase().includes("tu t'améliores"), "Contient 'tu t'améliores'");
    assert(phraseImprove.includes("62") && phraseImprove.includes("48"), "Phrase chiffrée (62 et 48)");
    assert(phraseImprove.includes("-14 points"), "Affiche la variation chiffrée (-14 points)");
    assert(phraseImprove.includes("7 jours"), "Mentionne la période 7 jours");

    // 3. Cas stable (risque passe de 50 à 52 -> +2 points)
    const phraseStable = engine.formatTrendSentence({
        insufficientData: false,
        baseline14: { avgRisk: 50 },
        window7: { avgRisk: 52 }
    });
    console.log("  Stable :", phraseStable);
    assert(phraseStable.toLowerCase().includes("stable"), "Contient 'stable'");
    assert(phraseStable.includes("50") && phraseStable.includes("52"), "Phrase chiffrée (50 et 52)");
    assert(phraseStable.includes("+2 points"), "Affiche la variation chiffrée (+2 points)");

    // 4. Cas régression (risque passe de 45 à 60 -> +15 points)
    const phraseWorse = engine.formatTrendSentence({
        insufficientData: false,
        baseline14: { avgRisk: 45 },
        window7: { avgRisk: 60 }
    });
    console.log("  Procrastination en hausse :", phraseWorse);
    assert(phraseWorse.toLowerCase().includes("tu procrastines plus qu'avant"), "Contient 'tu procrastines plus qu'avant'");
    assert(phraseWorse.includes("45") && phraseWorse.includes("60"), "Phrase chiffrée (45 et 60)");
    assert(phraseWorse.includes("+15 points"), "Affiche la variation chiffrée (+15 points)");
    assert(!phraseWorse.includes("nul") && !phraseWorse.includes("échec") && !phraseWorse.includes("honte"), "Sans jugement dur ni dévalorisant");

    // 5. Test direct via getTrends() avec snapshots enregistrés
    // 14 jours de base avec risque 62
    for (let i = 1; i <= 14; i++) {
        await engine.saveSnapshot({
            date: `2026-09-${String(i).padStart(2, '0')}`,
            risk: 62,
            completion: 40
        });
    }
    // 7 jours récents avec risque 48
    for (let i = 15; i <= 21; i++) {
        await engine.saveSnapshot({
            date: `2026-09-${String(i).padStart(2, '0')}`,
            risk: 48,
            completion: 80
        });
    }
    const trendsObj = await engine.getTrends('2026-09-21');
    assert(typeof trendsObj.sentence === 'string', "trendsObj.sentence est présent et de type string");
    assert(trendsObj.sentence.includes("-14 points"), "trendsObj.sentence calculé automatiquement (-14 points)");
    assert(trendsObj.sentence.toLowerCase().includes("tu t'améliores"), "trendsObj.sentence conclut à l'amélioration");

    console.log(`\nResultats: ${passed}/${passed + failed} assertions PASS`);
    if (failed > 0) process.exit(1);
}

run();
