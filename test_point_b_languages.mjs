import assert from 'assert';
import { LanguageEngine } from './src/engines/LanguageEngine.js';
import { LanguageView } from './src/ui/LanguageView.js';
import { PlanningEngine } from './src/engines/PlanningEngine.js';
import { App } from './src/core/App.js';

global.document = {
    getElementById: () => ({ addEventListener: () => {}, innerHTML: '', style: {} }),
    querySelector: () => null,
    querySelectorAll: () => []
};

class MockStorage {
    constructor() {
        this.data = {
            user_languages: [],
            events: [],
            chat_messages: [],
            pending_lang_conv: null
        };
    }
    async loadData(key) {
        return this.data[key] !== undefined ? JSON.parse(JSON.stringify(this.data[key])) : null;
    }
    async saveData(key, val) {
        this.data[key] = JSON.parse(JSON.stringify(val));
    }
}

async function run() {
    console.log("=== TEST POINT B: LANGUES (CRUD, RESSOURCES, PLAN, SUIVI & COACH) ===");
    let passed = 0;
    const check = (cond, msg) => {
        assert(cond, msg);
        console.log(`✅ PASS: ${msg}`);
        passed++;
    };

    const storage = new MockStorage();
    const langEngine = new LanguageEngine(storage);
    const planningEngine = new PlanningEngine(storage);

    // 1. État initial vide & affichage dans LanguageView
    const initialLangs = await langEngine.getLanguages();
    check(initialLangs.length === 0, "1a. Aucune langue au départ");

    const mockContainer = { innerHTML: '', querySelectorAll: () => [], querySelector: () => null };
    const mockApp = {
        languageEngine: langEngine,
        planningEngine: planningEngine,
        state: { userLanguages: [], userProfile: { name: 'Emmanuela' } },
        renderView: () => {}
    };
    const view = new LanguageView(mockContainer, mockApp);
    await view.render(mockApp.state);

    check(mockContainer.innerHTML.includes('id="languages-empty-state"'), "1b. État vide présent");
    check(mockContainer.innerHTML.includes('Ajoute ta première langue'), "1c. Message explicite 'Ajoute ta première langue'");
    check(mockContainer.innerHTML.includes('id="btn-add-first-lang"'), "1d. Bouton 'Ajouter ma première langue' présent");

    // 2. Multi-langues : ajout de plusieurs langues
    const langAnglais = await langEngine.saveLanguage({
        name: 'Anglais',
        level: 'B2',
        goal: 'Certification TOEIC 900',
        plan: { sessionsPerWeek: 3, duration: 45, preferredDays: ['monday', 'wednesday', 'friday'] }
    });
    check(langAnglais.id && langAnglais.name === 'Anglais', "2a. Première langue ajoutée (Anglais)");
    check(langAnglais.icon === '🇬🇧', "2b. Drapeau auto-détecté pour l'Anglais");

    const langEspagnol = await langEngine.saveLanguage({
        name: 'Espagnol',
        level: 'A2',
        goal: 'Voyage en Amérique Latine',
        plan: { sessionsPerWeek: 2, duration: 30, preferredDays: ['tuesday', 'thursday'] }
    });
    check(langEspagnol.id && langEspagnol.name === 'Espagnol', "2c. Deuxième langue ajoutée (Espagnol)");
    check(langEspagnol.icon === '🇪🇸', "2d. Drapeau auto-détecté pour l'Espagnol");

    let allLangs = await langEngine.getLanguages();
    check(allLangs.length === 2, "2e. Deux langues bien stockées en parallèle");

    // 3. Niveau et objectif modifiables
    await langEngine.saveLanguage({
        id: langAnglais.id,
        level: 'C1',
        goal: 'Aisance professionnelle et réunions'
    });
    const updatedAnglais = await langEngine.getLanguage(langAnglais.id);
    check(updatedAnglais.level === 'C1', "3a. Niveau de l'anglais modifié en C1");
    check(updatedAnglais.goal === 'Aisance professionnelle et réunions', "3b. Objectif de l'anglais modifié");

    // 4. Ressources : liens, livres, applis, vidéos (Ajout, Modif, Suppr)
    const res1 = await langEngine.addResource(langAnglais.id, {
        title: 'Altissia FORCE-N',
        type: 'link',
        value: 'https://formation.force-n.sn/course/view.php?id=649'
    });
    check(res1.id && res1.type === 'link', "4a. Ressource Lien ajoutée");

    const res2 = await langEngine.addResource(langAnglais.id, {
        title: 'Grammar in Use',
        type: 'book',
        value: 'Unités 1 à 15'
    });
    check(res2.id && res2.type === 'book', "4b. Ressource Livre ajoutée");

    const res3 = await langEngine.addResource(langAnglais.id, {
        title: 'Duolingo',
        type: 'app',
        value: 'Pratique quotidienne 10min'
    });
    check(res3.id && res3.type === 'app', "4c. Ressource Appli ajoutée");

    const res4 = await langEngine.addResource(langAnglais.id, {
        title: 'BBC Learning English',
        type: 'video',
        value: 'https://youtube.com/bbclearningenglish'
    });
    check(res4.id && res4.type === 'video', "4d. Ressource Vidéo ajoutée");

    let checkLangWithRes = await langEngine.getLanguage(langAnglais.id);
    check(checkLangWithRes.resources.length === 4, "4e. 4 ressources associées à la langue");

    // Modification d'une ressource
    await langEngine.updateResource(langAnglais.id, res2.id, {
        title: 'English Grammar in Use (Advanced)',
        value: 'Unités 1 à 30'
    });
    checkLangWithRes = await langEngine.getLanguage(langAnglais.id);
    const modRes = checkLangWithRes.resources.find(r => r.id === res2.id);
    check(modRes.title === 'English Grammar in Use (Advanced)', "4f. Ressource modifiée avec succès");

    // Suppression d'une ressource
    await langEngine.deleteResource(langAnglais.id, res3.id);
    checkLangWithRes = await langEngine.getLanguage(langAnglais.id);
    check(checkLangWithRes.resources.length === 3, "4g. Ressource supprimée avec succès");

    // 5. Suivi (séances, minutes, vocabulaire)
    await langEngine.updateTracking(langAnglais.id, { sessionsDelta: 2, minutesDelta: 90, vocabDelta: 35 });
    let tracking = (await langEngine.getLanguage(langAnglais.id)).tracking;
    check(tracking.sessionsCompleted === 2, "5a. Séances complétées incrémentées à 2");
    check(tracking.minutesStudied === 90, "5b. Minutes d'étude incrémentées à 90");
    check(tracking.vocabularyWords === 35, "5c. Mots de vocabulaire incrémentés à 35");

    await langEngine.updateTracking(langAnglais.id, { vocabDelta: 15 });
    tracking = (await langEngine.getLanguage(langAnglais.id)).tracking;
    check(tracking.vocabularyWords === 50, "5d. Mots de vocabulaire mis à jour à 50");

    // 6. Plan d'apprentissage qui crée des séances dans le planning
    const baseDate = new Date();
    const planResult = await langEngine.generatePlanningSessions(langAnglais.id, planningEngine, baseDate);
    check(planResult.success === true, "6a. Génération des séances dans le planning réussie");
    check(planResult.count > 0, "6b. Nombre de séances créées > 0");
    
    const events = await planningEngine.getEvents();
    const langEvents = events.filter(e => e.source === 'language_plan');
    check(langEvents.length === planResult.count, "6c. Événements de langue matérialisés dans le planning");
    check(langEvents[0].title.includes('Pratique Anglais'), "6d. Titre des événements conforme à la langue");

    // 7. Rendu dans LanguageView avec données présentes
    mockApp.state.userLanguages = await langEngine.getLanguages();
    await view.render(mockApp.state);
    check(mockContainer.innerHTML.includes('Anglais'), "7a. Rendu de la carte Anglais");
    check(mockContainer.innerHTML.includes('Espagnol'), "7b. Rendu de la carte Espagnol");
    check(mockContainer.innerHTML.includes('btn-add-resource'), "7c. Bouton ajouter ressource présent");
    check(mockContainer.innerHTML.includes('btn-apply-plan-planning'), "7d. Bouton planifier dans agenda présent");

    // 8. Coach : pose UNE question à la fois (niveau -> objectif -> temps disponible)
    const chatMsgsList = [];
    const chatHistoryEngine = {
        saveMessage: async (msg) => {
            chatMsgsList.push(msg);
            await storage.saveData('chat_messages', chatMsgsList);
            return msg;
        },
        getRecentMessages: async () => chatMsgsList,
        getMessages: async () => chatMsgsList
    };

    const fullApp = new App(
        storage, null,
        { getDailyStats: async()=>({}), getFullHistory: async()=>[], getMonthlyStats: async()=>({}) },
        { buildDailySummary: async()=>({}), getCheckIn: async()=>({}) },
        null, null, chatHistoryEngine, null
    );
    fullApp.academicEngine = { getSemesterSummary: async()=>({}), getSubjects: async()=>[], getGrades: async()=>[], getAssessments: async()=>[] };
    fullApp.planningEngine = planningEngine;
    fullApp.renderView = () => {};

    // 8.1 Déclenchement du coach de langue
    await fullApp.sendChatMessage("Je veux apprendre l'Allemand");
    let lastMsg = chatMsgsList[chatMsgsList.length - 1];
    check(lastMsg.role === 'assistant', "8a. Réponse de l'assistant coach reçue");
    check(lastMsg.content.includes("niveau actuel"), "8b. Le coach pose UNIQUEMENT la question du niveau");
    check(!lastMsg.content.includes("temps disponible"), "8c. Ne pose pas la question du temps disponible en même temps");

    // 8.2 Réponse pour le niveau -> Coach demande l'objectif (UNE seule question)
    await fullApp.sendChatMessage("Je suis grand débutant A1");
    lastMsg = chatMsgsList[chatMsgsList.length - 1];
    check(lastMsg.content.includes("A1"), "8d. Coach reformule le niveau A1");
    check(lastMsg.content.includes("objectif"), "8e. Coach pose UNIQUEMENT la question de l'objectif");
    check(!lastMsg.content.includes("séances de"), "8f. Ne pose pas encore la question du rythme");

    // 8.3 Réponse pour l'objectif -> Coach demande le temps disponible (UNE seule question)
    await fullApp.sendChatMessage("Mon objectif est de pouvoir voyager à Berlin l'été prochain");
    lastMsg = chatMsgsList[chatMsgsList.length - 1];
    check(lastMsg.content.includes("temps disponible"), "8g. Coach pose UNIQUEMENT la question du temps disponible");

    // 8.4 Réponse pour le temps disponible -> Coach finalise, configure et planifie
    await fullApp.sendChatMessage("Je peux faire 3 séances de 30 minutes par semaine");
    lastMsg = chatMsgsList[chatMsgsList.length - 1];
    check(lastMsg.content.includes("Félicitations") && lastMsg.content.includes("Allemand"), "8h. Coach confirme la création du plan complet");
    check(lastMsg.content.includes("3 séances de 30 min"), "8i. Coach confirme le rythme choisi");

    const finalLangs = await fullApp.languageEngine.getLanguages();
    const allemand = finalLangs.find(l => l.name === 'Allemand');
    check(allemand !== undefined, "8j. La langue Allemand a été automatiquement enregistrée");
    check(allemand.level === 'A1', "8k. Niveau A1 bien enregistré");
    check(allemand.goal.includes('Berlin'), "8l. Objectif Berlin bien enregistré");
    check(allemand.plan.sessionsPerWeek === 3 && allemand.plan.duration === 30, "8m. Plan de 3x30 min configuré");

    const finalEvents = await planningEngine.getEvents();
    const allemandEvents = finalEvents.filter(e => e.title.includes('Allemand'));
    check(allemandEvents.length > 0, "8n. Séances d'allemand injectées dans le planning");

    console.log(`\n🎉 TOUS LES ${passed} TESTS DU POINT B ONT RÉUSSI !`);
}

run().catch(err => {
    console.error("Test failed:", err);
    process.exit(1);
});
