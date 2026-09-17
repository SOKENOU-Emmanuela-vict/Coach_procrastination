import { App } from './src/core/App.js';
import { PlanningIntent } from './src/models/PlanningIntent.js';
import { Event } from './src/models/Event.js';
import { PlanningEngine } from './src/engines/PlanningEngine.js';
import { PlanningIntelligence } from './src/engines/PlanningIntelligence.js';
import { PlanningAI } from './src/ai/PlanningAI.js';
import { CoachOrchestrator } from './src/ai/CoachOrchestrator.js';
import { ChatHistoryEngine } from './src/engines/ChatHistoryEngine.js';
import { LLMDecision } from './src/models/LLMDecision.js';
import { CoachLLMReasoning } from './src/ai/CoachLLMReasoning.js';
import fs from 'fs';

class MockStorage {
    constructor() {
        this.data = {
            'availabilities': [
                { id: 'w1', date: '2026-09-18', startTime: '14:00', endTime: '18:00' },
                { id: 'w2', date: '2026-09-19', startTime: '10:00', endTime: '12:00' }
            ],
            'events': [],
            'acad_subjects': [{ id: 'sub_maths', title: 'Maths' }, { id: 'sub_phys', title: 'Physique' }],
            'acad_assessments': [],
            'projects': []
        };
    }
    async loadData(key) {
        return this.data[key] || null;
    }
    async saveData(key, value) {
        this.data[key] = value;
    }
}

// Mock AI Provider qui simule une recommandation du LLM
class MockLLMProvider {
    async generate(prompt) {
        console.log("MockLLMProvider CALLED!");
        // Renvoie une décision valide
        return JSON.stringify({
            version: 1,
            type: "planning_intent",
            rationale: "Il faut réviser",
            evidence: [{ documentId: "doc_1", snippet: "Exam", relevance: "high" }],
            intent: {
                action: "create",
                target: "event",
                payload: {
                    title: "Révision Maths",
                    type: "revision",
                    duration: 60,
                    subjectId: "sub_maths"
                }
            }
        });
    }
}

async function runTests() {
    console.log("=== EXECUTION REELLE DES 4 SCENARIOS ===\n");
    
    // Setup Mock Environment
    global.window = {};
    global.document = {
        getElementById: () => ({ innerHTML: '', addEventListener: () => {} }),
        body: { className: '' }
    };

    const storage = new MockStorage();
    const chatHistory = new ChatHistoryEngine(storage);
    const planningEngine = new PlanningEngine(storage);
    const planningIntelligence = new PlanningIntelligence(planningEngine);
    const planningAI = new PlanningAI(planningIntelligence);
    
    const mockLlmProvider = new MockLLMProvider();
    
    // App instantiates its own CoachOrchestrator, so we must mock it AFTER App creation
    const app = new App(storage, null, null, null, null, null, chatHistory);
    app.coachEngine.coachAI.llmReasoning = new CoachLLMReasoning(mockLlmProvider, null);
    app.planningEngine = planningEngine;
    app.state = { 
        userProfile: { 
            academic: { currentSemesterId: 's4' } 
        },
        availableSlots: [
            { id: 'w1', date: '2026-09-18', startTime: '14:00', endTime: '18:00' },
            { id: 'w2', date: '2026-09-19', startTime: '10:00', endTime: '12:00' }
        ]
    };
    app.refreshCalendarData = async () => {};
    app.refreshUserStats = async () => {};
    app.renderView = () => {};

    // ----------------------------------------------------
    // SCENARIO 1: Cas normal
    // ----------------------------------------------------
    console.log("--- SCENARIO 1: Cas normal ---");
    // Le Coach identifie un besoin via sendChatMessage, l'intent est généré, puis on l'accepte.
    await app.sendChatMessage("J'ai besoin de réviser les maths");
    
    // Récupérer le dernier message de l'assistant (qui contient l'intent)
    const conv = await chatHistory.getConversation('default');
    const lastMsg = conv[conv.length - 1];
    console.log("LAST MSG:", lastMsg);
    if (lastMsg.metadata && lastMsg.metadata.intent) {
        console.log("✅ Intent généré avec succès. Créneau suggéré :", lastMsg.metadata.intent.constraints.date, lastMsg.metadata.intent.constraints.startTime);
        
        // Simuler le clic sur Accepter
        const res = await app.acceptCoachSuggestion(new PlanningIntent(lastMsg.metadata.intent));
        console.log(res ? "✅ Clic sur Accepter exécuté sans crash." : "❌ Echec acceptCoachSuggestion");
        
        const events = await planningEngine.getEvents();
        if (events.length === 1 && events[0].title === "Révision Maths") {
            console.log("✅ L'Event est apparu dans le storage.");
        } else {
            console.log("❌ L'Event n'est pas dans le storage.");
        }
    } else {
        console.log("❌ Aucun intent généré.");
    }

    // ----------------------------------------------------
    // SCENARIO 2: Conflit
    // ----------------------------------------------------
    console.log("\n--- SCENARIO 2: Conflit ---");
    // On verrouille manuellement un événement à l'endroit exact où le LLM va vouloir planifier (qui est le 2026-09-18 à 14:00 selon les dispos de test)
    storage.data['events'].push({
        id: "ev_conflict",
        title: "Piscine",
        date: '2026-09-18',
        startTime: '14:00',
        endTime: '18:00', // Bloque toute la dispo
        lockStatus: 'locked'
    });
    
    // On relance la demande
    await app.sendChatMessage("Je veux encore réviser les maths");
    const conv2 = await chatHistory.getConversation('default');
    const lastMsg2 = conv2[conv2.length - 1];
    if (lastMsg2.metadata && lastMsg2.metadata.intent) {
        console.log("✅ Le système a trouvé le prochain créneau disponible, ignorant le créneau bloqué de 14:00.");
        console.log("-> Créneau suggéré :", lastMsg2.metadata.intent.constraints.date, lastMsg2.metadata.intent.constraints.startTime);
        if (lastMsg2.metadata.intent.constraints.date === '2026-09-19' && lastMsg2.metadata.intent.constraints.startTime === '10:00') {
            console.log("✅ (VÉRIFIÉ) Le créneau proposé est bien le suivant disponible.");
        } else {
            console.log("❌ Le créneau proposé est incorrect.");
        }
    } else {
        console.log("❌ Aucun intent généré ou échec de la recherche de candidat.");
    }
    
    // Tester le conflit à l'exécution (si l'utilisateur avait attendu longtemps et accepté un créneau périmé)
    const oldIntent = new PlanningIntent(lastMsg.metadata.intent); // Celui du Scénario 1 qui est maintenant bloqué
    try {
        const result = await planningEngine.executeIntent(oldIntent);
        if (result.success === false && result.reason.includes("CRITICAL_CONFLICT")) {
            console.log("✅ PlanningEngine refuse correctement l'exécution si un conflit surgit a posteriori.");
        } else {
            console.log("❌ PlanningEngine a laissé passer un conflit a posteriori.");
        }
    } catch(e) {
        console.log("Erreur inattendue", e);
    }

    // ----------------------------------------------------
    // SCENARIO 3: Sécurité
    // ----------------------------------------------------
    console.log("\n--- SCENARIO 3: Sécurité (Aucun forçage direct d'horaires par le LLM) ---");
    // On simule un LLM malveillant ou halluciné qui essaie de forcer un startTime
    let secPassed = false;
    try {
        LLMDecision.validate({
            version: 1,
            type: "planning_intent",
            rationale: "Je force 23h",
            evidence: [{ documentId: "doc_1", snippet: "Exam", relevance: "high" }],
            intent: {
                action: "create",
                target: "event",
                payload: {
                    title: "Malveillant",
                    duration: 60,
                    startTime: "23:00", // INTERDIT
                    date: "2026-09-18" // INTERDIT
                }
            }
        });
    } catch(e) {
        if (e.message.includes("champ temporel interdit")) {
            console.log("✅ Validation LLMDecision a rejeté la tentative de forçage temporel :", e.message);
            secPassed = true;
        }
    }
    if (!secPassed) console.log("❌ La validation de sécurité a échoué.");

    // ----------------------------------------------------
    // SCENARIO 4: Aucun déplacement automatique
    // ----------------------------------------------------
    console.log("\n--- SCENARIO 4: Aucun déplacement automatique ---");
    // On vérifie que PlanningEngine refuse strictement de modifier un event existant depuis un intent LLM
    const updateIntent = new PlanningIntent({
        version: 1,
        action: 'update', // Action non autorisée pour le moment
        target: 'event',
        constraints: { date: '2026-09-19', startTime: '10:00' },
        payload: { title: "Modifié" }
    });
    
    const updateRes = await planningEngine.executeIntent(updateIntent);
    if (!updateRes.success && updateRes.reason === 'Action not supported') {
        console.log("✅ PlanningEngine a correctement refusé l'action 'update'.");
    } else {
        console.log("❌ PlanningEngine a laissé passer une action 'update' (Modification).", updateRes);
    }

    // ----------------------------------------------------
    // B.11 ACADEMIC SCHEDULE INGESTION
    // ----------------------------------------------------
    console.log("\n--- B.11: Academic Schedule Ingestion ---");
    const scheduleEntries = [
        {
            title: "Cours de Maths",
            dayOfWeek: "monday",
            startTime: "08:00",
            endTime: "10:00",
            type: "lecture",
            lockStatus: "locked",
            subjectId: "sub_maths",
            source: "school_schedule"
        },
        {
            title: "TD Physique",
            dayOfWeek: "wednesday",
            startTime: "14:00",
            endTime: "16:00",
            type: "tutorial",
            lockStatus: "locked",
            subjectId: "sub_phys",
            source: "school_schedule"
        }
    ];

    // Pre-insert an existing non-school event
    await planningEngine.saveEvent({
        id: "ev_perso",
        title: "Sport",
        date: "2026-09-21", // This is a Monday
        startTime: "18:00",
        endTime: "19:00",
        source: "user"
    });

    const importResult = await planningEngine.applyScheduleImport(scheduleEntries, "2026-09-21");
    if (importResult.success) {
        console.log(`✅ Import réussi. ${importResult.count} événements générés.`);
        
        // Verify that existing events are not overwritten
        const finalEvents = await planningEngine.getEvents();
        const sportEvent = finalEvents.find(e => e.id === "ev_perso");
        if (sportEvent) {
            console.log("✅ (VÉRIFIÉ) L'événement pré-existant 'Sport' n'a pas été écrasé.");
        } else {
            console.log("❌ L'événement pré-existant a été supprimé !");
        }

        // Verify school events are created on multiple weeks
        const mathEvents = finalEvents.filter(e => e.title === "Cours de Maths");
        if (mathEvents.length === 4) { // 4 mondays in 28 days
            console.log("✅ (VÉRIFIÉ) Le cours de Maths a bien été généré sur 4 semaines (28 jours).");
        } else {
            console.log(`❌ Le cours de Maths n'a pas été généré correctement. Obtenu: ${mathEvents.length}`);
        }
    } else {
        console.log("❌ Echec de l'import:", importResult.reason);
    }

}

runTests();
