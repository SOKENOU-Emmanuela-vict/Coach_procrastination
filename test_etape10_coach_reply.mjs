import { CoachReasoning } from './src/ai/CoachReasoning.js';
import { CoachLocalReply } from './src/ai/CoachLocalReply.js';

async function runTests() {
    console.log("=== TESTS ÉTAPE 10 : CoachReasoning & CoachLocalReply ===");

    const today = new Date();
    const d5 = new Date(today); d5.setDate(today.getDate() - 6);
    const context = {
        currentDate: today.toLocaleDateString('fr-CA'),
        personalTasks: [
            { id: 't1', status: 'à faire', title: 'Tâche en retard', dueDate: d5.toLocaleDateString('fr-CA'), reportsCount: 1 },
            { id: 't2', status: 'à faire', title: 'Tâche reportée', reportsCount: 4 }
        ],
        books: [
            { id: 'b1', status: 'reading', title: 'Livre délaissé', lastProgressDate: d5.toLocaleDateString('fr-CA'), pagesRead: 10 }
        ]
    };

    const decisions = CoachReasoning.analyze(context);
    console.assert(decisions.some(d => d.signal.type === 'TASK_OVERDUE'), "Doit détecter la tâche en retard");
    console.assert(decisions.some(d => d.signal.type === 'TASK_POSTPONED_TOO_MUCH'), "Doit détecter la tâche reportée");
    console.assert(decisions.some(d => d.signal.type === 'BOOK_NEGLECTED'), "Doit détecter le livre délaissé");
    console.log("✅ CoachReasoning : Règles tâches et livres OK");

    const reply = CoachLocalReply.build(context, "lire");
    console.assert(reply.message.includes('Livres délaissés'), "Le message doit inclure les livres délaissés");
    console.assert(reply.message.includes('Tâches en retard') || reply.message.includes('reportées'), "Le message doit inclure les tâches");
    console.assert(reply.question.includes("Tu n'as lu aucune page"), "La question doit porter sur le livre (priorité de matching ou non)");
    console.log("✅ CoachLocalReply : Génération message OK");
    console.log("Tests terminés.");
}

runTests().catch(console.error);
