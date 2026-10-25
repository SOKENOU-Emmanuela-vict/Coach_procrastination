import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';

const ROOT_DIR = path.dirname(fileURLToPath(import.meta.url));
const SW_PATH = path.join(ROOT_DIR, 'sw.js');
const INDEX_PATH = path.join(ROOT_DIR, 'index.html');

let passed = 0;
let total = 0;

function assert(condition, message) {
    total++;
    if (!condition) {
        console.error(`❌ FAIL: ${message}`);
        process.exit(1);
    }
    passed++;
    console.log(`✅ PASS: ${message}`);
}

function walkSrcFiles(dir) {
    const out = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            out.push(...walkSrcFiles(full));
        } else if (entry.name.endsWith('.js') || entry.name.endsWith('.css')) {
            out.push('./' + path.relative(ROOT_DIR, full).replace(/\\/g, '/'));
        }
    }
    return out.sort();
}

function extractLocalRefsFromIndexHtml(html) {
    const refs = new Set();
    // Attributs href="..." et src="..."
    for (const m of html.matchAll(/\b(?:href|src)\s*=\s*["']([^"']+)["']/gi)) {
        refs.add(m[1]);
    }
    // Imports ES modules dans <script type="module">
    for (const m of html.matchAll(/\bimport\s+[^'"]*?from\s+["']([^"']+)["']/g)) {
        refs.add(m[1]);
    }

    const normalized = [];
    for (const raw of refs) {
        if (/^(?:https?:|data:|blob:|mailto:|javascript:|#)/i.test(raw)) continue;
        const withoutQuery = raw.split('?')[0].split('#')[0].trim();
        if (!withoutQuery) continue;
        const rel = withoutQuery.startsWith('./')
            ? withoutQuery
            : withoutQuery.startsWith('/')
              ? '.' + withoutQuery
              : './' + withoutQuery;
        if (rel === './sw.js') continue;
        normalized.push(rel);
    }
    return [...new Set(normalized)].sort();
}

function createSwSandbox(swCode, fetchImpl) {
    const listeners = {};
    const storeMap = new Map(); // cacheName -> Map<url, responseObj>
    const origin = 'http://127.0.0.1:8125';

    const toHref = (reqOrStr) => {
        const raw = typeof reqOrStr === 'string' ? reqOrStr : reqOrStr.url;
        return new URL(raw, origin + '/').href;
    };

    const caches = {
        async open(name) {
            if (!storeMap.has(name)) storeMap.set(name, new Map());
            const bucket = storeMap.get(name);
            return {
                async addAll(urls) {
                    for (const u of urls) {
                        const href = toHref(u);
                        const res = await fetchImpl({ url: href, method: 'GET' });
                        if (!res || !res.ok) throw new Error(`Échec précache ${href}`);
                        bucket.set(href, res.clone());
                    }
                },
                async put(reqOrUrl, response) {
                    bucket.set(toHref(reqOrUrl), response);
                },
                async match(reqOrUrl, opts = {}) {
                    const href = toHref(reqOrUrl);
                    if (bucket.has(href)) return bucket.get(href);
                    if (opts && opts.ignoreSearch) {
                        const clean = href.split('?')[0];
                        for (const [k, v] of bucket.entries()) {
                            if (k.split('?')[0] === clean) return v;
                        }
                    }
                    return undefined;
                }
            };
        },
        async keys() {
            return [...storeMap.keys()];
        },
        async delete(name) {
            return storeMap.delete(name);
        }
    };

    let skipWaitingCalled = false;
    let claimCalled = false;

    const context = vm.createContext({
        URL,
        Promise,
        console,
        caches,
        fetch: (req) => fetchImpl(typeof req === 'string' ? { url: req, method: 'GET' } : req),
        self: {
            location: { origin },
            skipWaiting: async () => { skipWaitingCalled = true; },
            clients: { claim: async () => { claimCalled = true; } },
            addEventListener(type, fn) {
                listeners[type] = fn;
            }
        }
    });

    vm.runInContext(swCode, context, { filename: 'sw.js' });
    return { listeners, storeMap, origin, getFlags: () => ({ skipWaitingCalled, claimCalled }) };
}

function makeResponse(body, status = 200) {
    return {
        ok: status >= 200 && status < 300,
        status,
        body,
        clone() {
            return makeResponse(body, status);
        }
    };
}

async function runTests() {
    console.log('=== TESTS SERVICE WORKER (PRÉCACHE COMPLET & STRATÉGIES RÉSEAU/CACHE) ===\n');

    const swCode = fs.readFileSync(SW_PATH, 'utf8');
    const indexHtml = fs.readFileSync(INDEX_PATH, 'utf8');

    const cacheNameMatch = swCode.match(/const\s+CACHE_NAME\s*=\s*'([^']+)';/);
    assert(Boolean(cacheNameMatch) && cacheNameMatch[1] !== 'learning-os-v2.0', `1. CACHE_NAME incrémenté (${cacheNameMatch ? cacheNameMatch[1] : 'absent'})`);
    const currentCacheName = cacheNameMatch[1];

    const listMatch = swCode.match(/const\s+ASSETS_TO_CACHE\s*=\s*\[([\s\S]*?)\];/);
    assert(Boolean(listMatch), '2. Liste ASSETS_TO_CACHE présente dans sw.js');
    const precacheList = [...listMatch[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
    const precacheSet = new Set(precacheList);

    // Vérification de tous les fichiers de src/
    const allSrcFiles = walkSrcFiles(path.join(ROOT_DIR, 'src'));
    const missingSrc = allSrcFiles.filter((f) => !precacheSet.has(f));
    assert(
        missingSrc.length === 0,
        `3. Tous les fichiers .js et .css de src/ (${allSrcFiles.length} fichiers) figurent dans ASSETS_TO_CACHE`
    );

    // Vérification de toutes les ressources locales référencées par index.html
    const indexRefs = extractLocalRefsFromIndexHtml(indexHtml);
    const missingIndexRefs = indexRefs.filter((r) => !precacheSet.has(r));
    assert(
        indexRefs.length > 0 && missingIndexRefs.length === 0,
        `4. Toutes les ressources locales référencées par index.html (${indexRefs.join(', ')}) figurent dans ASSETS_TO_CACHE`
    );

    // Vérification de la police Bootstrap Icons et de assets/
    assert(
        precacheSet.has('./vendor/bootstrap-icons/fonts/bootstrap-icons.woff2') &&
        precacheSet.has('./assets/profile.jpg') &&
        precacheSet.has('./index.html'),
        '5. Police bootstrap-icons.woff2, assets/profile.jpg et index.html sont précachés'
    );

    // Vérification que chaque fichier listé existe réellement sur le disque
    const nonExistent = precacheList.filter((rel) => {
        if (rel === './') return false;
        return !fs.existsSync(path.join(ROOT_DIR, rel));
    });
    assert(nonExistent.length === 0, '6. Chaque entrée de ASSETS_TO_CACHE existe réellement sur le disque');

    // Vérification que les grosses bibliothèques optionnelles ne bloquent pas le précache initial
    assert(
        !precacheSet.has('./vendor/pdfjs/pdf.worker.min.js') &&
        !precacheSet.has('./vendor/mammoth/mammoth.browser.min.js') &&
        !precacheSet.has('./vendor/sheetjs/xlsx.mini.min.js'),
        '7. Les bibliothèques lourdes (pdf.worker, mammoth, sheetjs) sont réservées au cache dynamique à la première utilisation'
    );

    // Simulation complète du cycle de vie et des stratégies fetch
    let online = true;
    let bootstrapVersionContent = 'export const V = "v1";';
    let networkHits = [];

    const env = createSwSandbox(swCode, async (req) => {
        networkHits.push(req.url);
        if (!online) throw new Error('Failed to fetch (offline)');
        if (req.url.includes('/src/core/Bootstrap.js')) {
            return makeResponse(bootstrapVersionContent, 200);
        }
        return makeResponse(`CONTENT:${req.url}`, 200);
    });

    // Pré-remplir un ancien cache obsolète pour vérifier le nettoyage à l'activate
    env.storeMap.set('learning-os-v2.0', new Map([['old', makeResponse('old')]]));

    // Install
    let installPromise;
    env.listeners.install({ waitUntil: (p) => { installPromise = p; } });
    await installPromise;
    assert(env.storeMap.get(currentCacheName).size === precacheList.length, '8. Événement install précache l’intégralité des ressources');

    // Activate
    let activatePromise;
    env.listeners.activate({ waitUntil: (p) => { activatePromise = p; } });
    await activatePromise;
    assert(!env.storeMap.has('learning-os-v2.0') && env.storeMap.has(currentCacheName), '9. Événement activate supprime les anciens caches');

    // Ignorer POST et requêtes externes (Gemini)
    let interceptedExternal = false;
    env.listeners.fetch({
        request: { url: 'https://generativelanguage.googleapis.com/v1beta/models/gemini:generateContent', method: 'POST' },
        respondWith: () => { interceptedExternal = true; }
    });
    env.listeners.fetch({
        request: { url: 'https://generativelanguage.googleapis.com/v1beta/models', method: 'GET' },
        respondWith: () => { interceptedExternal = true; }
    });
    assert(interceptedExternal === false, '10. Les appels Gemini et requêtes externes/POST ne sont jamais interceptés');

    // Hors-ligne : repli sur le précache même avec query string (?v=53)
    online = false;
    let offlineRespPromise;
    env.listeners.fetch({
        request: { url: `${env.origin}/src/core/Bootstrap.js?v=53`, method: 'GET', mode: 'cors' },
        respondWith: (p) => { offlineRespPromise = p; }
    });
    const offlineResp = await offlineRespPromise;
    assert(offlineResp && offlineResp.body === 'export const V = "v1";', '11. Hors-ligne : repli sur le cache fonctionnel même avec ?v=53');

    // Retour en ligne avec mise à jour d'un fichier .js : réseau d'abord sert la nouvelle version
    online = true;
    bootstrapVersionContent = 'export const V = "v2-updated";';
    let onlineUpdatePromise;
    env.listeners.fetch({
        request: { url: `${env.origin}/src/core/Bootstrap.js?v=53`, method: 'GET', mode: 'cors' },
        respondWith: (p) => { onlineUpdatePromise = p; }
    });
    const onlineUpdatedResp = await onlineUpdatePromise;
    assert(onlineUpdatedResp && onlineUpdatedResp.body === 'export const V = "v2-updated";', '12. En ligne : stratégie réseau d’abord sert immédiatement la version mise à jour');

    // Cache d'abord pour vendor/ + mise en cache dynamique de pdf.worker.min.js à la 1re utilisation
    networkHits = [];
    let gsapRespPromise;
    env.listeners.fetch({
        request: { url: `${env.origin}/vendor/gsap/gsap.min.js`, method: 'GET' },
        respondWith: (p) => { gsapRespPromise = p; }
    });
    await gsapRespPromise;
    assert(networkHits.length === 0, '13. Stratégie cache d’abord pour vendor/gsap/gsap.min.js (0 requête réseau)');

    let pdfWorkerPromise;
    env.listeners.fetch({
        request: { url: `${env.origin}/vendor/pdfjs/pdf.worker.min.js`, method: 'GET' },
        respondWith: (p) => { pdfWorkerPromise = p; }
    });
    await pdfWorkerPromise;
    assert(networkHits.length === 1, '14a. Première utilisation de pdf.worker.min.js récupérée sur le réseau et mise en cache dynamique');

    online = false;
    let pdfWorkerOfflinePromise;
    env.listeners.fetch({
        request: { url: `${env.origin}/vendor/pdfjs/pdf.worker.min.js`, method: 'GET' },
        respondWith: (p) => { pdfWorkerOfflinePromise = p; }
    });
    const pdfWorkerOffline = await pdfWorkerOfflinePromise;
    assert(Boolean(pdfWorkerOffline) && pdfWorkerOffline.status === 200, '14b. Seconde utilisation de pdf.worker.min.js servie hors-ligne depuis le cache dynamique');

    console.log(`\n=== RÉSULTATS SW : ${passed}/${total} ASSERTIONS PASSÉES ===`);
}

runTests().catch((err) => {
    console.error('❌ ERREUR NON GÉRÉE DANS test_sw_precache.mjs :', err);
    process.exit(1);
});
