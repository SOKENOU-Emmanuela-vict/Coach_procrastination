import assert from 'assert';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { App } from './src/core/App.js';
import { CoachOrchestrator } from './src/ai/CoachOrchestrator.js';
import { buildWww } from './scripts/build_www.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
let passed = 0;
let total = 0;

function check(cond, msg) {
    total++;
    if (!cond) {
        console.error(`❌ FAIL: ${msg}`);
        process.exit(1);
    }
    passed++;
    console.log(`✅ PASS: ${msg}`);
}

class MockStorage {
    constructor() { this.store = {}; }
    async loadData(k) { return this.store[k] || null; }
    async saveData(k, v) { this.store[k] = v; }
}

function findChromeExecutable() {
    const candidates = [
        path.join(process.env.PROGRAMFILES || 'C:\\Program Files', 'Google/Chrome/Application/chrome.exe'),
        path.join(process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)', 'Google/Chrome/Application/chrome.exe'),
        path.join(process.env.LOCALAPPDATA || '', 'Google/Chrome/Application/chrome.exe'),
        path.join(process.env.PROGRAMFILES || 'C:\\Program Files', 'Microsoft/Edge/Application/msedge.exe'),
        path.join(process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)', 'Microsoft/Edge/Application/msedge.exe')
    ];
    for (const c of candidates) {
        if (c && fs.existsSync(c)) return c;
    }
    return null;
}

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.webmanifest': 'application/manifest+json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.woff2': 'font/woff2'
};

async function runUnitTests() {
    const realWindow = global.window;
    const realDocument = global.document;
    const realFetch = global.fetch;
    const realNavigator = global.navigator;
    const realEnvKey = process.env.GEMINI_API_KEY;

    try {
        const store = { gemini_api_key: 'FAKE_TEST_LOCALSTORAGE_PRIO_1234' };
        let fetchCalledCount = 0;

        global.window = {
            location: { protocol: 'https:', hostname: 'learning-os-demo.web.app' },
            localStorage: {
                getItem: (k) => (k in store ? store[k] : null),
                setItem: (k, v) => { store[k] = String(v); },
                removeItem: (k) => { delete store[k]; }
            }
        };
        global.document = {
            getElementById: () => null,
            body: { className: '', classList: { add: () => {}, remove: () => {} } },
            querySelectorAll: () => [],
            querySelector: () => null
        };
        global.fetch = async () => {
            fetchCalledCount++;
            return { ok: true, json: async () => ({ apiKey: 'FAKE_TEST_SHOULD_NOT_CALL' }) };
        };

        // 1. Priorité stricte à localStorage devant process.env
        process.env.GEMINI_API_KEY = 'FAKE_TEST_ENV_KEY_9999';
        const orch = new CoachOrchestrator({ getSlots: () => [] });
        check(
            orch.llmProvider && orch.llmProvider.apiKey === 'FAKE_TEST_LOCALSTORAGE_PRIO_1234',
            '1. CoachOrchestrator lit la clé localStorage en priorité sur process.env'
        );

        // 2. En HTTPS Firebase Hosting : aucun appel à /api/config/key et clé localStorage préservée
        const app = new App(new MockStorage(), null, null, null, null, null, null, null);
        const resHttps = await app.syncApiKeyFromFile();
        check(resHttps === false && fetchCalledCount === 0, '2. En HTTPS (*.web.app), /api/config/key n’est jamais appelé (0 requête)');
        check(app.getMaskedGeminiApiKey() === '••••1234', '3. Clé localStorage conservée intacte sur hébergement HTTPS');

        // 3. Capacitor Android (https://localhost + window.Capacitor) : aucun appel /api/config/key
        global.window.location = { protocol: 'https:', hostname: 'localhost' };
        global.window.Capacitor = { isNativePlatform: () => true };
        const resCap = await app.syncApiKeyFromFile();
        check(resCap === false && fetchCalledCount === 0, '4. Dans Capacitor Android, /api/config/key n’est jamais appelé');
        delete global.window.Capacitor;

        // 4. Hors-ligne sur 127.0.0.1 : aucun appel réseau
        global.window.location = { protocol: 'http:', hostname: '127.0.0.1' };
        Object.defineProperty(global, 'navigator', {
            configurable: true,
            value: { onLine: false }
        });
        const resOffline = await app.syncApiKeyFromFile();
        check(resOffline === false && fetchCalledCount === 0, '5. Hors-ligne (navigator.onLine === false), aucun appel /api/config/key');

        // 5. Simulation serveur sans /api/config/key : rewrite HTML 200 -> ignoré proprement sans erreur JSON
        Object.defineProperty(global, 'navigator', {
            configurable: true,
            value: { onLine: true }
        });
        global.fetch = async () => ({
            ok: true,
            status: 200,
            headers: { get: (h) => (h.toLowerCase() === 'content-type' ? 'text/html; charset=utf-8' : null) },
            json: async () => { throw new Error('JSON ne doit pas être parsé sur text/html'); }
        });
        const resHtml = await app.syncApiKeyFromFile();
        check(resHtml === false && store.gemini_api_key === 'FAKE_TEST_LOCALSTORAGE_PRIO_1234', '6. Rewrite SPA (200 text/html) ignoré proprement sans erreur');

        // 6. Serveur répondant 404 -> ignoré sans erreur
        global.fetch = async () => ({ ok: false, status: 404, headers: { get: () => 'text/plain' } });
        const res404 = await app.syncApiKeyFromFile();
        check(res404 === false && store.gemini_api_key === 'FAKE_TEST_LOCALSTORAGE_PRIO_1234', '7. Réponse 404 sur /api/config/key ignorée proprement');

        // 7. Rejet réseau -> ignoré sans erreur
        global.fetch = async () => { throw new TypeError('Failed to fetch'); };
        const resErr = await app.syncApiKeyFromFile();
        check(resErr === false && store.gemini_api_key === 'FAKE_TEST_LOCALSTORAGE_PRIO_1234', '8. Rejet réseau ignoré sans erreur ni exception');
    } finally {
        global.window = realWindow;
        global.document = realDocument;
        global.fetch = realFetch;
        if (realNavigator !== undefined) {
            Object.defineProperty(global, 'navigator', { configurable: true, value: realNavigator });
        }
        if (realEnvKey !== undefined) process.env.GEMINI_API_KEY = realEnvKey;
        else delete process.env.GEMINI_API_KEY;
    }
}

async function runBrowserStaticHostingTest() {
    const chromePath = findChromeExecutable();
    check(Boolean(chromePath), '9. Chromium/Edge disponible pour vérifier le rendu statique sans server.js');

    const { outDir: wwwDir } = buildWww(ROOT, path.join(ROOT, 'www'));
    const fb = JSON.parse(fs.readFileSync(path.join(ROOT, 'firebase.json'), 'utf8'));
    const globalHeaders = Object.fromEntries(
        ((fb.hosting.headers.find(h => h.source === '**') || {}).headers || []).map(h => [h.key, h.value])
    );

    // Serveur statique reproduisant exactement Firebase Hosting (rewrite vers /index.html, pas de /api/config/key)
    const staticServer = http.createServer((req, res) => {
        const rawPath = (req.url || '/').split('?')[0];
        let rel = rawPath === '/' ? 'index.html' : rawPath.replace(/^\/+/, '');
        let filePath = path.join(wwwDir, rel);
        if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
            // Rewrite Firebase Hosting SPA vers /index.html
            filePath = path.join(wwwDir, 'index.html');
        }
        const ext = path.extname(filePath).toLowerCase();
        const headers = {
            'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
            ...globalHeaders
        };
        if (rawPath === '/sw.js' || rawPath === '/index.html' || rawPath === '/') {
            headers['Cache-Control'] = 'no-cache';
        }
        res.writeHead(200, headers);
        fs.createReadStream(filePath).pipe(res);
    });

    await new Promise(resolve => staticServer.listen(0, '127.0.0.1', resolve));
    const port = staticServer.address().port;
    const chromePort = 9348;

    const chromeProcess = spawn(chromePath, [
        '--headless=new',
        `--remote-debugging-port=${chromePort}`,
        '--disable-gpu',
        '--no-sandbox',
        `--user-data-dir=${path.join(ROOT, 'www', '..', '.chrome_tmp_a3')}`,
        '--window-size=1280,800'
    ]);

    const tmpProfileDir = path.join(ROOT, '.chrome_tmp_a3');
    try {
        await new Promise(r => setTimeout(r, 1500));
        const targets = await new Promise((res, rej) => {
            http.get(`http://127.0.0.1:${chromePort}/json`, resp => {
                let d = '';
                resp.on('data', c => d += c);
                resp.on('end', () => res(JSON.parse(d)));
            }).on('error', rej);
        });
        const pageTarget = targets.find(t => t.type === 'page') || targets[0];
        const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
        await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

        let msgId = 1;
        const send = (method, params = {}) => new Promise((resolve, reject) => {
            const id = msgId++;
            const handler = e => {
                const msg = JSON.parse(e.data);
                if (msg.id === id) {
                    ws.removeEventListener('message', handler);
                    if (msg.error) reject(new Error(msg.error.message));
                    else resolve(msg.result);
                }
            };
            ws.addEventListener('message', handler);
            ws.send(JSON.stringify({ id, method, params }));
        });

        const consoleErrors = [];
        const pageExceptions = [];
        ws.addEventListener('message', e => {
            const msg = JSON.parse(e.data);
            if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
                consoleErrors.push(JSON.stringify(msg.params.args));
            }
            if (msg.method === 'Runtime.exceptionThrown') {
                pageExceptions.push(JSON.stringify(msg.params.exceptionDetails));
            }
        });

        await send('Page.enable');
        await send('Runtime.enable');
        await send('Page.navigate', { url: `http://127.0.0.1:${port}/` });
        await new Promise(r => setTimeout(r, 1500));

        // Injecte une clé dans localStorage puis recharge (comme un utilisateur sur Firebase Hosting)
        await send('Runtime.evaluate', {
            expression: `localStorage.setItem('gemini_api_key', 'FAKE_TEST_HOSTED_USER_KEY_7788')`
        });
        await send('Page.reload', { ignoreCache: true });
        await new Promise(r => setTimeout(r, 1800));

        const state = await send('Runtime.evaluate', {
            returnByValue: true,
            expression: `({
                hasApp: Boolean(window.app),
                maskedKey: window.app ? window.app.getMaskedGeminiApiKey() : null,
                rootLen: document.getElementById('app-root') ? document.getElementById('app-root').innerText.length : 0
            })`
        });

        const info = state.result.value;
        check(info.hasApp === true && info.rootLen > 20, '10. App démarrée complètement sur www/ statique sans server.js');
        check(info.maskedKey === '••••7788', '11. Clé stockée dans localStorage active au démarrage sans server.js');
        check(consoleErrors.length === 0 && pageExceptions.length === 0, `12. Zéro erreur console/exception sans server.js (erreurs=${consoleErrors.length}, exceptions=${pageExceptions.length})`);

        ws.close();
    } finally {
        try { chromeProcess.kill(); } catch (_) {}
        staticServer.close();
        try { fs.rmSync(tmpProfileDir, { recursive: true, force: true }); } catch (_) {}
    }
}

async function main() {
    console.log('=== TESTS A3 : FONCTIONNEMENT SANS server.js / HTTPS / LOCALSTORAGE PRIORITAIRE ===\n');
    await runUnitTests();
    await runBrowserStaticHostingTest();
    console.log(`\n=== RÉSULTAT A3 : ${passed}/${total} ASSERTIONS PASSÉES ===`);
}

main().catch(err => {
    console.error('❌ ERREUR A3:', err);
    process.exit(1);
});
