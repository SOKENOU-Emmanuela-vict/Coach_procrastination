import assert from 'assert';
import { sanitizeUrl, sanitizeImageSrc, escapeHtml } from './src/utils/security.js';
import { LanguageView } from './src/ui/LanguageView.js';

console.log("=== TEST DE SÉCURITÉ : XSS & ASSAINISSEMENT DES URLS ===");

// 1. Test des protocoles dangereux
const dangerousUrls = [
    'javascript:alert(1)',
    'JAVASCRIPT:alert(document.cookie)',
    '  javascript:alert(1)  ',
    'vbscript:msgbox(1)',
    'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg=='
];

for (const badUrl of dangerousUrls) {
    const sanitized = sanitizeUrl(badUrl);
    assert.strictEqual(sanitized, '#', `1a. URL dangereuse non neutralisée: ${badUrl}`);
}
console.log("✅ PASS: 1. Tous les protocoles d'exécution de code client (javascript:, vbscript:, data:text/html) sont neutralisés");

// 2. Test des URLs légitimes
const safeUrls = [
    'https://notion.so/my-workspace',
    'http://localhost:3000',
    'https://github.com/my-project#readme',
    'mailto:emma@example.com'
];

for (const goodUrl of safeUrls) {
    const sanitized = sanitizeUrl(goodUrl);
    assert.strictEqual(sanitized, goodUrl, `2a. URL sûre rejetée à tort: ${goodUrl}`);
}
console.log("✅ PASS: 2. URLs légitimes autorisées et préservées");

// 3. Test des images
assert.strictEqual(sanitizeImageSrc("javascript:alert(1)"), '', "3a. javascript: dans image non bloqué");
assert.strictEqual(sanitizeImageSrc('https://images.unsplash.com/photo.jpg'), 'https://images.unsplash.com/photo.jpg', "3b. Image HTTPS acceptée");
const validDataImg = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
assert.strictEqual(sanitizeImageSrc(validDataImg), validDataImg, "3c. Data URL image base64 valide acceptée");
console.log("✅ PASS: 3. Assainissement des sources d'images conforme");

// 4. Test d'injection Proof Image & Link (XSS)
const proofXss = {
    date: '2026-10-21',
    image: "x' onerror='alert(1)",
    url: 'javascript:alert(document.cookie)',
    description: '<b>Test</b>',
    source: 'Test'
};
const safeImg = sanitizeImageSrc(proofXss.image);
const safeUrl = sanitizeUrl(proofXss.url);
const safeDesc = escapeHtml(proofXss.description);
assert(!safeImg || !safeImg.includes('onerror'), "4a. onerror totalement neutralisé");
assert(!safeUrl || !safeUrl.includes('javascript:'), "4b. Aucun href avec javascript: toléré");
assert(safeDesc.includes('&lt;b&gt;'), "4c. Balises HTML échappées");
console.log("✅ PASS: 4. Données de preuve immunisées contre XSS et injections");

console.log("\n🎉 TOUS LES TESTS DE SÉCURITÉ XSS / URLS ONT RÉUSSI !");
