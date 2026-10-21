import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

async function capturePilots() {
    const port = 9340 + Math.floor(Math.random() * 50);
    const tmpDir = 'C:\\Users\\HP\\AppData\\Local\\Temp\\chrome_p_' + Date.now();
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
    // Wait until app is initialized
    await send('Runtime.evaluate', {
        awaitPromise: true,
        expression: `new Promise(resolve => {
            const check = () => {
                if (window.app && window.app.state && document.querySelector('.bureau-content, .bureau')) resolve(true);
                else setTimeout(check, 100);
            };
            check();
        })`
    });
    await new Promise(r => setTimeout(r, 800));

    // Helper to resize viewport
    const setViewport = async (w, h) => {
        await send('Emulation.setDeviceMetricsOverride', {
            width: w,
            height: h,
            deviceScaleFactor: 1,
            mobile: w <= 500
        });
        await new Promise(r => setTimeout(r, 400));
    };

    // Helper to switch view
    const switchView = async (viewName) => {
        await send('Runtime.evaluate', {
            expression: `window.app ? window.app.renderView("${viewName}") : null`
        });
        await new Promise(r => setTimeout(r, 600));
    };

    // Helper to toggle theme
    const setTheme = async (themeName) => {
        await send('Runtime.evaluate', {
            expression: `document.body.className = "${themeName}";`
        });
        await new Promise(r => setTimeout(r, 300));
    };

    const widths = [
        { w: 1440, h: 900, label: '1440' },
        { w: 1024, h: 800, label: '1024' },
        { w: 390, h: 844, label: '390' }
    ];

    // 1. Capture Bureau
    await switchView('desktop');
    await setTheme('theme-light');
    for (const res of widths) {
        await setViewport(res.w, res.h);
        const shot = await send('Page.captureScreenshot', { format: 'png' });
        const filePath = path.resolve(`docs/ui-redesign/bureau_apres_${res.label}.png`);
        fs.writeFileSync(filePath, Buffer.from(shot.data, 'base64'));
        console.log(`Saved ${filePath} (${Math.round(shot.data.length / 1024)} Ko)`);
    }
    // Dark mode at 1440px
    await setViewport(1440, 900);
    await setTheme('theme-dark');
    const darkShotBureau = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.resolve(`docs/ui-redesign/bureau_apres_dark_1440.png`), Buffer.from(darkShotBureau.data, 'base64'));

    // 2. Capture École Vide
    await setTheme('theme-light');
    await switchView('academic');
    for (const res of widths) {
        await setViewport(res.w, res.h);
        const shot = await send('Page.captureScreenshot', { format: 'png' });
        const filePath = path.resolve(`docs/ui-redesign/ecole_apres_${res.label}.png`);
        fs.writeFileSync(filePath, Buffer.from(shot.data, 'base64'));
        console.log(`Saved ${filePath} (${Math.round(shot.data.length / 1024)} Ko)`);
    }
    // Dark mode at 1440px
    await setViewport(1440, 900);
    await setTheme('theme-dark');
    const darkShotEcole = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.resolve(`docs/ui-redesign/ecole_apres_dark_1440.png`), Buffer.from(darkShotEcole.data, 'base64'));

    // 3. Importer les données d'exemple pour École et capturer avec données
    await setTheme('theme-light');
    await send('Runtime.evaluate', {
        expression: `(async () => {
            if (window.app && window.app.importAcademicExample) {
                await window.app.importAcademicExample();
                window.app.renderView("academic");
            }
        })()`
    });
    await new Promise(r => setTimeout(r, 1200));

    for (const res of widths) {
        await setViewport(res.w, res.h);
        const shot = await send('Page.captureScreenshot', { format: 'png' });
        const filePath = path.resolve(`docs/ui-redesign/ecole_donnees_apres_${res.label}.png`);
        fs.writeFileSync(filePath, Buffer.from(shot.data, 'base64'));
        console.log(`Saved ${filePath} (${Math.round(shot.data.length / 1024)} Ko)`);
    }

    // Capture dark mode École avec données
    await setViewport(1440, 900);
    await setTheme('theme-dark');
    const darkShotDonnees = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.resolve(`docs/ui-redesign/ecole_donnees_apres_dark_1440.png`), Buffer.from(darkShotDonnees.data, 'base64'));
    console.log(`Saved docs/ui-redesign/ecole_donnees_apres_dark_1440.png`);

    ws.close();
    chrome.kill();
    console.log('All pilot captures (empty and with data) finished successfully!');
}

capturePilots().catch(console.error);
