/**
 * test_correctif_y1_hours.mjs
 * Test dédié pour le Correctif Y1 - Point 2 :
 * - Retrait de « heures illisibles » et de « ? h / ? h » quand les horaires de séance sont lus
 * - Masquage de la colonne « Heures » quand le volume horaire n'est pas demandé / présent
 * - Maintien de l'affichage des heures quand le volume horaire est présent (ex. 10 h / 25 h)
 */

import { TimetableImportEngine } from './src/engines/TimetableImportEngine.js';
import { PlanningView } from './src/ui/PlanningView.js';

let passed = 0;
let total = 0;

function assert(condition, message) {
    total++;
    if (!condition) {
        console.error(`❌ FAIL: ${message}`);
        throw new Error(message);
    }
    passed++;
    console.log(`✅ PASS: ${message}`);
}

console.log("=== TESTS CORRECTIF Y1 - POINT 2 : GESTION DES HEURES DANS L'APERÇU ===");

const engine = new TimetableImportEngine();

// 1. Emploi du temps sans volume horaire (ex. format texte ou CSV standard)
const rawText = `
Lundi 08:30 - 10:00 Algorithmique (Amphi A)
Mardi 14:00 - 16:00 Systèmes d'exploitation (Salle 102)
`;
const textRes = engine.parseTextSchedule(rawText);
const previewWithoutVolume = engine.buildPreview(textRes, { referenceDate: '2026-10-26' });

// Vérification dans le moteur : aucun flag missing_hours si aucun volume n'est demandé
assert(previewWithoutVolume.rows.length === 2, "1a. Deux séances extraites");
assert(!previewWithoutVolume.rows[0].flags.includes('missing_hours'), "1b. Séance 1 n'a pas le flag missing_hours");
assert(!previewWithoutVolume.rows[1].flags.includes('missing_hours'), "1c. Séance 2 n'a pas le flag missing_hours");

// Vérification dans le rendu HTML de l'aperçu (PlanningView)
const fakeElement = { addEventListener: () => {}, value: '', checked: true, getAttribute: () => '' };
const fakeContent = {
    innerHTML: '',
    querySelector: () => fakeElement,
    querySelectorAll: () => [fakeElement]
};
const fakeApp = { state: { academicSubjects: [] } };
const view = new PlanningView(null, fakeApp);

view.renderTimetablePreview(previewWithoutVolume, fakeContent, { close: () => {}, open: () => {}, onSaved: () => {} });

assert(!fakeContent.innerHTML.includes('<th>Heures</th>'), "2a. Colonne 'Heures' masquée quand aucun volume n'est demandé");
assert(!fakeContent.innerHTML.includes('? h / ? h'), "2b. Aucun '? h / ? h' présent dans l'aperçu");
assert(!fakeContent.innerHTML.includes('heures illisibles'), "2c. Aucun 'heures illisibles' affiché pour des horaires valides");

// 2. Emploi du temps AVEC volume horaire (ex. 10 h / 25 h)
const rawWithVolume = {
    group: 'Groupe 2',
    weekStart: '2026-10-26',
    entries: [
        {
            group: 'Groupe 2',
            dayLabel: 'Lundi 26 oct.',
            date: '2026-10-26',
            startTime: '08:00',
            endTime: '10:00',
            title: 'Analyse et conception',
            hoursDone: 10,
            hoursTotal: 25,
            room: 'Amphi A'
        }
    ]
};
const previewWithVolume = engine.buildPreview(rawWithVolume, { referenceDate: '2026-10-26' });

assert(previewWithVolume.rows.length === 1, "3a. Séance avec volume extraite");
view.renderTimetablePreview(previewWithVolume, fakeContent, { close: () => {}, open: () => {}, onSaved: () => {} });

assert(fakeContent.innerHTML.includes('<th>Heures</th>'), "3b. Colonne 'Heures' bien affichée quand le volume horaire est présent");
assert(fakeContent.innerHTML.includes('10 h / 25 h'), "3c. Volume '10 h / 25 h' affiché correctement");
assert(!fakeContent.innerHTML.includes('heures illisibles'), "3d. Pas de 'heures illisibles' quand les heures sont complètes");

console.log(`\n🎉 BILAN POINT 2 : ${passed}/${total} TESTS PASSÉS !`);
