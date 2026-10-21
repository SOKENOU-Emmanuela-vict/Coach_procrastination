import assert from 'assert';
import { deepSanitizeObject } from './src/utils/security.js';

console.log("=== TEST DE SÉCURITÉ : PROTOTYPE POLLUTION (Assainissement JSON & Import) ===");

// 1. Test unitaire sur deepSanitizeObject avec charge utile d'attaque
const maliciousPayload = JSON.parse(`{
    "__proto__": { "pollutedRoot": true },
    "constructor": { "prototype": { "pollutedConstructor": true } },
    "events": [
        {
            "id": "ev_1",
            "title": "Session normale",
            "__proto__": { "pollutedNested": true }
        }
    ],
    "user_profile": {
        "name": "Emma",
        "nested": {
            "prototype": { "pollutedDeep": true }
        }
    }
}`);

// Vérification initiale : les prototypes ne doivent pas être pollués
assert.strictEqual(Object.prototype.pollutedRoot, undefined, "1a. Prototype sain avant test");

const cleaned = deepSanitizeObject(maliciousPayload);

// Vérifications après assainissement
assert.strictEqual(Object.prototype.pollutedRoot, undefined, "1b. Prototype toujours sain après assainissement");
assert.strictEqual(Object.prototype.pollutedNested, undefined, "1c. Aucune pollution imbriquée dans les tableaux");
assert.strictEqual(cleaned.__proto__, undefined, "1d. Clé __proto__ supprimée de l'objet assaini");
assert.strictEqual(cleaned.constructor, undefined, "1e. Clé constructor supprimée de l'objet assaini");
assert.strictEqual(cleaned.events[0].__proto__, undefined, "1f. Clé __proto__ supprimée des éléments de tableau");
assert.strictEqual(cleaned.events[0].title, "Session normale", "1g. Données légitimes préservées");
assert.strictEqual(cleaned.user_profile.name, "Emma", "1h. Données utilisateur légitimes préservées");
console.log("✅ PASS: 1. Neutralisation complète des tentatives d'injection de prototype (__proto__, constructor, prototype)");

// 2. Test avec types primitifs et cas limites
assert.strictEqual(deepSanitizeObject(null), null, "2a. Null géré correctement");
assert.strictEqual(deepSanitizeObject(42), 42, "2b. Nombre géré correctement");
assert.strictEqual(deepSanitizeObject("texte"), "texte", "2c. String gérée correctement");
assert.deepStrictEqual(deepSanitizeObject([1, 2, 3]), [1, 2, 3], "2d. Tableau primitif préservé");
console.log("✅ PASS: 2. Robustesse sur types primitifs et cas limites");

console.log("\n🎉 TOUS LES TESTS DE SÉCURITÉ PROTOTYPE POLLUTION ONT RÉUSSI !");
