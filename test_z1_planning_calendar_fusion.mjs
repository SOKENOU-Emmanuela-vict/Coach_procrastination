/**
 * test_z1_planning_calendar_fusion.mjs
 * Test dédié pour la tâche Z1 :
 * - Calendrier fusionné dans Planning
 * - Support complet des modes Semaine et Mois avec sélecteur de vue
 * - Navigation temporelle en vue Semaine (précédente / suivante) et en vue Mois (mois précédent / suivant)
 * - Filtres d'affichage en vue Mois (École, Vie, Langue)
 * - CRUD événements sans IA fonctionnel en vue Semaine ET en vue Mois
 * - Widgets inférieurs de récapitulatif (Échéances École, Échéances Vie, Sessions Langue)
 * - Redirection automatique de la route 'calendar' vers 'planning' dans le Router
 * - Persistance du mode d'affichage
 */

import { App } from './src/core/App.js';
import { PlanningView } from './src/ui/PlanningView.js';
import { Event } from './src/models/Event.js';
import { Router } from './src/core/Router.js';
import fs from 'fs';
import path from 'path';

// --- Mocks légers d'environnement DOM ---
function createMockElement(id = '') {
    return {
        id,
        innerHTML: '',
        style: {},
        hidden: false,
        classList: { add: () => {}, remove: () => {}, contains: () => false },
        querySelectorAll: () => [],
        querySelector: () => null,
        addEventListener: () => {},
        setAttribute: () => {},
        getAttribute: () => null,
        remove: () => {}
    };
}

global.window = {
    location: { hash: '' },
    addEventListener: () => {},
    localStorage: {
        _data: {},
        getItem(k) { return this._data[k] || null; },
        setItem(k, v) { this._data[k] = String(v); },
        removeItem(k) { delete this._data[k]; }
    }
};

global.localStorage = global.window.localStorage;

global.document = {
    getElementById: (id) => createMockElement(id),
    querySelectorAll: () => [],
    querySelector: () => null,
    body: {
        className: '',
        setAttribute: () => {},
        classList: { add: () => {}, remove: () => {} }
    }
};

class MockStorage {
    constructor() { this.data = {}; }
    async loadData(key) { return this.data[key] || null; }
    async saveData(key, val) { this.data[key] = val; }
    loadDataSync(key) { return this.data[key] || null; }
    saveDataSync(key, val) { this.data[key] = val; }
}

async function runTests() {
    console.log("=== TESTS Z1 : FUSION DU CALENDRIER DANS LE PLANNING ===\n");
    let passed = 0;
    let total = 0;

    const assert = (condition, message) => {
        total++;
        if (condition) {
            console.log(`✅ PASS: ${message}`);
            passed++;
        } else {
            console.error(`❌ FAIL: ${message}`);
            process.exitCode = 1;
        }
    };

    // 1. Initialisation de l'App et du Storage
    const storage = new MockStorage();
    const app = new App(storage, null, null, null, null, null, null, null);
    app.storage = storage;
    app.planningEngine.storage = storage;
    app.refreshUserStats = async () => {};

    // 2. Suppression physique de CalendarView.js
    const calFileExists = fs.existsSync(path.join(process.cwd(), 'src/ui/CalendarView.js'));
    assert(!calFileExists, "1. CalendarView.js a été physiquement supprimé de src/ui/");

    // 3. Router : route 'calendar' retirée de this.views mais redirigée vers 'planning'
    const router = new Router('test-container', app);
    assert(router.views['calendar'] === undefined, "2. 'calendar' n'est plus une vue autonome dans router.views");
    assert(router.views['planning'] && router.views['planning'].constructor.name === 'PlanningView', "3. 'planning' est bien enregistré dans router.views");

    let redirectedView = null;
    router.views.planning.render = async (st) => { redirectedView = 'planning'; };
    await router.render('calendar', {});
    assert(redirectedView === 'planning', "4. Naviguer vers 'calendar' redirige de manière transparente vers 'planning'");

    // 4. PlanningView : structure de conteneur
    const mockContainer = createMockElement('planning-container');
    const planningView = new PlanningView(mockContainer, app);

    // 5. Rendu en Vue Semaine (par défaut)
    const state = {
        selectedDate: "2026-10-28",
        calendarData: {
            events: [
                new Event({ id: 'ev_math', title: 'Cours Maths', date: '2026-10-28', startTime: '09:00', endTime: '11:00', type: 'course', subjectId: 's_math' }),
                new Event({ id: 'ev_sport', title: 'Séance Natation', date: '2026-10-28', startTime: '18:00', endTime: '19:00', type: 'sport', projectId: 'p_sport' }),
                new Event({ id: 'ev_english', title: 'Anglais Conversation', date: '2026-10-29', startTime: '14:00', endTime: '15:00', type: 'langue' }),
                new Event({ id: 'ev_exam', title: 'CC Algèbre', date: '2026-11-02', startTime: '10:00', endTime: '12:00', type: 'CC' })
            ],
            projects: [
                { id: 'p_sport', title: 'Bien-être', tasks: [{ title: 'Faire du cardio', status: 'pending' }] }
            ],
            assessments: [
                { id: 'a_alg', title: 'Évaluation Algèbre', targetDate: '2026-11-05', coefficient: 2 }
            ]
        },
        userProfile: { name: 'Emmanuela' }
    };

    planningView.viewMode = 'week';
    planningView.render(state);

    assert(mockContainer.innerHTML.includes('PLANNING'), "5. Titre principal 'PLANNING' présent");
    assert(mockContainer.innerHTML.includes('data-planning-mode="week"'), "6. Bouton sélecteur 'Semaine' présent");
    assert(mockContainer.innerHTML.includes('data-planning-mode="month"'), "7. Bouton sélecteur 'Mois' présent");
    assert(mockContainer.innerHTML.includes('btn-add-event-planning'), "8. Bouton ajouter événement présent en vue Semaine");
    assert(mockContainer.innerHTML.includes('btn-import-timetable'), "9. Bouton importer emploi du temps présent");
    assert(mockContainer.innerHTML.includes('Cours Maths'), "10. Événement de cours affiché sur la timeline");
    assert(mockContainer.innerHTML.includes('btn-start-focus'), "11. Bouton démarrage session focus présent sur le cours");
    assert(mockContainer.innerHTML.includes('btn-prev-week') && mockContainer.innerHTML.includes('btn-next-week'), "12. Contrôles de navigation hebdo (précédent/suivant) présents");

    // 6. Bascule en Vue Mois
    planningView.viewMode = 'month';
    planningView.render(state);

    assert(mockContainer.innerHTML.includes('btn-prev-month') && mockContainer.innerHTML.includes('btn-next-month'), "13. Contrôles de navigation mensuelle (mois précédent/suivant) présents");
    assert(mockContainer.innerHTML.includes('filter-school'), "14. Filtre d'affichage 'École' présent en vue Mois");
    assert(mockContainer.innerHTML.includes('filter-life'), "15. Filtre d'affichage 'Vie' présent en vue Mois");
    assert(mockContainer.innerHTML.includes('filter-lang'), "16. Filtre d'affichage 'Langues' présent en vue Mois");
    assert(mockContainer.innerHTML.includes('planning-day-cell'), "17. Grille mensuelle avec cases de jour interactives présente");
    assert(mockContainer.innerHTML.includes('calendar-event-pill'), "18. Pastilles d'événements présentes dans les cases du mois");
    assert(mockContainer.innerHTML.includes('Cours Maths'), "19. Événement affiché dans la grille du mois");
    assert(mockContainer.innerHTML.includes('btn-edit-event') && mockContainer.innerHTML.includes('btn-delete-event'), "20. Actions modifier et supprimer présentes sur les pastilles en vue Mois");
    assert(mockContainer.innerHTML.includes('Échéances École'), "21. Widget inférieur Échéances École présent en vue Mois");
    assert(mockContainer.innerHTML.includes('Échéances Vie'), "22. Widget inférieur Échéances Vie présent en vue Mois");
    assert(mockContainer.innerHTML.includes('Sessions Langue'), "23. Widget inférieur Sessions Langue présent en vue Mois");

    // 7. Test de filtrage en vue Mois
    planningView.filters.school = false;
    planningView.render(state);
    assert(!mockContainer.innerHTML.includes('Cours Maths'), "24. Filtrage dynamique opérationnel (cours masqué quand filtre École inactif)");

    planningView.filters.school = true;
    planningView.render(state);
    assert(mockContainer.innerHTML.includes('Cours Maths'), "25. Cours réaffiché quand filtre École réactivé");

    // 8. CRUD sans IA : Création, modification et suppression via app
    app.renderView = async (v) => { app.state.currentView = v; };
    const evTest = new Event({ id: 'ev_crud_test', title: 'Révision Physique', date: '2026-10-28', startTime: '15:00', endTime: '16:00', type: 'revision' });
    await app.saveCalendarEvent(evTest);
    let events = await app.planningEngine.getEvents();
    assert(events.some(e => e.id === 'ev_crud_test'), "26. Création d'événement manuel enregistrée");

    evTest.title = 'Révision Physique Modifiée';
    await app.saveCalendarEvent(evTest);
    events = await app.planningEngine.getEvents();
    assert(events.find(e => e.id === 'ev_crud_test')?.title === 'Révision Physique Modifiée', "27. Modification d'événement manuel enregistrée");

    await app.deleteCalendarEvent('ev_crud_test');
    events = await app.planningEngine.getEvents();
    assert(!events.some(e => e.id === 'ev_crud_test'), "28. Suppression d'événement manuel enregistrée");

    // 9. Persistance du mode d'affichage via localStorage
    localStorage.setItem('planning_view_mode', 'month');
    const restoredView = new PlanningView(mockContainer, app);
    assert(restoredView.viewMode === 'month', "29. Mode d'affichage 'month' restauré depuis le stockage local (persistance F5)");

    localStorage.setItem('planning_view_mode', 'week');
    const restoredWeekView = new PlanningView(mockContainer, app);
    assert(restoredWeekView.viewMode === 'week', "30. Mode d'affichage 'week' restauré depuis le stockage local (persistance F5)");

    console.log(`\n=== RÉSULTATS Z1 : ${passed}/${total} ASSERTIONS PASSÉES ===\n`);
    if (passed !== total) process.exit(1);
}

runTests().catch(err => {
    console.error("❌ ERREUR NON CAPTURÉE DANS LES TESTS Z1 :", err);
    process.exit(1);
});
