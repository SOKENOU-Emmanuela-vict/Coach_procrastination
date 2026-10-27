import { spawn } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';

const ARTIFACT_DIR = 'C:\\Users\\HP\\.gemini\\antigravity\\brain\\d069e758-d031-41ef-85cc-669bd3238cc3';

// 1. Démarrer le serveur HTTP local sur le port 8125
const serverProcess = spawn('node', ['server.js'], {
    cwd: process.cwd(),
    stdio: 'pipe'
});

await new Promise(r => setTimeout(r, 1200));

// 2. Démarrer Chrome headless avec port CDP 9223
const chromeProcess = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new',
    '--remote-debugging-port=9223',
    '--disable-gpu',
    '--no-sandbox',
    '--window-size=1280,900',
    'http://127.0.0.1:8125'
]);

await new Promise(r => setTimeout(r, 2000));

try {
    // Obtenir la page cible depuis http://127.0.0.1:9223/json/list
    const targets = await new Promise((resolve, reject) => {
        http.get('http://127.0.0.1:9223/json/list', res => {
            let body = '';
            res.on('data', d => body += d);
            res.on('end', () => resolve(JSON.parse(body)));
        }).on('error', reject);
    });

    const pageTarget = targets.find(t => t.type === 'page');
    if (!pageTarget) throw new Error('Aucune cible de type page trouvée');

    const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
    await new Promise(res => ws.onopen = res);

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

    // Attendre 2 secondes que l'application s'initialise
    await new Promise(r => setTimeout(r, 2000));

    const checkDom = await send('Runtime.evaluate', {
        expression: `({
            sidebar: document.querySelector('.bureau-sidebar') ? document.querySelector('.bureau-sidebar').innerText.replace(/\\s+/g, ' ') : 'NO SIDEBAR',
            dataViews: Array.from(document.querySelectorAll('[data-view]')).map(el => el.getAttribute('data-view')),
            hasBtnCourse: !!document.querySelector('#btn-desktop-course')
        })`,
        returnByValue: true
    });
    console.log('DOM check:', JSON.stringify(checkDom.result.value, null, 2));

    // Capture 1 : Bureau avec la nouvelle sidebar complète
    const snap1 = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(ARTIFACT_DIR, 'x1_bureau.png'), Buffer.from(snap1.data, 'base64'));
    console.log('Capture 1 sauvegardée : x1_bureau.png');

    // Clic sur bouton démarrer une session
    const clickFocusRes = await send('Runtime.evaluate', {
        expression: `
            const btn = document.querySelector('#btn-desktop-course');
            if (btn) { btn.click(); 'CLICKED'; } else 'NOT_FOUND';
        `
    });
    console.log('Click focus result:', clickFocusRes.result.value);
    await new Promise(r => setTimeout(r, 1200));

    const focusCheck = await send('Runtime.evaluate', {
        expression: `document.body.innerText.slice(0, 150).replace(/\\s+/g, ' ')`
    });
    console.log('Focus view text:', focusCheck.result.value);

    // Capture 2 : Mode Focus
    const snap2 = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(ARTIFACT_DIR, 'x1_focus.png'), Buffer.from(snap2.data, 'base64'));
    console.log('Capture 2 sauvegardée : x1_focus.png');

    // Clic retour vers Calendrier
    await send('Runtime.evaluate', {
        expression: `
            const btnCal = document.querySelector('[data-view="calendar"]') || document.querySelector('#btn-focus-desktop');
            if (btnCal) btnCal.click();
        `
    });
    await new Promise(r => setTimeout(r, 1200));

    // Naviguer explicitement vers le calendrier si pas encore fait
    await send('Runtime.evaluate', {
        expression: `
            const calNav = document.querySelector('[data-view="calendar"]');
            if (calNav) calNav.click();
        `
    });
    await new Promise(r => setTimeout(r, 1200));

    const calCheck = await send('Runtime.evaluate', {
        expression: `document.body.innerText.slice(0, 150).replace(/\\s+/g, ' ')`
    });
    console.log('Calendar view text:', calCheck.result.value);

    // Capture 3 : Vue Calendrier
    const snap3 = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(ARTIFACT_DIR, 'x1_calendar.png'), Buffer.from(snap3.data, 'base64'));
    console.log('Capture 3 sauvegardée : x1_calendar.png');

    ws.close();
} catch (err) {
    console.error('Erreur vérification navigateur :', err);
} finally {
    chromeProcess.kill();
    serverProcess.kill();
}
