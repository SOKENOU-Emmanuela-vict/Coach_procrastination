/**
 * test_x1_navigation.mjs
 * Validation X1 : Accès aux écrans et démarrage du focus.
 * Vérifie que chaque écran (Calendrier, Hebdo, Tableau de bord, Portfolio, Focus)
 * est atteignable depuis le Bureau en 2 clics maximum,
 * que Focus se lance depuis Bureau et Planning, et que chaque écran a un retour clair.
 */

import { App } from './src/core/App.js';
import { Router } from './src/core/Router.js';
import { DesktopView } from './src/ui/DesktopView.js';
import { PlanningView } from './src/ui/PlanningView.js';
// CalendarView fusionné dans PlanningView
import { DashboardView } from './src/ui/DashboardView.js';
import { WeeklyView } from './src/ui/WeeklyView.js';
import { PortfolioView } from './src/ui/PortfolioView.js';
import { FocusView } from './src/ui/FocusView.js';

let passed = 0;
let total = 0;

function assert(cond, msg) {
    total++;
    if (cond) {
        console.log(`✅ PASS: ${msg}`);
        passed++;
    } else {
        console.error(`❌ FAIL: ${msg}`);
        process.exitCode = 1;
    }
}

// Construction d'un mock DOM minimal mais fonctionnel
class MockElement {
    constructor(id = '', tag = 'div') {
        this.id = id;
        this.tagName = tag.toUpperCase();
        this._innerHTML = '';
        this.attributes = {};
        this.listeners = {};
        this.children = [];
        this.style = {};
        this.classList = {
            classes: new Set(),
            add(c) { this.classes.add(c); },
            remove(c) { this.classes.delete(c); },
            contains(c) { return this.classes.has(c); }
        };
    }

    get innerHTML() {
        return this._innerHTML;
    }

    set innerHTML(html) {
        this._innerHTML = html;
        this._parseSimple(html);
    }

    setAttribute(k, v) { this.attributes[k] = String(v); }
    getAttribute(k) { return this.attributes[k] ?? null; }

    addEventListener(event, fn) {
        if (!this.listeners[event]) this.listeners[event] = [];
        this.listeners[event].push(fn);
    }

    dispatchEvent(event) {
        const ev = typeof event === 'string' ? { type: event, currentTarget: this, target: this, stopPropagation: () => {}, preventDefault: () => {} } : event;
        if (!ev.currentTarget) ev.currentTarget = this;
        if (!ev.target) ev.target = this;
        if (!ev.stopPropagation) ev.stopPropagation = () => {};
        if (!ev.preventDefault) ev.preventDefault = () => {};
        const list = this.listeners[ev.type] || [];
        for (const fn of list) fn(ev);
    }

    click() {
        this.dispatchEvent({ type: 'click' });
    }

    _parseSimple(html) {
        this.children = [];
        // Regex simplifiée pour extraire éléments avec id, class et data-view
        const tagRegex = /<([a-zA-Z0-9]+)([^>]*)>/g;
        let m;
        while ((m = tagRegex.exec(html)) !== null) {
            const tagName = m[1];
            const attrsStr = m[2];
            const child = new MockElement('', tagName);

            const idM = attrsStr.match(/id=["']([^"']+)["']/);
            if (idM) child.id = idM[1];

            const classM = attrsStr.match(/class=["']([^"']+)["']/);
            if (classM) {
                child.className = classM[1];
                classM[1].split(/\s+/).forEach(c => child.classList.add(c));
            }

            const dataViewM = attrsStr.match(/data-view=["']([^"']+)["']/);
            if (dataViewM) child.setAttribute('data-view', dataViewM[1]);

            const dataIdM = attrsStr.match(/data-id=["']([^"']+)["']/);
            if (dataIdM) child.setAttribute('data-id', dataIdM[1]);

            this.children.push(child);
        }
    }

    querySelector(selector) {
        return this.querySelectorAll(selector)[0] || null;
    }

    querySelectorAll(selector) {
        const results = [];
        const isClass = selector.startsWith('.');
        const isId = selector.startsWith('#');
        const isAttr = selector.startsWith('[') && selector.endsWith(']');
        const val = selector.slice(1);

        for (const ch of this.children) {
            if (isClass && ch.classList.contains(val)) results.push(ch);
            else if (isId && ch.id === val) results.push(ch);
            else if (isAttr) {
                const attrKey = selector.slice(1, -1).split('=')[0];
                if (ch.getAttribute(attrKey) !== null) results.push(ch);
            }
        }
        return results;
    }
}

// Injection environnement
const mockContainer = new MockElement('app-root');
global.document = {
    getElementById: (id) => {
        if (id === 'app-root' || id === 'view-container') return mockContainer;
        return mockContainer.querySelector('#' + id);
    },
    querySelector: (sel) => mockContainer.querySelector(sel),
    querySelectorAll: (sel) => mockContainer.querySelectorAll(sel),
    body: new MockElement('body')
};
global.window = {
    location: { hash: '', reload: () => {} },
    addEventListener: () => {},
    matchMedia: () => ({ matches: false }),
    confirm: () => true
};

async function testNavigation() {
    console.log("=== TESTS X1 : ACCES AUX ÉCRANS & MODE FOCUS ===");

    // Mock storage
    const storage = {
        data: {
            'events': [
                { id: 'ev-1', title: 'Révision Algo', type: 'revision', date: '2026-10-27', startTime: '14:00', endTime: '15:30', duration: 90, subjectId: 'algo' }
            ]
        },
        loadData: async (k) => storage.data[k] || null,
        saveData: async (k, v) => { storage.data[k] = v; },
        loadDataSync: (k) => storage.data[k] || null,
        saveDataSync: (k, v) => { storage.data[k] = v; }
    };

    const scheduler = {
        generateDailyPlan: async (date) => ({
            date: date || '2026-10-27',
            sessions: [
                { id: 'sess-1', title: 'Cours Réseau', type: 'course', startTime: '08:00', endTime: '10:00', duration: 120, completed: false }
            ],
            habits: []
        })
    };

    const studyRecordEngine = {
        completeSession: async () => {},
        uncompleteSession: async () => {},
        getDailyStats: async () => ({ totalMinutes: 60, completedSessions: 1 }),
        getFullHistory: async () => [],
        getMonthlyStats: async () => ({ totalHours: 10, daysActive: 5, avgQuality: 4, proofsGenerated: 2 })
    };

    const checkInEngine = {
        buildDailySummary: async () => ({
            date: '2026-10-27',
            execution: { completionRate: 100, completed: 1, missed: 0 },
            energy: 'high'
        }),
        getCheckIn: async () => ({ mood: 'high', energy: 'high', motivation: 'high' })
    };

    const weeklyReviewEngine = {
        buildWeeklySummary: async () => ({
            weekStart: '2026-10-20',
            weekEnd: '2026-10-27',
            execution: { actualMinutes: 120, plannedMinutes: 200, completionRate: 60, completed: 3, partial: 0, missed: 1, cancelled: 0 },
            subjectBreakdown: { Maths: { planned: 2, completed: 2, missed: 0 } },
            adHocSessions: [],
            followUps: [],
            trends: { lowEnergyDays: 1, averageSleep: 420 },
            dailySummaries: [{ date: '2026-10-26', execution: { completionRate: 100, completed: 2, missed: 0 }, energy: 'high' }]
        })
    };

    const chatHistoryEngine = {
        getConversation: async () => []
    };

    const app = new App(storage, scheduler, studyRecordEngine, checkInEngine, null, weeklyReviewEngine, chatHistoryEngine, null);
    app.router = new Router('app-root', app);

    // Initialiser un état avec des sessions pour le Desktop et le Planning
    app.state = {
        currentView: 'desktop',
        userProfile: { name: 'Test User', streak: 5, gamification: { level: 2, xp: 250, nextLevelXp: 500 } },
        dailyPlan: {
            date: '2026-10-27',
            sessions: [
                { id: 'sess-1', title: 'Cours Réseau', type: 'course', startTime: '08:00', endTime: '10:00', duration: 120, completed: false }
            ]
        },
        calendarData: {
            events: [
                { id: 'ev-1', title: 'Révision Algo', type: 'revision', date: '2026-10-27', startTime: '14:00', endTime: '15:30', duration: 90, subjectId: 'algo' }
            ],
            availabilities: [],
            subjects: [],
            assessments: [],
            projects: []
        },
        allCheckins: {
            '2026-10-26': { mood: 'high', energy: 'high', motivation: 'high', learned: 'Arbres binaires' }
        }
    };

    // 1. Rendu du Bureau
    await app.renderView('desktop');
    assert(mockContainer.innerHTML.includes('bureau-nav'), "DesktopView rendu avec barre latérale");

    // 2. Vérification des accès directs (1 clic depuis Bureau)
    const navItems = mockContainer.querySelectorAll('.bureau-nav-item');
    const viewsAvailable = navItems.map(n => n.getAttribute('data-view')).filter(Boolean);

    assert(viewsAvailable.includes('planning'), "Planning accessible en 1 clic dans la barre latérale (fusionné avec Calendrier)");
    assert(viewsAvailable.includes('dashboard'), "Tableau de bord accessible en 1 clic dans la barre latérale");
    assert(viewsAvailable.includes('weekly'), "Hebdo accessible en 1 clic dans la barre latérale");
    assert(viewsAvailable.includes('portfolio'), "Portfolio accessible en 1 clic dans la barre latérale");
    assert(viewsAvailable.includes('planning'), "Planning accessible en 1 clic dans la barre latérale");
    assert(viewsAvailable.includes('academic'), "École accessible en 1 clic dans la barre latérale");
    assert(viewsAvailable.includes('languages'), "Langues accessible en 1 clic dans la barre latérale");
    assert(viewsAvailable.includes('life'), "Vie accessible en 1 clic dans la barre latérale");
    assert(viewsAvailable.includes('chat'), "Coach accessible en 1 clic dans la barre latérale");

    // 3. Tester la navigation vers chaque écran cible et vérifier qu'il rend correctement
    // 3.1 Calendrier (redirigé automatiquement vers planning)
    await app.renderView('calendar');
    assert(mockContainer.innerHTML.includes('PLANNING'), "Navigation 'calendar' redirige vers Planning fusionné");

    // 3.2 Tableau de bord
    await app.renderView('dashboard');
    assert(mockContainer.innerHTML.includes('Poste de Pilotage') && mockContainer.innerHTML.includes('btn-dash-desktop'), "Tableau de bord se rend avec bouton retour Bureau");

    // 3.3 Hebdo (Weekly)
    await app.renderView('weekly');
    assert(mockContainer.innerHTML.includes('Weekly Review') && mockContainer.innerHTML.includes('btn-weekly-desktop'), "Hebdo se rend avec bouton retour Bureau");

    // 3.4 Portfolio (avec checkin pour valider le fix hasVoice)
    await app.renderView('portfolio');
    assert(mockContainer.innerHTML.includes('Mon Portfolio') && mockContainer.innerHTML.includes('btn-portfolio-back'), "Portfolio se rend sans erreur hasVoice et avec bouton retour");

    // 4. Focus : Démarrage depuis la carte du Bureau
    await app.renderView('desktop');
    const btnDesktopCourse = mockContainer.querySelector('#btn-desktop-course');
    assert(btnDesktopCourse !== null, "Bouton démarrer session présent sur la carte Bureau");
    
    await app.startFocusSession({ id: 'focus-desk', title: 'Session Rapide', expectedDuration: 25 });
    assert(app.state.currentView === 'focus', "App est en vue focus");
    assert(mockContainer.innerHTML.includes('Mode Focus') && mockContainer.innerHTML.includes('Session Rapide'), "FocusView rend la session lancée depuis le Bureau (1 clic)");
    assert(mockContainer.innerHTML.includes('btn-focus-quit-desktop'), "FocusView possède un bouton pour quitter vers Bureau");

    // 5. Focus : Démarrage depuis un événement du Planning (2 clics depuis Bureau)
    await app.renderView('planning');
    assert(app.state.currentView === 'planning', "Navigation au Planning (clic 1)");
    const focusBtns = mockContainer.querySelectorAll('.btn-start-focus');
    assert(focusBtns.length > 0, "Planning contient des boutons de démarrage de session sur les événements");

    await app.startFocusSession(app.state.calendarData.events[0]);
    assert(app.state.currentView === 'focus', "Focus lancé depuis événement Planning (clic 2)");
    assert(mockContainer.innerHTML.includes('Révision Algo'), "FocusView affiche le titre de l'événement d'étude");

    // 6. Quitter Focus et retour
    await app.renderView('desktop');
    assert(app.state.currentView === 'desktop', "Retour au Bureau fonctionnel");

    console.log(`\nRÉSULTAT : ${passed} / ${total} assertions validées.`);
    if (passed !== total) process.exitCode = 1;
}

testNavigation().catch(err => {
    console.error("Erreur inattendue dans le test :", err);
    process.exitCode = 1;
});
