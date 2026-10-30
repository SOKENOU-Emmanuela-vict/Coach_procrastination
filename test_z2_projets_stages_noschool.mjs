import { MemoryProvider } from './src/services/MemoryProvider.js';
import { ProjectEngine } from './src/engines/ProjectEngine.js';
import { Project } from './src/models/Project.js';
import { AcademicView } from './src/ui/AcademicView.js';

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

// Minimal DOM mock if running in Node
class MockElement {
    constructor(tagName = 'div') {
        this.tagName = tagName.toUpperCase();
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
    removeAttribute(k) { delete this.attributes[k]; }
    get id() { return this.attributes['id'] || ''; }
    set id(v) { this.setAttribute('id', v); }
    get value() { return this._value ?? ''; }
    set value(v) { this._value = v; }
    get checked() { return this._checked ?? false; }
    set checked(v) { this._checked = !!v; }
    addEventListener(evt, fn) {
        if (!this._listeners) this._listeners = {};
        if (!this._listeners[evt]) this._listeners[evt] = [];
        this._listeners[evt].push(fn);
    }
    dispatchEvent(evt) {
        const list = this._listeners?.[evt.type || evt] || [];
        list.forEach(fn => fn(evt));
    }
    click() {
        this.dispatchEvent({ type: 'click', currentTarget: this, target: this, preventDefault: () => {}, stopPropagation: () => {} });
    }
    get innerHTML() { return this._innerHTML; }
    set innerHTML(html) {
        this._innerHTML = html;
        this._parseMockChildren(html);
    }
    _parseMockChildren(html) {
        this.children = [];
        // simple tag match
        const tagRegex = /<([a-z0-9-]+)([^>]*)>(.*?)<\/\1>|<([a-z0-9-]+)([^>]*)\/?>/gis;
        let match;
        while ((match = tagRegex.exec(html)) !== null) {
            const tagName = match[1] || match[4];
            const attrStr = match[2] || match[5] || '';
            const inner = match[3] || '';
            const el = new MockElement(tagName);
            el.innerHTML = inner;
            const attrRegex = /([a-z0-9-_]+)(?:=["']([^"']*)["'])?/gi;
            let aMatch;
            while ((aMatch = attrRegex.exec(attrStr)) !== null) {
                const aName = aMatch[1];
                const aVal = aMatch[2] !== undefined ? aMatch[2] : 'true';
                el.setAttribute(aName, aVal);
                if (aName === 'class') {
                    aVal.split(/\s+/).forEach(c => el.classList.add(c));
                }
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
}

async function runTests() {
    console.log("=== TEST Z2 : PROJETS ET STAGES AUTONOMES SANS INFOS SCOLAIRES ===");

    const storage = new MemoryProvider();
    const projectEngine = new ProjectEngine(storage);

    // 1. Modèle Project & Stage autonome
    const proj1 = new Project({
        id: 'p_portfolio',
        title: 'Refonte Portfolio Web',
        type: 'project',
        status: 'active',
        startDate: '2026-11-01',
        endDate: '2026-12-15',
        duration: '6 semaines',
        location: '',
        notes: 'Construire une vitrine de mes compétences en GSAP et CSS',
        tasks: [
            { id: 's1', title: 'Maquette Wireframe', status: 'done', completed: true },
            { id: 's2', title: 'Développement HTML/CSS', status: 'todo', completed: false }
        ],
        subjectId: 'sub_maths_123' // Sujet existant en base à préserver discrètement !
    });

    assert(proj1.title === 'Refonte Portfolio Web', "1. Titre du projet correct");
    assert(proj1.type === 'project', "2. Type projet");
    assert(proj1.progress === 50, "3. Progression calculée : 1/2 étape terminée = 50%");
    assert(proj1.duration === '6 semaines', "4. Durée autonome");
    assert(proj1.subjectId === 'sub_maths_123', "5. Lien subjectId d'origine présent dans le modèle");

    // 2. Stage autonome
    const stage1 = new Project({
        id: 'st_data_analyst',
        title: 'Stage Assistant Data Analyst',
        type: 'stage',
        status: 'active',
        startDate: '2027-02-01',
        endDate: '2027-07-31',
        duration: '6 mois (35h/semaine)',
        location: 'Paris (2j télétravail)',
        notes: 'Convention signée avec TechCorp, tuteur M. Dupont',
        tasks: [
            { id: 'st1', title: 'Signature convention', status: 'done' },
            { id: 'st2', title: 'Prise de poste et onboarding', status: 'todo' },
            { id: 'st3', title: 'Rapport de mi-parcours', status: 'todo' }
        ]
    });

    assert(stage1.type === 'stage', "6. Type stage");
    assert(stage1.location === 'Paris (2j télétravail)', "7. Lieu du stage");
    assert(stage1.duration === '6 mois (35h/semaine)', "8. Durée du stage");
    assert(stage1.progress === 33, "9. Progression stage 1/3 = 33%");

    // 3. Sauvegarde dans ProjectEngine et conservation de subjectId
    await projectEngine.saveProject(proj1);
    await projectEngine.saveProject(stage1);

    const savedList = await projectEngine.getProjects();
    assert(savedList.length === 2, "10. Deux projets/stages sauvegardés");

    // Mise à jour sans toucher subjectId
    await projectEngine.saveProject({
        id: 'p_portfolio',
        title: 'Refonte Portfolio Web Pro',
        status: 'completed',
        duration: '7 semaines'
    });
    const reloadedProj = (await projectEngine.getProjects()).find(p => p.id === 'p_portfolio');
    assert(reloadedProj.title === 'Refonte Portfolio Web Pro', "11. Titre mis à jour");
    assert(reloadedProj.status === 'completed', "12. Statut passé à completed");
    assert(reloadedProj.subjectId === 'sub_maths_123', "13. RÈGLE D'OR : subjectId en base n'a pas été détruit");

    // 4. Test Rendu AcademicView en Bloc 1 (Projets & Stages)
    const mockContainer = new MockElement('div');
    const mockApp = {
        state: {
            academicSubjects: [{ id: 'sub_maths_123', name: 'Mathématiques', code: 'MATH101', cect: 6 }],
            academicSemesters: [{ id: 'sem_s3_26', name: 'Semestre 3' }],
            academicAssessments: [],
            academicGrades: [],
            projects: [reloadedProj, stage1],
            userProfile: { name: 'Emma' }
        },
        projectEngine,
        async saveProject(data) {
            const p = await projectEngine.saveProject(data);
            this.state.projects = await projectEngine.getProjects();
            return p;
        },
        async deleteProject(id) {
            await projectEngine.deleteProject(id);
            this.state.projects = await projectEngine.getProjects();
        }
    };

    const academicView = new AcademicView(mockContainer, mockApp);

    // A. Bloc 0 (Cursus)
    academicView.selectedBlock = 0;
    academicView.render(mockApp.state);
    assert(mockContainer.innerHTML.includes('CURSUS ACADÉMIQUE'), "14. Bloc 0 affiche CURSUS ACADÉMIQUE");
    assert(mockContainer.innerHTML.includes('id="btn-add-subject-top"'), "15. Bloc 0 propose + Matière");

    // B. Bloc 1 (Projets & Stages)
    academicView.selectedBlock = 1;
    academicView.render(mockApp.state);

    const htmlBlock1 = mockContainer.innerHTML;
    assert(htmlBlock1.includes('PROJETS & STAGES'), "16. Bloc 1 affiche le titre PROJETS & STAGES");
    assert(htmlBlock1.includes('id="btn-add-project"'), "17. Bloc 1 affiche le bouton + Projet");
    assert(htmlBlock1.includes('id="btn-add-stage"'), "18. Bloc 1 affiche le bouton + Stage");

    // ZÉRO MENTION SCOLAIRE DANS L'AFFICHAGE DU BLOC PROJETS & STAGES
    assert(!htmlBlock1.includes('btn-add-subject-top'), "19. Aucun bouton + Matière dans l'affichage des projets");
    assert(!htmlBlock1.includes('btn-add-semester'), "20. Aucun bouton + Semestre dans l'affichage des projets");
    assert(!htmlBlock1.includes('btn-import-example'), "21. Aucun import de cursus exemple dans les projets");
    assert(!htmlBlock1.includes('MATH101'), "22. Aucune matière MATH101 affichée dans la liste des projets");
    assert(!htmlBlock1.includes('CECT'), "23. Aucune mention de CECT dans les projets");
    assert(!htmlBlock1.includes('School'), "24. Aucun libellé School affiché");

    // AFFICHAGE DES INFOS AUTONOMES DU PROJET ET DU STAGE
    assert(htmlBlock1.includes('Refonte Portfolio Web Pro'), "25. Titre du projet rendu");
    assert(htmlBlock1.includes('Stage Assistant Data Analyst'), "26. Titre du stage rendu");
    assert(htmlBlock1.includes('Paris (2j télétravail)'), "27. Lieu du stage autonome rendu");
    assert(htmlBlock1.includes('6 mois (35h/semaine)'), "28. Durée du stage rendue");
    assert(htmlBlock1.includes('Convention signée avec TechCorp'), "29. Notes libres rendues");
    assert(htmlBlock1.includes('btn-edit-project'), "30. Bouton d'édition autonome présent");
    assert(htmlBlock1.includes('btn-delete-project'), "31. Bouton de suppression présent");
    assert(htmlBlock1.includes('form-add-step'), "32. Formulaire d'ajout d'étape présent");

    // 5. Suppression d'un projet
    await mockApp.deleteProject('p_portfolio');
    academicView.render(mockApp.state);
    assert(!mockContainer.innerHTML.includes('Refonte Portfolio Web Pro'), "33. Projet supprimé n'apparaît plus");
    assert(mockContainer.innerHTML.includes('Stage Assistant Data Analyst'), "34. Le stage reste présent");

    console.log(`\n=== RÉSULTATS : ${passed}/${passed + failed} PASSÉS ===`);
    if (failed > 0) process.exit(1);
}

runTests().catch(e => {
    console.error("Erreur fatale test Z2 :", e);
    process.exit(1);
});
