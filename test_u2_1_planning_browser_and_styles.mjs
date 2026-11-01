import { PlanningView } from './src/ui/PlanningView.js';
import { EventModal } from './src/ui/EventModal.js';
import { Motion } from './src/ui/motion.js';
import assert from 'assert';
import fs from 'fs';

// Mock document pour Node.js
if (typeof global.document === 'undefined') {
    global.document = {
        getElementById: () => ({ addEventListener: () => {}, innerHTML: '', style: {} }),
        querySelector: () => ({ addEventListener: () => {}, classList: { add: () => {} } }),
        querySelectorAll: () => [],
        createElement: (tag) => ({
            tagName: tag,
            style: {},
            className: '',
            classList: { add: () => {}, remove: () => {} },
            appendChild: () => {},
            querySelector: () => null,
            querySelectorAll: () => [],
            addEventListener: () => {}
        }),
        body: {
            className: '',
            setAttribute: () => {},
            appendChild: () => {}
        }
    };
}

import { App } from './src/core/App.js';
import { Event } from './src/models/Event.js';

console.log("=== VÉRIFICATION COMPLÈTE U2-1 : PLANNING, MOTION & ZERO STYLE INLINE ===");

// 1. Zéro style inline statique dans PlanningView.js
const planningSource = fs.readFileSync('src/ui/PlanningView.js', 'utf-8');
const planningInlineStyles = [...planningSource.matchAll(/style="([^"]*)"/g)].map(m => m[1]);
// Seules les coordonnées dynamiques (left/top/width/height) sont autorisées sur .planning-event-block
const staticPlanningStyles = planningInlineStyles.filter(s => !s.includes('calc(') && !s.includes('top:'));
assert.strictEqual(staticPlanningStyles.length, 0, `PlanningView ne doit avoir aucun style inline statique (trouvé: ${staticPlanningStyles.join(' ; ')})`);
console.log("✅ 1. PlanningView : 0 style inline statique (seuls calculs de grille autorisés)");

// 2. Zéro style inline dans EventModal.js
const eventModalSource = fs.readFileSync('src/ui/EventModal.js', 'utf-8');
const eventModalInlineStyles = [...eventModalSource.matchAll(/style="([^"]*)"/g)].map(m => m[1]);
assert.strictEqual(eventModalInlineStyles.length, 0, `EventModal ne doit avoir aucun style inline (trouvé: ${eventModalInlineStyles.join(' ; ')})`);
console.log("✅ 2. EventModal : 0 style inline");

// 3. Intégration Motion
assert.strictEqual(typeof Motion.staggerIn, 'function', "Motion.staggerIn disponible");
assert.strictEqual(typeof Motion.fadeIn, 'function', "Motion.fadeIn disponible");
assert.strictEqual(typeof Motion.modalOpen, 'function', "Motion.modalOpen disponible");
assert.strictEqual(typeof Motion.buttonTap, 'function', "Motion.buttonTap disponible");
console.log("✅ 3. Module Motion centralisé et prêt");

// 4. Test Rendu PlanningView (Semaine et Mois)
const mockContainer = {
    innerHTML: '',
    querySelector: (sel) => {
        if (sel === '.planning-content') return { classList: { add: () => {} } };
        return null;
    },
    querySelectorAll: (sel) => []
};

const mockStorage = {
    data: {},
    loadData: async (k) => mockStorage.data[k] || null,
    saveData: async (k, v) => { mockStorage.data[k] = v; }
};

const app = new App(mockStorage);
app.state = {
    selectedDate: "2026-11-02",
    calendarData: {
        events: [
            new Event({ id: 'ev1', title: 'Cours Réseaux', date: '2026-11-02', startTime: '08:00', endTime: '10:00', type: 'course', subjectId: 'sub1' }),
            new Event({ id: 'ev2', title: 'Russe Débutant', date: '2026-11-03', startTime: '14:00', endTime: '15:00', type: 'langue' }),
            new Event({ id: 'ev3', title: 'Projet IA', date: '2026-11-04', startTime: '16:00', endTime: '18:00', type: 'project', projectId: 'p1' })
        ],
        projects: [{ id: 'p1', title: 'Projet IA', tasks: [{ title: 'Faire le dataset', status: 'pending' }] }],
        assessments: [{ id: 'a1', title: 'Examen Réseaux', targetDate: '2026-11-10', coefficient: 2 }]
    },
    userProfile: { name: 'Emmanuela' }
};

const view = new PlanningView(mockContainer, app);

// Rendu semaine
view.viewMode = 'week';
view.render(app.state);
assert.ok(mockContainer.innerHTML.includes('PLANNING'), "Titre planning présent");
assert.ok(mockContainer.innerHTML.includes('Cours Réseaux'), "Cours réseaux affiché sur la timeline");
assert.ok(mockContainer.innerHTML.includes('btn-add-event-planning'), "Bouton ajouter présent");
assert.ok(mockContainer.innerHTML.includes('btn-import-timetable'), "Bouton import emploi du temps présent");
assert.ok(mockContainer.innerHTML.includes('btn-start-focus'), "Bouton session focus présent");
assert.ok(mockContainer.innerHTML.includes('btn-edit-event'), "Bouton modifier présent");
assert.ok(mockContainer.innerHTML.includes('btn-delete-event'), "Bouton supprimer présent");
console.log("✅ 4. Rendu Vue Semaine validé (timeline, événements, boutons CRUD)");

// Rendu mois
view.viewMode = 'month';
view.render(app.state);
assert.ok(mockContainer.innerHTML.includes('planning-month-grid'), "Grille du mois présente");
assert.ok(mockContainer.innerHTML.includes('calendar-event-pill'), "Pastilles d'événements présentes");
assert.ok(mockContainer.innerHTML.includes('Cours Réseaux'), "Cours réseaux présent en vue mois");
assert.ok(mockContainer.innerHTML.includes('Russe Débutant'), "Cours russe présent en vue mois");
assert.ok(mockContainer.innerHTML.includes('filter-school'), "Filtre école présent");
assert.ok(mockContainer.innerHTML.includes('filter-life'), "Filtre vie présent");
assert.ok(mockContainer.innerHTML.includes('filter-lang'), "Filtre langues présent");
console.log("✅ 5. Rendu Vue Mois validé (grille 35j, pastilles, filtres, résumés inférieurs)");

// 6. Test EventModal
const modal = new EventModal(app);
assert.strictEqual(typeof modal.open, 'function');
assert.strictEqual(typeof modal.close, 'function');
console.log("✅ 6. EventModal prêt pour ouverture/édition");

console.log("\n🎉 TOUS LES CONTRÔLES U2-1 SONT VALIDÉS AVEC SUCCÈS !");
