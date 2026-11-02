import { spawn } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

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

async function capture() {
    const chromePath = findChromeExecutable();
    if (!chromePath) {
        console.log("No browser found, skipping capture cleanly");
        return;
    }

    const port = 9360;
    const testProfile = path.join(process.env.TEMP || '', 'chrome-w0-profile-' + Date.now());

    const chromeProcess = spawn(chromePath, [
        `--remote-debugging-port=${port}`,
        `--user-data-dir=${testProfile}`,
        '--headless=new',
        '--no-sandbox',
        '--disable-gpu',
        '--window-size=1440,900'
    ]);

    try {
        let wsUrl = '';
        for (let i = 0; i < 30; i++) {
            await delay(500);
            try {
                const res = await new Promise((resolve, reject) => {
                    http.get(`http://127.0.0.1:${port}/json`, (r) => {
                        let data = '';
                        r.on('data', chunk => data += chunk);
                        r.on('end', () => resolve(JSON.parse(data)));
                    }).on('error', reject);
                });
                const pageTarget = res.find(t => t.type === 'page') || res[0];
                if (pageTarget && pageTarget.webSocketDebuggerUrl) {
                    wsUrl = pageTarget.webSocketDebuggerUrl;
                    break;
                }
            } catch (_) {}
        }

        if (!wsUrl) throw new Error("Could not connect to Chrome CDP");

        const ws = new globalThis.WebSocket(wsUrl);
        await new Promise((resolve, reject) => {
            ws.onopen = resolve;
            ws.onerror = reject;
        });

        let id = 1;
        function send(method, params = {}) {
            return new Promise((resolve, reject) => {
                const curId = id++;
                const handler = (event) => {
                    const parsed = JSON.parse(event.data);
                    if (parsed.id === curId) {
                        ws.removeEventListener('message', handler);
                        if (parsed.error) reject(parsed.error);
                        else resolve(parsed.result);
                    }
                };
                ws.addEventListener('message', handler);
                ws.send(JSON.stringify({ id: curId, method, params }));
            });
        }

        await send('Runtime.enable');
        await send('Page.enable');
        await send('Page.navigate', { url: 'http://127.0.0.1:8125/' });

        // Wait for app
        for (let i = 0; i < 30; i++) {
            await delay(500);
            const check = await send('Runtime.evaluate', {
                expression: `!!(window.app && window.app.renderView)`,
                returnByValue: true
            });
            if (check.result.value) break;
        }

        // Navigate to coach
        await send('Runtime.evaluate', {
            expression: `window.app.renderView('chat')`,
            awaitPromise: true
        });
        await delay(1000);

        // Click Clé IA button
        await send('Runtime.evaluate', {
            expression: `(() => {
                const btn = document.querySelector('#btn-coach-api-key');
                if (btn) btn.click();
            })()`
        });
        await delay(1000);

        // Ensure target folder exists
        const outDir = path.join(process.cwd(), 'docs', 'finitions');
        if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

        // Capture screenshot
        const screenshot = await send('Page.captureScreenshot', { format: 'png' });
        fs.writeFileSync(path.join(outDir, 'w0_api_key_modal.png'), Buffer.from(screenshot.data, 'base64'));
        console.log("Screenshot saved to docs/finitions/w0_api_key_modal.png");

        ws.close();
    } finally {
        chromeProcess.kill('SIGKILL');
        try { fs.rmSync(testProfile, { recursive: true, force: true }); } catch (_) {}
    }
}

capture().catch(e => {
    console.error("Capture error:", e);
    process.exit(1);
});
