import { Message } from './src/models/Message.js';
import { ChatHistoryEngine } from './src/engines/ChatHistoryEngine.js';
import { Event } from './src/models/Event.js';
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

function assert(condition, message) {
    if (!condition) {
        console.error(`❌ FAIL: ${message}`);
        process.exit(1);
    }
    console.log(`✅ PASS: ${message}`);
}

async function runTests() {
    console.log("=== TESTS CHAT HISTORY (B.17) ===\n");
    let passed = 0;
    let total = 0;
    const wrapAssert = (condition, message) => { total++; assert(condition, message); passed++; };

    const storage = new MockStorage();
    const engine = new ChatHistoryEngine(storage);

    // Initial state
    const initialEvents = await storage.loadData('events') || [];
    
    // Test 1: Créer et sauvegarder un message utilisateur
    const msg1 = await engine.saveMessage({
        conversationId: 'conv_1',
        role: 'user',
        content: 'Bonjour, peux-tu planifier mes révisions ?',
        createdAt: '2026-09-16T10:00:00Z'
    });
    wrapAssert(msg1.id.startsWith('msg_'), "Test 1: Message utilisateur sauvegardé avec un ID valide.");
    wrapAssert(msg1.role === 'user', "Test 1: Role 'user' correct.");

    // Test 2: Créer et sauvegarder une réponse assistant
    const msg2 = await engine.saveMessage({
        conversationId: 'conv_1',
        role: 'assistant',
        content: 'Bien sûr, quelles sont vos matières ?',
        createdAt: '2026-09-16T10:01:00Z'
    });
    wrapAssert(msg2.role === 'assistant', "Test 2: Message assistant sauvegardé avec succès.");

    // Test 3: Récupérer une conversation complète
    const conv1 = await engine.getConversation('conv_1');
    wrapAssert(conv1.length === 2, "Test 3: La conversation complète contient 2 messages.");

    // Test 4: Vérifier l'ordre des messages (chronologique)
    wrapAssert(conv1[0].id === msg1.id && conv1[1].id === msg2.id, "Test 4: Les messages sont dans l'ordre chronologique.");

    // Test 5: Récupérer les derniers messages
    await engine.saveMessage({ conversationId: 'conv_1', role: 'user', content: 'Maths et Info.', createdAt: '2026-09-16T10:02:00Z' });
    await engine.saveMessage({ conversationId: 'conv_1', role: 'assistant', content: 'Je note.', createdAt: '2026-09-16T10:03:00Z' });
    await engine.saveMessage({ conversationId: 'conv_1', role: 'user', content: 'Merci.', createdAt: '2026-09-16T10:04:00Z' });
    
    const recent = await engine.getRecentMessages('conv_1', 3);
    wrapAssert(recent.length === 3, "Test 5: getRecentMessages retourne bien le nombre demandé.");
    wrapAssert(recent[2].content === 'Merci.', "Test 5: Le dernier message est correct.");

    // Test 6: Vérifier plusieurs conversations indépendantes
    await engine.saveMessage({ conversationId: 'conv_2', role: 'user', content: 'Nouveau sujet.', createdAt: '2026-09-16T11:00:00Z' });
    const conv2 = await engine.getConversation('conv_2');
    const conv1Again = await engine.getConversation('conv_1');
    wrapAssert(conv2.length === 1 && conv2[0].content === 'Nouveau sujet.', "Test 6: La conversation 2 est isolée.");
    wrapAssert(conv1Again.length === 5, "Test 6: La conversation 1 est inchangée.");

    // Test 7: Vérifier qu'une conversation vide est gérée proprement
    const emptyConv = await engine.getConversation('conv_unknown');
    wrapAssert(Array.isArray(emptyConv) && emptyConv.length === 0, "Test 7: Conversation inconnue retourne un tableau vide.");

    // Test 8: Vérifier clearConversation()
    await engine.clearConversation('conv_1');
    const clearedConv1 = await engine.getConversation('conv_1');
    wrapAssert(clearedConv1.length === 0, "Test 8: clearConversation a bien effacé la conversation 1.");
    const stillConv2 = await engine.getConversation('conv_2');
    wrapAssert(stillConv2.length === 1, "Test 8: clearConversation na pas touché la conversation 2.");

    // Test 9: Vérifier que les messages persistent réellement dans le Storage
    const rawData = await storage.loadData('chat_history');
    wrapAssert(rawData && rawData.length === 1 && rawData[0].conversationId === 'conv_2', "Test 9: Persistance confirmée dans 'chat_history'.");

    // Test 10: Vérifier qu'aucun Event n'est créé ou modifié
    const finalEvents = await storage.loadData('events') || [];
    wrapAssert(finalEvents.length === initialEvents.length, "Test 10: Aucun Event n'a été créé ou modifié.");

    // Test 11: Vérifier qu'aucun PlanningIntent n'est créé
    const finalIntents = await storage.loadData('intents') || [];
    wrapAssert(finalIntents.length === 0, "Test 11: Aucun PlanningIntent n'a été créé (le backend est purement conversationnel).");

    // Test 12: Vérifier la compatibilité avec les conventions existantes du Storage
    // Les messages ont un ID, une date et sont dans un array.
    wrapAssert(rawData[0].id.startsWith('msg_') && rawData[0].createdAt, "Test 12: Conventions d'identifiants et format respectées.");

    console.log(`\n=== RÉSULTATS : ${passed}/${total} TESTS PASSÉS ===`);
}

runTests().catch(e => {
    console.error(e);
    process.exit(1);
});
