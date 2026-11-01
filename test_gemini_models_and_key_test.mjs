import assert from 'assert';
import fs from 'fs';
import {
    GeminiProvider,
    GEMINI_PRIMARY_MODEL,
    GEMINI_FALLBACK_MODELS,
    PREFERRED_MODELS,
    resetSessionModel,
    notifyCspViolation,
    clearCspViolation
} from './src/ai/GeminiProvider.js';
import { CoachLocalReply } from './src/ai/CoachLocalReply.js';
import { CoachChatView } from './src/ui/CoachChatView.js';

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
            return { ok: false, status: 404, json: async () => ({ error: { message: "ListModels unavailable" } }) };
        }
        
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
    provider.retryDelayMs = 0;
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

// 6. Diagnostic précis des erreurs fetch (status 0) : CSP, CORS, hors-ligne, DNS, extension
{
    const originalFetch = globalThis.fetch;
    const testKeyAIza = "AIzaSySecretKey999";

    // 6a. Bloqué par la CSP
    notifyCspViolation('https://generativelanguage.googleapis.com');
    globalThis.fetch = async () => { throw new TypeError('Failed to fetch due to CSP'); };
    const pCSP = new GeminiProvider(testKeyAIza);
    const resCSP = await pCSP.testKey();
    assert.strictEqual(resCSP.ok, false);
    assert(resCSP.message.includes("CSP") || resCSP.message.includes("politique de sécurité"), "Doit identifier le blocage CSP");
    assert(resCSP.message.includes("generativelanguage"), "Doit mentionner l'hôte joint");
    assert(resCSP.message.includes("AIza"), "Doit mentionner le type de clé AIza");
    assert(!resCSP.message.includes(testKeyAIza), "Ne doit JAMAIS révéler la clé secrète");
    clearCspViolation();
    console.log("✅ PASS: 6a. Diagnostic échec fetch : bloqué par la CSP (securitypolicyviolation)");

    // 6b. Erreur CORS ou réponse opaque
    globalThis.fetch = async () => { throw new TypeError('Failed to fetch (CORS header missing)'); };
    const pCORS = new GeminiProvider(testKeyAIza);
    const resCORS = await pCORS.testKey();
    assert.strictEqual(resCORS.ok, false);
    assert(resCORS.message.includes("CORS") || resCORS.message.includes("opaque"), "Doit identifier une erreur CORS");
    assert(resCORS.message.includes("generativelanguage"), "Doit mentionner l'hôte generativelanguage");
    assert(resCORS.message.includes("AIza"), "Doit mentionner le type AIza");
    assert(!resCORS.message.includes(testKeyAIza), "Ne doit pas révéler la clé");
    console.log("✅ PASS: 6b. Diagnostic échec fetch : erreur CORS / opaque");

    // 6c. Navigateur hors-ligne (navigator.onLine === false)
    const originalOnLineDesc = Object.getOwnPropertyDescriptor(globalThis.navigator || {}, 'onLine');
    try {
        Object.defineProperty(globalThis.navigator, 'onLine', { value: false, configurable: true });
    } catch (_) {}
    globalThis.fetch = async () => { throw new TypeError('Failed to fetch (offline)'); };
    const pOffline = new GeminiProvider(testKeyAIza);
    const resOffline = await pOffline.testKey();
    assert.strictEqual(resOffline.ok, false);
    assert(resOffline.message.includes("hors-ligne") || resOffline.message.includes("connexion Internet"), "Doit identifier le mode hors-ligne");
    assert(resOffline.message.includes("generativelanguage") && resOffline.message.includes("AIza"));
    assert(!resOffline.message.includes(testKeyAIza));
    if (originalOnLineDesc) {
        Object.defineProperty(globalThis.navigator, 'onLine', originalOnLineDesc);
    } else {
        try { Object.defineProperty(globalThis.navigator, 'onLine', { value: true, configurable: true }); } catch (_) {}
    }
    console.log("✅ PASS: 6c. Diagnostic échec fetch : navigateur hors-ligne (navigator.onLine === false)");

    // 6d. Nom d'hôte introuvable / échec DNS
    globalThis.fetch = async () => {
        const err = new TypeError('fetch failed');
        err.cause = new Error('getaddrinfo ENOTFOUND generativelanguage.googleapis.com');
        throw err;
    };
    const pDNS = new GeminiProvider(testKeyAIza);
    const resDNS = await pDNS.testKey();
    assert.strictEqual(resDNS.ok, false);
    assert(resDNS.message.includes("Nom d'hôte introuvable") || resDNS.message.includes("DNS"), "Doit identifier l'erreur DNS/hôte introuvable");
    assert(resDNS.message.includes("generativelanguage") && resDNS.message.includes("AIza"));
    assert(!resDNS.message.includes(testKeyAIza));
    console.log("✅ PASS: 6d. Diagnostic échec fetch : nom d'hôte introuvable (échec DNS)");

    // 6e. Connexion refusée (ECONNREFUSED)
    globalThis.fetch = async () => {
        const err = new TypeError('fetch failed');
        err.cause = new Error('connect ECONNREFUSED 127.0.0.1:443');
        throw err;
    };
    const pRefused = new GeminiProvider(testKeyAIza);
    const resRefused = await pRefused.testKey();
    assert.strictEqual(resRefused.ok, false);
    assert(resRefused.message.includes("refusée"), "Doit identifier la connexion refusée");
    assert(resRefused.message.includes("generativelanguage") && resRefused.message.includes("AIza"));
    console.log("✅ PASS: 6e. Diagnostic échec fetch : connexion refusée");

    // 6f. Extension qui bloque (ERR_BLOCKED_BY_CLIENT)
    globalThis.fetch = async () => { throw new TypeError('net::ERR_BLOCKED_BY_CLIENT'); };
    const pExt = new GeminiProvider(testKeyAIza);
    const resExt = await pExt.testKey();
    assert.strictEqual(resExt.ok, false);
    assert(resExt.message.includes("extension") || resExt.message.includes("bloqueur"), "Doit identifier le blocage par une extension");
    assert(resExt.message.includes("generativelanguage") && resExt.message.includes("AIza"));
    assert(!resExt.message.includes(testKeyAIza));
    console.log("✅ PASS: 6f. Diagnostic échec fetch : extension qui bloque (ERR_BLOCKED_BY_CLIENT)");

    globalThis.fetch = originalFetch;
}

// 7. Clé commençant par AQ. : essai vers aiplatform puis generativelanguage puis message d'aide limpide
{
    const originalFetch = globalThis.fetch;
    const testKeyAQ = "AQ.TokenSecretVertex123";
    const triedUrls = [];

    globalThis.fetch = async (url) => {
        triedUrls.push(String(url));
        // Échec sur les deux endpoints
        return { ok: false, status: 403, json: async () => ({ error: { message: "Permission denied for this origin" } }) };
    };

    const pAQ = new GeminiProvider(testKeyAQ);
    const resAQ = await pAQ.testKey();

    assert.strictEqual(resAQ.ok, false, "testKey doit échouer pour la clé AQ. bloquée");
    assert(triedUrls.some(u => u.includes('aiplatform.googleapis.com')), "Doit avoir tenté l'adresse aiplatform");
    assert(triedUrls.some(u => u.includes('generativelanguage.googleapis.com')), "Doit avoir tenté l'autre adresse (generativelanguage)");
    assert(resAQ.message.includes("Cette clé de type AQ. ne fonctionne pas depuis le navigateur ; crée une clé AIza dans Google AI Studio"),
        "Doit donner exactement le message d'aide attendu pour les clés AQ.");
    assert(!resAQ.message.includes(testKeyAQ), "La clé AQ. ne doit jamais être affichée");

    globalThis.fetch = originalFetch;
    console.log("✅ PASS: 7. Clé AQ. : essai sur les deux adresses + message d'orientation vers Google AI Studio");
}

// 8. Distinction fine de l'erreur 403 : API non activée vs Clé refusée
{
    const originalFetch = globalThis.fetch;

    // 8a. Message contenant 'has not been used'
    globalThis.fetch = async () => ({
        ok: false,
        status: 403,
        json: async () => ({ error: { message: "Generative Language API has not been used in project 12345 before or it is disabled." } })
    });
    const resUsed = await (new GeminiProvider("AIzaSyKeyTest403")).testKey();
    assert(resUsed.message.includes("API Gemini non activée"), "Doit distinguer 'API Gemini non activée' pour 'has not been used'");

    // 8b. Message contenant 'disabled'
    globalThis.fetch = async () => ({
        ok: false,
        status: 403,
        json: async () => ({ error: { message: "The service is disabled for this project" } })
    });
    const resDisabled = await (new GeminiProvider("AIzaSyKeyTest403")).testKey();
    assert(resDisabled.message.includes("API Gemini non activée"), "Doit distinguer 'API Gemini non activée' pour 'disabled'");

    // 8c. Message contenant 'PERMISSION_DENIED'
    globalThis.fetch = async () => ({
        ok: false,
        status: 403,
        json: async () => ({ error: { message: "PERMISSION_DENIED: API is not activated" } })
    });
    const resPerm = await (new GeminiProvider("AIzaSyKeyTest403")).testKey();
    assert(resPerm.message.includes("API Gemini non activée"), "Doit distinguer 'API Gemini non activée' pour 'PERMISSION_DENIED'");

    // 8d. Message d'une clé révoquée / expirée (autre message)
    globalThis.fetch = async () => ({
        ok: false,
        status: 403,
        json: async () => ({ error: { message: "The provided API key is expired or revoked." } })
    });
    const resRevoked = await (new GeminiProvider("AIzaSyKeyTest403")).testKey();
    assert(resRevoked.message.includes("Clé API invalide ou refusée"), "Doit qualifier de clé invalide/refusée pour une expiration");

    globalThis.fetch = originalFetch;
    console.log("✅ PASS: 8. Erreur 403 : distinction fine entre 'API Gemini non activée' et 'clé refusée'");
}

// 9. Absence de doublon de l'id #coach-api-key-status
{
    const fileContent = fs.readFileSync('src/ui/CoachChatView.js', 'utf8');
    const matches = fileContent.match(/id="coach-api-key-status"/g);
    assert.strictEqual(matches ? matches.length : 0, 1, "Il ne doit y avoir qu'une seule occurrence de id='coach-api-key-status'");
    console.log("✅ PASS: 9. Vérification de l'id unique #coach-api-key-status dans CoachChatView.js");
}

console.log("\n🎉 TOUS LES TESTS DU CORRECTIF CLÉ GEMINI SONT PASSÉS AVEC SUCCÈS !");
