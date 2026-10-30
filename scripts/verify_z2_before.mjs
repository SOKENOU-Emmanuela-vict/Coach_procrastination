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
    console.log("⚠️ Chrome introuvable : capture passée proprement.");
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
        '--remote-debugging-port=9223',
        '--disable-gpu',
        '--no-sandbox',
        '--window-size=1280,800'
    ]);

    await new Promise(r => setTimeout(r, 1500));

    const targets = await new Promise((res, rej) => {
        http.get('http://127.0.0.1:9223/json', resp => {
            let data = '';
            resp.on('data', c => data += c);
            resp.on('end', () => res(JSON.parse(data)));
        }).on('error', rej);
    });

    const pageTarget = targets.find(t => t.type === 'page') || targets[0];
    const wsUrl = pageTarget.webSocketDebuggerUrl;

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

    await send('Page.navigate', { url: 'http://127.0.0.1:8125/#academic' });
    await new Promise(r => setTimeout(r, 2000));

    // Click block tab 1 (Projets & Stages)
    await send('Runtime.evaluate', {
        expression: `(() => {
            const tab = document.querySelector('.academic-block-tab[data-id="1"]');
            if (tab) tab.click();
        })()`,
        returnByValue: true
    });
    await new Promise(r => setTimeout(r, 800));

    const shot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(DOCS_DIR, 'z2_projets_stages_before.png'), Buffer.from(shot.data, 'base64'));
    console.log("✅ Capture avant enregistrée : docs/restructuration/z2_projets_stages_before.png");

    ws.close();
} catch (e) {
    console.error("Erreur capture avant :", e);
} finally {
    if (chromeProcess) try { chromeProcess.kill(); } catch (_) {}
    if (serverProcess) try { serverProcess.kill(); } catch (_) {}
}
