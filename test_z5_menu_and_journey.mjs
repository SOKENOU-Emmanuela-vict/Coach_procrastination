import assert from 'node:assert';
import { App } from './src/core/App.js';
import { DesktopView } from './src/ui/DesktopView.js';
import { PlanningView } from './src/ui/PlanningView.js';
import { AcademicView } from './src/ui/AcademicView.js';
import { LanguageView } from './src/ui/LanguageView.js';
import { LifeView } from './src/ui/LifeView.js';
import { CoachChatView } from './src/ui/CoachChatView.js';

console.log("=== TESTS Z5 : MENU FINAL 6 ENTRÉES ET NAVIGATION ===");

const EXPECTED_MENU = [
    { view: 'desktop', label: 'Bureau' },
    { view: 'planning', label: 'Planning' },
    { view: 'academic', label: 'École' },
    { view: 'languages', label: 'Langues' },
    { view: 'life', label: 'Vie' },
    { view: 'chat', label: 'Coach' }
];

const mockState = {
    userProfile: { name: 'Emma', gamification: { level: 2, xp: 250, nextLevelXp: 1000 } },
    calendarData: { events: [], subjects: [], assessments: [], projects: [] },
    todayCheckIn: { sleep: { durationMinutes: 480, quality: 4 } },
    academicSummary: { average: { value: 14.5 }, cectStatus: { officialTotal: 30 } },
    coachInsights: [],
    lastCoachReminder: 'Tu as un examen dans 7 jours !',
    userLanguages: [{ id: 'lang-en', name: 'Anglais', level: 'B2', targetLevel: 'C1' }]
};

function createMockElement(id = 'app-root') {
    return {
        id,
        innerHTML: '',
        style: {},
        querySelector(selector) {
            return this.querySelectorAll(selector)[0] || null;
        },
        querySelectorAll(selector) {
            const results = [];
            if (!this.innerHTML) return results;

            if (selector === '.bureau-nav-item' || selector.includes('.bureau-nav-item')) {
                // Parse items with data-view and .bureau-nav-item
                const regex = /<div[^>]*class="[^"]*bureau-nav-item[^"]*"[^>]*data-view="([^"]+)"[^>]*>([\s\S]*?)<\/div>/gi;
                let match;
                while ((match = regex.exec(this.innerHTML)) !== null) {
                    const view = match[1];
                    const inner = match[2].replace(/<[^>]+>/g, '').trim();
                    results.push({
                        getAttribute: (attr) => attr === 'data-view' ? view : null,
                        textContent: inner,
                        innerHTML: match[2],
                        classList: { contains: (cls) => match[0].includes(cls) },
                        addEventListener: () => {}
                    });
                }
            }
            return results;
        },
        addEventListener: () => {}
    };
}

// Global browser mocks for node run
if (typeof global.document === 'undefined') {
    global.document = {
        getElementById: (id) => createMockElement(id),
        querySelector: () => null,
        querySelectorAll: () => [],
        body: {
            setAttribute: () => {},
            getAttribute: () => '',
            className: ''
        }
    };
}

const mockApp = {
    state: mockState,
    getPedagogicalDateObject: () => new Date('2026-10-30T10:00:00'),
    renderView: (v) => {},
    sendChatMessage: () => {},
    scheduler: {
        getHabits: async () => []
    },
    languageEngine: {
        getAllLanguagesSync: () => mockState.userLanguages,
        getLanguages: async () => mockState.userLanguages
    }
};

const viewClasses = [
    { name: 'DesktopView', ViewClass: DesktopView },
    { name: 'PlanningView', ViewClass: PlanningView },
    { name: 'AcademicView', ViewClass: AcademicView },
    { name: 'LanguageView', ViewClass: LanguageView },
    { name: 'LifeView', ViewClass: LifeView },
    { name: 'CoachChatView', ViewClass: CoachChatView }
];

for (const { name, ViewClass } of viewClasses) {
    const el = createMockElement('app-root');
    const view = new ViewClass(el, mockApp);
    await view.render(mockState);

    console.log(`\n--- Vérification menu dans ${name} ---`);
    assert(el.innerHTML.length > 0, `${name} doit produire du contenu HTML`);

    // Vérifier les 6 entrées
    for (let i = 0; i < EXPECTED_MENU.length; i++) {
        const item = EXPECTED_MENU[i];
        const dataViewPattern = new RegExp(`data-view="${item.view}"`, 'i');
        assert(dataViewPattern.test(el.innerHTML), `${name} doit contenir l'entrée de menu data-view="${item.view}"`);
        assert(el.innerHTML.includes(item.label), `${name} doit afficher le label "${item.label}"`);
    }

    // Vérifier l'ordre des entrées dans le HTML
    let lastIndex = -1;
    for (const item of EXPECTED_MENU) {
        const idx = el.innerHTML.indexOf(`data-view="${item.view}"`);
        assert(idx > -1, `${name} doit contenir data-view="${item.view}"`);
        assert(idx > lastIndex, `${name} ordre incorrect: data-view="${item.view}" (pos ${idx}) doit suivre la précédente (pos ${lastIndex})`);
        lastIndex = idx;
    }

    // Vérifier qu'aucune ancienne entrée n'est présente dans les menus
    const obsoleteViews = ['calendar', 'dashboard', 'weekly', 'portfolio'];
    for (const obs of obsoleteViews) {
        const obsPattern = new RegExp(`class="[^"]*bureau-nav-item[^"]*"[^>]*data-view="${obs}"`, 'i');
        assert(!obsPattern.test(el.innerHTML), `${name} NE DOIT PAS contenir d'entrée de menu pour "${obs}"`);
    }

    // Vérifier qu'aucune balise data-view="planning" n'est laissée non fermée
    // (Une balise mal formée aurait un data-view="planning" suivi immédiatement par une autre ouverture)
    const malformedPlanning = /data-view="planning"[^>]*>\s*<div[^>]*data-view=/i;
    assert(!malformedPlanning.test(el.innerHTML), `${name} ne doit pas avoir de balise planning non fermée`);

    console.log(`✅ ${name} : Les 6 entrées Bureau, Planning, École, Langues, Vie, Coach sont valides et bien ordonnées.`);
}

console.log("\n--- Vérification du Router et des redirections ---");
const fullApp = new App();
assert(typeof fullApp.router.views.desktop !== 'undefined', "Router a DesktopView");
assert(typeof fullApp.router.views.planning !== 'undefined', "Router a PlanningView");
assert(typeof fullApp.router.views.academic !== 'undefined', "Router a AcademicView");
assert(typeof fullApp.router.views.languages !== 'undefined', "Router a LanguageView");
assert(typeof fullApp.router.views.life !== 'undefined', "Router a LifeView");
assert(typeof fullApp.router.views.chat !== 'undefined', "Router a CoachChatView");

console.log("✅ Router configuré avec les 6 vues principales.");

console.log("\n==========================================");
console.log("TOUS LES TESTS Z5 SONT PASSÉS AVEC SUCCÈS !");
console.log("==========================================");
