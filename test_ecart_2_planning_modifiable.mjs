import assert from 'assert';

global.document = {
    getElementById: (id) => ({
        id,
        value: '',
        style: {},
        innerHTML: '',
        addEventListener: () => {},
        appendChild: () => {},
        querySelector: () => null,
        querySelectorAll: () => []
    }),
    querySelector: () => null,
    querySelectorAll: () => [],
    createElement: (tag) => ({
        tagName: tag,
        id: '',
        style: {},
        innerHTML: '',
        addEventListener: () => {},
        appendChild: () => {},
        querySelector: () => null,
        querySelectorAll: () => []
    }),
    body: {
        classList: { add: () => {}, remove: () => {} },
        appendChild: () => {}
    }
};

import { PlanningEngine } from './src/engines/PlanningEngine.js';
import { App } from './src/core/App.js';
import { Event } from './src/models/Event.js';
import { EventModal } from './src/ui/EventModal.js';
import { PlanningView } from './src/ui/PlanningView.js';
import { CalendarView } from './src/ui/CalendarView.js';

class MockStorage {
    constructor() {
        this.data = {};
    }
    async loadData(key) {
        return this.data[key] || null;
    }
    async saveData(key, val) {
        this.data[key] = val;
    }
}

async function runTests() {
    console.log("--- Test Écart 2 : Planning modifiable sans IA ---");

    const storage = new MockStorage();
    const planningEngine = new PlanningEngine(storage);

    const app = new App(storage, null, null, null, null, null, null, null);
    app.planningEngine = planningEngine;
    app.renderView = async (v) => { app.state.currentView = v; };

    // 1. Sauvegarde d'un événement sans IA (CRUD direct via App / Formulaire)
    const eventData = {
        title: "Séance Algo Personnelle",
        date: "2026-10-15",
        startTime: "14:00",
        endTime: "16:00",
        type: "course",
        lockStatus: "locked",
        repetition: "none"
    };

    await app.saveCalendarEvent(eventData);

    let allEvents = await planningEngine.getEvents();
    assert.strictEqual(allEvents.length, 1, "Un événement doit être créé");
    const created = allEvents[0];
    assert.strictEqual(created.title, "Séance Algo Personnelle");
    assert.strictEqual(created.date, "2026-10-15");
    assert.strictEqual(created.startTime, "14:00");
    assert.strictEqual(created.endTime, "16:00");
    assert.strictEqual(created.type, "course");
    assert.strictEqual(created.lockStatus, "locked");
    console.log("✅ 1. Création d'événement manuel validée");

    // 2. Modification de l'événement (même id, nouvelles valeurs)
    const updatedData = {
        id: created.id,
        title: "Séance Algo Avancée",
        date: "2026-10-15",
        startTime: "14:30",
        endTime: "16:30",
        type: "course",
        lockStatus: "flexible",
        repetition: "none"
    };

    await app.saveCalendarEvent(updatedData);

    allEvents = await planningEngine.getEvents();
    assert.strictEqual(allEvents.length, 1, "Toujours 1 événement après mise à jour");
    const updated = allEvents[0];
    assert.strictEqual(updated.title, "Séance Algo Avancée");
    assert.strictEqual(updated.startTime, "14:30");
    assert.strictEqual(updated.endTime, "16:30");
    assert.strictEqual(updated.lockStatus, "flexible");
    console.log("✅ 2. Modification d'événement manuel validée");

    // 3. Répétition hebdomadaire (weekly -> 4 occurrences)
    const repeatingWeekly = {
        title: "Sport Hebdo",
        date: "2026-10-16",
        startTime: "18:00",
        endTime: "19:00",
        type: "sport",
        lockStatus: "flexible",
        repetition: "weekly"
    };

    await app.saveCalendarEvent(repeatingWeekly);
    allEvents = await planningEngine.getEvents();
    // 1 ancien + 4 nouveaux = 5
    assert.strictEqual(allEvents.length, 5, "La répétition hebdomadaire doit générer 4 occurrences");
    const sportEvents = allEvents.filter(e => e.title === "Sport Hebdo");
    assert.strictEqual(sportEvents.length, 4);
    assert.strictEqual(sportEvents[0].date, "2026-10-16");
    assert.strictEqual(sportEvents[1].date, "2026-10-23");
    assert.strictEqual(sportEvents[2].date, "2026-10-30");
    assert.strictEqual(sportEvents[3].date, "2026-11-06");
    console.log("✅ 3. Répétition hebdomadaire validée (4 semaines)");

    // 4. Répétition quotidienne (daily -> 7 occurrences)
    const repeatingDaily = {
        title: "Méditation Matinale",
        date: "2026-10-20",
        startTime: "07:30",
        endTime: "08:00",
        type: "personal",
        lockStatus: "flexible",
        repetition: "daily"
    };

    await app.saveCalendarEvent(repeatingDaily);
    allEvents = await planningEngine.getEvents();
    const meditationEvents = allEvents.filter(e => e.title === "Méditation Matinale");
    assert.strictEqual(meditationEvents.length, 7, "La répétition quotidienne doit générer 7 occurrences");
    assert.strictEqual(meditationEvents[0].date, "2026-10-20");
    assert.strictEqual(meditationEvents[6].date, "2026-10-26");
    console.log("✅ 4. Répétition quotidienne validée (7 jours)");

    // 5. Suppression de l'événement initial
    await app.deleteCalendarEvent(created.id);
    allEvents = await planningEngine.getEvents();
    assert.strictEqual(allEvents.find(e => e.id === created.id), undefined, "L'événement doit être supprimé");
    console.log("✅ 5. Suppression d'événement validée");

    // 6. Présence des éléments d'interface dans PlanningView et CalendarView
    const mockContainer = {
        innerHTML: '',
        querySelector: () => null,
        querySelectorAll: () => []
    };

    const planningView = new PlanningView(mockContainer, app);
    planningView.render({
        selectedDate: "2026-10-15",
        calendarData: {
            events: [
                { id: "e1", title: "Test Planning", date: "2026-10-15", startTime: "10:00", endTime: "11:00", type: "course" }
            ]
        },
        userProfile: { name: "Test" }
    });

    assert.ok(mockContainer.innerHTML.includes('id="btn-add-event-planning"'), "Bouton ajouter événement présent dans PlanningView");
    assert.ok(mockContainer.innerHTML.includes('btn-edit-event'), "Boutons modifier présents dans PlanningView");
    assert.ok(mockContainer.innerHTML.includes('btn-delete-event'), "Boutons supprimer présents dans PlanningView");
    console.log("✅ 6. Contrôles PlanningView validés (ajouter, modifier, supprimer)");

    const calendarView = new CalendarView(mockContainer, app);
    calendarView.render({
        calendarData: {
            events: [
                { id: "e2", title: "Test Calendar", date: "2026-10-15", startTime: "10:00", endTime: "11:00", type: "course" }
            ],
            projects: [],
            assessments: [],
            subjects: []
        }
    });

    assert.ok(mockContainer.innerHTML.includes('id="btn-add-event-calendar"'), "Bouton ajouter événement présent dans CalendarView");
    assert.ok(mockContainer.innerHTML.includes('btn-edit-event'), "Boutons modifier présents dans CalendarView");
    assert.ok(mockContainer.innerHTML.includes('btn-delete-event'), "Boutons supprimer présents dans CalendarView");
    console.log("✅ 7. Contrôles CalendarView validés (ajouter, modifier, supprimer)");

    // 8. EventModal initialisation
    const eventModal = new EventModal(app);
    assert.strictEqual(typeof eventModal.open, 'function', "EventModal doit exposer open()");
    assert.strictEqual(typeof eventModal.close, 'function', "EventModal doit exposer close()");
    assert.strictEqual(typeof eventModal.handleSave, 'function', "EventModal doit exposer handleSave()");
    console.log("✅ 8. Composant EventModal réutilisable validé");

    console.log("\n🎉 TOUS LES TESTS DE L'ÉCART 2 SONT VERTS !");
}

runTests().catch(err => {
    console.error("❌ Erreur test écart 2:", err);
    process.exit(1);
});
