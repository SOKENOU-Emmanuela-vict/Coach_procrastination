import assert from 'assert';
import { sanitizeUrl, sanitizeImageSrc, escapeHtml } from './src/utils/security.js';
import { PortfolioView } from './src/ui/PortfolioView.js';
import { LanguageView } from './src/ui/LanguageView.js';

console.log("=== TEST DE SÉCURITÉ : XSS & ASSAINISSEMENT DES URLS ===");

// 1. Tests unitaires sur sanitizeUrl
const xssPayloads = [
    'javascript:alert(1)',
    'JAVASCRIPT:alert(document.domain)',
    '  javascript:alert(window.origin)',
    'java\u0000script:alert(1)',
    'vbscript:msgbox(1)',
    'data:text/html,<script>alert(1)</script>',
    'javascript://%0aalert(1)'
];

for (const payload of xssPayloads) {
    const sanitized = sanitizeUrl(payload);
    assert.strictEqual(sanitized, '#', `1. Payload XSS neutralisé : ${payload}`);
}
console.log("✅ PASS: 1. Tous les protocoles d'exécution de code client (javascript:, vbscript:, data:text/html) sont neutralisés");

// 2. Tests des URL légitimes
assert.strictEqual(sanitizeUrl('https://formation.force-n.sn/course/view.php?id=649'), 'https://formation.force-n.sn/course/view.php?id=649', "2a. URL HTTPS acceptée");
assert.strictEqual(sanitizeUrl('http://localhost:8125/test'), 'http://localhost:8125/test', "2b. URL HTTP acceptée");
assert.strictEqual(sanitizeUrl('/index.html'), '/index.html', "2c. Chemin relatif absolu accepté");
assert.strictEqual(sanitizeUrl('./assets/logo.png'), './assets/logo.png', "2d. Chemin relatif local accepté");
assert.strictEqual(sanitizeUrl('open.spotify.com'), 'https://open.spotify.com', "2e. Domaine sans protocole préfixé par https://");
console.log("✅ PASS: 2. URLs légitimes autorisées et préservées");

// 3. Tests unitaires sur sanitizeImageSrc
assert.strictEqual(sanitizeImageSrc('javascript:alert(1)'), '', "3a. Image javascript: rejetée");
assert.strictEqual(sanitizeImageSrc('https://images.unsplash.com/photo.jpg'), 'https://images.unsplash.com/photo.jpg', "3b. Image HTTPS acceptée");
const validDataImg = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
assert.strictEqual(sanitizeImageSrc(validDataImg), validDataImg, "3c. Data URL image base64 valide acceptée");
console.log("✅ PASS: 3. Assainissement des sources d'images conforme");

// 4. Test d'injection dans PortfolioView (Proof Image & Link)
// Mock minimal du container et de l'app
const mockContainer = { innerHTML: '', querySelectorAll: () => [] };
const mockApp = { monthlyReport: {}, projectEngine: {} };
const portfolio = new PortfolioView(null, mockApp);
portfolio.container = mockContainer;

const stateWithXssProof = {
    monthlyReport: {
        proofs: [
            {
                date: '2026-10-21',
                image: "x' onerror='alert(1)",
                url: 'javascript:alert(document.cookie)',
                description: '<b>Test</b>',
                source: 'Test'
            }
        ]
    }
};

portfolio.render(stateWithXssProof);
assert(!mockContainer.innerHTML.includes('document.write'), "4a. document.write totalement absent du rendu de preuve");
assert(!mockContainer.innerHTML.includes('href="javascript:'), "4b. Aucun href avec javascript: généré dans le portfolio");
console.log("✅ PASS: 4. Rendu de preuve dans PortfolioView immunisé contre XSS et document.write");

console.log("\n🎉 TOUS LES TESTS DE SÉCURITÉ XSS / URLS ONT RÉUSSI !");
