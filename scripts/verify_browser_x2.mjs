import { spawn } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';

const ARTIFACT_DIR = 'C:\\Users\\HP\\.gemini\\antigravity\\brain\\d069e758-d031-41ef-85cc-669bd3238cc3';

const serverProcess = spawn('node', ['server.js'], { cwd: process.cwd(), stdio: 'pipe' });
await new Promise(r => setTimeout(r, 1200));

const chromeProcess = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new',
    '--remote-debugging-port=9225',
    '--disable-gpu',
    '--no-sandbox',
    '--window-size=1280,900',
    'http://127.0.0.1:8125'
]);

await new Promise(r => setTimeout(r, 2000));

try {
    const targets = await new Promise((resolve, reject) => {
        http.get('http://127.0.0.1:9225/json/list', res => {
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
    await new Promise(r => setTimeout(r, 2000));

    // Aller sur le Coach Chat
    await send('Runtime.evaluate', {
        expression: `
            const chatNav = document.querySelector('[data-view="chat"]');
            if (chatNav) chatNav.click();
        `
    });
    await new Promise(r => setTimeout(r, 1200));

    // Envoyer "faire mon bilan"
    await send('Runtime.evaluate', {
        expression: `
            const input = document.querySelector('#chat-input-text');
            const btn = document.querySelector('#btn-chat-send');
            if (input && btn) {
                input.value = "faire mon bilan";
                btn.click();
            }
        `
    });
    await new Promise(r => setTimeout(r, 1500));

    // Poser une question hors sujet
    await send('Runtime.evaluate', {
        expression: `
            const input = document.querySelector('#chat-input-text');
            const btn = document.querySelector('#btn-chat-send');
            if (input && btn) {
                input.value = "Quel temps fait-il sur Mars ?";
                btn.click();
            }
        `
    });
    await new Promise(r => setTimeout(r, 2000));

    // Vérifier les messages
    const checkChat = await send('Runtime.evaluate', {
        expression: `Array.from(document.querySelectorAll('.chat-bubble, .message-bubble, div[style*="border-radius"]')).map(el => el.innerText.slice(0, 100)).filter(t => t.length > 5)`
    });
    console.log('Chat bubbles:', JSON.stringify(checkChat.result.value, null, 2));

    const snap = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(ARTIFACT_DIR, 'x2_checkin.png'), Buffer.from(snap.data, 'base64'));
    console.log('Capture sauvegardée : x2_checkin.png');

    ws.close();
} catch (err) {
    console.error('Erreur vérification navigateur X2 :', err);
} finally {
    chromeProcess.kill();
    serverProcess.kill();
}
