import { spawn } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';

function delay(ms) {
    return new Promise(r => setTimeout(r, ms));
}

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

async function run() {
    const chromePath = findChromeExecutable();
    const port = 9355;
    const testProfile = 'C:\\Users\\HP\\AppData\\Local\\Temp\\chrome-persist-view-' + Date.now();

    const chromeProcess = spawn(chromePath, [
        `--remote-debugging-port=${port}`,
        `--user-data-dir=${testProfile}`,
        '--headless=new',
        '--no-sandbox',
        '--disable-gpu',
        '--window-size=1440,900',
        'http://127.0.0.1:8125/'
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

        // Wait for window.app to be defined
        for (let i = 0; i < 20; i++) {
            const check = await send('Runtime.evaluate', {
                expression: `!!(window.app && window.app.renderView && window.app.state)`,
                returnByValue: true
            });
            if (check.result.value) break;
            await delay(500);
        }

        // 1. Switch view to 'chat'
        const navRes = await send('Runtime.evaluate', {
            expression: `(async () => {
                if (window.app && window.app.renderView) {
                    await window.app.renderView('chat');
                    return { success: true, view: window.app.state.currentView };
                }
                return { success: false };
            })()`,
            awaitPromise: true,
            returnByValue: true
        });
        console.log("Navigated to:", navRes.result.value);

        // Verify localStorage saved
        const lsCheck = await send('Runtime.evaluate', {
            expression: `localStorage.getItem('learning_os_current_view')`,
            returnByValue: true
        });
        console.log("localStorage saved view:", lsCheck.result.value);

        // 2. Reload page
        console.log("Reloading page...");
        await send('Page.reload', { ignoreCache: true });
        
        // Wait for window.app to be ready again
        for (let i = 0; i < 20; i++) {
            await delay(500);
            const check = await send('Runtime.evaluate', {
                expression: `!!(window.app && window.app.state && window.app.state.currentView)`,
                returnByValue: true
            });
            if (check.result.value) break;
        }

        // 3. Verify active view after reload
        const afterReload = await send('Runtime.evaluate', {
            expression: `(() => {
                return {
                    currentView: window.app ? window.app.state.currentView : null,
                    isChatVisible: !!document.querySelector('.coach-layout, #chat-input, .coach-messages')
                };
            })()`,
            returnByValue: true
        });
        console.log("After reload state:", afterReload.result.value);

        if (afterReload.result.value.currentView === 'chat') {
            console.log("SUCCESS: View persisted across page reload!");
        } else {
            console.error("FAIL: View did not persist!");
            process.exit(1);
        }

        ws.close();
    } finally {
        chromeProcess.kill('SIGKILL');
        try { fs.rmSync(testProfile, { recursive: true, force: true }); } catch (_) {}
    }
}

run().catch(e => {
    console.error("Test error:", e);
    process.exit(1);
});
