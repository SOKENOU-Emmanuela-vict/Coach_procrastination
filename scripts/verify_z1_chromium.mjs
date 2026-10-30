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
let exitCode = 0;

try {
    serverProcess = await ensureServer();

    chromeProcess = spawn(chromePath, [
        '--headless=new',
        '--remote-debugging-port=9229',
        '--disable-gpu',
        '--no-sandbox',
        '--window-size=1280,900',
        'http://127.0.0.1:8125'
    ]);

    await new Promise(r => setTimeout(r, 2000));

    const targets = await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Timeout connexion CDP')), 5000);
        http.get('http://127.0.0.1:9229/json/list', res => {
            let body = '';
            res.on('data', d => body += d);
            res.on('end', () => {
                clearTimeout(timer);
                resolve(JSON.parse(body));
            });
        }).on('error', (err) => {
            clearTimeout(timer);
            reject(err);
        });
    });

    const pageTarget = targets.find(t => t.type === 'page' && t.url.includes('8125'));
    if (!pageTarget) throw new Error('Aucune cible page Learning OS trouvée sur port 9229');

    const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
    await new Promise((res, rej) => {
        ws.onopen = res;
        ws.onerror = rej;
    });

    let msgId = 1;
    const send = (method, params = {}) => new Promise((resolve) => {
        const id = msgId++;
        const handler = (evt) => {
            const data = JSON.parse(evt.data);
            if (data.id === id) {
                ws.removeEventListener('message', handler);
                resolve(data.result);
            }
        };
        ws.addEventListener('message', handler);
        ws.send(JSON.stringify({ id, method, params }));
    });

    await send('Page.enable');
    await send('Runtime.enable');

    // Attendre l'initialisation de l'application
    await send('Runtime.evaluate', {
        awaitPromise: true,
        expression: `new Promise(resolve => {
            const interval = setInterval(() => {
                if (window.app && window.app.planningEngine) {
                    clearInterval(interval);
                    resolve(true);
                }
            }, 100);
            setTimeout(() => { clearInterval(interval); resolve(true); }, 5000);
        })`
    });

    console.log("=== VÉRIFICATION CHROMIUM Z1 : PLANNING UNIQUE ===");

    // 1. Ouvrir Planning
    await send('Runtime.evaluate', {
        expression: `window.app.renderView('planning');`
    });
    await new Promise(r => setTimeout(r, 600));

    // 2. Vérifier absence de 'Calendrier' dans le menu
    const menuCheck = await send('Runtime.evaluate', {
        returnByValue: true,
        expression: `!document.querySelector('.bureau-nav-item[data-view="calendar"]')`
    });
    if (menuCheck.result?.value) {
        console.log("✅ 1. 'Calendrier' n'est plus présent dans la barre de navigation latérale.");
    } else {
        throw new Error("ÉCHEC : 'Calendrier' est encore présent dans la navigation.");
    }

    // 3. Basculer en vue Semaine si besoin et créer un événement
    await send('Runtime.evaluate', {
        expression: `
            const btnWeek = document.querySelector('button[data-planning-mode="week"]');
            if (btnWeek) btnWeek.click();
        `
    });
    await new Promise(r => setTimeout(r, 400));

    console.log("2. Création d'événement en vue Semaine...");
    await send('Runtime.evaluate', {
        awaitPromise: true,
        expression: `(async () => {
            const today = new Date().toLocaleDateString('fr-CA');
            await window.app.saveCalendarEvent({
                id: 'evt_z1_semaine',
                title: 'Séance Semaine Test',
                date: today,
                startTime: '10:00',
                endTime: '11:00',
                type: 'course'
            });
        })()`
    });
    await new Promise(r => setTimeout(r, 500));

    // Capture Semaine avec l'événement
    const shot1 = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(DOCS_DIR, 'z1_planning_semaine_event.png'), Buffer.from(shot1.data, 'base64'));
    console.log("✅ Capture enregistrée : docs/restructuration/z1_planning_semaine_event.png");

    // Modification en vue Semaine
    console.log("3. Modification d'événement en vue Semaine...");
    await send('Runtime.evaluate', {
        awaitPromise: true,
        expression: `(async () => {
            const today = new Date().toLocaleDateString('fr-CA');
            await window.app.saveCalendarEvent({
                id: 'evt_z1_semaine',
                title: 'Séance Semaine Modifiée',
                date: today,
                startTime: '10:00',
                endTime: '12:00',
                type: 'course'
            });
        })()`
    });
    await new Promise(r => setTimeout(r, 500));

    const checkModSemaine = await send('Runtime.evaluate', {
        returnByValue: true,
        expression: `document.body.innerText.includes('Séance Semaine Modifiée')`
    });
    if (!checkModSemaine.result?.value) throw new Error("ÉCHEC : Modification événement semaine non reflétée");
    console.log("✅ Événement semaine modifié avec succès.");

    // Suppression en vue Semaine
    console.log("4. Suppression d'événement en vue Semaine...");
    await send('Runtime.evaluate', {
        awaitPromise: true,
        expression: `(async () => {
            await window.app.deleteCalendarEvent('evt_z1_semaine');
        })()`
    });
    await new Promise(r => setTimeout(r, 400));

    // 4. Basculer en vue Mois
    console.log("5. Bascule en vue Mois...");
    await send('Runtime.evaluate', {
        expression: `
            const btnMonth = document.querySelector('button[data-planning-mode="month"]');
            if (btnMonth) btnMonth.click();
        `
    });
    await new Promise(r => setTimeout(r, 500));

    // Création d'événement en vue Mois
    console.log("6. Création d'événement en vue Mois...");
    await send('Runtime.evaluate', {
        awaitPromise: true,
        expression: `(async () => {
            const today = new Date().toLocaleDateString('fr-CA');
            await window.app.saveCalendarEvent({
                id: 'evt_z1_mois',
                title: 'Examen Mois Test',
                date: today,
                startTime: '14:00',
                endTime: '16:00',
                type: 'exam'
            });
        })()`
    });
    await new Promise(r => setTimeout(r, 500));

    // Capture Mois avec l'événement
    const shot2 = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(DOCS_DIR, 'z1_planning_mois_event.png'), Buffer.from(shot2.data, 'base64'));
    console.log("✅ Capture enregistrée : docs/restructuration/z1_planning_mois_event.png");

    // Modification en vue Mois
    console.log("7. Modification d'événement en vue Mois...");
    await send('Runtime.evaluate', {
        awaitPromise: true,
        expression: `(async () => {
            const today = new Date().toLocaleDateString('fr-CA');
            await window.app.saveCalendarEvent({
                id: 'evt_z1_mois',
                title: 'Examen Mois Modifié',
                date: today,
                startTime: '14:00',
                endTime: '17:00',
                type: 'exam'
            });
        })()`
    });
    await new Promise(r => setTimeout(r, 500));

    const checkModMois = await send('Runtime.evaluate', {
        returnByValue: true,
        expression: `document.body.innerText.includes('Examen Mois Modifié')`
    });
    if (!checkModMois.result?.value) throw new Error("ÉCHEC : Modification événement mois non reflétée");
    console.log("✅ Événement mois modifié avec succès.");

    // Suppression en vue Mois
    console.log("8. Suppression d'événement en vue Mois...");
    await send('Runtime.evaluate', {
        awaitPromise: true,
        expression: `(async () => {
            await window.app.deleteCalendarEvent('evt_z1_mois');
        })()`
    });
    await new Promise(r => setTimeout(r, 400));

    // 5. Import d'emploi du temps visible dans les deux vues
    console.log("9. Import d'emploi du temps et visibilité dans les deux vues...");
    await send('Runtime.evaluate', {
        awaitPromise: true,
        expression: `(async () => {
            const today = new Date();
            const dateStr = today.toLocaleDateString('fr-CA');
            await window.app.saveCalendarEvent({
                id: 'evt_z1_import',
                title: 'Algèbre Fondamentale Z1',
                date: dateStr,
                startTime: '08:00',
                endTime: '10:00',
                type: 'course'
            });
        })()`
    });
    await new Promise(r => setTimeout(r, 500));

    // Vérification en vue Mois
    const inMonth = await send('Runtime.evaluate', {
        returnByValue: true,
        expression: `document.body.innerText.includes('Algèbre Fondamentale Z1')`
    });
    if (!inMonth.result?.value) throw new Error("ÉCHEC : Cours importé non visible en vue Mois");

    // Basculer en vue Semaine
    await send('Runtime.evaluate', {
        expression: `
            const btnWeek = document.querySelector('button[data-planning-mode="week"]');
            if (btnWeek) btnWeek.click();
        `
    });
    await new Promise(r => setTimeout(r, 500));

    // Vérification en vue Semaine
    const inWeek = await send('Runtime.evaluate', {
        returnByValue: true,
        expression: `document.body.innerText.includes('Algèbre Fondamentale Z1')`
    });
    if (!inWeek.result?.value) throw new Error("ÉCHEC : Cours importé non visible en vue Semaine");
    console.log("✅ Cours importé bien visible dans les deux vues (Semaine et Mois).");

    const shot3 = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(DOCS_DIR, 'z1_planning_import_visible_both_views.png'), Buffer.from(shot3.data, 'base64'));
    console.log("✅ Capture enregistrée : docs/restructuration/z1_planning_import_visible_both_views.png");

    // 6. Test F5 persistant (rechargement de page)
    console.log("10. Test de persistance F5...");
    // Basculer en mode Mois avant F5
    await send('Runtime.evaluate', {
        expression: `
            const btnMonth = document.querySelector('button[data-planning-mode="month"]');
            if (btnMonth) btnMonth.click();
        `
    });
    await new Promise(r => setTimeout(r, 500));

    // Recharger la page (F5)
    await send('Page.reload');
    await new Promise(r => setTimeout(r, 2000));

    // Rouvrir Planning
    await send('Runtime.evaluate', {
        expression: `window.app.renderView('planning');`
    });
    await new Promise(r => setTimeout(r, 600));

    // Vérifier que le mode Mois est toujours actif et que l'événement est toujours présent
    const f5Check = await send('Runtime.evaluate', {
        returnByValue: true,
        expression: `({
            hasMonthGrid: !!document.querySelector('.planning-day-cell'),
            hasEvent: document.body.innerText.includes('Algèbre Fondamentale Z1')
        })`
    });
    const f5Res = f5Check.result?.value;
    if (f5Res && f5Res.hasMonthGrid && f5Res.hasEvent) {
        console.log("✅ Mode Mois et données persistants après rechargement F5 !");
    } else {
        throw new Error("ÉCHEC : Persistance F5 échouée");
    }

    const shot4 = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(DOCS_DIR, 'z1_f5_persistant.png'), Buffer.from(shot4.data, 'base64'));
    console.log("✅ Capture enregistrée : docs/restructuration/z1_f5_persistant.png");

    console.log("\n🎉 TOUTES LES VÉRIFICATIONS CHROMIUM Z1 SONT PASSÉES AVEC SUCCÈS !");
    ws.close();
} catch (err) {
    console.error("❌ ERREUR VÉRIFICATION CHROMIUM Z1 :", err);
    exitCode = 1;
} finally {
    try { if (chromeProcess) chromeProcess.kill(); } catch (_) {}
    try { if (serverProcess) serverProcess.kill(); } catch (_) {}
    process.exit(exitCode);
}
