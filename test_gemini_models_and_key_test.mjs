import assert from 'assert';
import {
    GeminiProvider,
    GEMINI_PRIMARY_MODEL,
    GEMINI_FALLBACK_MODELS,
    PREFERRED_MODELS,
    resetSessionModel
} from './src/ai/GeminiProvider.js';
import { CoachLocalReply } from './src/ai/CoachLocalReply.js';

console.log("=== TESTS CORRECTIF CLÉ GEMINI & LISTMODELS ===");

// 1. Modèles autorisés et exclusions
assert.strictEqual(GEMINI_PRIMARY_MODEL, "gemini-3.8-flash", "Le modèle principal doit être gemini-3.8-flash");
assert.deepStrictEqual(GEMINI_FALLBACK_MODELS, [
    "gemini-3.6-flash",
    "gemini-3.5-flash-lite",
    "gemini-3.1-flash-lite",
    "gemini-2.5-flash"
], "Les modèles de repli doivent être 3.6-flash, 3.5-flash-lite, 3.1-flash-lite et 2.5-flash");

assert(!GEMINI_FALLBACK_MODELS.includes("gemini-3.5-flash"), "gemini-3.5-flash doit être retiré");
assert(!GEMINI_FALLBACK_MODELS.includes("gemini-2.0-flash"), "gemini-2.0-flash doit être retiré");
assert(!GEMINI_FALLBACK_MODELS.includes("gemini-1.5-flash"), "gemini-1.5-flash doit être retiré");
console.log("✅ PASS: 1. Modèle principal gemini-3.8-flash et liste de repli conforme sans 3.5-flash/2.0/1.5");

// 2. Choix du modèle via ListModels selon la préférence
{
    resetSessionModel();
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url) => {
        if (url.includes('/models?')) {
            return {
                ok: true,
                status: 200,
                json: async () => ({
                    models: [
                        { name: 'models/text-embedding-004', supportedGenerationMethods: ['embedContent'] },
                        { name: 'models/gemini-3.1-flash-lite', supportedGenerationMethods: ['generateContent'] },
                        { name: 'models/gemini-3.6-flash', supportedGenerationMethods: ['generateContent'] }
                    ]
                })
            };
        }
        return { ok: false, status: 500 };
    };

    const provider = new GeminiProvider("AIzaSyFakeKey123");
    const chosen = await provider.resolveModel();
    assert.strictEqual(chosen, "gemini-3.6-flash", "resolveModel doit choisir gemini-3.6-flash (le premier dispo selon l'ordre de préférence)");
    assert.strictEqual(provider.selectedModel, "gemini-3.6-flash", "Le modèle doit être gardé en mémoire pour la session");
    
    globalThis.fetch = originalFetch;
    console.log("✅ PASS: 2. ListModels filtre generateContent et choisit le premier modèle selon la préférence");
}

// 3. Repli automatique si un modèle renvoie 404 (absent)
{
    resetSessionModel();
    const originalFetch = globalThis.fetch;
    const requestedModels = [];

    globalThis.fetch = async (url, options) => {
        if (url.includes('/models?')) {
            // ListModels échoue ou renvoie liste par défaut
            return { ok: false, status: 404, json: async () => ({ error: { message: "ListModels unavailable" } }) };
        }
        
        // generateContent call
        const match = url.match(/models\/([^:]+):generateContent/);
        const m = match ? match[1] : '';
        requestedModels.push(m);

        if (m === 'gemini-3.8-flash') {
            return {
                ok: false,
                status: 404,
                json: async () => ({ error: { message: "models/gemini-3.8-flash is not found for API version v1beta" } })
            };
        }
        if (m === 'gemini-3.6-flash') {
            return {
                ok: true,
                status: 200,
                json: async () => ({
                    candidates: [{ content: { parts: [{ text: "Réponse valide de gemini-3.6-flash" }] } }]
                })
            };
        }
        return { ok: false, status: 500 };
    };

    const provider = new GeminiProvider("AIzaSyFakeKey123");
    provider.retryDelayMs = 0; // Pas de délai pour les tests
    const text = await provider.generate("Test prompt");
    
    assert(text.includes("gemini-3.6-flash"), "La réponse doit provenir du modèle de repli");
    assert.deepStrictEqual(requestedModels, ["gemini-3.8-flash", "gemini-3.6-flash"], "3.8-flash a échoué (404) puis repli immédiat sur 3.6-flash");
    assert.strictEqual(provider.lastModelUsed, "gemini-3.6-flash", "Le dernier modèle utilisé doit être 3.6-flash");

    globalThis.fetch = originalFetch;
    console.log("✅ PASS: 3. Modèle absent (404) -> repli automatique immédiat sur le modèle suivant");
}

// 4. Bouton tester ma clé : clé invalide (400/403) ou quota (429) -> message clair
{
    const originalFetch = globalThis.fetch;
    
    // Test 403
    globalThis.fetch = async () => ({
        ok: false,
        status: 403,
        json: async () => ({ error: { message: "API key not valid. Please pass a valid API key." } })
    });

    const provider = new GeminiProvider("AIzaSyInvalidKeyTest");
    const res403 = await provider.testKey();
    assert.strictEqual(res403.ok, false, "testKey doit échouer sur 403");
    assert.strictEqual(res403.status, 403, "Status doit être 403");
    assert(res403.message.includes("Erreur 403") && res403.message.includes("Clé API invalide"), "Message doit mentionner Erreur 403 et Clé API invalide");
    assert(!res403.message.includes("AIzaSyInvalidKeyTest"), "La clé ne doit jamais apparaître dans le message");

    // Test 429
    globalThis.fetch = async () => ({
        ok: false,
        status: 429,
        json: async () => ({ error: { message: "Resource has been exhausted (e.g. check quota)." } })
    });

    const res429 = await provider.testKey();
    assert.strictEqual(res429.ok, false, "testKey doit échouer sur 429");
    assert(res429.message.includes("Erreur 429") && res429.message.includes("Quota"), "Message doit mentionner Erreur 429 et Quota");

    // Test succès
    globalThis.fetch = async () => ({
        ok: true,
        status: 200,
        json: async () => ({
            models: [{ name: 'models/gemini-3.8-flash', supportedGenerationMethods: ['generateContent'] }]
        })
    });

    const resOk = await provider.testKey();
    assert.strictEqual(resOk.ok, true, "testKey doit réussir sur 200");
    assert.strictEqual(resOk.model, "gemini-3.8-flash", "Le modèle retenu doit être gemini-3.8-flash");
    assert(resOk.message.includes("OK") && resOk.message.includes("gemini-3.8-flash"), "Le message doit annoncer OK + nom du modèle");

    globalThis.fetch = originalFetch;
    console.log("✅ PASS: 4. testKey() gère 403/429/200 avec message clair en français sans exposer la clé");
}

// 5. Message d'erreur du chat avec recommandation
{
    const lineAuth = CoachLocalReply.llmStatusLine({ ok: false, status: 403, code: 'AUTH', message: 'API key expired' });
    assert(lineAuth.includes("Teste ta clé dans les réglages"), "Le message de chat doit conseiller 'Teste ta clé dans les réglages'");
    assert(lineAuth.includes("403"), "Le code HTTP doit être mentionné");
    assert(!lineAuth.includes("stack") && !lineAuth.includes("Error:"), "Pas d'erreur technique brute");

    const lineQuota = CoachLocalReply.llmStatusLine({ ok: false, status: 429, code: 'QUOTA', message: 'Rate limit' });
    assert(lineQuota.includes("Teste ta clé dans les réglages"), "Le message de chat pour quota doit aussi conseiller de tester la clé");

    console.log("✅ PASS: 5. Message d'erreur du chat clair, en français avec conseil 'Teste ta clé dans les réglages'");
}

console.log("\n🎉 TOUS LES TESTS DE LA CLÉ GEMINI SONT PASSÉS AVEC SUCCÈS !");
