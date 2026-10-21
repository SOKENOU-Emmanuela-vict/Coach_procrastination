import { spawn } from 'child_process';

async function checkConsole() {
    const port = 9345 + Math.floor(Math.random() * 50);
    const tmpDir = 'C:\\Users\\HP\\AppData\\Local\\Temp\\chrome_console_' + Date.now();
    const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
        '--headless=new',
        '--no-sandbox',
        '--disable-gpu',
        '--user-data-dir=' + tmpDir,
        `--remote-debugging-port=${port}`,
        '--window-size=1440,900'
    ]);

    await new Promise(r => setTimeout(r, 2000));
    const tabRes = await fetch(`http://127.0.0.1:${port}/json/new?http://127.0.0.1:8125/`, { method: 'PUT' });
    const tab = await tabRes.json();
    const ws = new WebSocket(tab.webSocketDebuggerUrl);
    await new Promise(r => ws.onopen = r);

    const consoleErrors = [];
    const failedRequests = [];

    let id = 1;
    const send = (m, p = {}) => new Promise((resolve, reject) => {
        const msgId = id++;
        const h = (e) => {
            const d = JSON.parse(e.data);
            if (d.id === msgId) {
                ws.removeEventListener('message', h);
                if (d.error) reject(d.error);
                else resolve(d.result);
            }
        };
        ws.addEventListener('message', h);
        ws.send(JSON.stringify({ id: msgId, method: m, params: p }));
    });

    ws.addEventListener('message', (e) => {
        const d = JSON.parse(e.data);
        if (d.method === 'Runtime.consoleAPICalled') {
            if (d.params.type === 'error') {
                consoleErrors.push(d.params.args.map(a => a.value || a.description).join(' '));
            }
        }
        if (d.method === 'Runtime.exceptionThrown') {
            consoleErrors.push(d.params.exceptionDetails.text + ' ' + (d.params.exceptionDetails.exception?.description || ''));
        }
        if (d.method === 'Network.loadingFailed') {
            failedRequests.push(d.params.errorText + ' ' + d.params.type);
        }
    });

    await send('Runtime.enable');
    await send('Network.enable');
    await send('Page.enable');

    await new Promise(r => setTimeout(r, 2500));

    // Test Bureau navigation
    await send('Runtime.evaluate', { expression: 'window.app.renderView("desktop")' });
    await new Promise(r => setTimeout(r, 600));

    // Test École navigation
    await send('Runtime.evaluate', { expression: 'window.app.renderView("academic")' });
    await new Promise(r => setTimeout(r, 600));

    // Test clicking back to Bureau
    await send('Runtime.evaluate', { expression: 'window.app.renderView("desktop")' });
    await new Promise(r => setTimeout(r, 600));

    console.log(`Console Errors: ${consoleErrors.length}`);
    if (consoleErrors.length > 0) {
        consoleErrors.forEach(err => console.log('  ❌ Console Error:', err));
    } else {
        console.log('  ✅ Console is 100% clean, 0 errors!');
    }

    console.log(`Failed Network Requests: ${failedRequests.length}`);
    if (failedRequests.length > 0) {
        failedRequests.forEach(req => console.log('  ⚠️ Failed request:', req));
    } else {
        console.log('  ✅ All resources loaded locally with 0 blocked/failed requests!');
    }

    ws.close();
    chrome.kill();
}

checkConsole().catch(console.error);
