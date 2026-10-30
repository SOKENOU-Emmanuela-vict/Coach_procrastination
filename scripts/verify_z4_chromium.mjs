import { spawn } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';

const DOCS_DIR = path.resolve('docs/restructuration');
if (!fs.existsSync(DOCS_DIR)) fs.mkdirSync(DOCS_DIR, { recursive: true });

function findChromeExecutable() {
    if (process.env.CHROME_BIN && fs.existsSync(process.env.CHROME_BIN)) return process.env.CHROME_BIN;
    if (process.env.CHROME_PATH && fs.existsSync(process.env.CHROME_PATH)) return process.env.CHROME_PATH;
    const candidates = [
        path.join(process.env.PROGRAMFILES || 'C:\\Program Files', 'Google/Chrome/Application/chrome.exe'),
        path.join(process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)', 'Google/Chrome/Application/chrome.exe'),
        path.join(process.env.LOCALAPPDATA || '', 'Google/Chrome/Application/chrome.exe'),
        path.join(process.env.PROGRAMFILES || 'C:\\Program Files', 'Microsoft/Edge/Application/msedge.exe'),
        path.join(process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)', 'Microsoft/Edge/Application/msedge.exe'),
        '/usr/bin/google-chrome',
        '/usr/bin/chromium',
        '/usr/bin/chromium-browser',
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
    ];
    for (const c of candidates) {
        if (c && fs.existsSync(c)) return c;
    }
    return null;
}

const chromePath = findChromeExecutable();
if (!chromePath) {
    console.log("⚠️ Chrome introuvable : test passé proprement.");
    process.exit(0);
}

async function ensureServer() {
    const isRunning = await new Promise(res => {
        const req = http.get('http://127.0.0.1:8126', () => res(true));
        req.on('error', () => res(false));
        req.setTimeout(500, () => { req.destroy(); res(false); });
    });
    if (isRunning) return null;

    const srv = spawn('node', ['server.js'], {
        cwd: process.cwd(),
        env: { ...process.env, PORT: '8126' },
        stdio: 'ignore'
    });
    await new Promise(r => setTimeout(r, 1000));
    return srv;
}

let serverProcess = null;
let chromeProcess = null;

try {
    serverProcess = await ensureServer();

    chromeProcess = spawn(chromePath, [
        '--headless=new',
        '--remote-debugging-port=9226',
        '--disable-gpu',
        '--no-sandbox',
        '--window-size=1280,900'
    ]);

    await new Promise(r => setTimeout(r, 1500));

    const targets = await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Timeout /json')), 5000);
        http.get('http://127.0.0.1:9226/json', (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                clearTimeout(timer);
                resolve(JSON.parse(body));
            });
        }).on('error', (err) => {
            clearTimeout(timer);
            reject(err);
        });
    });

    const pageTarget = targets.find(t => t.type === 'page' && t.url.includes('8126')) || targets.find(t => t.type === 'page') || targets[0];
    const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
    await new Promise((res, rej) => {
        ws.onopen = res;
        ws.onerror = rej;
    });

    let msgId = 1;
    const send = (method, params = {}) => new Promise((resolve) => {
        const id = msgId++;
        const onMsg = (event) => {
            const data = JSON.parse(event.data);
            if (data.id === id) {
                ws.removeEventListener('message', onMsg);
                resolve(data.result);
            }
        };
        ws.addEventListener('message', onMsg);
        ws.send(JSON.stringify({ id, method, params }));
    });

    await send('Page.enable');
    await send('Runtime.enable');

    console.log("1. Chargement de l'application sur le port 8126...");
    await send('Page.navigate', { url: 'http://127.0.0.1:8126/#chat' });
    await new Promise(r => setTimeout(r, 2000));

    // Préparation des données de test dans le navigateur
    console.log("2. Préparation des données (séances restantes, séances cochées, compteurs hebdo)...");
    const prepResult = await send('Runtime.evaluate', {
        expression: `(async () => {
            const app = window.app;
            if (!app) return { ok: false, error: 'window.app non trouvé' };

            // Suppression explicite de toute clé IA (mode sans clé)
            try { localStorage.removeItem('gemini_api_key'); } catch (_) {}

            const today = app.getPedagogicalDate ? app.getPedagogicalDate(new Date()) : new Date().toLocaleDateString('fr-CA');

            // Événements du jour : 1 restant, 1 coché
            await app.storage.saveData('events', [
                { id: 'ev_rem_1', title: 'Séance Révision Algèbre', startTime: '15:00', endTime: '16:00', date: today, status: 'planifiée', completed: false },
                { id: 'ev_done_1', title: 'Cours Histoire Terminé', startTime: '10:00', endTime: '12:00', date: today, status: 'completed', completed: true }
            ]);

            // Tâches personnelles : 1 restante aujourd'hui, 1 faite aujourd'hui, 1 en retard
            await app.storage.saveData('personal_tasks', [
                { id: 't_rem_1', title: 'Acheter fournitures', dueDate: today, status: 'à faire', completed: false },
                { id: 't_done_1', title: 'Fiche lecture terminée', dueDate: today, status: 'faite', completed: true },
                { id: 't_late_1', title: 'Convention de stage', dueDate: '2026-10-20', status: 'à faire', completed: false }
            ]);

            // Historique d'étude pour la semaine
            await app.storage.saveData('study_history', [
                { id: 'hist_1', date: today, actualDuration: 45, status: 'completed' }
            ]);

            // Compteurs semaine passée
            await app.storage.saveData('weekly_counters', [
                { week: '2026-W43', sessionsDone: 1, tasksDone: 1, focusMinutes: 45 }
            ]);

            // Réinitialiser l'état et naviguer vers le chat
            await app.refreshUserStats();
            await app.renderView('chat');
            return { ok: true, today };
        })()`,
        awaitPromise: true,
        returnByValue: true
    });

    const prepVal = prepResult.result?.value || prepResult.value;
    console.log("Données initialisées :", prepVal);

    // Question 1 : Qu'est-ce qu'il me reste aujourd'hui ?
    console.log("3. Envoi de la question « Qu'est-ce qu'il me reste aujourd'hui ? »...");
    await send('Runtime.evaluate', {
        expression: `(async () => {
            if (window.app && typeof window.app.sendChatMessage === 'function') {
                await window.app.sendChatMessage("Qu'est-ce qu'il me reste aujourd'hui ?");
                await window.app.renderView('chat');
            }
        })()`,
        awaitPromise: true
    });
    await new Promise(r => setTimeout(r, 1500));

    // Question 2 : Mon bilan de la semaine
    console.log("4. Envoi de la question « Mon bilan de la semaine »...");
    await send('Runtime.evaluate', {
        expression: `(async () => {
            if (window.app && typeof window.app.sendChatMessage === 'function') {
                await window.app.sendChatMessage("Mon bilan de la semaine");
                await window.app.renderView('chat');
            }
        })()`,
        awaitPromise: true
    });
    await new Promise(r => setTimeout(r, 1500));

    // Vérification des réponses dans le DOM du chat
    const checkAnswers = await send('Runtime.evaluate', {
        expression: `(() => {
            const container = document.querySelector('#chat-messages-container');
            const messages = container ? Array.from(container.children).map(el => el.innerText || el.textContent) : [];
            const allText = messages.join('\\n---MSG---\\n');

            const hasRem1 = allText.includes('Séance Révision Algèbre');
            const hasRemTask = allText.includes('Acheter fournitures');
            const hasGoldenDoneEvent = allText.includes('Cours Histoire Terminé');
            const hasGoldenDoneTask = allText.includes('Fiche lecture terminée');
            const hasWeeklyHeader = allText.includes('Bilan de la semaine :');
            const hasWeeklyContent = allText.includes('Cette semaine, tu as accompli');

            return {
                ok: hasRem1 && hasRemTask && !hasGoldenDoneEvent && !hasGoldenDoneTask && hasWeeklyHeader && hasWeeklyContent,
                hasRem1,
                hasRemTask,
                goldenRuleRespected: !hasGoldenDoneEvent && !hasGoldenDoneTask,
                hasWeeklyHeader,
                hasWeeklyContent,
                messagesCount: messages.length,
                allText
            };
        })()`,
        returnByValue: true
    });

    const answersVal = checkAnswers.result?.value || checkAnswers.value;
    console.log("Vérification des réponses dans le chat :", {
        hasRem1: answersVal?.hasRem1,
        hasRemTask: answersVal?.hasRemTask,
        goldenRuleRespected: answersVal?.goldenRuleRespected,
        hasWeeklyHeader: answersVal?.hasWeeklyHeader,
        hasWeeklyContent: answersVal?.hasWeeklyContent
    });

    if (!answersVal?.ok) {
        console.warn("Détail texte reçu dans le chat :", answersVal?.allText);
        throw new Error("Vérification des réponses du chat non concluante.");
    }

    // Capture de l'écran Coach Chat avec les deux réponses
    const shotChat = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(DOCS_DIR, 'z4_coach_chat_reminders.png'), Buffer.from(shotChat.data, 'base64'));
    console.log("✅ Capture enregistrée : docs/restructuration/z4_coach_chat_reminders.png");

    // 5. Navigation vers le Bureau pour vérifier le bloc Rappels du Coach
    console.log("5. Navigation vers le Bureau...");
    await send('Runtime.evaluate', {
        expression: `(async () => {
            if (window.app && window.app.renderView) {
                await window.app.renderView('desktop');
            }
        })()`,
        awaitPromise: true
    });
    await new Promise(r => setTimeout(r, 1200));

    const checkDesktop = await send('Runtime.evaluate', {
        expression: `(() => {
            const remindersCard = document.querySelector('#desktop-coach-reminders');
            const reminderText = document.querySelector('.bureau-coach-reminder-text');
            const navDashboard = document.querySelector('[data-view="dashboard"]');
            const navWeekly = document.querySelector('[data-view="weekly"]');

            return {
                ok: !!remindersCard,
                cardFound: !!remindersCard,
                text: reminderText ? reminderText.innerText : null,
                navDashboardPresent: !!navDashboard,
                navWeeklyPresent: !!navWeekly
            };
        })()`,
        returnByValue: true
    });

    const deskVal = checkDesktop.result?.value || checkDesktop.value;
    console.log("Vérification du Bureau :", deskVal);

    if (!deskVal?.cardFound) {
        throw new Error("Bloc #desktop-coach-reminders introuvable sur le Bureau");
    }
    if (deskVal.navDashboardPresent || deskVal.navWeeklyPresent) {
        throw new Error("Tableau de bord ou Hebdo encore présent dans la navigation du Bureau");
    }

    // Capture de l'écran Bureau avec le widget « Rappels du coach »
    const shotDesk = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(DOCS_DIR, 'z4_desktop_coach_widget.png'), Buffer.from(shotDesk.data, 'base64'));
    console.log("✅ Capture enregistrée : docs/restructuration/z4_desktop_coach_widget.png");

    console.log("\n🎉 TOUTES LES VÉRIFICATIONS NAVIGATEUR Z4 SONT VALIDÉES !");
    ws.close();
} catch (e) {
    console.error("Erreur test Z4 Chromium :", e);
    process.exitCode = 1;
} finally {
    if (chromeProcess) try { chromeProcess.kill(); } catch (_) {}
    if (serverProcess) try { serverProcess.kill(); } catch (_) {}
}
