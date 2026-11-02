import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { App } from './src/core/App.js';
import { PromptBuilder } from './src/ai/PromptBuilder.js';
import { DesktopView } from './src/ui/DesktopView.js';
import { AcademicView } from './src/ui/AcademicView.js';
import { PlanningView } from './src/ui/PlanningView.js';
import { LanguageView } from './src/ui/LanguageView.js';
import { CoachChatView } from './src/ui/CoachChatView.js';
import { LifeView } from './src/ui/LifeView.js';

console.log("=== TESTS W1 : PROFIL UTILISATEUR & PRÉNOM PARTOUT ===");

// 1. Mock Storage pour tester la sauvegarde sans écraser les autres champs
class MockStorage {
    constructor() { this.store = {}; }
    async loadData(key) { return this.store[key] ? JSON.parse(JSON.stringify(this.store[key])) : null; }
    async saveData(key, val) { this.store[key] = JSON.parse(JSON.stringify(val)); }
}

const storage = new MockStorage();
await storage.saveData('user_profile', {
    streak: 7,
    currentSemesterId: 'sem_s4_27',
    gamification: { level: 3, xp: 750, nextLevelXp: 1000 },
    groupe: 'TD2'
});

const app = new App(storage, null, null, null, null, null, null, null);
app.state = {
    userProfile: await storage.loadData('user_profile')
};

// 2. Test sauvegarde prénom + filière + photo
const saved = await app.saveUserProfile({
    name: 'Emmanuela',
    lastName: 'Sokenou',
    formation: 'L2 IA & Big Data',
    avatarPhoto: 'data:image/jpeg;base64,FAKEIMAGE'
});

assert.strictEqual(saved.name, 'Emmanuela', "Prénom enregistré");
assert.strictEqual(saved.streak, 7, "Streak préservé");
assert.strictEqual(saved.currentSemesterId, 'sem_s4_27', "currentSemesterId préservé");
assert.strictEqual(saved.gamification.level, 3, "Niveau gamification préservé");
assert.strictEqual(saved.groupe, 'TD2', "Groupe préservé");
console.log("✅ PASS: 1. saveUserProfile sauvegarde sans écraser les autres champs");

// 3. Test affichage sur tous les écrans
class MockElement {
    constructor(id = '') { this.id = id; this.innerHTML = ''; }
    querySelectorAll() { return []; }
    querySelector() { return null; }
    addEventListener() {}
}

const mockContainer = new MockElement('app-root');
if (typeof global.document === 'undefined') {
    global.document = {
        getElementById: (id) => mockContainer,
        querySelector: (sel) => mockContainer,
        querySelectorAll: (sel) => [],
        body: new MockElement('body')
    };
}

const state = {
    userProfile: saved,
    dailyPlan: { sessions: [], habits: [] },
    calendarData: { events: [], availabilities: [] },
    academicSummary: {},
    todayCheckIn: null
};

// 3.1 DesktopView
const deskContainer = new MockElement('app-root');
const deskView = new DesktopView(deskContainer, app);
deskView.render(state);
assert(deskContainer.innerHTML.includes('Bonjour, Emmanuela'), "Bureau : 'Bonjour, Emmanuela'");
assert(deskContainer.innerHTML.includes('id="btn-profile"'), "Bureau : avatar présent");
assert(deskContainer.innerHTML.includes('bureau-avatar-img') || deskContainer.innerHTML.includes('E'), "Bureau : photo ou initiale E");
console.log("✅ PASS: 2. Bureau affiche le prénom et l'avatar");

// 3.2 AcademicView
const acadContainer = new MockElement('app-root');
const acadView = new AcademicView(acadContainer, app);
acadView.render(state);
assert(acadContainer.innerHTML.includes('id="btn-profile"'), "École : bouton profil présent");
assert(acadContainer.innerHTML.includes('bureau-avatar-img') || acadContainer.innerHTML.includes('E'), "École : avatar présent");
console.log("✅ PASS: 3. École affiche l'avatar profil");

// 3.3 PlanningView
const planContainer = new MockElement('app-root');
const planView = new PlanningView(planContainer, app);
planView.render(state);
assert(planContainer.innerHTML.includes('Emmanuela'), "Planning : prénom affiché");
assert(planContainer.innerHTML.includes('id="btn-profile"'), "Planning : avatar présent");
console.log("✅ PASS: 4. Planning affiche le prénom et l'avatar");

// 3.4 LanguageView
const langContainer = new MockElement('app-root');
const langView = new LanguageView(langContainer, app);
await langView.render(state);
assert(langContainer.innerHTML.includes('id="btn-profile"'), "Langues : bouton profil présent");
console.log("✅ PASS: 5. Langues affiche l'avatar profil");

// 3.5 LifeView
const lifeContainer = new MockElement('app-root');
const lifeView = new LifeView(lifeContainer, app);
await lifeView.render(state);
assert(lifeContainer.innerHTML.includes('id="btn-profile"'), "Vie : bouton profil présent");
console.log("✅ PASS: 6. Vie affiche l'avatar profil");

// 3.6 CoachChatView
const chatContainer = new MockElement('app-root');
const chatView = new CoachChatView(chatContainer, app);
chatView.render([]);
assert(chatContainer.innerHTML.includes('id="btn-profile"'), "Coach : bouton profil présent");
console.log("✅ PASS: 7. Coach affiche l'avatar profil");

// 4. Test PromptBuilder (contexte envoyé à Gemini : uniquement le prénom)
const promptCtx = {
    user: saved,
    academic: {},
    conversation: [
        { role: 'user', content: 'Je veux réviser' }
    ]
};

const builtPrompt = PromptBuilder.build(promptCtx, "Aide-moi");
assert(builtPrompt.includes("Tu tutoies Emmanuela"), "PromptBuilder : tutoiement avec le prénom");
assert(builtPrompt.includes('"firstName":"Emmanuela"'), "PromptBuilder : firstName seul dans le contexte JSON");
assert(!builtPrompt.includes('"lastName":"Sokenou"'), "PromptBuilder : nom de famille exclu du prompt Gemini");
assert(builtPrompt.includes("Emmanuela : Je veux réviser"), "PromptBuilder : le rôle utilisateur dans la conversation porte le prénom");
console.log("✅ PASS: 8. PromptBuilder n'envoie que le prénom à Gemini et l'utilise dans les consignes");

console.log("\n🎉 TOUS LES TESTS W1 PASSENT AVEC SUCCÈS !");
