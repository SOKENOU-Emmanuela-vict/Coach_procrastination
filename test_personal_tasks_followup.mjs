import assert from 'assert';
import { RiskEngine } from './src/engines/RiskEngine.js';

async function runTests() {
    console.log("=== TEST RISK ENGINE: PERSONAL TASKS ===");
    
    // Fake storage that does nothing
    const storage = {
        loadData: async () => null,
        saveData: async () => {}
    };

    const riskEngine = new RiskEngine(storage);

    const contextWithNoReports = {
        personalTasks: [
            { id: '1', status: 'à faire', reportsCount: 0 },
            { id: '2', status: 'faite', reportsCount: 10 } // faite, donc ignorée
        ]
    };

    let res = await riskEngine.evaluateRisk(contextWithNoReports);
    assert.strictEqual(res.factors.some(f => f.description.includes('reports cumulés')), false);

    const contextWithFewReports = {
        personalTasks: [
            { id: '1', status: 'planifiée', reportsCount: 3 }
        ]
    };
    res = await riskEngine.evaluateRisk(contextWithFewReports);
    let taskFactor = res.factors.find(f => f.description.includes('Quelques reports'));
    assert(taskFactor, "Devrait avoir un facteur pour 'Quelques reports'");
    assert.strictEqual(taskFactor.weight, 10);

    const contextWithManyReports = {
        personalTasks: [
            { id: '1', status: 'reportée', reportsCount: 4 },
            { id: '2', status: 'à faire', reportsCount: 2 }
        ]
    };
    res = await riskEngine.evaluateRisk(contextWithManyReports);
    taskFactor = res.factors.find(f => f.description.includes('Procrastination active'));
    assert(taskFactor, "Devrait avoir un facteur pour 'Procrastination active'");
    assert.strictEqual(taskFactor.weight, 20);

    console.log("✅ PASS: RiskEngine prend en compte les reports de tâches personnelles.");
}

runTests().catch(e => {
    console.error(e);
    process.exit(1);
});
