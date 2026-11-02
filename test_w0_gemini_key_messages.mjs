import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { GeminiProvider, diagnoseNetworkFailure } from './src/ai/GeminiProvider.js';
import { CoachChatView } from './src/ui/CoachChatView.js';

console.log("=== TESTS W0 : MESSAGES DE CLÉ GEMINI & ENDPOINTS ===");

// 1. Vérification statique : Aucun conseil « crée une clé AIza » dans GeminiProvider.js
const geminiCode = fs.readFileSync(path.join(process.cwd(), 'src/ai/GeminiProvider.js'), 'utf8');
assert(!geminiCode.includes("créée dans Google AI Studio"), "1. Pas de conseil obsolète 'créée dans Google AI Studio' orientant vers AIza");
assert(!geminiCode.includes("Utilise une clé AIza"), "1b. Pas de conseil 'Utilise une clé AIza'");
console.log("✅ PASS: 1. Retrait des conseils obsolètes 'crée une clé AIza' dans GeminiProvider.js");

// 2. Vérification CoachChatView : aucune mention de 'Vertex AI Express' et placeholder conforme
const chatViewCode = fs.readFileSync(path.join(process.cwd(), 'src/ui/CoachChatView.js'), 'utf8');
assert(!chatViewCode.includes("Vertex AI Express"), "2. Pas de mention 'Vertex AI Express' dans l'aide de CoachChatView");
assert(chatViewCode.includes('placeholder="commence par AQ. ou AIza"'), "2b. Placeholder 'commence par AQ. ou AIza' présent");
console.log("✅ PASS: 2. Aide CoachChatView nettoyée et placeholder 'commence par AQ. ou AIza' vérifié");

// 3. Nouveau message quand Google est joignable mais refuse
const expectedMsg = "Google est joignable mais l'appel a été refusé ou bloqué par le navigateur. Vérifie que la clé vient de Google AI Studio et que l'API Gemini est activée sur son projet. Ouvre la Console (F12) pour le détail.";
const originalFetch = globalThis.fetch;
globalThis.fetch = async (url, options) => {
    if (options && options.mode === 'no-cors') {
        return { ok: false, type: 'opaque', status: 0 };
    }
    throw new TypeError('Failed to fetch');
};

const diag = await diagnoseNetworkFailure(new Error('Failed to fetch'), 'AQ.TestKeyRefused');
assert.strictEqual(diag.code, 'CORS_OR_AQ', "3. Code diagnostic CORS_OR_AQ");
assert.strictEqual(diag.message, expectedMsg, "3b. Message exact conforme pour Google joignable mais refus");
console.log("✅ PASS: 3. Nouveau message de refus navigateur / CORS vérifié");

// 4. generativelanguage essayé avant aiplatform avec en-tête x-goog-api-key puis ?key=
const requestedSteps = [];
globalThis.fetch = async (url, opts) => {
    requestedSteps.push({ url: String(url), headers: opts?.headers || {} });
    return {
        ok: true,
        status: 200,
        json: async () => ({
            candidates: [{ content: { parts: [{ text: "Bonjour !" }] } }]
        })
    };
};

const provider = new GeminiProvider("AQ.TestNewOrderKey123");
provider.retryDelayMs = 0;
await provider.generate("Test prompt");

assert(requestedSteps.length > 0, "4a. Au moins une requête envoyée");
assert(requestedSteps[0].url.startsWith("https://generativelanguage.googleapis.com/v1beta/models/"), "4b. generativelanguage appelé en premier");
assert.strictEqual(requestedSteps[0].headers['x-goog-api-key'], "AQ.TestNewOrderKey123", "4c. En-tête x-goog-api-key présent en premier");
console.log("✅ PASS: 4. generativelanguage (en-tête x-goog-api-key) appelé avant aiplatform");

// 5. Repli sur aiplatform si generativelanguage échoue pour clé AQ. (erreur réseau / CORS)
const fallbackSteps = [];
globalThis.fetch = async (url, opts) => {
    fallbackSteps.push(String(url));
    if (String(url).includes('generativelanguage.googleapis.com')) {
        throw new TypeError('Failed to fetch (CORS/Network)');
    }
    return {
        ok: true,
        status: 200,
        json: async () => ({
            candidates: [{ content: { parts: [{ text: "Réponse aiplatform" }] } }]
        })
    };
};

const resFallback = await provider.generate("Test fallback");
assert(resFallback.includes("Réponse aiplatform"), "5a. Réponse obtenue via repli aiplatform");
assert(fallbackSteps.some(u => u.includes('aiplatform.googleapis.com')), "5b. aiplatform appelé en repli");
console.log("✅ PASS: 5. Repli vers aiplatform fonctionnel en cas d'échec generativelanguage");

globalThis.fetch = originalFetch;

console.log("\n🎉 TOUS LES TESTS W0 PASSENT AVEC SUCCÈS !");
