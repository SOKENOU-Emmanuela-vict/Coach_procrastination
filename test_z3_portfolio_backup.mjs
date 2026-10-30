import { MemoryProvider } from './src/services/MemoryProvider.js';
import fs from 'fs';
import path from 'path';

let passed = 0;
let failed = 0;

function assert(condition, message) {
    if (condition) {
        console.log(`✅ PASS: ${message}`);
        passed++;
    } else {
        console.error(`❌ FAIL: ${message}`);
        failed++;
    }
}

// Minimal mock container for testing DOM rendering
class MockElement {
    constructor(id = '', tag = 'div') {
        this.id = id;
        this.tagName = tag.toUpperCase();
        this.children = [];
        this.attributes = {};
        this._innerHTML = '';
        this.classList = {
            _classes: new Set(),
            add: (c) => this.classList._classes.add(c),
            remove: (c) => this.classList._classes.delete(c),
            contains: (c) => this.classList._classes.has(c)
        };
    }
    setAttribute(k, v) { this.attributes[k] = String(v); }
    getAttribute(k) { return this.attributes[k] ?? null; }
    hasAttribute(k) { return k in this.attributes; }
    get innerHTML() { return this._innerHTML; }
    set innerHTML(html) {
        this._innerHTML = html;
        this.children = [];
        const tagRegex = /<([a-z0-9-]+)([^>]*)>(.*?)<\/\1>|<([a-z0-9-]+)([^>]*)\/?>/gis;
        let match;
        while ((match = tagRegex.exec(html)) !== null) {
            const tagName = match[1] || match[4];
            const attrStr = match[2] || match[5] || '';
            const el = new MockElement('', tagName);
            el.innerHTML = match[3] || '';
            const attrRegex = /([a-z0-9-_]+)(?:=["']([^"']*)["'])?/gi;
            let aMatch;
            while ((aMatch = attrRegex.exec(attrStr)) !== null) {
                el.setAttribute(aMatch[1], aMatch[2] !== undefined ? aMatch[2] : 'true');
                if (aMatch[1] === 'id') el.id = aMatch[2];
            }
            this.children.push(el);
        }
    }
    querySelector(selector) {
        return this.querySelectorAll(selector)[0] || null;
    }
    querySelectorAll(selector) {
        const results = [];
        const matchEl = (el) => {
            if (selector.startsWith('#')) {
                if (el.id === selector.slice(1)) results.push(el);
            } else if (selector.startsWith('.')) {
                if (el.classList.contains(selector.slice(1))) results.push(el);
            } else if (selector.includes('[') && selector.includes(']')) {
                const m = selector.match(/\[([a-z0-9-_]+)(?:=["']?([^"']*)["']?)?\]/i);
                if (m) {
                    const attr = m[1];
                    const val = m[2];
                    if (val !== undefined) {
                        if (el.getAttribute(attr) === val) results.push(el);
                    } else if (el.hasAttribute(attr)) {
                        results.push(el);
                    }
                }
            } else if (el.tagName.toLowerCase() === selector.toLowerCase()) {
                results.push(el);
            }
            el.children.forEach(matchEl);
        };
        this.children.forEach(matchEl);
        return results;
    }
    addEventListener() {}
}

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

const { App } = await import('./src/core/App.js');
const { Router } = await import('./src/core/Router.js');

async function runTests() {
    console.log("=== TEST Z3 : SUPPRESSION PORTFOLIO ET SAUVEGARDE SUR LE BUREAU ===");

    // 1. Vérification que PortfolioView.js est bien supprimé du disque
    const portfolioViewExists = fs.existsSync(path.resolve('src/ui/PortfolioView.js'));
    assert(!portfolioViewExists, "1. PortfolioView.js est supprimé du disque");

    // 2. Vérification que Router ne charge plus PortfolioView et redirige 'portfolio' vers 'desktop'
    const storage = new MemoryProvider();
    const app = new App(storage);
    const router = new Router(mockContainer, app);

    assert(!('portfolio' in router.views), "2. 'portfolio' n'est plus une vue enregistrée dans Router.views");
    
    // Redirection
    await router.render('portfolio', { userProfile: { name: 'Emma' } });
    assert(mockContainer.innerHTML.includes('Bonjour, Emma'), "3. Navigation 'portfolio' redirige automatiquement vers le Bureau");

    // 3. Bouton Sauvegarde & modale d'export/import sur le Bureau
    await router.render('desktop', { userProfile: { name: 'Emma' } });
    assert(mockContainer.innerHTML.includes('id="btn-backup-modal"'), "4. Bouton 'Sauvegarde' présent sur le Bureau");
    assert(mockContainer.innerHTML.includes('id="backup-modal"'), "5. Modale 'Sauvegarde' intégrée sur le Bureau");
    assert(mockContainer.innerHTML.includes('id="btn-export-data"'), "6. Bouton '#btn-export-data' présent dans la modale Sauvegarde");
    assert(mockContainer.innerHTML.includes('id="input-import-data"'), "7. Champ '#input-import-data' présent dans la modale Sauvegarde");

    // 4. Absence totale du bouton Portfolio dans le menu du Bureau
    const navItems = mockContainer.querySelectorAll('.bureau-nav-item');
    const viewsInNav = navItems.map(n => n.getAttribute('data-view'));
    assert(!viewsInNav.includes('portfolio'), "8. Aucun lien Portfolio dans la barre latérale du Bureau");

    // 5. Test du cycle complet : Données -> Export -> Vidage de la base -> Réimport -> Données restaurées
    console.log("\n--- TEST CYCLE DE SAUVEGARDE / RESTAURATION ---");

    // A. Injection de données réalistes
    await storage.saveData('user_profile', { id: 'u1', name: 'Emma', xp: 450 });
    await storage.saveData('acad_subjects', [
        { id: 'sub_algo', name: 'Algorithmique Avancée', code: 'INFO201', cect: 6 }
    ]);
    await storage.saveData('acad_grades', [
        { id: 'gr_1', subjectId: 'sub_algo', score: 17 }
    ]);
    await storage.saveData('projects', [
        { id: 'proj_ai', title: 'Assistant IA Personnel', status: 'active', duration: '3 mois' }
    ]);
    await storage.saveData('daily_checkins', [
        { date: '2026-10-25', energy: 4, mood: 5 }
    ]);
    await storage.saveData('events', [
        { id: 'ev_1', title: 'Cours Maths', date: '2026-10-30', startTime: '09:00', endTime: '11:00' }
    ]);

    // B. Export complet
    const exportedData = await app.exportAllData();
    assert(exportedData && typeof exportedData === 'object', "9. exportAllData() a généré un objet de sauvegarde");
    assert(exportedData._meta?.app === 'coach_procrastination', "10. Métadonnées d'export valides");
    assert(exportedData.acad_subjects?.length === 1, "11. Matières présentes dans l'export");
    assert(exportedData.projects?.length === 1, "12. Projets présents dans l'export");
    assert(exportedData.daily_checkins?.length === 1, "13. Check-ins présents dans l'export");
    assert(exportedData.events?.length === 1, "14. Événements présents dans l'export");

    // C. Vidage complet de la base
    const allKeys = await storage.getAllKeys();
    for (const key of allKeys) {
        await storage.saveData(key, null);
    }
    const afterClearSubjects = await storage.loadData('acad_subjects');
    const afterClearProjects = await storage.loadData('projects');
    assert(!afterClearSubjects || afterClearSubjects.length === 0, "15. Base vidée : 0 matière");
    assert(!afterClearProjects || afterClearProjects.length === 0, "16. Base vidée : 0 projet");

    // D. Réimport de la sauvegarde
    await app.importAllData(exportedData);

    // E. Vérification de la restauration exacte des données
    const restoredProfile = await storage.loadData('user_profile');
    const restoredSubjects = await storage.loadData('acad_subjects');
    const restoredGrades = await storage.loadData('acad_grades');
    const restoredProjects = await storage.loadData('projects');
    const restoredCheckins = await storage.loadData('daily_checkins');
    const restoredEvents = await storage.loadData('events');

    assert(restoredProfile?.name === 'Emma', "17. Profil restauré avec succès");
    assert(restoredSubjects?.length === 1 && restoredSubjects[0].name === 'Algorithmique Avancée', "18. Matière 'Algorithmique Avancée' restaurée");
    assert(restoredGrades?.length === 1 && restoredGrades[0].score === 17, "19. Note 17/20 restaurée");
    assert(restoredProjects?.length === 1 && restoredProjects[0].title === 'Assistant IA Personnel', "20. Projet 'Assistant IA Personnel' restauré");
    assert(restoredCheckins?.length === 1 && restoredCheckins[0].mood === 5, "21. Check-ins restaurés");
    assert(restoredEvents?.length === 1 && restoredEvents[0].title === 'Cours Maths', "22. Événement planning restauré");

    // 6. Vérification sw.js : PortfolioView ne figure plus dans la liste des assets
    const swContent = fs.readFileSync('sw.js', 'utf8');
    assert(!swContent.includes('PortfolioView.js'), "23. PortfolioView.js est absent de sw.js");

    console.log(`\n=== RÉSULTATS : ${passed}/${passed + failed} PASSÉS ===`);
    if (failed > 0) process.exit(1);
}

runTests().catch(e => {
    console.error("Erreur fatale test Z3 :", e);
    process.exit(1);
});
