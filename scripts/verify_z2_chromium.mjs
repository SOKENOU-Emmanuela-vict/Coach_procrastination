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
        '--remote-debugging-port=9224',
        '--disable-gpu',
        '--no-sandbox',
        '--window-size=1280,850'
    ]);

    await new Promise(r => setTimeout(r, 1500));

    const targets = await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Timeout /json')), 5000);
        http.get('http://127.0.0.1:9224/json', (res) => {
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

    console.log("1. Navigation vers l'univers École...");
    await send('Page.navigate', { url: 'http://127.0.0.1:8125/#academic' });
    await new Promise(r => setTimeout(r, 1500));

    // 2. Bascule sur l'onglet Projets & Stages
    console.log("2. Clic sur l'onglet Projets & Stages (data-id='1')...");
    await send('Runtime.evaluate', {
        expression: `(() => {
            const tab = document.querySelector('.academic-block-tab[data-id="1"]');
            if (tab) tab.click();
        })()`,
        returnByValue: true
    });
    await new Promise(r => setTimeout(r, 800));

    // 3. Création d'un Projet via le formulaire
    console.log("3. Création d'un Projet autonome...");
    await send('Runtime.evaluate', {
        expression: `(async () => {
            const app = window.app;
            if (app) {
                await app.saveProject({
                    id: 'proj_demo_autonome',
                    title: 'Refonte Portfolio Web 2026',
                    type: 'project',
                    status: 'active',
                    duration: '4 semaines',
                    startDate: '2026-11-01',
                    endDate: '2026-11-30',
                    location: '',
                    notes: 'Projet autonome de design et intégration CSS sans dépendance scolaire.',
                    tasks: [
                        { id: 't1', title: 'Architecture des vues', status: 'done', completed: true },
                        { id: 't2', title: 'Mise en page épurée', status: 'todo', completed: false }
                    ]
                });
                await app.renderView('academic');
                const tab = document.querySelector('.academic-block-tab[data-id="1"]');
                if (tab) tab.click();
            }
        })()`,
        awaitPromise: true,
        returnByValue: true
    });
    await new Promise(r => setTimeout(r, 800));

    // 4. Création d'un Stage autonome via le formulaire
    console.log("4. Création d'un Stage autonome...");
    await send('Runtime.evaluate', {
        expression: `(async () => {
            const app = window.app;
            if (app) {
                await app.saveProject({
                    id: 'stage_demo_autonome',
                    title: 'Stage Assistant Data & IA',
                    type: 'stage',
                    status: 'active',
                    duration: '6 mois (35h/semaine)',
                    startDate: '2027-02-01',
                    endDate: '2027-07-31',
                    location: 'Paris (2j télétravail)',
                    notes: 'Convention de stage en entreprise : analyse prédictive et dashboards.',
                    tasks: [
                        { id: 'st1', title: 'Validation des objectifs', status: 'done', completed: true },
                        { id: 'st2', title: 'Rapport intermédiaire', status: 'todo', completed: false }
                    ]
                });
                await app.renderView('academic');
                const tab = document.querySelector('.academic-block-tab[data-id="1"]');
                if (tab) tab.click();
            }
        })()`,
        awaitPromise: true,
        returnByValue: true
    });
    await new Promise(r => setTimeout(r, 800));

    // 5. Vérification du DOM à l'écran (absence totale de mentions scolaires)
    const domCheck = await send('Runtime.evaluate', {
        expression: `(() => {
            const content = document.querySelector('.bureau-content')?.innerHTML || '';
            const hasSchoolButton = !!document.querySelector('#btn-add-subject-top') || !!document.querySelector('#btn-add-semester');
            const hasProjectCard = !!document.querySelector('.project-card[data-project-id="proj_demo_autonome"]');
            const hasStageCard = !!document.querySelector('.project-card[data-project-id="stage_demo_autonome"]');
            const hasStageLocation = content.includes('Paris (2j télétravail)');
            const hasDuration = content.includes('6 mois (35h/semaine)');
            const hasSchoolWord = content.includes('MATH101') || content.includes('CECT') || content.includes('School');
            return {
                hasSchoolButton,
                hasProjectCard,
                hasStageCard,
                hasStageLocation,
                hasDuration,
                hasSchoolWord
            };
        })()`,
        returnByValue: true
    });

    console.log("Vérification visuelle DOM :", domCheck.value);

    // 6. Capture de l'écran après restructuration
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(DOCS_DIR, 'z2_projets_stages_after.png'), Buffer.from(shot.data, 'base64'));
    console.log("✅ Capture après enregistrée : docs/restructuration/z2_projets_stages_after.png");

    ws.close();
} catch (e) {
    console.error("Erreur capture après :", e);
    process.exitCode = 1;
} finally {
    if (chromeProcess) try { chromeProcess.kill(); } catch (_) {}
    if (serverProcess) try { serverProcess.kill(); } catch (_) {}
}
