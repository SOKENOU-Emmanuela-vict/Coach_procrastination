import assert from 'assert';

// Mock minimal DOM for Node.js test environment
const mockElements = new Map();
function createMockContainer(id = 'fake-id') {
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

global.document = {
    body: { className: '', classList: { add: () => {}, remove: () => {} } },
    getElementById: (id) => mockElements.get(id) || createMockContainer(id),
    querySelector: () => null,
    querySelectorAll: () => []
};

const { DesktopView } = await import('./src/ui/DesktopView.js');
const { LifeView } = await import('./src/ui/LifeView.js');
// PortfolioView supprimé
const { WeeklyView } = await import('./src/ui/WeeklyView.js');
const { BilanView } = await import('./src/ui/BilanView.js');
const { FocusView } = await import('./src/ui/FocusView.js');

console.log("=== TEST POINT C : INVENTAIRE TEXTES STATIQUES & ÉTATS VIDES ===");

// 1. Bureau (DesktopView)
console.log("\n[1] Test DesktopView sans données inventées");
{
    const container = createMockContainer('desk-container');
    const app = {
        getPedagogicalDate: () => '2026-10-14',
        getPedagogicalDateObject: () => new Date('2026-10-14T10:00:00')
    };
    const view = new DesktopView('desk-container', app);
    view.container = container;

    // Test état vide (aucun profil, aucune langue, aucun check-in)
    const stateEmpty = {
        userProfile: {},
        coachInsights: [],
        calendarData: { events: [] },
        dailyPlan: { sessions: [] },
        userLanguages: []
    };
    view.render(stateEmpty);

    // Vérifier l'absence de données inventées
    assert.strictEqual(container.innerHTML.includes('Mathieu'), false, "DesktopView ne doit pas inventer le prénom 'Mathieu'");
    assert.strictEqual(container.innerHTML.includes('Bonjour, Toi'), true, "DesktopView utilise 'Toi' en fallback neutre");
    assert.strictEqual(container.innerHTML.includes('22°'), false, "DesktopView ne doit pas afficher de météo inventée 22° Paris");
    assert.strictEqual(container.innerHTML.includes('10:24'), false, "DesktopView ne doit pas afficher une heure figée 10:24");
    assert.strictEqual(container.innerHTML.includes('Aucune langue enregistrée.'), true, "DesktopView affiche un état vide pour les langues");
    assert.strictEqual(container.innerHTML.includes('Non renseigné'), true, "DesktopView affiche 'Non renseigné' pour le sommeil/hydratation manquants");

    // Test avec données réelles
    const stateWithData = {
        userProfile: { name: 'Emmanuela' },
        coachInsights: [],
        calendarData: { events: [] },
        dailyPlan: { sessions: [{ id: 's1', completed: true }] },
        userLanguages: [{ id: 'es', name: 'Espagnol', level: 'B1', tracking: { sessionsCompleted: 4 } }],
        todayCheckIn: { water: 1.5, sleep: { durationMinutes: 480 } }
    };
    view.render(stateWithData);
    assert.strictEqual(container.innerHTML.includes('Bonjour, Emmanuela'), true, "DesktopView affiche le vrai prénom");
    assert.strictEqual(container.innerHTML.includes('Espagnol'), true, "DesktopView affiche la vraie langue");
    assert.strictEqual(container.innerHTML.includes('1.5L'), true, "DesktopView affiche la vraie hydratation");
    assert.strictEqual(container.innerHTML.includes('8h'), true, "DesktopView affiche le vrai sommeil");
    console.log("  ✔ DesktopView validé (zéro texte statique inventé, états vides explicites)");
}

// 2. Vie (LifeView)
console.log("\n[2] Test LifeView sans données inventées");
{
    const container = createMockContainer('life-container');
    const app = {
        scheduler: { getHabits: async () => [] },
        projectEngine: { getGoals: async () => [] }
    };
    const view = new LifeView('life-container', app);
    view.container = container;

    // Rendu état vide
    await view.render({});

    // Vérifier l'absence des fausses stats fitness
    assert.strictEqual(container.innerHTML.includes('1850'), false, "LifeView ne doit pas afficher 1850 kcal inventées");
    assert.strictEqual(container.innerHTML.includes('kcal brûlées'), false, "LifeView ne doit pas afficher de jauge de calories inventée");
    assert.strictEqual(container.innerHTML.includes('8,432'), false, "LifeView ne doit pas afficher 8,432 pas inventés");
    assert.strictEqual(container.innerHTML.includes('Dark Knight OST'), false, "LifeView ne doit pas afficher une chanson inventée Dark Knight");
    assert.strictEqual(container.innerHTML.includes('Hans Zimmer'), false, "LifeView ne doit pas afficher Hans Zimmer en dur");
    assert.strictEqual(container.innerHTML.includes('Aucune habitude enregistrée.'), true, "LifeView affiche un état vide explicite pour les habitudes");
    assert.strictEqual(container.innerHTML.includes('Ouvrir Spotify'), true, "LifeView propose un raccourci d'ambiance musicale propre");

    // Rendu avec vrai check-in
    await view.render({
        todayCheckIn: { water: 2.0, sleep: { durationMinutes: 420 }, energy: 'high', dayAssessment: 'Journée efficace' }
    });
    assert.strictEqual(container.innerHTML.includes('2 L'), true, "LifeView affiche l'eau du check-in");
    assert.strictEqual(container.innerHTML.includes('7 h'), true, "LifeView affiche le sommeil du check-in");
    assert.strictEqual(container.innerHTML.includes('Haute'), true, "LifeView affiche l'énergie du check-in");
    assert.strictEqual(container.innerHTML.includes('Journée efficace'), true, "LifeView affiche le bilan du jour réel");
    console.log("  ✔ LifeView validé (calories/pas/titres supprimés, états vides explicites)");
}

// 3. Sauvegarde sur Bureau (ex-Portfolio)
console.log("\n[3] Test Sauvegarde sur Bureau (ex-Portfolio)");
{
    const container = createMockContainer('desktop-container');
    const { DesktopView } = await import('./src/ui/DesktopView.js');
    const view = new DesktopView('desktop-container', {});
    view.container = container;
    view.render({
        userProfile: { name: 'Emma' },
        calendarData: { events: [] },
        academicSummary: {},
        todayCheckIn: null
    });
    assert.strictEqual(container.innerHTML.includes('id="btn-backup-modal"'), true, "DesktopView propose le bouton Sauvegarde");
    assert.strictEqual(container.innerHTML.includes('id="btn-export-data"'), true, "Modale Sauvegarde propose l'export de données");
    assert.strictEqual(container.innerHTML.includes('id="input-import-data"'), true, "Modale Sauvegarde propose l'import de données");
    console.log("  ✔ Sauvegarde Bureau validée (remplace Portfolio sans perte de données)");
}

// 4. Weekly (WeeklyView)
console.log("\n[4] Test WeeklyView sans données inventées");
{
    const container = createMockContainer('weekly-container');
    const app = {};
    const view = new WeeklyView('weekly-container', app);
    view.container = container;

    // Rendu état sans sommeil ni résumés
    view.render({
        execution: {},
        trends: { lowEnergyDays: 0, averageSleep: null },
        dailySummaries: []
    });

    assert.strictEqual(container.innerHTML.includes('Sommeil moyen : <strong style="color:#fff;">Non renseigné</strong>'), true, "WeeklyView affiche 'Non renseigné' au lieu de '0 h' quand le sommeil n'a pas été mesuré");
    assert.strictEqual(container.innerHTML.includes('Aucun résumé de journée enregistré pour cette semaine.'), true, "WeeklyView affiche l'état vide explicite pour les jours");

    // Rendu avec données réelles
    view.render({
        execution: { actualDuration: 120, plannedDuration: 180, completionRate: 67 },
        trends: { lowEnergyDays: 1, averageSleep: 450 },
        dailySummaries: [{ date: '2026-10-12', completionRate: 80, energy: 'high' }]
    });
    assert.strictEqual(container.innerHTML.includes('7.5 h'), true, "WeeklyView affiche la vraie moyenne de sommeil calculée");
    assert.strictEqual(container.innerHTML.includes('📅 2026-10-12'), true, "WeeklyView affiche les résumés journaliers réels");
    console.log("  ✔ WeeklyView validé (sommeil moyen et jours sans données corrigés)");
}

// 5. Bilan (BilanView)
console.log("\n[5] Test BilanView sans données inventées");
{
    const container = createMockContainer('bilan-container');
    const app = {};
    const view = new BilanView('bilan-container', app);
    view.container = container;

    // Rendu état vide (aucune session)
    view.render({ summary: null, checkIn: null, stats: { completedTasksCount: 0, focusTime: 0 } });
    assert.strictEqual(container.innerHTML.includes('Aucune session enregistrée pour cette journée.'), true, "BilanView indique explicitement quand aucune session n'a eu lieu");

    // Rendu avec checkIn déjà validé
    view.render({
        summary: null,
        checkIn: { energy: 'high', sleep: { durationMinutes: 480 } },
        stats: {}
    });
    assert.strictEqual(container.innerHTML.includes('8h'), true, "BilanView affiche le sommeil du check-in");
    console.log("  ✔ BilanView validé (indication journée vide et sommeil propre)");
}

// 6. Focus (FocusView)
console.log("\n[6] Test FocusView sans données inventées");
{
    const container = createMockContainer('focus-container');
    const app = {
        state: { dailyPlan: { sessions: [] } }
    };
    const view = new FocusView('focus-container', app);
    view.container = container;

    // Cas 1 : aucune session programmée du tout
    view.render(null);
    assert.strictEqual(container.innerHTML.includes('Aucune session de focus active ou programmée pour aujourd\'hui.'), true, "FocusView affiche l'état vide neutre quand rien n'est planifié");
    assert.strictEqual(container.innerHTML.includes('Toutes les sessions sont terminées ! 🎉'), false, "FocusView n'affirme pas que des sessions sont terminées quand aucune n'existait");

    // Cas 2 : sessions programmées et toutes terminées
    app.state.dailyPlan.sessions = [{ id: 's1', completed: true }];
    view.render(null);
    assert.strictEqual(container.innerHTML.includes('Toutes les sessions prévues sont terminées ! 🎉'), true, "FocusView félicite uniquement si des sessions ont effectivement été planifiées");
    console.log("  ✔ FocusView validé (état vide neutre vs toutes terminées)");
}

console.log("\n✅ TOUS LES TESTS DU POINT C SONT VERTS !");
