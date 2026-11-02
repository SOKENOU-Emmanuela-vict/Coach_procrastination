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

    const port = 9361;
    const testProfile = path.join(process.env.TEMP || '', 'chrome-w1-profile-' + Date.now());

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

        if (!wsUrl) {
            console.error("Failed to connect to browser CDP");
            return;
        }

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
        await send('Console.enable');

        ws.addEventListener('message', (ev) => {
            const data = JSON.parse(ev.data);
            if (data.method === 'Runtime.consoleAPICalled') {
                console.log('[Browser console]', data.params.args.map(a => a.value || a.description).join(' '));
            } else if (data.method === 'Runtime.exceptionThrown') {
                console.error('[Browser exception]', data.params.exceptionDetails);
            }
        });
        await send('Page.navigate', { url: 'http://127.0.0.1:8125/' });

        // Wait for app
        for (let i = 0; i < 30; i++) {
            await delay(500);
            const check = await send('Runtime.evaluate', {
                expression: `!!(window.app && window.app.renderView)`,
                returnByValue: true
            });
            if (check.result?.value) break;
        }

        await delay(1000);

        // Open profile modal
        console.log("Clicking avatar to open profile modal...");
        await send('Runtime.evaluate', {
            expression: `
                const btn = document.querySelector('#btn-profile');
                if (btn) btn.click();
            `
        });
        await delay(1000);

        // Capture modal
        const outDir = path.resolve('docs/finitions');
        if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

        const modalShot = await send('Page.captureScreenshot', { format: 'png' });
        fs.writeFileSync(path.join(outDir, 'w1_profile_modal.png'), Buffer.from(modalShot.data, 'base64'));
        console.log("Captured docs/finitions/w1_profile_modal.png");

        // Fill in profile and save
        console.log("Filling profile form and saving...");
        await send('Runtime.evaluate', {
            expression: `
                const fn = document.querySelector('#profile-modal-firstname');
                const ln = document.querySelector('#profile-modal-lastname');
                const fl = document.querySelector('#profile-modal-formation');
                if (fn) fn.value = 'Emmanuela';
                if (ln) ln.value = 'Sokenou';
                if (fl) fl.value = 'L2 IA & Big Data';
                const saveBtn = document.querySelector('#btn-profile-modal-save');
                if (saveBtn) saveBtn.click();
            `
        });
        await delay(1500);

        // Check updated greeting & avatar
        const greetingCheck = await send('Runtime.evaluate', {
            expression: `
                ({
                    greeting: document.querySelector('.bureau-greeting-title')?.textContent?.trim() || '',
                    avatar: document.querySelector('#btn-profile')?.textContent?.trim() || ''
                })
            `,
            returnByValue: true
        });
        console.log("Greeting & avatar check:", greetingCheck.result?.value);

        const updatedShot = await send('Page.captureScreenshot', { format: 'png' });
        fs.writeFileSync(path.join(outDir, 'w1_profile_updated.png'), Buffer.from(updatedShot.data, 'base64'));
        console.log("Captured docs/finitions/w1_profile_updated.png");

        // Test F5 reload persistence
        console.log("Reloading page (F5) to test persistence...");
        await send('Page.reload');
        await delay(2500);

        const reloadCheck = await send('Runtime.evaluate', {
            expression: `
                ({
                    greeting: document.querySelector('.bureau-greeting-title')?.textContent?.trim() || '',
                    avatar: document.querySelector('#btn-profile')?.textContent?.trim() || ''
                })
            `,
            returnByValue: true
        });
        console.log("After reload check:", reloadCheck.result?.value);

        ws.close();
    } finally {
        chromeProcess.kill('SIGTERM');
        try { fs.rmSync(testProfile, { recursive: true, force: true }); } catch (_) {}
    }
}

capture().catch(err => {
    console.error("Capture error:", err);
    process.exit(1);
});
