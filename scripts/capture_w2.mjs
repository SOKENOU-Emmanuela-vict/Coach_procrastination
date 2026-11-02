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

    const port = 9362;
    const testProfile = path.join(process.env.TEMP || '', 'chrome-w2-profile-' + Date.now());

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
        await send('Page.navigate', { url: 'http://127.0.0.1:8125/' });

        // Wait for app ready
        for (let i = 0; i < 30; i++) {
            await delay(500);
            const check = await send('Runtime.evaluate', {
                expression: `!!(window.app && window.app.renderView)`,
                returnByValue: true
            });
            if (check.result?.value) break;
        }

        const outDir = path.resolve('docs/finitions');
        if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

        // 1. Preload data for Langues, Focus & Life via window.app
        await send('Runtime.evaluate', {
            expression: `(async () => {
                // Langue
                if (window.app.languageEngine) {
                    await window.app.languageEngine.saveLanguage({
                        id: 'lang_demo',
                        name: 'Anglais',
                        level: 'B2',
                        goal: 'Objectif TOEIC 850'
                    });
                    await window.app.languageEngine.addResource('lang_demo', {
                        title: 'BBC Learning English',
                        type: 'video',
                        value: 'https://bbc.co.uk/learningenglish'
                    });
                    await window.app.languageEngine.updateTracking('lang_demo', { sessions: 4, minutes: 120, vocab: 45 });
                }

                // Focus history
                if (window.app.studyRecordEngine) {
                    await window.app.studyRecordEngine.completeSession(
                        { id: 'sess_demo_1', title: 'Révision IA & Algorithmique', expectedDuration: 45, difficulty: '🟢' },
                        {
                            status: 'completed',
                            actualDuration: 45,
                            difficulty: '🟢',
                            quality: 5,
                            reflection: 'Session très productive sur les arbres binaires',
                            proof: {
                                type: 'Capture',
                                title: 'Capture de code',
                                description: 'Arbres de décision validés',
                                image: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
                            }
                        },
                        '2026-11-02'
                    );
                }

                // Quick life data
                await window.app.saveQuickCheckInField('water', 6);
                await window.app.saveQuickCheckInField('sleep', { durationMinutes: 480, quality: 'good' });
                await window.app.saveQuickCheckInField('energyLevel', 4);
                await window.app.saveQuickCheckInField('energy', 'high');
                await window.app.saveQuickCheckInField('activity', { title: 'Course à pied', durationMinutes: 30 });
                await window.app.saveQuickCheckInField('dayAssessment', 'Complétée comme prévu');
            })()`,
            awaitPromise: true
        });

        // 2. Capture Langues
        console.log("Navigating to Langues...");
        await send('Runtime.evaluate', { expression: `window.app.renderView('languages')`, awaitPromise: true });
        await delay(1200);
        let shot = await send('Page.captureScreenshot', { format: 'png' });
        fs.writeFileSync(path.join(outDir, 'w2_langues_crud.png'), Buffer.from(shot.data, 'base64'));
        console.log("Captured docs/finitions/w2_langues_crud.png");

        // 3. Capture Focus (avec historique)
        console.log("Navigating to Focus...");
        await send('Runtime.evaluate', { expression: `window.app.renderView('focus')`, awaitPromise: true });
        await delay(1200);
        shot = await send('Page.captureScreenshot', { format: 'png' });
        fs.writeFileSync(path.join(outDir, 'w2_focus_history.png'), Buffer.from(shot.data, 'base64'));
        console.log("Captured docs/finitions/w2_focus_history.png");

        // 4. Capture Vie (Fitness & Bien-être avec valeurs renseignées)
        console.log("Navigating to Vie...");
        await send('Runtime.evaluate', { expression: `window.app.renderView('life')`, awaitPromise: true });
        await delay(1200);
        shot = await send('Page.captureScreenshot', { format: 'png' });
        fs.writeFileSync(path.join(outDir, 'w2_life_wellbeing.png'), Buffer.from(shot.data, 'base64'));
        console.log("Captured docs/finitions/w2_life_wellbeing.png");

        // 5. Capture Bilan (avec boutons modifier et supprimer)
        console.log("Navigating to Bilan...");
        await send('Runtime.evaluate', { expression: `window.app.renderView('bilan')`, awaitPromise: true });
        await delay(1200);
        shot = await send('Page.captureScreenshot', { format: 'png' });
        fs.writeFileSync(path.join(outDir, 'w2_bilan_edit.png'), Buffer.from(shot.data, 'base64'));
        console.log("Captured docs/finitions/w2_bilan_edit.png");

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
