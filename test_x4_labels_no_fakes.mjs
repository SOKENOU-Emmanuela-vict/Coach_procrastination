/**
 * test_x4_labels_no_fakes.mjs
 * Test dédié pour la tâche X4 :
 * - Suppression des textes factices (18°C Paris dans CoachChatView)
 * - Suppression du bouton Déconnexion inerte dans PlanningView
 * - Francisation complète des libellés (École, Vie, Vie & Bien-être)
 * - Inventaire propre des états vides et absence de données factices
 */
import { CoachChatView } from './src/ui/CoachChatView.js';
import { PlanningView } from './src/ui/PlanningView.js';
// CalendarView fusionné dans PlanningView
import { DesktopView } from './src/ui/DesktopView.js';
import { EventModal } from './src/ui/EventModal.js';

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

const mockElements = new Map();
function createMockContainer(id = 'fake-container') {
    let _html = '';
    const container = {
        id,
        style: {},
        get innerHTML() { return _html; },
        set innerHTML(val) { _html = val; },
        querySelector: () => null,
        querySelectorAll: () => [],
        addEventListener: () => {},
        removeEventListener: () => {}
    };
    mockElements.set(id, container);
    return container;
}

global.window = {};
global.document = {
    body: { className: '', classList: { add: () => {}, remove: () => {} }, appendChild: () => {} },
    getElementById: (id) => mockElements.get(id) || null,
    querySelector: () => null,
    querySelectorAll: () => [],
    createElement: () => createMockContainer('created-modal')
};

async function runTests() {
    console.log("=== TESTS X4 : TEXTES FACTICES & LIBELLÉS FRANÇAIS ===");

    const mockApp = {
        getPedagogicalDate: () => '2026-10-27',
        getPedagogicalDateObject: () => new Date('2026-10-27T10:00:00'),
        renderView: () => {},
        clock: () => new Date('2026-10-27T10:00:00'),
        academicEngine: { getSemesters: async () => [], getSubjects: async () => [] },
        chatHistoryEngine: { getConversation: async () => [] },
        storage: { loadData: async () => null, saveData: async () => {} },
        state: { academicSubjects: [], academicSemesters: [] }
    };

    // -----------------------------------------------------------------
    // 1. CoachChatView : Plus de météo factice 18°C Paris
    // -----------------------------------------------------------------
    console.log("\n--- 1. CoachChatView sans 18°C ---");
    const chatContainer = createMockContainer('chat-view-container');
    const chatView = new CoachChatView('chat-view-container', mockApp);
    chatView.container = chatContainer;
    await chatView.render({ messages: [] });

    assert(!chatContainer.innerHTML.includes('18°C'), "1.1 '18°C' est introuvable dans CoachChatView");
    assert(!chatContainer.innerHTML.includes('Paris</span>'), "1.2 'Paris' météorologique est introuvable");
    assert(!chatContainer.innerHTML.includes('⛅'), "1.3 Émoji météo factice ⛅ supprimé");

    // -----------------------------------------------------------------
    // 2. PlanningView : Bouton Déconnexion supprimé
    // -----------------------------------------------------------------
    console.log("\n--- 2. PlanningView sans Déconnexion inerte ---");
    const planContainer = createMockContainer('planning-view-container');
    const planView = new PlanningView('planning-view-container', mockApp);
    planView.container = planContainer;
    planView.render({
        userProfile: { name: 'Emmanuela' },
        calendarData: { events: [] },
        dailyPlan: { sessions: [] }
    });

    assert(!planContainer.innerHTML.includes('Déconnexion'), "2.1 Bouton 'Déconnexion' supprimé de PlanningView");
    assert(planContainer.innerHTML.includes('Emmanuela'), "2.2 Le nom d'utilisateur est toujours affiché proprement");

    // -----------------------------------------------------------------
    // 3. CalendarView : Libellés en français (École, Vie) et pas de RSK
    // -----------------------------------------------------------------
    console.log("\n--- 3. PlanningView (vue Mois) libellés en français ---");
    const calContainer = createMockContainer('calendar-view-container');
    const calView = new PlanningView('calendar-view-container', mockApp);
    calView.viewMode = 'month';
    calView.container = calContainer;
    calView.render({
        calendarData: { events: [] },
        projects: []
    });

    assert(!calContainer.innerHTML.includes('RSK CALENDAR'), "3.1 'RSK CALENDAR' absent");
    assert(calContainer.innerHTML.includes('PLANNING'), "3.2 Titre propre 'PLANNING' présent");
    assert(!calContainer.innerHTML.includes('>Life<'), "3.3 Filtre 'Life' en anglais remplacé par 'Vie'");
    assert(calContainer.innerHTML.includes('>Vie<') || calContainer.innerHTML.includes('Vie'), "3.4 Filtre 'Vie' en français présent");
    assert(!calContainer.innerHTML.includes('Échéances Life'), "3.5 'Échéances Life' remplacé par 'Échéances Vie'");
    assert(calContainer.innerHTML.includes('Échéances Vie'), "3.6 'Échéances Vie' présent");

    // -----------------------------------------------------------------
    // 4. DesktopView : Vie & Bien-être
    // -----------------------------------------------------------------
    console.log("\n--- 4. DesktopView libellés en français ---");
    const deskContainer = createMockContainer('desktop-view-container');
    const deskView = new DesktopView('desktop-view-container', mockApp);
    deskView.container = deskContainer;
    deskView.render({
        userProfile: { name: 'Emmanuela' },
        coachInsights: [],
        calendarData: { events: [] },
        dailyPlan: { sessions: [] },
        userLanguages: []
    });

    assert(!deskContainer.innerHTML.includes('Life &amp; Bien-être') && !deskContainer.innerHTML.includes('Life & Bien-être'), "4.1 'Life & Bien-être' supprimé");
    assert(deskContainer.innerHTML.includes('Vie &amp; Bien-être') || deskContainer.innerHTML.includes('Vie & Bien-être'), "4.2 'Vie & Bien-être' présent");

    // -----------------------------------------------------------------
    // 5. EventModal : Personnel / Vie
    // -----------------------------------------------------------------
    console.log("\n--- 5. EventModal libellés en français ---");
    global.document.createElement = () => createMockContainer('created-modal');
    global.document.body.appendChild = () => {};
    const eventModal = new EventModal(mockApp);
    const modalEl = eventModal.ensureModal();

    assert(!modalEl.innerHTML.includes('Personnel / Life'), "5.1 'Personnel / Life' supprimé d'EventModal");
    assert(modalEl.innerHTML.includes('Personnel / Vie'), "5.2 'Personnel / Vie' présent dans EventModal");

    console.log(`\n======================================================`);
    console.log(`RÉSULTAT X4 : ${passed} / ${total} assertions validées.`);
    console.log(`======================================================`);
}

runTests().catch(err => {
    console.error("Erreur fatale test X4 :", err);
    process.exit(1);
});
