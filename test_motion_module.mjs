import assert from 'assert';
import { Motion } from './src/ui/motion.js';

console.log("=== TESTS MODULE MOTION ===");

// 1. Environnement sans window / sans GSAP (Node.js natif)
assert.strictEqual(Motion.isAvailable(), false, "Motion.isAvailable doit retourner false si window ou gsap est absent");

// Doit s'exécuter sans aucune exception
assert.doesNotThrow(() => {
    Motion.staggerIn('.card');
    Motion.fadeIn('.container');
    Motion.modalOpen({});
    Motion.buttonTap({});
    Motion.messageIn({});
}, "Les méthodes de Motion doivent être silencieuses et sans erreur quand GSAP est absent");

console.log("✅ 1. Résilience totale sans GSAP validée");

// 2. Simulation avec window et gsap
let tweenCalled = null;
global.window = {
    gsap: {
        fromTo: (targets, from, to) => {
            tweenCalled = { targets, from, to };
        }
    },
    matchMedia: (query) => ({
        matches: false // prefers-reduced-motion désactivé
    })
};

assert.strictEqual(Motion.isAvailable(), true, "Motion.isAvailable doit être true avec GSAP actif");

Motion.fadeIn('#main-view', { duration: 0.3 });
assert.ok(tweenCalled, "fromTo doit être appelé");
assert.strictEqual(tweenCalled.targets, '#main-view');
assert.strictEqual(tweenCalled.to.duration, 0.3);
assert.strictEqual(tweenCalled.from.opacity, 0);
assert.strictEqual(tweenCalled.to.opacity, 1);
console.log("✅ 2. Animation GSAP standard opérationnelle");

// 3. Respect strict de prefers-reduced-motion
global.window.matchMedia = (query) => ({
    matches: query.includes('prefers-reduced-motion: reduce')
});

assert.strictEqual(Motion.isAvailable(), false, "Motion.isAvailable doit être false si prefers-reduced-motion est activé");
tweenCalled = null;
Motion.fadeIn('#main-view');
assert.strictEqual(tweenCalled, null, "Aucune animation ne doit être jouée quand prefers-reduced-motion est activé");
console.log("✅ 3. Respect strict de prefers-reduced-motion validé");

console.log("\n🎉 TOUS LES TESTS MOTION SONT VERTS !");

