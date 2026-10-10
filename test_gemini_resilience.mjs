// GeminiProvider : nouvelles tentatives + modèles de secours quand Gemini est saturé (503), arrêt immédiat
// sur une clé refusée, erreurs lisibles (status / code) et message clair pour l'import d'emploi du temps.
// Aucun appel réseau : fetch est simulé.
import { GeminiProvider, GeminiError, describeGeminiFailure, GEMINI_PRIMARY_MODEL } from './src/ai/GeminiProvider.js';
import { App } from './src/core/App.js';

let failures = 0;
function assert(cond, msg) {
    if (cond) console.log(`✅ PASS: ${msg}`);
    else { console.error(`❌ FAIL: ${msg}`); failures++; process.exitCode = 1; }
}

const realFetch = global.fetch;
const modelOf = (url) => (String(url).match(/models\/([^:]+):/) || [])[1];
const ok = (text) => ({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text }] } }] }) });
const fail = (status, message) => ({ ok: false, status, json: async () => ({ error: { code: status, message } }) });

function provider() {
    const gp = new GeminiProvider('CLE_TEST');
    gp.retryDelayMs = 0;
    return gp;
}

try {
    // 1. Saturation du modèle principal → nouvelle tentative puis modèle de secours
    let calls = [];
    global.fetch = async (url) => { calls.push(modelOf(url)); return modelOf(url) === GEMINI_PRIMARY_MODEL ? fail(503, 'This model is currently experiencing high demand.') : ok('{"ok":true}'); };
    let gp = provider();
    let out = await gp.generate('x');
    assert(out === '{"ok":true}', '1. 503 sur le modèle principal : la réponse vient du modèle de secours');
    assert(calls.length === 3 && calls[0] === GEMINI_PRIMARY_MODEL && calls[1] === GEMINI_PRIMARY_MODEL && calls[2] === gp.fallbackModels[0],
        '2. Ordre des essais : principal ×2 puis premier modèle de secours');
    assert(gp.lastModelUsed === gp.fallbackModels[0], '3. lastModelUsed renseigné');

    // 2. Une seule saturation passagère : la 2e tentative sur le principal suffit
    calls = []; let n = 0;
    global.fetch = async (url) => { calls.push(modelOf(url)); return n++ === 0 ? fail(503, 'high demand') : ok('A'); };
    out = await provider().generate('x');
    assert(out === 'A' && calls.length === 2 && calls.every(m => m === GEMINI_PRIMARY_MODEL), '4. Saturation passagère : 2e essai sur le même modèle');

    // 3. Tout est saturé → GeminiError avec status 503 et code OVERLOADED
    calls = [];
    global.fetch = async (url) => { calls.push(modelOf(url)); return fail(503, 'This model is currently experiencing high demand.'); };
    gp = provider();
    let err = await gp.generate('x').catch(e => e);
    assert(err instanceof GeminiError && err.status === 503 && err.code === 'OVERLOADED', '5. Tout saturé : GeminiError status 503 / OVERLOADED');
    assert(/code 503/.test(err.message) && /saturés/.test(err.message) && calls.length === 2 + gp.fallbackModels.length, '6. Message clair + tous les modèles essayés');

    // 4. Clé refusée : arrêt immédiat, aucun modèle de secours, clé jamais dans le message
    calls = [];
    global.fetch = async (url) => { calls.push(modelOf(url)); return fail(403, 'API key not valid CLE_TEST'); };
    err = await provider().generate('x').catch(e => e);
    assert(err.code === 'AUTH' && err.status === 403 && calls.length === 1, '7. 403 : pas de nouvel essai (clé refusée)');
    assert(!String(err.message).includes('CLE_TEST') && !String(err.detail).includes('CLE_TEST'), '8. La clé n\'apparaît jamais dans l\'erreur');

    // 5. Réseau coupé
    global.fetch = async () => { throw new TypeError('Failed to fetch'); };
    err = await provider().generate('x').catch(e => e);
    assert(err.code === 'NETWORK' && err.status === 0, '9. Réseau coupé : code NETWORK');

    // 6. Modèle trop lent (délai dépassé) → modèle suivant
    calls = [];
    global.fetch = (url, opts) => { calls.push(modelOf(url)); if (modelOf(url) !== GEMINI_PRIMARY_MODEL) return Promise.resolve(ok('B'));
        return new Promise((_, reject) => opts.signal.addEventListener('abort', () => { const e = new Error('aborted'); e.name = 'AbortError'; reject(e); })); };
    gp = provider(); gp.timeoutMs = 30;
    out = await gp.generate('x');
    assert(out === 'B' && calls[0] === GEMINI_PRIMARY_MODEL && calls.length === 2, '10. Délai dépassé : passage direct au modèle de secours');

    // 7. Modèle imposé : pas de modèle de secours
    calls = [];
    global.fetch = async (url) => { calls.push(modelOf(url)); return fail(503, 'high demand'); };
    err = await provider().generate('x', { model: 'gemini-test' }).catch(e => e);
    assert(err.code === 'OVERLOADED' && calls.every(m => m === 'gemini-test'), '11. Modèle imposé : seuls des essais sur ce modèle');

    // 8. Lecture de fichier : même résilience
    calls = [];
    global.fetch = async (url, opts) => { calls.push(modelOf(url)); const body = JSON.parse(opts.body);
        if (!body.contents[0].parts[0].inlineData) return fail(400, 'bad');
        return modelOf(url) === GEMINI_PRIMARY_MODEL ? fail(503, 'high demand') : ok('```json\n{"entries":[]}\n```'); };
    out = await provider().generateFromFile({ prompt: 'lis', mimeType: 'application/pdf', data: 'JVBERi0=' });
    assert(out === '{"entries":[]}' && calls.length === 3, '12. generateFromFile : modèle de secours après 503');

    // 9. Descriptions
    assert(describeGeminiFailure(429, 'Resource exhausted').code === 'QUOTA' && describeGeminiFailure(404, 'not found').code === 'MODEL'
        && describeGeminiFailure(0, 'timeout').code === 'TIMEOUT', '13. describeGeminiFailure : quota / modèle / délai');

    // 10. Message de l'import d'emploi du temps
    const ge = new GeminiError('Erreur API Gemini (code 503) : les serveurs de Gemini sont saturés.', { status: 503, code: 'OVERLOADED' });
    const ex = App.explainGeminiFailure(ge, "Lecture de l'emploi du temps impossible");
    assert(/^Lecture de l'emploi du temps impossible \(code 503\) : les serveurs de Gemini sont saturés\. .*réessaie dans quelques minutes/.test(ex.message) && ex.code === 'OVERLOADED',
        '14. Import : message clair avec le code et quoi faire');
    const other = new Error('Format non pris en charge');
    assert(App.explainGeminiFailure(other, 'X') === other, '15. Erreur non Gemini renvoyée telle quelle');
} finally {
    global.fetch = realFetch;
}
if (failures === 0) console.log('\nTous les tests de résilience Gemini passent.');
