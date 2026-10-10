import assert from 'assert';
import { RiskEngine } from './src/engines/RiskEngine.js';
import { MemoryProvider } from './src/services/MemoryProvider.js';

async function testRiskEngineCheckIn() {
    console.log("=== TESTS RISK ENGINE EXTENSION ===");
    
    const storage = new MemoryProvider();
    const riskEngine = new RiskEngine(storage);
    const today = new Date().toLocaleDateString('fr-CA');

    // Cas 1: Pas de checkin (pénalité de base 10)
    let context = { currentDate: today };
    let result = await riskEngine.evaluateRisk(context);
    assert.strictEqual(result.factors.some(f => f.description.includes('Check-in quotidien non réalisé')), true);
    let baseScoreNoCheckin = result.score;
    
    // Cas 2: Checkin avec tout au beau fixe
    await storage.saveData('daily_checkins', {
        [today]: { energy: 'high', mood: 'high', motivation: 'high' }
    });
    result = await riskEngine.evaluateRisk(context);
    assert.strictEqual(result.factors.some(f => f.type === 'wellness'), false, "Aucun facteur bien-être négatif");
    
    // Cas 3: Checkin avec humeur basse
    await storage.saveData('daily_checkins', {
        [today]: { energy: 'high', mood: 'low', motivation: 'high' }
    });
    result = await riskEngine.evaluateRisk(context);
    assert.strictEqual(result.factors.some(f => f.description === 'Humeur basse déclarée au check-in.'), true);
    
    // Cas 4: Checkin avec motivation faible
    await storage.saveData('daily_checkins', {
        [today]: { energy: 'high', mood: 'high', motivation: 'low' }
    });
    result = await riskEngine.evaluateRisk(context);
    assert.strictEqual(result.factors.some(f => f.description === 'Motivation faible déclarée au check-in.'), true);

    // Cas 5: Cumul des trois (energy, mood, motivation low)
    await storage.saveData('daily_checkins', {
        [today]: { energy: 'low', mood: 'low', motivation: 'low' }
    });
    result = await riskEngine.evaluateRisk(context);
    const wellnessFactors = result.factors.filter(f => f.type === 'wellness');
    assert.strictEqual(wellnessFactors.length, 3, "Trois facteurs de risque wellness");

    console.log("✔ Les attributs mood et motivation impactent le RiskScore");
    console.log("=== TOUS LES TESTS SONT AU VERT ===");
}

testRiskEngineCheckIn().catch(err => {
    console.error("Test échoué:", err);
    process.exit(1);
});
