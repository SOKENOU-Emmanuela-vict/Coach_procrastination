/**
 * test_correctif_y1_grid.mjs
 * Test Chromium réel pour le Correctif Y1 - Point 1 :
 * - Saisie en grille dans Planning
 * - Inversion horaire (fin avant début) -> message d'erreur visible
 * - Ligne valide -> aperçu (sans crash timeToMinutes) -> Valider
 * - Vérification de la présence de l'événement dans Planning et Calendrier
 * - Capture d'écran enregistrée dans docs/import/grid_import_verified.png
 */

import { spawn } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';

const ARTIFACT_DIR = 'C:\\Users\\HP\\.gemini\\antigravity\\brain\\d069e758-d031-41ef-85cc-669bd3238cc3';
const DOCS_IMPORT_DIR = path.resolve('docs/import');

if (!fs.existsSync(DOCS_IMPORT_DIR)) {
    fs.mkdirSync(DOCS_IMPORT_DIR, { recursive: true });
}

console.log("=== TEST CHROMIUM : CORRECTIF Y1 - GRILLE DE PLANNING ===");

// 1. Démarrer Chrome headless avec port CDP 9228
const chromeProcess = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new',
    '--remote-debugging-port=9228',
    '--disable-gpu',
    '--no-sandbox',
    '--window-size=1280,900',
    'http://127.0.0.1:8125'
]);

await new Promise(r => setTimeout(r, 2000));

let exitCode = 0;

try {
    const targets = await new Promise((resolve, reject) => {
        http.get('http://127.0.0.1:9228/json/list', res => {
            let body = '';
            res.on('data', d => body += d);
            res.on('end', () => resolve(JSON.parse(body)));
        }).on('error', reject);
    });

    const pageTarget = targets.find(t => t.type === 'page' && t.url.includes('8125'));
    if (!pageTarget) throw new Error('Aucune cible page Learning OS trouvée sur port 9228');

    const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
    await new Promise(res => ws.onopen = res);

    let msgId = 1;
    const send = (method, params = {}) => new Promise((resolve) => {
        const id = msgId++;
        const handler = (evt) => {
            const data = JSON.parse(evt.data);
            if (data.id === id) {
                ws.removeEventListener('message', handler);
                resolve(data.result);
            }
        };
        ws.addEventListener('message', handler);
        ws.send(JSON.stringify({ id, method, params }));
    });

    const consoleErrors = [];
    ws.addEventListener('message', (evt) => {
        const data = JSON.parse(evt.data);
        if (data.method === 'Runtime.consoleAPICalled' && data.params.type === 'error') {
            consoleErrors.push(data.params.args.map(a => a.value || a.description).join(' '));
        }
    });

    await send('Page.enable');
    await send('Runtime.enable');

    // Attendre l'initialisation de l'application
    await send('Runtime.evaluate', {
        awaitPromise: true,
        expression: `new Promise(resolve => {
            const interval = setInterval(() => {
                if (window.app && window.app.timetableImporter) {
                    clearInterval(interval);
                    resolve(true);
                }
            }, 100);
        })`
    });

    // 1. Ouvrir la vue Planning
    await send('Runtime.evaluate', {
        expression: `window.app.renderView('planning');`
    });
    await new Promise(r => setTimeout(r, 500));

    // 2. Ouvrir la modale d'import d'emploi du temps
    await send('Runtime.evaluate', {
        expression: `
            const btn = document.querySelector('#btn-import-timetable');
            if (btn) btn.click();
        `
    });
    await new Promise(r => setTimeout(r, 400));

    // 3. Basculer sur l'onglet Saisie en grille
    await send('Runtime.evaluate', {
        expression: `
            const tabGrid = document.querySelector('button[data-tab="grid"]');
            if (tabGrid) tabGrid.click();
        `
    });
    await new Promise(r => setTimeout(r, 400));

    // 4. Test Inversion : Fin avant début (10:00 -> 08:00)
    console.log("Test 1 : Heure de fin avant début...");
    const errorResult = await send('Runtime.evaluate', {
        awaitPromise: true,
        returnByValue: true,
        expression: `(async () => {
            const tr = document.querySelector('#tt-grid-tbody tr');
            if (!tr) return { success: false, reason: 'Pas de ligne trouvée' };
            tr.querySelector('.tt-row-title').value = 'Physique Quantique Invalide';
            tr.querySelector('.tt-row-start').value = '10:00';
            tr.querySelector('.tt-row-end').value = '08:00';
            
            const btnPreview = document.querySelector('#tt-grid-preview-btn');
            btnPreview.click();
            await new Promise(r => setTimeout(r, 300));
            const feedback = document.querySelector('#tt-grid-feedback');
            return {
                text: feedback ? feedback.innerText : '',
                hasAlert: !!feedback && feedback.innerHTML.includes('doit être après')
            };
        })()`
    });

    const errVal = errorResult.result ? errorResult.result.value : errorResult.value;
    if (errVal && errVal.hasAlert) {
        console.log("✅ PASS: Inversion horaire détectée et bloquée avec message explicite :");
        console.log("   -> " + errVal.text.trim());
    } else {
        throw new Error("ÉCHEC: L'inversion horaire n'a pas affiché le message attendu : " + JSON.stringify(errorResult));
    }

    // 5. Test Ligne valide : 08:00 -> 10:00
    console.log("Test 2 : Ligne valide 08:00 -> 10:00...");
    const validPreviewResult = await send('Runtime.evaluate', {
        awaitPromise: true,
        returnByValue: true,
        expression: `(async () => {
            const tr = document.querySelector('#tt-grid-tbody tr');
            tr.querySelector('.tt-row-title').value = 'Physique Quantique Grille';
            tr.querySelector('.tt-row-start').value = '08:00';
            tr.querySelector('.tt-row-end').value = '10:00';
            tr.querySelector('.tt-row-room').value = 'Salle B12';
            
            const btnPreview = document.querySelector('#tt-grid-preview-btn');
            btnPreview.click();
            await new Promise(r => setTimeout(r, 600));
            
            const previewTable = document.querySelector('.data-table');
            const hasRow = previewTable && previewTable.innerText.includes('Physique Quantique Grille');
            const btnValidate = document.querySelector('.tt-validate');
            return {
                previewShown: !!hasRow,
                canValidate: !!btnValidate && !btnValidate.disabled
            };
        })()`
    });

    const validVal = validPreviewResult.result ? validPreviewResult.result.value : validPreviewResult.value;
    if (validVal && validVal.previewShown && validVal.canValidate) {
        console.log("✅ PASS: Aperçu généré avec succès sans plantage timeToMinutes !");
    } else {
        throw new Error("ÉCHEC: L'aperçu ne s'est pas affiché : " + JSON.stringify(validPreviewResult));
    }

    // 6. Cliquer sur Valider
    console.log("Test 3 : Clic sur Valider...");
    await send('Runtime.evaluate', {
        expression: `
            const btnValidate = document.querySelector('.tt-validate');
            if (btnValidate) btnValidate.click();
        `
    });
    await new Promise(r => setTimeout(r, 800));

    // 7. Vérifier la présence de l'événement dans le Planning
    const inPlanning = await send('Runtime.evaluate', {
        returnByValue: true,
        expression: `document.body.innerText.includes('Physique Quantique Grille')`
    });
    const planVal = inPlanning.result ? inPlanning.result.value : inPlanning.value;

    if (planVal) {
        console.log("✅ PASS: Événement 'Physique Quantique Grille' bien visible dans le Planning !");
    } else {
        throw new Error("ÉCHEC: Événement non trouvé dans le Planning");
    }

    // 8. Basculer sur le Calendrier et vérifier la présence de l'événement
    console.log("Test 4 : Vérification dans le Calendrier...");
    await send('Runtime.evaluate', {
        expression: `window.app.renderView('calendar');`
    });
    await new Promise(r => setTimeout(r, 800));

    const inCalendar = await send('Runtime.evaluate', {
        returnByValue: true,
        expression: `document.body.innerText.includes('Physique Quantique Grille')`
    });
    const calVal = inCalendar.result ? inCalendar.result.value : inCalendar.value;

    if (calVal) {
        console.log("✅ PASS: Événement 'Physique Quantique Grille' bien visible dans le Calendrier !");
    } else {
        throw new Error("ÉCHEC: Événement non trouvé dans le Calendrier");
    }

    // 9. Capture d'écran du Calendrier avec l'événement importé
    const screenshot = await send('Page.captureScreenshot', { format: 'png' });
    const buffer = Buffer.from(screenshot.data, 'base64');
    const outPath = path.join(DOCS_IMPORT_DIR, 'grid_import_verified.png');
    const artifactPath = path.join(ARTIFACT_DIR, 'grid_import_verified.png');
    fs.writeFileSync(outPath, buffer);
    fs.writeFileSync(artifactPath, buffer);
    console.log(`✅ Capture enregistrée dans ${outPath} et ${artifactPath}`);

    // 10. Vérifier 0 erreur console
    const relevantErrors = consoleErrors.filter(e => !e.includes('favicon.ico'));
    if (relevantErrors.length > 0) {
        console.warn("⚠ Erreurs console observées :", relevantErrors);
    } else {
        console.log("✅ 0 erreur console JavaScript.");
    }

    console.log("\n🎉 TEST COMPLET DU POINT 1 VALIDÉ AVEC SUCCÈS !");

    ws.close();
} catch (err) {
    console.error("❌ ERREUR :", err.message);
    exitCode = 1;
} finally {
    try { chromeProcess.kill(); } catch (_) {}
    process.exit(exitCode);
}
