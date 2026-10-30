import { spawn } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';
import assert from 'assert';

const PARCOURS_DIR = path.resolve('docs/restructuration/z5_parcours');
if (!fs.existsSync(PARCOURS_DIR)) {
    fs.mkdirSync(PARCOURS_DIR, { recursive: true });
}

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
    console.log("⚠️ Chrome introuvable : test passé proprement sans échec.");
    process.exit(0);
}

const PORT = 8127;
const DEBUG_PORT = 9227;

async function ensureServer() {
    const isRunning = await new Promise(res => {
        const req = http.get(`http://127.0.0.1:${PORT}`, () => res(true));
        req.on('error', () => res(false));
        req.setTimeout(500, () => { req.destroy(); res(false); });
    });
    if (isRunning) return null;

    const srv = spawn('node', ['server.js'], {
        cwd: process.cwd(),
        env: { ...process.env, PORT: `${PORT}` },
        stdio: 'ignore'
    });
    await new Promise(r => setTimeout(r, 1200));
    return srv;
}

let serverProcess = null;
let chromeProcess = null;

try {
    serverProcess = await ensureServer();

    chromeProcess = spawn(chromePath, [
        '--headless=new',
        `--remote-debugging-port=${DEBUG_PORT}`,
        '--disable-gpu',
        '--no-sandbox',
        '--window-size=1280,900'
    ]);

    await new Promise(r => setTimeout(r, 1500));

    const targets = await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Timeout /json')), 5000);
        http.get(`http://127.0.0.1:${DEBUG_PORT}/json`, (res) => {
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

    const pageTarget = targets.find(t => t.type === 'page' && t.url.includes(`${PORT}`)) || targets.find(t => t.type === 'page') || targets[0];
    const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
    await new Promise((res, rej) => {
        ws.onopen = res;
        ws.onerror = rej;
    });

    const jsErrors = [];

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

    ws.addEventListener('message', (event) => {
        try {
            const data = JSON.parse(event.data);
            if (data.method === 'Runtime.consoleAPICalled') {
                if (data.params.type === 'error') {
                    const text = data.params.args.map(a => a.value || a.description || JSON.stringify(a)).join(' ');
                    console.error(" [CDP console.error]", text);
                    jsErrors.push({ source: 'console.error', text });
                }
            } else if (data.method === 'Runtime.exceptionThrown') {
                const desc = data.params.exceptionDetails?.exception?.description || data.params.exceptionDetails?.text || 'Uncaught exception';
                console.error(" [CDP exceptionThrown]", desc);
                jsErrors.push({ source: 'exceptionThrown', text: desc });
            }
        } catch (_) {}
    });

    await send('Page.enable');
    await send('Runtime.enable');

    const capture = async (filename, description) => {
        await new Promise(r => setTimeout(r, 600));
        const shot = await send('Page.captureScreenshot', { format: 'png' });
        const filePath = path.join(PARCOURS_DIR, filename);
        fs.writeFileSync(filePath, Buffer.from(shot.data, 'base64'));
        console.log(`📸 [${description}] Capturé : ${filePath}`);
    };

    console.log("\n=== DÉBUT DU PARCOURS COMPLET CHROMIUM (Z5) ===");

    // 1. CHARGEMENT INITIAL : BUREAU
    console.log("\n1. Chargement du Bureau...");
    await send('Page.navigate', { url: `http://127.0.0.1:${PORT}/#desktop` });
    await new Promise(r => setTimeout(r, 2000));

    // Installer l'intercepteur window.onerror et initialiser des données d'exemple
    await send('Runtime.evaluate', {
        expression: `(() => {
            window.__jsErrors = [];
            window.addEventListener('error', (e) => {
                window.__jsErrors.push({ source: 'window.onerror', message: e.message, filename: e.filename, lineno: e.lineno });
            });
            window.addEventListener('unhandledrejection', (e) => {
                window.__jsErrors.push({ source: 'unhandledrejection', reason: String(e.reason) });
            });
            // Mode sans clé IA pour test offline
            try { localStorage.removeItem('gemini_api_key'); } catch (_) {}
        })()`
    });

    // Initialiser les données pour avoir des contenus visibles sur tous les écrans
    await send('Runtime.evaluate', {
        expression: `(async () => {
            const app = window.app;
            if (!app) return;
            const today = app.getPedagogicalDate ? app.getPedagogicalDate(new Date()) : new Date().toLocaleDateString('fr-CA');
            await app.storage.saveData('events', [
                { id: 'ev_1', title: 'Cours Algorithmique', startTime: '10:00', endTime: '12:00', date: today, status: 'planifiée', subjectId: 'algo' },
                { id: 'ev_2', title: 'Révision Anglais', startTime: '14:00', endTime: '15:00', date: today, status: 'planifiée', type: 'langue' }
            ]);
            await app.storage.saveData('personal_tasks', [
                { id: 't_1', title: 'Préparer DM Mathématiques', dueDate: today, status: 'à faire', completed: false }
            ]);
            await app.refreshUserStats();
            await app.renderView('desktop');
        })()`,
        awaitPromise: true
    });

    await capture('01_bureau.png', 'Étape 1 : Bureau');

    // 2. NAVIGATION VERS PLANNING (VUE SEMAINE)
    console.log("\n2. Clic menu -> Planning (Semaine)...");
    await send('Runtime.evaluate', {
        expression: `(() => {
            const navBtn = document.querySelector('.bureau-sidebar [data-view="planning"]');
            if (navBtn) navBtn.click();
            else window.app.renderView('planning');
        })()`
    });
    await new Promise(r => setTimeout(r, 800));
    await capture('02_planning_semaine.png', 'Étape 2 : Planning Semaine');

    // 3. PLANNING : BASCULE EN VUE MOIS
    console.log("\n3. Bascule en vue Mois...");
    await send('Runtime.evaluate', {
        expression: `(() => {
            const monthBtn = document.querySelector('button[data-planning-mode="month"]');
            if (monthBtn) monthBtn.click();
        })()`
    });
    await new Promise(r => setTimeout(r, 800));
    await capture('03_planning_mois.png', 'Étape 3 : Planning Mois');

    // 4. NAVIGATION VERS ÉCOLE (BLOC 1 : CURSUS & MATIÈRES)
    console.log("\n4. Clic menu -> École (Cursus)...");
    await send('Runtime.evaluate', {
        expression: `(() => {
            const navBtn = document.querySelector('.bureau-sidebar [data-view="academic"]');
            if (navBtn) navBtn.click();
            else window.app.renderView('academic');
        })()`
    });
    await new Promise(r => setTimeout(r, 800));
    // S'assurer que le bloc Cursus (data-id 0) est actif
    await send('Runtime.evaluate', {
        expression: `(() => {
            const tabCursus = document.querySelector('.academic-block-tab[data-id="0"]');
            if (tabCursus) tabCursus.click();
        })()`
    });
    await new Promise(r => setTimeout(r, 600));
    await capture('04_ecole_cursus.png', 'Étape 4 : École Cursus & Matières');

    // 5. ÉCOLE (BLOC 2 : PROJETS & STAGES)
    console.log("\n5. Clic onglet -> Projets & Stages...");
    await send('Runtime.evaluate', {
        expression: `(() => {
            const tabProjets = document.querySelector('.academic-block-tab[data-id="1"]');
            if (tabProjets) tabProjets.click();
        })()`
    });
    await new Promise(r => setTimeout(r, 800));
    await capture('05_ecole_projets_stages.png', 'Étape 5 : École Projets & Stages');

    // 6. ÉCOLE (BLOC 3 : DOCUMENTS)
    console.log("\n6. Retour bloc Cursus et ouverture Documents...");
    // Revenir à l'onglet cursus pour avoir accès au bouton Documents
    await send('Runtime.evaluate', {
        expression: `(() => {
            const tabCursus = document.querySelector('.academic-block-tab[data-id="0"]');
            if (tabCursus) tabCursus.click();
        })()`
    });
    await new Promise(r => setTimeout(r, 600));

    await send('Runtime.evaluate', {
        expression: `(() => {
            const btnDocs = document.querySelector('#btn-open-documents');
            if (btnDocs) btnDocs.click();
        })()`
    });
    await new Promise(r => setTimeout(r, 1000));
    await capture('06_ecole_documents.png', 'Étape 6 : École Modale Documents');

    // Fermer la modale documents
    await send('Runtime.evaluate', {
        expression: `(() => {
            const btnClose = document.querySelector('#btn-doc-modal-close');
            if (btnClose) btnClose.click();
        })()`
    });
    await new Promise(r => setTimeout(r, 500));

    // 7. NAVIGATION VERS LANGUES
    console.log("\n7. Clic menu -> Langues...");
    await send('Runtime.evaluate', {
        expression: `(() => {
            const navBtn = document.querySelector('.bureau-sidebar [data-view="languages"]');
            if (navBtn) navBtn.click();
            else window.app.renderView('languages');
        })()`
    });
    await new Promise(r => setTimeout(r, 800));
    await capture('07_langues.png', 'Étape 7 : Langues');

    // 8. NAVIGATION VERS VIE
    console.log("\n8. Clic menu -> Vie...");
    await send('Runtime.evaluate', {
        expression: `(() => {
            const navBtn = document.querySelector('.bureau-sidebar [data-view="life"]');
            if (navBtn) navBtn.click();
            else window.app.renderView('life');
        })()`
    });
    await new Promise(r => setTimeout(r, 800));
    await capture('08_vie.png', 'Étape 8 : Vie');

    // 9. NAVIGATION VERS COACH (CHAT) ET QUESTION
    console.log("\n9. Clic menu -> Coach & Envoi d'une question...");
    await send('Runtime.evaluate', {
        expression: `(() => {
            const navBtn = document.querySelector('.bureau-sidebar [data-view="chat"]');
            if (navBtn) navBtn.click();
            else window.app.renderView('chat');
        })()`
    });
    await new Promise(r => setTimeout(r, 800));

    await send('Runtime.evaluate', {
        expression: `(async () => {
            if (window.app && typeof window.app.sendChatMessage === 'function') {
                await window.app.sendChatMessage("Qu'est-ce qu'il me reste aujourd'hui ?");
                await window.app.renderView('chat');
            }
        })()`,
        awaitPromise: true
    });
    await new Promise(r => setTimeout(r, 1200));
    await capture('09_coach_chat.png', 'Étape 9 : Coach Chat & Réponse');

    // 10. RETOUR BUREAU & MODALE SAUVEGARDE
    console.log("\n10. Retour Bureau & Ouverture Sauvegarde...");
    await send('Runtime.evaluate', {
        expression: `(() => {
            const navBtn = document.querySelector('.bureau-sidebar [data-view="desktop"]');
            if (navBtn) navBtn.click();
            else window.app.renderView('desktop');
        })()`
    });
    await new Promise(r => setTimeout(r, 800));

    await send('Runtime.evaluate', {
        expression: `(() => {
            const btnBackup = document.querySelector('#btn-backup-modal');
            if (btnBackup) btnBackup.click();
        })()`
    });
    await new Promise(r => setTimeout(r, 600));
    await capture('10_bureau_modale_sauvegarde.png', 'Étape 10 : Bureau Modale Sauvegarde Ouverte');

    // Fermer la modale sauvegarde
    await send('Runtime.evaluate', {
        expression: `(() => {
            const btnClose = document.querySelector('#backup-modal-close');
            if (btnClose) btnClose.click();
        })()`
    });
    await new Promise(r => setTimeout(r, 500));
    await capture('11_bureau_final.png', 'Étape 11 : Bureau Final');

    // 11. EXTRACTION ET VÉRIFICATION DES ERREURS JAVASCRIPT
    console.log("\n11. Vérification des erreurs JavaScript console / window...");
    const windowErrorsRes = await send('Runtime.evaluate', {
        expression: `window.__jsErrors || []`,
        returnByValue: true
    });
    const windowErrors = windowErrorsRes.result?.value || [];

    const allErrors = [...jsErrors, ...windowErrors];
    console.log(`Bilan des erreurs : ${allErrors.length} erreur(s) détectée(s).`);

    if (allErrors.length > 0) {
        console.error("Détail des erreurs JS relevées :");
        allErrors.forEach((err, idx) => {
            console.error(` ${idx + 1}. [${err.source}] ${err.text || err.message}`);
        });
    }

    assert.strictEqual(allErrors.length, 0, `Le parcours doit comporter 0 erreur JS, mais a rencontré ${allErrors.length} erreur(s).`);

    console.log("\n=======================================================");
    console.log("🎉 SUCCÈS TOTAL DU PARCOURS CHROMIUM SANS ERREUR JS !");
    console.log("=======================================================");
    ws.close();
} catch (e) {
    console.error("❌ Échec de la vérification parcours Chromium :", e);
    process.exitCode = 1;
} finally {
    if (chromeProcess) try { chromeProcess.kill(); } catch (_) {}
    if (serverProcess) try { serverProcess.kill(); } catch (_) {}
}
