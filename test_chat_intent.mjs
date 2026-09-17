import { App } from './src/core/App.js';
import { PlanningIntent } from './src/models/PlanningIntent.js';

class MockStorage {
    constructor() {
        this.data = {};
    }
    async loadData(key) {
        return this.data[key] || null;
    }
    async saveData(key, value) {
        this.data[key] = value;
    }
}

async function runTest() {
    console.log("=== TEST B.19 END TO END INTENT RECONSTRUCTION ===");
    
    // 1. Initialiser le DOM virtuel de base
    global.window = {};
    global.document = {
        getElementById: () => ({ innerHTML: '', addEventListener: () => {} }),
        body: { className: '' }
    };

    // 2. Initialiser l'App avec des mocks
    const mockStorage = new MockStorage();
    const app = new App(mockStorage, null, null, null, null, null, null);
    
    // S'assurer que le PlanningEngine est bien attaché (le constructeur d'App l'initialise)
    app.state = { userProfile: {} }; // Mock state minimal
    
    // 3. Créer un intent simulé provenant du Coach
    const mockIntent = new PlanningIntent({
        action: 'create',
        target: 'event',
        constraints: {
            date: new Date().toLocaleDateString('fr-CA'),
            startTime: "14:00"
        },
        payload: {
            title: "Révision de test B.19",
            type: "revision",
            duration: 60
        }
    });

    // 4. Simuler le stockage JSON dans l'attribut data-intent (comme le fait CoachChatView)
    const intentJsonStr = encodeURIComponent(JSON.stringify(mockIntent));

    // 5. Simuler le clic du bouton (ce que fait CoachChatView.js lignes 133-143)
    console.log("-> Simulation du clic sur le bouton...");
    const intentDataStr = decodeURIComponent(intentJsonStr);
    const intentData = JSON.parse(intentDataStr);
    
    // IMPORTANT: Reconstruction de la classe, c'est ce qu'on vient de corriger
    const reconstructedIntent = new PlanningIntent(intentData);

    try {
        // Simuler le rafraichissement du calendrier pour ne pas crasher
        app.refreshCalendarData = async () => {}; 
        app.refreshUserStats = async () => {};
        
        await app.acceptCoachSuggestion(reconstructedIntent);
        console.log("✅ acceptCoachSuggestion a été appelé sans erreur.");
    } catch (e) {
        console.error("❌ ERREUR LORS DE L'ACCEPTATION :", e.message);
        process.exit(1);
    }

    // 6. Vérifier dans le Storage si l'Event a été créé
    const today = new Date().toLocaleDateString('fr-CA');
    const events = await app.planningEngine.getEventsForDate(today);
    
    const found = events.find(e => e.title === "Révision de test B.19");
    if (found) {
        console.log("✅ L'Event a bien été créé et trouvé dans le storage :", found.title, found.startTime);
    } else {
        console.error("❌ L'Event n'a pas été trouvé dans le storage pour aujourd'hui.");
        process.exit(1);
    }
}

runTest();
