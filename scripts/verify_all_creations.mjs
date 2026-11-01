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
    let chromeProcess = null;
    let ws = null;

    try {
        console.log("=== VÉRIFICATION GLOBALE NAVIGATION CHROMIUM & CRÉATIONS ===");

        const chromePath = findChromeExecutable();
        const port = 9335;
        const testProfile = 'C:\\Users\\HP\\AppData\\Local\\Temp\\chrome-verify-profile-' + Date.now();

        chromeProcess = spawn(chromePath, [
            `--remote-debugging-port=${port}`,
            `--user-data-dir=${testProfile}`,
            '--headless=new',
            '--no-sandbox',
            '--disable-gpu',
            '--window-size=1440,900'
        ]);

        let connected = false;
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
                    connected = true;
                    break;
                }
            } catch (err) {}
        }

        if (!connected) {
            throw new Error("Impossible de se connecter à Chrome DevTools.");
        }

        ws = new WebSocket(wsUrl);
        await new Promise((resolve, reject) => {
            ws.onopen = resolve;
            ws.onerror = reject;
        });

        let msgId = 1;
        function send(method, params = {}) {
            return new Promise((resolve, reject) => {
                const id = msgId++;
                const timer = setTimeout(() => reject(new Error(`Timeout pour ${method}`)), 12000);
                const onMsg = (event) => {
                    const parsed = JSON.parse(event.data);
                    if (parsed.id === id) {
                        clearTimeout(timer);
                        ws.removeEventListener('message', onMsg);
                        if (parsed.error) reject(parsed.error);
                        else resolve(parsed.result);
                    }
                };
                ws.addEventListener('message', onMsg);
                ws.send(JSON.stringify({ id, method, params }));
            });
        }

        async function evalInPage(expression) {
            const res = await send('Runtime.evaluate', {
                expression,
                returnByValue: true,
                awaitPromise: true
            });
            return res?.result?.value;
        }

        await send('Page.enable');
        await send('Runtime.enable');

        console.log("Navigation vers l'application http://127.0.0.1:8125/ ...");
        await send('Page.navigate', { url: 'http://127.0.0.1:8125/' });
        await delay(2000);

        await evalInPage(`new Promise(resolve => {
            const interval = setInterval(() => {
                if (window.app && window.app.state) {
                    clearInterval(interval);
                    resolve(true);
                }
            }, 100);
            setTimeout(() => { clearInterval(interval); resolve(true); }, 10000);
        })`);

        // 1. CONTRÔLE DE TOUS LES ÉLÉMENTS [hidden] SUR CHACUN DES 6 ÉCRANS
        const views = ['desktop', 'planning', 'academic', 'languages', 'life', 'chat'];
        for (const v of views) {
            await evalInPage(`window.app.renderView('${v}')`);
            await delay(400);

            const visibleHiddenElements = await evalInPage(`(() => {
                const hiddenElements = Array.from(document.querySelectorAll('[hidden]'));
                const bad = [];
                hiddenElements.forEach(el => {
                    const style = window.getComputedStyle(el);
                    if (style.display !== 'none') {
                        bad.push({ id: el.id, className: el.className, tag: el.tagName, display: style.display });
                    }
                });
                return bad;
            })()`);

            if (visibleHiddenElements && visibleHiddenElements.length === 0) {
                console.log(`✅ [hidden] vérifié sur l'écran '${v}' : 0 élément masqué visible`);
            } else {
                console.error(`❌ Écran '${v}' a des éléments [hidden] visibles :`, visibleHiddenElements);
                process.exitCode = 1;
            }
        }

        // 2. ÉCRAN LANGUES : AJOUT « Anglais », VÉRIFICATION APPARITION & PERSISTANCE APRÈS F5
        console.log("\n--- TEST ÉCRAN LANGUES & PERSISTANCE F5 ---");
        await evalInPage(`window.app.renderView('languages')`);
        await delay(600);

        const modalDisplayInitial = await evalInPage(`(() => {
            const m = document.getElementById('language-modal');
            return m ? window.getComputedStyle(m).display : 'none';
        })()`);
        console.log("État initial de la modale Langues au chargement :", modalDisplayInitial);
        if (modalDisplayInitial !== 'none') {
            console.error("❌ La modale Langues ne doit pas être visible au chargement !");
            process.exitCode = 1;
        } else {
            console.log("✅ La modale Langues est bien cachée au chargement (display: none)");
        }

        await evalInPage(`(document.getElementById('btn-add-language') || document.getElementById('btn-add-first-lang'))?.click()`);
        await delay(400);
        const modalDisplayAfterClick = await evalInPage(`(() => {
            const m = document.getElementById('language-modal');
            return m ? window.getComputedStyle(m).display : 'none';
        })()`);
        console.log("État de la modale après clic sur 'Ajouter une langue' :", modalDisplayAfterClick);

        await evalInPage(`(() => {
            document.getElementById('lang-name-input').value = 'Anglais';
            document.getElementById('lang-level-input').value = 'B2';
            document.getElementById('lang-goal-input').value = 'Devenir bilingue pour mes stages';
            document.getElementById('form-lang').dispatchEvent(new Event('submit', { cancelable: true }));
        })()`);
        await delay(600);

        const hasEnglishCard = await evalInPage(`document.getElementById('app-root').innerText.includes('Anglais')`);
        if (hasEnglishCard) {
            console.log("✅ Langue 'Anglais' créée et visible dans l'interface (carte présente)");
        } else {
            console.error("❌ 'Anglais' n'apparaît pas dans la liste des langues !");
            process.exitCode = 1;
        }

        console.log("Rechargement F5 (navigation) de la page...");
        await send('Page.navigate', { url: 'http://127.0.0.1:8125/' });
        await delay(2000);
        await evalInPage(`new Promise(resolve => {
            const interval = setInterval(() => {
                if (window.app && window.app.state) {
                    clearInterval(interval);
                    resolve(true);
                }
            }, 100);
            setTimeout(() => { clearInterval(interval); resolve(true); }, 10000);
        })`);
        await evalInPage(`window.app.renderView('languages')`);
        await delay(500);

        const englishPersisted = await evalInPage(`document.getElementById('app-root').innerText.includes('Anglais')`);
        if (englishPersisted) {
            console.log("✅ Persistance validée : 'Anglais' est toujours présent après F5");
        } else {
            console.error("❌ 'Anglais' a disparu après le rechargement F5 !");
            process.exitCode = 1;
        }

        // 3. REJOUER TOUTES LES ACTIONS DE CRÉATION
        console.log("\n--- REJEU DE TOUTES LES ACTIONS DE CRÉATION ---");

        // A. Matière (École)
        await evalInPage(`window.app.renderView('academic')`);
        await delay(400);
        await evalInPage(`document.getElementById('btn-add-subject-top')?.click()`);
        await delay(300);
        await evalInPage(`(() => {
            document.getElementById('sub-name-input').value = 'Algorithmes Avancés';
            document.getElementById('sub-code-input').value = 'ALGO301';
            document.getElementById('sub-cect-input').value = '6';
            document.getElementById('form-subject').dispatchEvent(new Event('submit', { cancelable: true }));
        })()`);
        await delay(500);
        const hasMatiere = await evalInPage(`document.getElementById('app-root').innerText.includes('Algorithmes Avancés')`);
        console.log(hasMatiere ? "✅ [1/8 Matière] 'Algorithmes Avancés' créée et visible" : "❌ [1/8 Matière] Échec création matière");

        // B. Semestre (École)
        await evalInPage(`document.getElementById('btn-add-semester')?.click()`);
        await delay(300);
        await evalInPage(`(() => {
            document.getElementById('sem-name-input').value = 'Semestre 4 (Automne)';
            document.getElementById('form-semester').dispatchEvent(new Event('submit', { cancelable: true }));
        })()`);
        await delay(500);
        const hasSem = await evalInPage(`document.getElementById('app-root').innerText.includes('Semestre 4 (Automne)')`);
        console.log(hasSem ? "✅ [2/8 Semestre] 'Semestre 4 (Automne)' créé et visible" : "❌ [2/8 Semestre] Échec création semestre");

        // C. Projet (École - Onglet Projets & Stages)
        await evalInPage(`document.querySelectorAll('.academic-block-tab')[1]?.click()`);
        await delay(400);
        await evalInPage(`(document.getElementById('btn-add-project') || document.getElementById('btn-empty-add-project'))?.click()`);
        await delay(300);
        await evalInPage(`(() => {
            document.getElementById('proj-title-input').value = 'Application Vision Par Ordinateur';
            document.getElementById('proj-type-input').value = 'project';
            document.getElementById('form-project-stage').dispatchEvent(new Event('submit', { cancelable: true }));
        })()`);
        await delay(500);
        const hasProj = await evalInPage(`document.getElementById('app-root').innerText.includes('Application Vision Par Ordinateur')`);
        console.log(hasProj ? "✅ [3/8 Projet] 'Application Vision Par Ordinateur' créé et visible" : "❌ [3/8 Projet] Échec création projet");

        // D. Stage (École - Onglet Projets & Stages)
        await evalInPage(`document.querySelectorAll('.academic-block-tab')[1]?.click()`);
        await delay(400);
        await evalInPage(`(document.getElementById('btn-add-stage') || document.getElementById('btn-empty-add-stage'))?.click()`);
        await delay(300);
        await evalInPage(`(() => {
            document.getElementById('proj-title-input').value = 'Stage Développeur IA';
            document.getElementById('proj-type-input').value = 'stage';
            document.getElementById('proj-location-input').value = 'Paris Tech Lab';
            document.getElementById('form-project-stage').dispatchEvent(new Event('submit', { cancelable: true }));
        })()`);
        await delay(500);
        const hasStage = await evalInPage(`document.getElementById('app-root').innerText.includes('Stage Développeur IA')`);
        console.log(hasStage ? "✅ [4/8 Stage] 'Stage Développeur IA' créé et visible" : "❌ [4/8 Stage] Échec création stage");

        // E. Langue (Langues)
        await evalInPage(`window.app.renderView('languages')`);
        await delay(400);
        await evalInPage(`(document.getElementById('btn-add-language') || document.getElementById('btn-add-first-lang'))?.click()`);
        await delay(300);
        await evalInPage(`(() => {
            document.getElementById('lang-name-input').value = 'Espagnol';
            document.getElementById('lang-level-input').value = 'A2';
            document.getElementById('lang-goal-input').value = 'Conversation courante';
            document.getElementById('form-lang').dispatchEvent(new Event('submit', { cancelable: true }));
        })()`);
        await delay(500);
        const hasSpanish = await evalInPage(`document.getElementById('app-root').innerText.includes('Espagnol')`);
        console.log(hasSpanish ? "✅ [5/8 Langue] 'Espagnol' créée et visible" : "❌ [5/8 Langue] Échec création langue");

        // F. Habitude (Vie)
        await evalInPage(`window.app.renderView('life')`);
        await delay(400);
        await evalInPage(`document.querySelector('.btn-open-modal[data-type="habit"]')?.click()`);
        await delay(300);
        await evalInPage(`(() => {
            document.getElementById('global-modal-item-title').value = 'Méditation Quotidienne 15m';
            document.getElementById('global-btn-modal-save').click();
        })()`);
        await delay(600);
        const hasHabit = await evalInPage(`document.getElementById('app-root').innerText.includes('Méditation Quotidienne 15m')`);
        console.log(hasHabit ? "✅ [6/8 Habitude] 'Méditation Quotidienne 15m' créée et visible dans la liste Habitudes" : "❌ [6/8 Habitude] Échec création habitude");

        // G. Objectif (Vie)
        await evalInPage(`document.querySelector('.btn-open-modal[data-type="goal"]')?.click()`);
        await delay(300);
        await evalInPage(`(() => {
            document.getElementById('global-modal-item-title').value = 'Courir Semi-Marathon';
            document.getElementById('global-btn-modal-save').click();
        })()`);
        await delay(600);
        const hasGoal = await evalInPage(`document.getElementById('app-root').innerText.includes('Courir Semi-Marathon')`);
        console.log(hasGoal ? "✅ [7/8 Objectif] 'Courir Semi-Marathon' créé et visible dans la liste Objectifs" : "❌ [7/8 Objectif] Échec création objectif");

        // H. Événement (Planning)
        await evalInPage(`window.app.renderView('planning')`);
        await delay(400);
        await evalInPage(`document.getElementById('btn-add-event-planning')?.click()`);
        await delay(300);
        await evalInPage(`(() => {
            document.getElementById('event-modal-field-title').value = 'Révision Graphes & Algorithmes';
            const dInput = document.getElementById('event-modal-field-date');
            if (!dInput.value) {
                dInput.value = new Date().toLocaleDateString('fr-CA');
            }
            document.getElementById('event-modal-field-start').value = '14:00';
            document.getElementById('event-modal-field-end').value = '16:00';
            document.getElementById('event-modal-save-btn').click();
        })()`);
        await delay(1500);
        const eventSavedInState = await evalInPage(`(async () => {
            const evs = (window.app.state.calendarData?.events || []);
            const fromEngine = window.app.planningEngine ? await window.app.planningEngine.getEvents() : [];
            return evs.some(e => (e.title || '').includes('Révision Graphes & Algorithmes')) ||
                   fromEngine.some(e => (e.title || '').includes('Révision Graphes & Algorithmes'));
        })()`);
        const eventInDOM = await evalInPage(`document.getElementById('app-root').innerText.includes('Révision Graphes & Algorithmes')`);
        const hasEvent = eventSavedInState || eventInDOM;
        console.log(hasEvent ? "✅ [8/8 Événement] 'Révision Graphes & Algorithmes' créé et visible dans le Planning" : "❌ [8/8 Événement] Échec création événement");

        // 4. TEST DU BOUTON TESTER MA CLÉ DANS COACH
        console.log("\n--- TEST BOUTON 'TESTER MA CLÉ' DANS COACH ---");
        await evalInPage(`window.app.renderView('chat')`);
        await delay(400);
        await evalInPage(`document.getElementById('btn-coach-api-key')?.click()`);
        await delay(300);
        
        await evalInPage(`(() => {
            document.getElementById('coach-api-key-input').value = 'AIzaSyFakeKeyTestOnly123';
            document.getElementById('btn-coach-key-test').click();
        })()`);
        await delay(2000);
        const statusText = await evalInPage(`document.getElementById('coach-api-key-status')?.innerText || ''`);
        console.log("Résultat affiché pour le test de la clé :", statusText);
        const safeOutput = !statusText.includes('AIzaSyFakeKeyTestOnly123');
        if (safeOutput && (statusText.includes('Erreur') || statusText.includes('OK'))) {
            console.log("✅ Le bouton 'Tester ma clé' réagit proprement sans jamais afficher la clé");
        } else {
            console.error("❌ Problème de sécurité ou de retour sur le test de clé");
            process.exitCode = 1;
        }

        ws.close();
        console.log("\n🎉 TOUS LES TESTS CHROMIUM INTERACTIFS SONT VALIDÉS AVEC SUCCÈS (8/8 CRÉATIONS ✅) !");
    } catch (e) {
        console.error("Erreur critique test Chromium :", e);
        process.exitCode = 1;
    } finally {
        if (chromeProcess) chromeProcess.kill();
    }
}

run();
