import assert from 'assert';
import fs from 'fs';
import { FocusView } from './src/ui/FocusView.js';

console.log("=== TESTS U2-2 : FOCUS ZERO STYLE INLINE & AMBIANCE MINIMALISTE ===");

// 1. Zéro style inline statique dans FocusView.js
const focusCode = fs.readFileSync('./src/ui/FocusView.js', 'utf-8');
const focusMatches = (focusCode.match(/style=["'][^"']*["']/g) || []);
assert.strictEqual(focusMatches.length, 0, `FocusView.js ne doit contenir aucun style inline (trouvé: ${focusMatches.length})`);
console.log("✅ PASS: 1. FocusView.js contient 0 attribut style inline");

// 2. Absence d'émojis décoratifs dans FocusView
assert(!focusCode.includes('⏱️'), "FocusView n'utilise plus l'émoji chronomètre ⏱️");
assert(!focusCode.includes('🏠'), "FocusView n'utilise plus l'émoji maison 🏠");
assert(!focusCode.includes('📅'), "FocusView n'utilise plus l'émoji calendrier 📅");
assert(!focusCode.includes('📸'), "FocusView n'utilise plus l'émoji appareil photo 📸");
console.log("✅ PASS: 2. Emojis décoratifs remplacés par des bootstrap-icons dans FocusView");

// 3. Rendu FocusView et data-univers
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
    state: { dailyPlan: { sessions: [] } },
    renderView: () => {},
    showBilan: () => {}
};

const focusView = new FocusView(mockContainer, mockApp);

// Test sans session
focusView.render(null);
assert.strictEqual(mockBody.className, 'theme-light', "FocusView active theme-light");
assert.strictEqual(mockBody.getAttribute('data-univers'), 'focus', "FocusView active data-univers='focus'");
assert(mockContainer.innerHTML.includes('focus-card focus-empty-card'), "FocusView utilise les classes sémantiques focus-card");
console.log("✅ PASS: 3. FocusView sans session configure le fond clair et les classes sémantiques");

// Test avec session active
focusView.render({
    id: 's-test',
    title: 'Travail dirigé Mathématiques',
    objective: 'Résoudre les équations différentielles',
    expectedResult: 'Exercice 1 validé',
    expectedDuration: 30,
    resourceLink: 'https://example.com'
});

assert(mockContainer.innerHTML.includes('focus-timer-display'), "FocusView affiche le chronomètre avec classe sémantique");
assert(mockContainer.innerHTML.includes('btn-extend-time'), "FocusView contient les boutons d'extension");
assert(mockContainer.innerHTML.includes('btn-pre-complete-task'), "FocusView contient le bouton de validation");
console.log("✅ PASS: 4. FocusView avec session active configure l'écran minimaliste sans style inline");

console.log("\n🎉 TOUS LES TESTS U2-2 FOCUS SONT PASSÉS !");
if (focusView.timerInterval) clearInterval(focusView.timerInterval);
process.exit(0);
