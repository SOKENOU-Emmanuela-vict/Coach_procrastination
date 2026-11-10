import { spawn } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';

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

const chromePath = findChromeExecutable();
if (!chromePath) {
    console.error('Aucun navigateur Chromium trouvé');
    process.exit(1);
}

const port = 9334;
let chromeProcess = spawn(chromePath, [
    '--headless=new',
    `--remote-debugging-port=${port}`,
    '--disable-gpu',
    '--no-sandbox',
    '--window-size=1400,1650'
]);

await new Promise(r => setTimeout(r, 1500));

try {
    const targets = await new Promise((res, rej) => {
        http.get(`http://127.0.0.1:${port}/json`, resp => {
            let data = '';
            resp.on('data', c => data += c);
            resp.on('end', () => res(JSON.parse(data)));
        }).on('error', rej);
    });

    const pageTarget = targets.find(t => t.type === 'page') || targets[0];
    const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

    let msgId = 1;
    const send = (method, params = {}) => new Promise(resolve => {
        const id = msgId++;
        const handler = e => {
            const data = JSON.parse(e.data);
            if (data.id === id) {
                ws.removeEventListener('message', handler);
                resolve(data.result);
            }
        };
        ws.addEventListener('message', handler);
        ws.send(JSON.stringify({ id, method, params }));
    });

    await send('Page.enable');
    const targetUrl = 'file:///' + path.resolve('docs/ui-redesign/icons/icon_preview.html').replace(/\\/g, '/');
    console.log('Navigating to', targetUrl);
    await send('Page.navigate', { url: targetUrl });
    await new Promise(r => setTimeout(r, 1500));

    const res = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
    const outPath = path.resolve('docs/ui-redesign/icons/icon_showcase.png');
    fs.writeFileSync(outPath, Buffer.from(res.data, 'base64'));
    console.log('Capture enregistrée dans', outPath);

    // Copie vers l'artifact dir
    const artifactDir = 'C:\\Users\\HP\\.gemini\\antigravity\\brain\\d069e758-d031-41ef-85cc-669bd3238cc3';
    if (fs.existsSync(artifactDir)) {
        const artifactPath = path.join(artifactDir, 'icon_showcase.png');
        fs.copyFileSync(outPath, artifactPath);
        console.log('Capture copiée vers artifact:', artifactPath);
    }

    ws.close();
} catch (err) {
    console.error('Erreur:', err);
} finally {
    try { chromeProcess.kill(); } catch (e) {}
}
