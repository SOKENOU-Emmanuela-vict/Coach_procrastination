import assert from 'assert';
import fs from 'fs';
import { CoachChatView } from './src/ui/CoachChatView.js';
import { BilanView } from './src/ui/BilanView.js';

console.log("=== TESTS U2-2 : COACH & BILANVIEW ZERO STYLE INLINE & AMBIANCE MESSAGERIE ===");

// 1. Zéro style inline statique dans CoachChatView.js
const coachCode = fs.readFileSync('./src/ui/CoachChatView.js', 'utf-8');
const coachMatches = (coachCode.match(/style=["'][^"']*["']/g) || []);
assert.strictEqual(coachMatches.length, 0, `CoachChatView.js ne doit contenir aucun style inline (trouvé: ${coachMatches.length})`);
console.log("✅ PASS: 1. CoachChatView.js contient 0 attribut style inline");

// 2. Zéro style inline statique dans BilanView.js
const bilanCode = fs.readFileSync('./src/ui/BilanView.js', 'utf-8');
const bilanMatches = (bilanCode.match(/style=["'][^"']*["']/g) || []);
assert.strictEqual(bilanMatches.length, 0, `BilanView.js ne doit contenir aucun style inline (trouvé: ${bilanMatches.length})`);
console.log("✅ PASS: 2. BilanView.js contient 0 attribut style inline");

// 3. Absence d'émojis décoratifs IA dans CoachChatView
assert(!coachCode.includes('🤖'), "CoachChatView n'utilise plus l'émoji robot 🤖 (remplacé par bi-robot)");
assert(!coachCode.includes('👋'), "CoachChatView n'utilise plus l'émoji main 👋 (remplacé par bi-chat-dots)");
console.log("✅ PASS: 3. Emojis décoratifs remplacés par des bootstrap-icons dans CoachChatView");

// 4. Rendu CoachChatView et data-univers
const mockBody = {
    className: '',
    attrs: {},
    setAttribute(k, v) { this.attrs[k] = v; },
    getAttribute(k) { return this.attrs[k]; }
};

const mockContainer = {
    innerHTML: '',
    querySelectorAll: () => [],
    querySelector: () => null
};

globalThis.document = {
    body: mockBody,
    getElementById: () => mockContainer
};

const mockApp = {
    state: {},
    getMaskedGeminiApiKey: () => null,
    renderView: () => {}
};

const chatView = new CoachChatView(mockContainer, mockApp);
chatView.render([]);

assert.strictEqual(mockBody.className, 'theme-light', "CoachChatView active theme-light");
assert.strictEqual(mockBody.getAttribute('data-univers'), 'coach', "CoachChatView active data-univers='coach'");
console.log("✅ PASS: 4. CoachChatView configure le fond clair theme-light et l'univers coach");

// 5. Rendu BilanView et data-univers
const bilanView = new BilanView(mockContainer, mockApp);
bilanView.render({
    summary: { execution: { completed: 2, completionRate: 100 }, actual: { minutes: 90 }, planned: { items: [] } },
    checkIn: null,
    stats: { completedTasksCount: 2, focusTime: 90 }
});

assert.strictEqual(mockBody.getAttribute('data-univers'), 'coach', "BilanView configure data-univers='coach'");
assert(mockContainer.innerHTML.includes('bilan-stats-card'), "BilanView utilise les classes CSS sémantiques bilan-stats-card");
console.log("✅ PASS: 5. BilanView configure l'univers coach et les classes sémantiques");

console.log("\n🎉 TOUS LES TESTS U2-2 COACH & BILANVIEW SONT PASSÉS !");
