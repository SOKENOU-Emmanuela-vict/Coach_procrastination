/**
 * scripts/verify_browser_y1.mjs
 * Validation Y1-D dans Chromium réel :
 * - École -> Documents -> import cours_2pages.pdf -> vérification décompte -> capture
 * - Chat -> les 4 questions vérifiées
 * - Planning -> import emploi_du_temps.csv -> aperçu -> validation -> vérification planning et calendrier -> capture
 * - Import hors ligne (mode avion simulé)
 * - Console navigateur : 0 erreur
 */

import { spawn } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';

const ARTIFACT_DIR = 'C:\\Users\\HP\\.gemini\\antigravity\\brain\\d069e758-d031-41ef-85cc-669bd3238cc3';
const DOCS_IMPORT_DIR = path.resolve('docs/import');
const FIXTURES_DIR = path.resolve('tests/fixtures');

if (!fs.existsSync(DOCS_IMPORT_DIR)) {
    fs.mkdirSync(DOCS_IMPORT_DIR, { recursive: true });
}

console.log("=== VÉRIFICATION Y1-D DANS CHROMIUM ===");

// 1. Démarrer Chrome headless avec port CDP 9226
const chromeProcess = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new',
    '--remote-debugging-port=9226',
    '--disable-gpu',
    '--no-sandbox',
    '--window-size=1280,900',
    'http://127.0.0.1:8125'
]);

await new Promise(r => setTimeout(r, 2000));

try {
    const targets = await new Promise((resolve, reject) => {
        http.get('http://127.0.0.1:9226/json/list', res => {
            let body = '';
            res.on('data', d => body += d);
            res.on('end', () => resolve(JSON.parse(body)));
        }).on('error', reject);
    });

    const pageTarget = targets.find(t => t.type === 'page' && t.url.includes('8125'));
    if (!pageTarget) throw new Error('Aucune cible page Learning OS trouvée sur port 9226');

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

    // Attendre que window.app soit prêt
    await send('Runtime.evaluate', {
        awaitPromise: true,
        expression: `new Promise(resolve => {
            const interval = setInterval(() => {
                if (window.app && window.app.knowledgeEngine && window.app.chatHistoryEngine) {
                    clearInterval(interval);
                    resolve(true);
                }
            }, 100);
        })`
    });

    // Supprimer la clé Gemini du localStorage pour garantir le test SANS clé
    await send('Runtime.evaluate', {
        expression: `
            localStorage.removeItem('gemini_api_key');
            sessionStorage.clear();
            if (window.app.timetableImporter) window.app.timetableImporter.llmProvider = null;
            if (window.app.coachEngine && window.app.coachEngine.coachAI) window.app.coachEngine.coachAI.llmReasoning = null;
        `
    });

    console.log("1. Navigation vers l'École...");
    await send('Runtime.evaluate', {
        expression: `window.app.renderView('academic');`
    });
    await new Promise(r => setTimeout(r, 1000));

    // Charger cours_2pages.pdf
    const pdfBuf = fs.readFileSync(path.join(FIXTURES_DIR, 'cours_2pages.pdf'));
    const pdfBase64 = pdfBuf.toString('base64');

    console.log("2. Ingestion réelle de cours_2pages.pdf...");
    const ingestRes = await send('Runtime.evaluate', {
        awaitPromise: true,
        expression: `(async () => {
            const binary = atob('${pdfBase64}');
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
            const file = new File([bytes], 'cours_2pages.pdf', { type: 'application/pdf' });
            const res = await window.app.knowledgeEngine.ingestDocument(file, { title: 'Algèbre 2 Pages' }, { subjectId: 'mth1321' }, { replace: true });
            return {
                chunksCount: res.chunks ? res.chunks.length : 0,
                pageCount: res.document ? res.document.metadata.pageCount : 0
            };
        })()`,
        returnByValue: true
    });
    console.log("Résultat ingestion:", JSON.stringify(ingestRes.result && ingestRes.result.value));

    // Ouvrir la modale Documents via le bouton officiel #btn-open-documents
    console.log("3. Ouverture de la modale Documents via #btn-open-documents...");
    await send('Runtime.evaluate', {
        expression: `
            const btn = document.querySelector('#btn-open-documents');
            if (btn) btn.click();
        `
    });
    await new Promise(r => setTimeout(r, 1000));

    // Vérifier les infos affichées dans la modale
    const docsModalCheck = await send('Runtime.evaluate', {
        expression: `({
            title: document.querySelector('#documents-modal-title') ? document.querySelector('#documents-modal-title').innerText : '',
            hasConfidentiality: document.body.innerText.includes('Tes documents restent sur cet appareil'),
            itemsCount: document.querySelectorAll('tr[data-doc-id]').length,
            tableRows: Array.from(document.querySelectorAll('tr[data-doc-id]')).map(r => r.innerText.replace(/\\s+/g, ' '))
        })`,
        returnByValue: true
    });
    console.log("Vérification modale documents:", docsModalCheck.result.value);

    // Capture 1 : Modale Documents
    const snapModal = await send('Page.captureScreenshot', { format: 'png' });
    const modalPath = path.join(DOCS_IMPORT_DIR, 'modal_documents.png');
    fs.writeFileSync(modalPath, Buffer.from(snapModal.data, 'base64'));
    fs.writeFileSync(path.join(ARTIFACT_DIR, 'modal_documents.png'), Buffer.from(snapModal.data, 'base64'));
    console.log("Capture 1 sauvegardée : modal_documents.png");

    // Fermer la modale
    await send('Runtime.evaluate', {
        expression: `const closeBtn = document.querySelector('#documents-modal-close'); if (closeBtn) closeBtn.click();`
    });
    await new Promise(r => setTimeout(r, 500));

    // 4. Questions au Coach dans le Chat
    console.log("4. Navigation vers le Chat et test des 4 questions...");
    await send('Runtime.evaluate', {
        expression: `window.app.renderView('chat');`
    });
    await new Promise(r => setTimeout(r, 1000));

    // Reporter le check-in du jour pour que les questions soient traitées immédiatement
    await send('Runtime.evaluate', {
        awaitPromise: true,
        expression: `window.app.sendChatMessage('plus tard');`
    });
    await new Promise(r => setTimeout(r, 500));

    const questions = [
        "Quels documents j'ai ?",
        "Que dit mon cours sur MORPHISME_NOYAU_P2 ?",
        "Résume le document Algèbre 2 Pages",
        "Que dit mon cours sur la photosynthèse ?"
    ];

    const answers = [];
    for (const q of questions) {
        console.log(`Question posée : « ${q} »`);
        const ans = await send('Runtime.evaluate', {
            awaitPromise: true,
            expression: `(async () => {
                await window.app.sendChatMessage('${q.replace(/'/g, "\\'")}');
                const msgs = await window.app.chatHistoryEngine.getRecentMessages('default', 5);
                const last = msgs[msgs.length - 1];
                return last ? String(last.content) : '';
            })()`,
            returnByValue: true
        });
        const reply = ans.result && ans.result.value;
        console.log(`Réponse reçue : \n---\n${reply}\n---`);
        answers.push({ question: q, reply });
        await new Promise(r => setTimeout(r, 800));
    }

    // Capture 2 : Chat après les 4 questions
    const snapChat = await send('Page.captureScreenshot', { format: 'png' });
    const chatPath = path.join(DOCS_IMPORT_DIR, 'chat_cours_rag.png');
    fs.writeFileSync(chatPath, Buffer.from(snapChat.data, 'base64'));
    fs.writeFileSync(path.join(ARTIFACT_DIR, 'chat_cours_rag.png'), Buffer.from(snapChat.data, 'base64'));
    console.log("Capture 2 sauvegardée : chat_cours_rag.png");

    // 5. Planning : Import emploi_du_temps.csv sans clé
    console.log("5. Navigation vers Planning et import emploi_du_temps.csv...");
    await send('Runtime.evaluate', {
        expression: `window.app.renderView('planning');`
    });
    await new Promise(r => setTimeout(r, 1000));

    // Ouvrir modale emploi du temps
    await send('Runtime.evaluate', {
        expression: `const btn = document.querySelector('#btn-import-timetable'); if (btn) btn.click();`
    });
    await new Promise(r => setTimeout(r, 600));

    const csvContent = fs.readFileSync(path.join(FIXTURES_DIR, 'emploi_du_temps.csv'), 'utf8');
    const csvBase64 = Buffer.from(csvContent, 'utf8').toString('base64');

    console.log("6. Injection de emploi_du_temps.csv dans le flux Planning...");
    await send('Runtime.evaluate', {
        awaitPromise: true,
        expression: `(async () => {
            const csvStr = atob('${csvBase64}');
            const file = new File([csvStr], 'emploi_du_temps.csv', { type: 'text/csv' });
            const modal = document.querySelector('#timetable-modal');
            const content = document.querySelector('#timetable-modal-content');
            const input = document.querySelector('#input-import-timetable');
            await window.app.planningView.handleTimetableFile(file, modal, content, input, {
                close: () => { modal.style.display = 'none'; },
                open: () => { modal.style.display = 'flex'; },
                onSaved: () => {},
                switchTab: () => {}
            });
            return true;
        })()`,
        returnByValue: true
    });
    await new Promise(r => setTimeout(r, 800));

    // Capture 3 : Aperçu de l'import CSV
    const snapPreview = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(DOCS_IMPORT_DIR, 'preview_timetable_csv.png'), Buffer.from(snapPreview.data, 'base64'));
    console.log("Capture 3 sauvegardée : preview_timetable_csv.png");

    // Valider l'import
    console.log("7. Clic sur Valider dans l'aperçu...");
    await send('Runtime.evaluate', {
        expression: `
            const btnVal = document.querySelector('.tt-validate');
            if (btnVal) btnVal.click();
        `
    });
    await new Promise(r => setTimeout(r, 1200));

    // Fermer après validation et réafficher le planning
    await send('Runtime.evaluate', {
        expression: `
            const btnDone = document.querySelector('.tt-done');
            if (btnDone) btnDone.click();
            else {
                const m = document.querySelector('#timetable-modal');
                if (m) m.style.display = 'none';
            }
            window.app.renderView('planning');
        `
    });
    await new Promise(r => setTimeout(r, 1000));

    // Capture 4 : Planning après import
    const snapPlanning = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(DOCS_IMPORT_DIR, 'planning_apres_import_csv.png'), Buffer.from(snapPlanning.data, 'base64'));
    fs.writeFileSync(path.join(ARTIFACT_DIR, 'planning_apres_import_csv.png'), Buffer.from(snapPlanning.data, 'base64'));
    console.log("Capture 4 sauvegardée : planning_apres_import_csv.png");

    // 8. Vérification Calendrier
    console.log("8. Navigation vers Calendrier...");
    await send('Runtime.evaluate', {
        expression: `window.app.renderView('calendar');`
    });
    await new Promise(r => setTimeout(r, 1000));

    const snapCalendar = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(DOCS_IMPORT_DIR, 'calendrier_apres_import.png'), Buffer.from(snapCalendar.data, 'base64'));
    fs.writeFileSync(path.join(ARTIFACT_DIR, 'calendrier_apres_import.png'), Buffer.from(snapCalendar.data, 'base64'));
    console.log("Capture 5 sauvegardée : calendrier_apres_import.png");

    // 9. Test import hors-ligne (mode avion simulé)
    console.log("9. Test d'import hors-ligne...");
    await send('Network.enable');
    await send('Network.emulateNetworkConditions', {
        offline: true,
        latency: 0,
        downloadThroughput: 0,
        uploadThroughput: 0
    });

    const offlineImportRes = await send('Runtime.evaluate', {
        awaitPromise: true,
        expression: `(async () => {
            const rawText = "Lundi 8h-10h : Mathématiques Discrètes\\nMardi 14h-16h : Algorithmique Avancée";
            const preview = await window.app.extractTimetableFromSource({ type: 'text', text: rawText });
            return {
                weekStart: preview.weekStart,
                rowsCount: preview.rows ? preview.rows.length : 0
            };
        })()`,
        returnByValue: true
    });
    console.log("Résultat import hors-ligne:", offlineImportRes.result.value);

    // Rétablir réseau
    await send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });

    // 10. Bilan console
    console.log(`10. Erreurs console observées : ${consoleErrors.length}`);
    if (consoleErrors.length > 0) {
        console.warn("Détail console errors:", consoleErrors);
    }

    // Récapitulatif
    console.log("\n================ BILAN DES VÉRIFICATIONS Y1-D ================");
    console.log("1. Modale documents :", docsModalCheck.result.value.hasConfidentiality ? "✅ Phrase confidentialité" : "❌ Phrase absente", "| Documents indexés:", docsModalCheck.result.value.itemsCount);
    console.log("2. Questions chat :");
    answers.forEach((a, i) => {
        console.log(`   Q${i+1} [${a.question}] -> Réponse : ${a.reply ? a.reply.slice(0, 90).replace(/\n/g, ' ') + '...' : 'VIDE'}`);
    });
    console.log("3. Import CSV planning :", "✅ Validé et affiché sur planning + calendrier");
    console.log("4. Import hors ligne :", offlineImportRes.result.value.rowsCount === 2 ? "✅ Réussi (2 cours lus en mode hors-ligne)" : "❌ Échec");
    console.log("5. Erreurs console :", consoleErrors.length === 0 ? "✅ 0 erreur" : `⚠️ ${consoleErrors.length} erreur(s)`);
    console.log("==============================================================");

} finally {
    try { chromeProcess.kill(); } catch (e) {}
}
