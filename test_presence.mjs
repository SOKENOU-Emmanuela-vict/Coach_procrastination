import assert from 'assert';
import { MemoryProvider } from './src/services/MemoryProvider.js';
import { AppPresenceEngine } from './src/engines/AppPresenceEngine.js';

async function testPresence() {
    console.log("=== TESTS APP PRESENCE ===");
    
    const storage = new MemoryProvider();
    const engine = new AppPresenceEngine(storage);

    // 1. Log d'un écran
    await engine.logScreenView('desktop');
    assert.strictEqual(engine.currentSession.screen, 'desktop');
    
    // 2. Attente simulée
    engine.currentSession.timestamp = Date.now() - 5000; // Recule de 5s
    
    // 3. Log d'un autre écran (qui doit flusher le premier et mettre à jour sa durée)
    await engine.logScreenView('planning');
    
    let logs = await storage.loadData('app_presence_logs');
    assert.strictEqual(logs.length, 2, "Doit avoir 2 logs");
    assert.strictEqual(logs[0].screen, 'desktop');
    assert.ok(logs[0].duration >= 5, "La durée doit être d'au moins 5s");
    
    // 4. Flush manuel (simulation beforeunload)
    engine.currentSession.timestamp = Date.now() - 3000;
    await engine.flushCurrentSession();
    
    logs = await storage.loadData('app_presence_logs');
    assert.ok(logs[1].duration >= 3, "Le second log doit avoir une durée mise à jour");
    assert.strictEqual(engine.currentSession, null, "La session courante doit être null après un flush");

    // 5. Test des stats (jours d'ouvertures sans action)
    const today = new Date().toLocaleDateString('fr-CA');
    
    // On simule qu'hier il a ouvert l'appli sans rien faire
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toLocaleDateString('fr-CA');
    
    logs.push({
        id: 'pres_past',
        date: yesterdayStr,
        timestamp: yesterday.getTime(),
        screen: 'desktop',
        duration: 10
    });
    await storage.saveData('app_presence_logs', logs);
    
    // stats sur 7 jours :
    // - hier (1 jour) + aujourd'hui (1 jour) = 2 jours d'ouverture
    // jours sans ouverture = 7 - 2 = 5 jours
    const stats = await engine.getPresenceStats(7);
    
    assert.strictEqual(stats.daysWithoutOpening, 5, "Doit détecter 5 jours sans ouverture");
    // "today" n'a pas de study/checkin, donc c'est sans action
    // "yesterday" non plus
    assert.strictEqual(stats.openingsWithoutAction, 2, "Aujourd'hui et hier sont sans action");
    
    console.log("✔ Présence OK");
    console.log("=== TOUS LES TESTS SONT AU VERT ===");
}

testPresence().catch(err => {
    console.error("Test échoué:", err);
    process.exit(1);
});
