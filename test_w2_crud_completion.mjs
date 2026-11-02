import assert from 'assert';
import { LanguageEngine } from './src/engines/LanguageEngine.js';
import { StudyRecordEngine } from './src/engines/StudyRecordEngine.js';
import { CheckInEngine } from './src/engines/CheckInEngine.js';
import { App } from './src/core/App.js';

console.log("=== TESTS W2 : TROUS DE CRÉATION / MODIFICATION / SUPPRESSION ===");

class MockStorage {
    constructor() { this.store = {}; }
    async loadData(key) { return this.store[key] ? JSON.parse(JSON.stringify(this.store[key])) : null; }
    async saveData(key, val) { this.store[key] = JSON.parse(JSON.stringify(val)); }
}

const storage = new MockStorage();
const langEngine = new LanguageEngine(storage);
const studyEngine = new StudyRecordEngine(storage);
const checkInEngine = new CheckInEngine(storage, null, null, studyEngine);
const app = new App(storage, null, studyEngine, checkInEngine, null, null, null, null);
app.languageEngine = langEngine;

// -------------------------------------------------------------
// a) LANGUES : suivi, ressources, et suppression complète
// -------------------------------------------------------------
const lang = await langEngine.saveLanguage({
    name: 'Espagnol',
    level: 'A2',
    goal: 'Voyage en Colombie'
});
assert(lang.id, "Langue créée avec id");

// Suivi : ajout, modification, remise à zéro
await langEngine.updateTracking(lang.id, { sessionsDelta: 2, minutesDelta: 60, vocabDelta: 25 });
let fetchedLang = await langEngine.getLanguage(lang.id);
assert.strictEqual(fetchedLang.tracking.sessionsCompleted, 2, "Tracking sessions incrémenté");
assert.strictEqual(fetchedLang.tracking.minutesStudied, 60, "Tracking minutes incrémenté");
assert.strictEqual(fetchedLang.tracking.vocabularyWords, 25, "Tracking vocabulaire incrémenté");

await langEngine.updateTracking(lang.id, { sessions: 5, minutes: 150, vocab: 50 });
fetchedLang = await langEngine.getLanguage(lang.id);
assert.strictEqual(fetchedLang.tracking.sessionsCompleted, 5, "Tracking modifié avec valeurs absolues");

await langEngine.resetTracking(lang.id);
fetchedLang = await langEngine.getLanguage(lang.id);
assert.strictEqual(fetchedLang.tracking.sessionsCompleted, 0, "Tracking réinitialisé à 0");
assert.strictEqual(fetchedLang.tracking.minutesStudied, 0, "Tracking minutes réinitialisé à 0");
console.log("✅ PASS: 1. Langues : Suivi modifiable et réinitialisable à 0");

// Ressources : ajout, modification, suppression
const res1 = await langEngine.addResource(lang.id, { title: 'Babbel App', type: 'app', value: 'https://babbel.com' });
fetchedLang = await langEngine.getLanguage(lang.id);
assert.strictEqual(fetchedLang.resources.length, 1, "Ressource ajoutée");

await langEngine.updateResource(lang.id, res1.id, { title: 'Babbel Premium', value: 'https://babbel.com/premium' });
fetchedLang = await langEngine.getLanguage(lang.id);
assert.strictEqual(fetchedLang.resources[0].title, 'Babbel Premium', "Ressource modifiée");

await langEngine.deleteResource(lang.id, res1.id);
fetchedLang = await langEngine.getLanguage(lang.id);
assert.strictEqual(fetchedLang.resources.length, 0, "Ressource supprimée");
console.log("✅ PASS: 2. Langues : Ressources ajoutées, modifiées, supprimées");

// Suppression langue entière
await langEngine.deleteLanguage(lang.id);
const allLangs = await langEngine.getLanguages();
assert(!allLangs.some(l => l.id === lang.id), "Langue entièrement supprimée");
console.log("✅ PASS: 3. Langues : Suppression complète d'une langue");

// -------------------------------------------------------------
// b) SÉANCES D'ÉTUDE ET PREUVES (Focus/historique)
// -------------------------------------------------------------
const dummySession = {
    id: 'sess_test_101',
    title: 'Exercices Algorithmique',
    expectedDuration: 45,
    difficulty: '🟡'
};
const dummyMetrics = {
    status: 'completed',
    actualDuration: 50,
    difficulty: '🟡',
    quality: 3,
    reflection: 'Bien compris les graphes',
    proof: {
        type: 'Capture',
        title: 'Preuve capture',
        description: 'Screenshot code Python',
        image: 'data:image/png;base64,TESTPROOF'
    }
};

const completeRes = await studyEngine.completeSession(dummySession, dummyMetrics, '2026-11-02');
const recId = completeRes.record.id;
let history = await app.getStudyHistory();
let foundRec = history.find(r => r.id === recId);
assert(foundRec, "Séance passée enregistrée dans l'historique");
assert(foundRec.proof && foundRec.proof.image, "Preuve avec capture enregistrée");

// Modification note et difficulté
await app.updateStudyRecord(recId, {
    quality: 5,
    difficulty: '🟢',
    actualDifficulty: '🟢',
    reflection: 'Revu à tête reposée, totalement maîtrisé !'
});
foundRec = (await app.getStudyHistory()).find(r => r.id === recId);
assert.strictEqual(foundRec.quality, 5, "Qualité mise à jour à 5");
assert.strictEqual(foundRec.actualDifficulty, '🟢', "Difficulté mise à jour à 🟢");
assert.strictEqual(foundRec.reflection, 'Revu à tête reposée, totalement maîtrisé !', "Réflexion mise à jour");
console.log("✅ PASS: 4. Focus : Note et difficulté d'une séance passée modifiées");

// Suppression de la preuve uniquement
await app.deleteStudyProof(recId);
foundRec = (await app.getStudyHistory()).find(r => r.id === recId);
assert(foundRec, "La séance existe toujours après suppression de la preuve");
assert.strictEqual(foundRec.proof, null, "La preuve a été supprimée");
console.log("✅ PASS: 5. Focus : Preuve (capture) supprimée sans détruire la séance");

// Suppression de la séance entière
await app.deleteStudyRecord(recId);
foundRec = (await app.getStudyHistory()).find(r => r.id === recId);
assert(!foundRec, "La séance d'étude a été définitivement supprimée");
console.log("✅ PASS: 6. Focus : Séance d'étude supprimée de l'historique");

// -------------------------------------------------------------
// c) BILAN DU JOUR (check-in) : modification et suppression
// -------------------------------------------------------------
const dateBilan = '2026-11-02';
await checkInEngine.saveCheckIn({
    date: dateBilan,
    energy: 'medium',
    sleep: { durationMinutes: 420, quality: 'fair' },
    dayAssessment: 'completed',
    blockers: ['Distractions réseaux sociaux']
});
let savedCheckin = await checkInEngine.getCheckIn(dateBilan);
assert(savedCheckin, "Bilan du jour initialement enregistré");

// Modification du bilan
await checkInEngine.saveCheckIn({
    date: dateBilan,
    energy: 'high',
    sleep: { durationMinutes: 480, quality: 'good' },
    dayAssessment: 'completed',
    blockers: []
});
savedCheckin = await checkInEngine.getCheckIn(dateBilan);
assert.strictEqual(savedCheckin.energy, 'high', "Bilan modifié : énergie mise à jour");
assert.strictEqual(savedCheckin.sleep.durationMinutes, 480, "Bilan modifié : sommeil mis à jour");

// Suppression du bilan
const delRes = await app.deleteCheckIn(dateBilan);
assert(delRes, "deleteCheckIn a retourné true");
savedCheckin = await checkInEngine.getCheckIn(dateBilan);
assert.strictEqual(savedCheckin, null, "Bilan du jour supprimé avec succès");
console.log("✅ PASS: 7. Bilan du jour : Modification et suppression d'un bilan d'un jour précis");

// -------------------------------------------------------------
// d) SPORT / BIEN-ÊTRE (page Vie) : saisie rapide, modif, effaçable
// -------------------------------------------------------------
// Hydratation
await app.saveQuickCheckInField('water', 6); // 6 verres
let currentLife = await checkInEngine.getCheckIn(app.getPedagogicalDate());
assert.strictEqual(currentLife.water, 6, "Hydratation renseignée (6 verres)");

await app.saveQuickCheckInField('water', null); // effacer
currentLife = await checkInEngine.getCheckIn(app.getPedagogicalDate());
assert(!currentLife.water, "Hydratation effacée");

// Sommeil
await app.saveQuickCheckInField('sleep', { durationMinutes: 450, quality: 'good' });
currentLife = await checkInEngine.getCheckIn(app.getPedagogicalDate());
assert.strictEqual(currentLife.sleep.durationMinutes, 450, "Sommeil renseigné");

await app.saveQuickCheckInField('sleep', null);
currentLife = await checkInEngine.getCheckIn(app.getPedagogicalDate());
assert(!currentLife.sleep, "Sommeil effacé");

// Énergie (1 à 5)
await app.saveQuickCheckInField('energyLevel', 4);
await app.saveQuickCheckInField('energy', 'high');
currentLife = await checkInEngine.getCheckIn(app.getPedagogicalDate());
assert.strictEqual(currentLife.energyLevel, 4, "Énergie 4/5 renseignée en un clic");

await app.saveQuickCheckInField('energyLevel', null);
await app.saveQuickCheckInField('energy', null);
currentLife = await checkInEngine.getCheckIn(app.getPedagogicalDate());
assert(!currentLife.energyLevel, "Énergie effacée");

// Activité physique du jour
await app.saveQuickCheckInField('activity', { title: 'Natation', durationMinutes: 45 });
currentLife = await checkInEngine.getCheckIn(app.getPedagogicalDate());
assert.strictEqual(currentLife.activity.title, 'Natation', "Activité physique renseignée");
assert.strictEqual(currentLife.activity.durationMinutes, 45, "Durée activité renseignée");

await app.saveQuickCheckInField('activity', null);
currentLife = await checkInEngine.getCheckIn(app.getPedagogicalDate());
assert(!currentLife.activity, "Activité physique effacée");
console.log("✅ PASS: 8. Vie / Fitness : Hydratation, sommeil, énergie 1-5 et activité physique renseignables, modifiables et effaçables");

console.log("\n🎉 TOUS LES TESTS W2 PASSENT AVEC SUCCÈS ! (8/8 assertions validées)");
