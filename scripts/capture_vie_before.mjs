import { spawn } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';

const DOCS_DIR = path.resolve('docs/ui-redesign/u2');
if (!fs.existsSync(DOCS_DIR)) fs.mkdirSync(DOCS_DIR, { recursive: true });

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
if (!chromePath) process.exit(1);

let chromeProcess = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9248',
    '--disable-gpu',
    '--no-sandbox',
    '--window-size=1440,900'
]);

await new Promise(r => setTimeout(r, 1500));

try {
    const targets = await new Promise((res, rej) => {
        http.get('http://127.0.0.1:9248/json', resp => {
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

    await send('Page.navigate', { url: 'http://127.0.0.1:8125/' });
    await new Promise(r => setTimeout(r, 2000));

    await send('Runtime.evaluate', {
        awaitPromise: true,
        expression: `new Promise(resolve => {
            const interval = setInterval(() => {
                if (window.app && window.app.state) {
                    clearInterval(interval);
                    resolve(true);
                }
            }, 100);
            setTimeout(() => { clearInterval(interval); resolve(true); }, 8000);
        })`
    });

    await send('Runtime.evaluate', { expression: `window.app.renderView('life');` });
    await new Promise(r => setTimeout(r, 800));

    const setViewport = async (w, h) => {
        await send('Emulation.setDeviceMetricsOverride', {
            width: w,
            height: h,
            deviceScaleFactor: 1,
            mobile: w <= 500
        });
        await new Promise(r => setTimeout(r, 500));
    };

    const capture = async (filename) => {
        const res = await send('Page.captureScreenshot', { format: 'png' });
        fs.writeFileSync(path.join(DOCS_DIR, filename), Buffer.from(res.data, 'base64'));
        console.log(`✅ Capture avant enregistrée : docs/ui-redesign/u2/${filename}`);
    };

    // 1. Desktop 1440
    await setViewport(1440, 900);
    await new Promise(r => setTimeout(r, 500));
    await capture('vie_avant_1440.png');

    // 2. Mobile 390
    await setViewport(390, 844);
    await new Promise(r => setTimeout(r, 500));
    await capture('vie_avant_390.png');

    ws.close();
} catch (e) {
    console.error("Erreur capture vie avant :", e);
} finally {
    if (chromeProcess) chromeProcess.kill();
}
