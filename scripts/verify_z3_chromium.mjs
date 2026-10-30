import { spawn } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';

const DOCS_DIR = path.resolve('docs/restructuration');
if (!fs.existsSync(DOCS_DIR)) fs.mkdirSync(DOCS_DIR, { recursive: true });

function findChromeExecutable() {
    if (process.env.CHROME_BIN && fs.existsSync(process.env.CHROME_BIN)) return process.env.CHROME_BIN;
    if (process.env.CHROME_PATH && fs.existsSync(process.env.CHROME_PATH)) return process.env.CHROME_PATH;
    const candidates = [
        path.join(process.env.PROGRAMFILES || 'C:\\Program Files', 'Google/Chrome/Application/chrome.exe'),
        path.join(process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)', 'Google/Chrome/Application/chrome.exe'),
        path.join(process.env.LOCALAPPDATA || '', 'Google/Chrome/Application/chrome.exe'),
        path.join(process.env.PROGRAMFILES || 'C:\\Program Files', 'Microsoft/Edge/Application/msedge.exe'),
        path.join(process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)', 'Microsoft/Edge/Application/msedge.exe'),
        '/usr/bin/google-chrome',
        '/usr/bin/chromium',
        '/usr/bin/chromium-browser',
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
    ];
    for (const c of candidates) {
        if (c && fs.existsSync(c)) return c;
    }
    return null;
}

const chromePath = findChromeExecutable();
if (!chromePath) {
    console.log("⚠️ Chrome introuvable : test passé proprement.");
    process.exit(0);
}

async function ensureServer() {
    const isRunning = await new Promise(res => {
        const req = http.get('http://127.0.0.1:8125', () => res(true));
        req.on('error', () => res(false));
        req.setTimeout(500, () => { req.destroy(); res(false); });
    });
    if (isRunning) return null;

    const srv = spawn('node', ['server.js'], {
        cwd: process.cwd(),
        env: { ...process.env, PORT: '8125' },
        stdio: 'ignore'
    });
    await new Promise(r => setTimeout(r, 1000));
    return srv;
}

let serverProcess = null;
let chromeProcess = null;

try {
    serverProcess = await ensureServer();

    chromeProcess = spawn(chromePath, [
        '--headless=new',
        '--remote-debugging-port=9225',
        '--disable-gpu',
        '--no-sandbox',
        '--window-size=1280,850'
    ]);

    await new Promise(r => setTimeout(r, 1500));

    const targets = await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Timeout /json')), 5000);
        http.get('http://127.0.0.1:9225/json', (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                clearTimeout(timer);
                resolve(JSON.parse(body));
            });
        }).on('error', (err) => {
            clearTimeout(timer);
            reject(err);
        });
    });

    const pageTarget = targets.find(t => t.type === 'page' && t.url.includes('8125')) || targets.find(t => t.type === 'page') || targets[0];
    const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
    await new Promise((res, rej) => {
        ws.onopen = res;
        ws.onerror = rej;
    });

    let msgId = 1;
    const send = (method, params = {}) => new Promise((resolve) => {
        const id = msgId++;
        const onMsg = (event) => {
            const data = JSON.parse(event.data);
            if (data.id === id) {
                ws.removeEventListener('message', onMsg);
                resolve(data.result);
            }
        };
        ws.addEventListener('message', onMsg);
        ws.send(JSON.stringify({ id, method, params }));
    });

    await send('Page.enable');
    await send('Runtime.enable');

    console.log("1. Navigation vers le Bureau...");
    await send('Page.navigate', { url: 'http://127.0.0.1:8125/#desktop' });
    await new Promise(r => setTimeout(r, 1500));

    // 2. Ouverture de la modale Sauvegarde
    console.log("2. Clic sur le bouton Sauvegarde (#btn-backup-modal)...");
    await send('Runtime.evaluate', {
        expression: `(() => {
            const btn = document.querySelector('#btn-backup-modal');
            if (btn) btn.click();
        })()`,
        returnByValue: true
    });
    await new Promise(r => setTimeout(r, 800));

    // 3. Capture de la modale de sauvegarde
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(DOCS_DIR, 'z3_backup_modal.png'), Buffer.from(shot.data, 'base64'));
    console.log("✅ Capture enregistrée : docs/restructuration/z3_backup_modal.png");

    // 4. Test du cycle Export -> Vidage -> Réimport en conditions réelles
    console.log("3. Test du cycle Export -> Vidage -> Réimport dans le navigateur...");
    const cycleResult = await send('Runtime.evaluate', {
        expression: `(async () => {
            const app = window.app;
            if (!app) return { ok: false, error: 'window.app non trouvé' };

            // Donnée test à exporter
            await app.storage.saveData('test_z3_marker', { name: 'Preuve Z3', timestamp: Date.now() });

            // 1. Export
            const backup = await app.exportAllData();
            if (!backup.test_z3_marker) return { ok: false, error: 'Export incomplet' };

            // 2. Vidage
            await app.storage.saveData('test_z3_marker', null);
            const afterClear = await app.storage.loadData('test_z3_marker');
            if (afterClear !== null && afterClear !== undefined) return { ok: false, error: 'Vidage échoué' };

            // 3. Réimport
            await app.importAllData(backup);
            const afterImport = await app.storage.loadData('test_z3_marker');
            if (!afterImport || afterImport.name !== 'Preuve Z3') return { ok: false, error: 'Restauration échouée' };

            // 4. Test redirection ancienne URL #portfolio
            if (app.renderView) {
                await app.renderView('portfolio');
            }
            const isDesktop = document.querySelector('.bureau') && !document.querySelector('.portfolio-container');

            return {
                ok: true,
                exportedKeys: Object.keys(backup).length,
                restoredMarker: afterImport.name,
                redirectedToDesktop: isDesktop
            };
        })()`,
        awaitPromise: true,
        returnByValue: true
    });

    const val = cycleResult.result?.value || cycleResult.value || cycleResult;
    console.log("Résultat du cycle navigateur :", val);
    if (!val?.ok) {
        throw new Error("Cycle export/import échoué : " + (val?.error || JSON.stringify(cycleResult)));
    }
    console.log("✅ Preuve navigateur validée : export .json -> vidage -> réimport -> données réapparues !");

    ws.close();
} catch (e) {
    console.error("Erreur test Z3 Chromium :", e);
    process.exitCode = 1;
} finally {
    if (chromeProcess) try { chromeProcess.kill(); } catch (_) {}
    if (serverProcess) try { serverProcess.kill(); } catch (_) {}
}
