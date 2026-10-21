import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const outDir = path.resolve('docs/ui-redesign');
if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
}

// Nettoyer les fichiers de test
['test.png', 'test_screen.png'].forEach(f => {
    const p = path.join(outDir, f);
    if (fs.existsSync(p)) fs.unlinkSync(p);
});

const views = [
    { name: 'bureau', view: 'desktop' },
    { name: 'planning', view: 'planning' },
    { name: 'ecole', view: 'academic' },
    { name: 'langues', view: 'languages' },
    { name: 'vie', view: 'life' },
    { name: 'coach', view: 'chat' },
    { name: 'calendrier', view: 'calendar' },
    { name: 'portfolio', view: 'portfolio' },
    { name: 'focus', view: 'focus' },
    { name: 'bilan', view: 'bilan' },
    { name: 'hebdo', view: 'weekly' },
    { name: 'dashboard', view: 'dashboard' }
];

async function captureAll() {
    const tmpDir = 'C:\\Users\\HP\\AppData\\Local\\Temp\\chrome_capture_suite';
    const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
        '--headless=new',
        '--no-sandbox',
        '--disable-gpu',
        '--user-data-dir=' + tmpDir,
        '--remote-debugging-port=9333',
        '--window-size=1440,900'
    ]);

    await new Promise(r => setTimeout(r, 2000));

    console.log('Connexion à Chrome headless...');
    const tabRes = await fetch('http://127.0.0.1:9333/json/new?http://127.0.0.1:8125/', { method: 'PUT' });
    const tab = await tabRes.json();

    const ws = new WebSocket(tab.webSocketDebuggerUrl);
    await new Promise(r => ws.onopen = r);

    let id = 1;
    const send = (method, params = {}) => new Promise((resolve, reject) => {
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
        ws.send(JSON.stringify({ id: msgId, method, params }));
    });

    await send('Page.enable');
    // Attendre que l'application et Bootstrap soient prêts
    await new Promise(r => setTimeout(r, 2500));

    for (const v of views) {
        console.log(`\nCapture de : ${v.name} (${v.view})`);
        
        // 1. Basculer la vue
        await send('Runtime.evaluate', {
            expression: `window.app ? window.app.renderView('${v.view}') : null`,
            awaitPromise: true
        });
        await new Promise(r => setTimeout(r, 600));

        // 2. Largeur 1440px
        await send('Emulation.setDeviceMetricsOverride', {
            width: 1440,
            height: 900,
            deviceScaleFactor: 1,
            mobile: false
        });
        await new Promise(r => setTimeout(r, 300));
        const shot1440 = await send('Page.captureScreenshot', { format: 'png' });
        fs.writeFileSync(path.join(outDir, `${v.name}_avant_1440.png`), Buffer.from(shot1440.data, 'base64'));
        console.log(`  ✅ ${v.name}_avant_1440.png (${Math.round(shot1440.data.length / 1024)} Ko)`);

        // 3. Largeur 390px (mobile)
        await send('Emulation.setDeviceMetricsOverride', {
            width: 390,
            height: 844,
            deviceScaleFactor: 1,
            mobile: true
        });
        await new Promise(r => setTimeout(r, 300));
        const shot390 = await send('Page.captureScreenshot', { format: 'png' });
        fs.writeFileSync(path.join(outDir, `${v.name}_avant_390.png`), Buffer.from(shot390.data, 'base64'));
        console.log(`  ✅ ${v.name}_avant_390.png (${Math.round(shot390.data.length / 1024)} Ko)`);
    }

    ws.close();
    chrome.kill();
    console.log('\n🎉 Toutes les captures "AVANT" sont terminées !');
}

captureAll().catch(console.error);
