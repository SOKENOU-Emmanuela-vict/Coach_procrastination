import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

async function captureUIKit() {
    const tmpDir = 'C:\\Users\\HP\\AppData\\Local\\Temp\\chrome_uikit';
    const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
        '--headless=new',
        '--no-sandbox',
        '--disable-gpu',
        '--user-data-dir=' + tmpDir,
        '--remote-debugging-port=9333',
        '--window-size=1440,900'
    ]);

    await new Promise(r => setTimeout(r, 2000));
    const tabRes = await fetch('http://127.0.0.1:9333/json/new?http://127.0.0.1:8125/ui-kit.html', { method: 'PUT' });
    const tab = await tabRes.json();
    const ws = new WebSocket(tab.webSocketDebuggerUrl);
    await new Promise(r => ws.onopen = r);

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

    await send('Page.enable');
    await new Promise(r => setTimeout(r, 1200));

    const universes = ['bureau', 'ecole', 'vie', 'langues'];
    for (const u of universes) {
        await send('Runtime.evaluate', { expression: `setUnivers("${u}")` });
        await new Promise(r => setTimeout(r, 400));
        const shot = await send('Page.captureScreenshot', { format: 'png' });
        fs.writeFileSync(path.resolve(`docs/ui-redesign/uikit_${u}_1440.png`), Buffer.from(shot.data, 'base64'));
        console.log(`Saved docs/ui-redesign/uikit_${u}_1440.png (${Math.round(shot.data.length / 1024)} Ko)`);
    }

    // Capture dark mode for École and Bureau
    await send('Runtime.evaluate', { expression: 'setUnivers("ecole"); toggleTheme();' });
    await new Promise(r => setTimeout(r, 400));
    const shotDark = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.resolve('docs/ui-redesign/uikit_ecole_dark_1440.png'), Buffer.from(shotDark.data, 'base64'));
    console.log(`Saved docs/ui-redesign/uikit_ecole_dark_1440.png (${Math.round(shotDark.data.length / 1024)} Ko)`);

    ws.close();
    chrome.kill();
    console.log('UI Kit captures finished successfully!');
}

captureUIKit().catch(console.error);
