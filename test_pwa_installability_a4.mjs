import http from 'http';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { buildWww } from './scripts/build_www.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PWA_DOCS_DIR = path.join(ROOT, 'docs', 'pwa');
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

async function run() {
    console.log('=== TESTS A4 : INSTALLABILITÉ PWA DANS CHROMIUM + MODE HORS-LIGNE ===\n');

    fs.mkdirSync(PWA_DOCS_DIR, { recursive: true });
    const { outDir: wwwDir } = buildWww(ROOT, path.join(ROOT, 'www'));
    const fb = JSON.parse(fs.readFileSync(path.join(ROOT, 'firebase.json'), 'utf8'));
    const globalHeaders = Object.fromEntries(
        ((fb.hosting.headers.find(h => h.source === '**') || {}).headers || []).map(h => [h.key, h.value])
    );

    const staticServer = http.createServer((req, res) => {
        const rawPath = (req.url || '/').split('?')[0];
        let rel = rawPath === '/' ? 'index.html' : rawPath.replace(/^\/+/, '');
        let filePath = path.join(wwwDir, rel);
        if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
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
    const chromePath = findChromeExecutable();
    check(Boolean(chromePath), '1. Navigateur Chromium détecté');

    const chromePort = 9351;
    const tmpProfileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'learning_os_a4_'));

    const chromeProcess = spawn(chromePath, [
        '--headless=new',
        `--remote-debugging-port=${chromePort}`,
        '--disable-gpu',
        '--no-sandbox',
        `--user-data-dir=${tmpProfileDir}`,
        '--window-size=1280,820'
    ]);

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
                    if (msg.error) reject(new Error(`${method}: ${msg.error.message}`));
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
        await send('Network.enable');

        // 1. Navigation initiale vers le site statique www/
        const appUrl = `http://127.0.0.1:${port}/`;
        await send('Page.navigate', { url: appUrl });
        await new Promise(r => setTimeout(r, 2500));

        // Attendre que le Service Worker soit prêt puis recharger pour qu'il contrôle la page
        const swReady1 = await send('Runtime.evaluate', {
            awaitPromise: true,
            returnByValue: true,
            expression: `(async () => {
                if (!('serviceWorker' in navigator)) return { supported: false };
                const reg = await navigator.serviceWorker.ready;
                return {
                    supported: true,
                    scope: reg.scope,
                    activeState: reg.active ? reg.active.state : null,
                    scriptURL: reg.active ? reg.active.scriptURL : null
                };
            })()`
        });
        const swInfo1 = swReady1.result.value;
        check(swInfo1.supported && swInfo1.activeState === 'activated', `2. Service Worker activé (${swInfo1.activeState})`);

        await send('Page.reload', { ignoreCache: false });
        await new Promise(r => setTimeout(r, 1500));

        const swControlled = await send('Runtime.evaluate', {
            returnByValue: true,
            expression: `Boolean(navigator.serviceWorker.controller && navigator.serviceWorker.controller.state === 'activated')`
        });
        check(swControlled.result.value === true, '3. Service Worker contrôle activement la page après rechargement');

        // 2. Audit du Manifeste natif par Chromium (Page.getAppManifest)
        const manifestRes = await send('Page.getAppManifest');
        const manifestErrors = manifestRes.errors || [];
        check(manifestRes.url && manifestRes.url.endsWith('/manifest.webmanifest'), `4a. Manifeste détecté par Chromium (${manifestRes.url})`);
        check(manifestErrors.length === 0, `4b. Zéro erreur de manifeste dans Chromium (erreurs=${manifestErrors.length})`);

        // 3. Vérification des critères natifs d'installabilité Chromium (Page.getInstallabilityErrors)
        const installRes = await send('Page.getInstallabilityErrors');
        const installErrors = installRes.installabilityErrors || [];
        check(
            installErrors.length === 0,
            `5. Critères d'installabilité PWA Chromium satisfaits (installabilityErrors=${JSON.stringify(installErrors)})`
        );

        // 4. Chargement réel de toutes les icônes déclarées dans le manifeste
        const iconLoadCheck = await send('Runtime.evaluate', {
            awaitPromise: true,
            returnByValue: true,
            expression: `(async () => {
                const res = await fetch('./manifest.webmanifest');
                const mf = await res.json();
                const out = [];
                for (const ic of mf.icons) {
                    const dims = await new Promise((resolve) => {
                        const img = new Image();
                        img.onload = () => resolve({ ok: true, w: img.naturalWidth, h: img.naturalHeight });
                        img.onerror = () => resolve({ ok: false });
                        img.src = ic.src;
                    });
                    out.push({ src: ic.src, declared: ic.sizes, ...dims });
                }
                const cachesList = await caches.keys();
                const cache = await caches.open(cachesList[0]);
                const cachedUrls = (await cache.keys()).length;
                return { icons: out, cachesList, cachedUrls };
            })()`
        });
        const iconAudit = iconLoadCheck.result.value;
        const allIconsOk = iconAudit.icons.every(i => i.ok && `${i.w}x${i.h}` === i.declared);
        check(allIconsOk && iconAudit.icons.length >= 4, `6. Toutes les icônes (${iconAudit.icons.length}) chargées et décodées dans Chromium aux dimensions exactes`);
        check(iconAudit.cachedUrls >= 100, `7. Précache PWA actif (${iconAudit.cachedUrls} ressources en cache dans ${iconAudit.cachesList.join(', ')})`);

        const saveDocs = process.argv.includes('--save-docs');

        // 5. Capture Desktop (1280x820)
        const shotDesktop = await send('Page.captureScreenshot', { format: 'png' });
        const desktopBuf = Buffer.from(shotDesktop.data, 'base64');
        const desktopPath = path.join(PWA_DOCS_DIR, 'pwa_desktop.png');
        if (saveDocs || !fs.existsSync(desktopPath)) {
            fs.writeFileSync(desktopPath, desktopBuf);
        }
        check(desktopBuf.length > 5000 && desktopBuf.subarray(0, 4).toString('hex') === '89504e47', '8. Capture PWA Desktop PNG valide');

        // 6. Test Responsive Android Mobile (390x844) + Capture Mobile
        await send('Emulation.setDeviceMetricsOverride', {
            width: 390,
            height: 844,
            deviceScaleFactor: 2,
            mobile: true
        });
        await new Promise(r => setTimeout(r, 800));
        const shotMobile = await send('Page.captureScreenshot', { format: 'png' });
        const mobileBuf = Buffer.from(shotMobile.data, 'base64');
        const mobilePath = path.join(PWA_DOCS_DIR, 'pwa_mobile.png');
        if (saveDocs || !fs.existsSync(mobilePath)) {
            fs.writeFileSync(mobilePath, mobileBuf);
        }
        check(mobileBuf.length > 5000 && mobileBuf.subarray(0, 4).toString('hex') === '89504e47', '9. Capture PWA Mobile (390x844) PNG valide');

        // 7. Test réel de fonctionnement HORS-LIGNE dans Chromium (émulation coupure réseau totale)
        await send('Network.emulateNetworkConditions', {
            offline: true,
            latency: 0,
            downloadThroughput: 0,
            uploadThroughput: 0
        });
        await send('Page.reload', { ignoreCache: false });
        await new Promise(r => setTimeout(r, 2000));

        const offlineState = await send('Runtime.evaluate', {
            returnByValue: true,
            expression: `({
                onLine: navigator.onLine,
                hasApp: Boolean(window.app),
                title: document.title,
                rootTextLen: document.getElementById('app-root') ? document.getElementById('app-root').innerText.trim().length : 0
            })`
        });
        const off = offlineState.result.value;
        check(
            off.onLine === false && off.hasApp === true && off.rootTextLen > 20,
            `10. Application redémarre entièrement HORS-LIGNE depuis le Service Worker (onLine=${off.onLine}, textLen=${off.rootTextLen})`
        );

        check(
            consoleErrors.length === 0 && pageExceptions.length === 0,
            `11. Zéro erreur console/exception tout au long du test (erreurs=${consoleErrors.length}, exceptions=${pageExceptions.length})`
        );

        // Copie des captures dans l'artifact dir si --save-docs ou absent
        const artifactDir = 'C:\\Users\\HP\\.gemini\\antigravity\\brain\\d069e758-d031-41ef-85cc-669bd3238cc3';
        if (fs.existsSync(artifactDir)) {
            fs.copyFileSync(desktopPath, path.join(artifactDir, 'pwa_desktop.png'));
            fs.copyFileSync(mobilePath, path.join(artifactDir, 'pwa_mobile.png'));
        }

        ws.close();
    } finally {
        try { chromeProcess.kill(); } catch (_) {}
        staticServer.close();
        try { fs.rmSync(tmpProfileDir, { recursive: true, force: true }); } catch (_) {}
    }

    console.log(`\n=== RÉSULTAT A4 : ${passed}/${total} ASSERTIONS PASSÉES ===`);
}

run().catch(err => {
    console.error('❌ ERREUR A4:', err);
    process.exit(1);
});
