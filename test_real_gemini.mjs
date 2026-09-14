import { CoachContextBuilder } from './src/ai/CoachContext.js';
import { CoachAI } from './src/ai/CoachAI.js';
import { PlanningAI } from './src/ai/PlanningAI.js';
import { GeminiProvider } from './src/ai/GeminiProvider.js';
import { PlanningIntelligence } from './src/engines/PlanningIntelligence.js';

// --- Mock Classes for Testing ---
class MockPlanningEngine {
    async getEventsForDate(date) { return []; }
    async getAvailabilityWindows() { return [{ date: "2026-09-15", startTime: "17:00", endTime: "19:00", id: "w1" }]; }
}

async function runTest() {
    console.log("=== TEST RÉEL GEMINI (B.10) ===");

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.error("❌ Erreur : Aucune clé API trouvée. Veuillez lancer le script avec : GEMINI_API_KEY='votre_clé' node test_real_gemini.mjs");
        process.exit(1);
    }

    const llmProvider = new GeminiProvider(apiKey);
    const coachAI = new CoachAI(llmProvider, null); // Pas de RAG pour ce test simple
    const planningEngine = new MockPlanningEngine();
    const planningIntelligence = new PlanningIntelligence(planningEngine);
    const planningAI = new PlanningAI(planningIntelligence);

    // 1. Simulation d'un contexte métier complexe
    const rawData = {
        currentDate: "2026-09-12",
        userProfile: { name: "Étudiant Test" },
        academicSummary: {
            pastDueAssessments: [{ id: "eval_retard", title: "Projet de Droit", targetDate: "2026-09-10" }],
            upcomingAssessments: [{ id: "eval_proche", title: "Partiel de Mathématiques", daysRemaining: 3, targetDate: "2026-09-15" }]
        },
        projects: [
            { id: "proj_1", title: "Apprendre React", progress: 25, deadline: "2026-10-01" }
        ],
        temporalEvents: [
            { title: "Cours d'anglais", date: "2026-09-12", startTime: "08:00", endTime: "10:00", lockStatus: "locked" }
        ],
        availableSlots: [
            { date: "2026-09-15", startTime: "17:00", endTime: "19:00", durationMinutes: 120 }
        ],
        analytics: {
            weeklyFocus: 45, // Faible
            burnoutRisk: "Medium"
        }
    };

    console.log("1️⃣  Construction du CoachContext...");
    const context = CoachContextBuilder.build(rawData);

    console.log("2️⃣  Appel à CoachAI (Gemini en cours d'inférence)...");
    try {
        const rawRecommendations = await coachAI.analyze(context, "Analyse ma situation globale et donne-moi tes meilleurs conseils.");
        
        console.log(`\n✅ ${rawRecommendations.length} Recommandation(s) générée(s) :`);
        rawRecommendations.forEach((rec, i) => {
            console.log(`\n--- Recommandation ${i+1} [${rec.type}] ---`);
            console.log(`Titre   : ${rec.title}`);
            console.log(`Message : ${rec.message}`);
            if (rec.actionable) {
                console.log(`Action  : ${rec.planningRequest.action} ${rec.planningRequest.target} (${rec.planningRequest.duration} min)`);
                console.log(`Payload :`, rec.planningRequest.payload);
            }
        });

        console.log("\n3️⃣  Appel à PlanningAI (Résolution temporelle)...");
        const plannedRecommendations = await planningAI.plan(rawRecommendations, context.planning);

        console.log(`\n✅ PlanningAI a traité les recommandations :`);
        plannedRecommendations.forEach((rec, i) => {
            if (rec.intent) {
                console.log(`--- Intent ${i+1} ---`);
                console.log(`Date choisie : ${rec.intent.constraints.date}`);
                console.log(`Heure : ${rec.intent.constraints.startTime || 'Flexible'}`);
            }
        });

        console.log("\n✅ TEST TERMINÉ AVEC SUCCÈS !");
    } catch (e) {
        console.error("❌ Échec du test :", e);
    }
}

runTest();
