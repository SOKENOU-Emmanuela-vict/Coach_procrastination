// Clés Google Cloud Vertex AI Express Mode (« AQ.… ») et configuration de clé dans le Coach.
// Aucun appel réseau réel et aucune vraie clé : uniquement des jetons factices de test + fetch simulé.
import { GeminiProvider, GeminiError, GEMINI_PRIMARY_MODEL } from './src/ai/GeminiProvider.js';
import { CoachOrchestrator } from './src/ai/CoachOrchestrator.js';
import { App } from './src/core/App.js';
import { CoachChatView } from './src/ui/CoachChatView.js';

let failures = 0;
function assert(cond, msg) {
    if (cond) console.log(`✅ PASS: ${msg}`);
    else { console.error(`❌ FAIL: ${msg}`); failures++; process.exitCode = 1; }
}

const realFetch = global.fetch;
const realWindow = global.window;
const realDocument = global.document;

const ok = (text) => ({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text }] } }] }) });
const fail = (status, message) => ({ ok: false, status, json: async () => ({ error: { code: status, message } }) });

class MockStorage {
    constructor() { this.data = {}; }
    async loadData(k) { return this.data[k] || null; }
    async saveData(k, v) { this.data[k] = v; }
}

try {
    // 1. Détection Vertex AI Express Mode (« AQ.… ») + nettoyage des espaces
    const gpVertex = new GeminiProvider('  AQ.FAKE_TEST_TOKEN_1234\n ');
    gpVertex.retryDelayMs = 0;
    assert(gpVertex.apiKey === 'AQ.FAKE_TEST_TOKEN_1234', '1. Clé nettoyée des espaces et retours ligne');
    assert(gpVertex.isVertexExpressKey() === true, '2. Clé AQ. reconnue comme clé Vertex AI Express Mode');

    // 2. Appel generate() avec clé AQ. → endpoint aiplatform.googleapis.com + role: "user"
    let capturedUrl = null;
    let capturedBody = null;
    global.fetch = async (url, opts) => {
        capturedUrl = String(url);
        capturedBody = JSON.parse(opts.body);
        return ok('{"ok":"vertex"}');
    };
    const outVertex = await gpVertex.generate('Bonjour coach');
    assert(outVertex === '{"ok":"vertex"}', '3. Réponse obtenue via Vertex AI Express Mode');
    assert(capturedUrl.startsWith(`https://aiplatform.googleapis.com/v1/publishers/google/models/${GEMINI_PRIMARY_MODEL}:generateContent?key=`),
        '4. URL routée vers aiplatform.googleapis.com/v1/publishers/google/models/...');
    assert(capturedBody && capturedBody.contents && capturedBody.contents[0] && capturedBody.contents[0].role === 'user',
        '5. generate() inclut bien role: "user" exigé par Vertex AI');

    // 3. Clé Google AI Studio classique → endpoint generativelanguage.googleapis.com inchangé
    const gpStudio = new GeminiProvider('CLE_STUDIO_TEST_5678');
    gpStudio.retryDelayMs = 0;
    assert(gpStudio.isVertexExpressKey() === false, '6. Clé AI Studio standard non marquée Vertex Express');
    await gpStudio.generate('Salut');
    assert(capturedUrl.startsWith(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_PRIMARY_MODEL}:generateContent?key=`),
        '7. Clé AI Studio routée vers generativelanguage.googleapis.com');

    // 4. Repli automatique jusqu'à gemini-2.5-flash si les modèles 3.x renvoient 404 sur Vertex Express
    const triedModels = [];
    global.fetch = async (url) => {
        const m = (String(url).match(/models\/([^:]+):/) || [])[1];
        triedModels.push(m);
        if (m === 'gemini-2.5-flash') return ok('{"fallback":"2.5"}');
        return fail(404, `Publisher Model ${m} not found`);
    };
    const outFallback = await gpVertex.generate('Test fallback 2.5');
    assert(outFallback === '{"fallback":"2.5"}' && gpVertex.lastModelUsed === 'gemini-2.5-flash',
        '8. Repli automatique sur gemini-2.5-flash en cas de 404 sur les modèles précédents');

    // 5. generateFromFile() routé vers aiplatform.googleapis.com avec clé AQ.
    capturedUrl = null;
    global.fetch = async (url) => {
        capturedUrl = String(url);
        return ok('{"entries":[]}');
    };
    const outFile = await gpVertex.generateFromFile({ prompt: 'Lis', mimeType: 'application/pdf', data: 'JVBERi0=' });
    assert(outFile === '{"entries":[]}' && capturedUrl.startsWith('https://aiplatform.googleapis.com/v1/publishers/google/models/'),
        '9. generateFromFile() utilise aussi aiplatform.googleapis.com avec une clé AQ.');

    // 6. Confidentialité : la clé AQ. n'apparaît jamais dans GeminiError
    global.fetch = async () => fail(401, 'Invalid key AQ.FAKE_TEST_TOKEN_1234 rejected');
    const authErr = await gpVertex.generate('Test').catch(e => e);
    assert(authErr instanceof GeminiError && authErr.code === 'AUTH', '10. Erreur 401 convertie en GeminiError AUTH');
    assert(!String(authErr.message).includes('AQ.FAKE_TEST_TOKEN_1234') && !String(authErr.detail).includes('AQ.FAKE_TEST_TOKEN_1234'),
        '11. La clé AQ. est masquée dans message et detail');

    // 7. Rejet immédiat et explicite d'une clé OpenAI (« sk-… ») sans appel réseau
    let networkCalls = 0;
    global.fetch = async () => { networkCalls++; return ok('{}'); };
    const gpOpenAI = new GeminiProvider('sk-' + 'fake_openai_test');
    const openAiErr = await gpOpenAI.generate('Test').catch(e => e);
    assert(networkCalls === 0 && openAiErr instanceof GeminiError && openAiErr.code === 'AUTH' && /OpenAI/i.test(openAiErr.message),
        '12. Clé sk- bloquée immédiatement avec explication claire sans requête réseau');

    // 8. App.setGeminiApiKey + getMaskedGeminiApiKey + CoachOrchestrator (espaces ignorés)
    const store = {};
    global.window = {
        localStorage: {
            getItem: (k) => (Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null),
            setItem: (k, v) => { store[k] = String(v); },
            removeItem: (k) => { delete store[k]; }
        }
    };
    const fakeContainer = {
        innerHTML: '',
        addEventListener: () => {},
        querySelectorAll: () => [],
        querySelector: () => null
    };
    global.document = {
        getElementById: (id) => (id === 'app-root' ? fakeContainer : null),
        body: { className: '', classList: { add: () => {}, remove: () => {} } },
        querySelectorAll: () => [],
        querySelector: () => null
    };

    store.gemini_api_key = '   ';
    const orchEmpty = new CoachOrchestrator(null, null, null);
    assert(orchEmpty.llmProvider === null, '13. Une clé composée uniquement d\'espaces est ignorée proprement');

    const app = new App(new MockStorage(), null, null, null, null, null, null, null);
    assert(app.getMaskedGeminiApiKey() === null, '14. Aucune clé active par défaut');

    const active = app.setGeminiApiKey('  AQ.FAKE_TEST_TOKEN_9876  ');
    assert(active === true && store.gemini_api_key === 'AQ.FAKE_TEST_TOKEN_9876',
        '15. setGeminiApiKey enregistre la clé nettoyée dans localStorage');
    assert(app.getMaskedGeminiApiKey() === '••••9876',
        '16. getMaskedGeminiApiKey ne révèle que les 4 derniers caractères');
    assert(app.coachEngine.llmProvider && app.coachEngine.llmProvider.isVertexExpressKey() === true,
        '17. coachEngine bascule immédiatement sur Vertex AI Express Mode');
    assert(app.timetableImporter && app.timetableImporter.llmProvider === app.coachEngine.llmProvider,
        '18. timetableImporter reçoit aussi immédiatement le nouveau fournisseur');

    // 9. Rendu CoachChatView : bouton + modale présents, zéro style inline ajouté dans la modale
    const chatView = new CoachChatView('app-root', app);
    chatView.render([]);
    assert(fakeContainer.innerHTML.includes('id="btn-coach-api-key"') && fakeContainer.innerHTML.includes('••••9876'),
        '19. CoachChatView affiche le bouton de clé IA avec les 4 derniers caractères');
    const modalSlice = fakeContainer.innerHTML.slice(fakeContainer.innerHTML.indexOf('id="coach-api-key-modal"'));
    assert(modalSlice.includes('id="coach-api-key-input"') && !modalSlice.includes('style="'),
        '20. La modale de clé IA ne contient aucun attribut style inline');

    app.setGeminiApiKey('');
    assert(app.getMaskedGeminiApiKey() === null && store.gemini_api_key === undefined && app.coachEngine.llmProvider === null,
        '21. setGeminiApiKey("") supprime la clé et repasse en mode local');
} finally {
    global.fetch = realFetch;
    global.window = realWindow;
    global.document = realDocument;
}

if (failures === 0) console.log('\nTous les tests Vertex AI Express Mode et Clé IA passent.');
