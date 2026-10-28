/**
 * test_y1_c_timetable_no_key.mjs
 * Validation des fonctionnalités Y1-C : Import d'emploi du temps sans clé Gemini
 * (Texte brut, Saisie en grille, Fichiers CSV / XLSX / DOCX, Anti-doublon, Validation / Annulation)
 */

import { App } from './src/core/App.js';
import { MemoryProvider } from './src/services/MemoryProvider.js';
import { ChatHistoryEngine } from './src/engines/ChatHistoryEngine.js';
import { SchedulerEngine } from './src/engines/SchedulerEngine.js';
import { AcademicSeeder } from './src/data/AcademicSeeder.js';
import { TimetableImportEngine } from './src/engines/TimetableImportEngine.js';
import { PlanningView } from './src/ui/PlanningView.js';
import fs from 'fs';
import path from 'path';

let failures = 0;
let passed = 0;

function assert(cond, msg) {
    if (cond) {
        console.log(`✅ PASS: ${msg}`);
        passed++;
    } else {
        console.error(`❌ FAIL: ${msg}`);
        failures++;
        process.exitCode = 1;
    }
}

const FIXTURES_DIR = path.resolve('tests/fixtures');

global.window = {};
global.document = {
    getElementById: () => ({ innerHTML: '', addEventListener: () => {}, querySelectorAll: () => [], querySelector: () => null }),
    body: { className: '', classList: { add: () => {}, remove: () => {} } },
    querySelectorAll: () => [],
    querySelector: () => null
};

async function createTestApp() {
    const storage = new MemoryProvider();
    const chat = new ChatHistoryEngine(storage);
    const scheduler = new SchedulerEngine(storage);
    const app = new App(storage, scheduler, null, null, null, null, chat);
    app.coachEngine.coachAI.llmReasoning = null;
    app.timetableImporter.llmProvider = null; // STRICTEMENT AUCUNE CLÉ GEMINI
    app.renderView = async () => {};
    await new AcademicSeeder(app.academicEngine).seed();
    return { app, storage };
}

async function runTests() {
    console.log("=== TESTS Y1-C : IMPORT D'EMPLOI DU TEMPS SANS CLÉ ===\n");

    const { app, storage } = await createTestApp();
    const importer = app.timetableImporter;
    const subjects = await app.academicEngine.getSubjects();

    // 1. TEXTE VALIDE
    const validText = [
        "Lundi 8h-10h : Structures algébriques et applications (Amphi A)",
        "Mardi 10h-12h : Approche orientée objet (Salle TP 2)",
        "Jeudi 14h-16h : Structures algébriques et applications (Amphi B)"
    ].join('\n');

    const textRes = importer.parseTextSchedule(validText, { defaultGroup: 'Groupe 2' });
    assert(textRes.entries.length === 3, '1a. Texte valide extrait exactement 3 séances');
    assert(textRes.unreadLines.length === 0, '1b. Texte valide : 0 ligne non lue');
    assert(textRes.entries[0].room === 'Amphi A', '1c. Salle (Amphi A) extraite du titre');
    assert(textRes.entries[0].title === 'Structures algébriques et applications', '1d. Titre nettoyé de la salle');

    const previewValid = importer.buildPreview({ entries: textRes.entries }, {
        referenceDate: '2026-10-26',
        subjects,
        group: 'Groupe 2'
    });
    assert(previewValid.weekStart === '2026-10-26', '1e. Semaine calée sur le lundi de référence (2026-10-26)');
    assert(previewValid.rows.length === 3, '1f. Aperçu contient 3 lignes pour le Groupe 2');
    assert(previewValid.rows[0].subjectId === 'mth1321', '1g. Première séance reliée à la matière MTH1321');
    assert(previewValid.rows[1].subjectId === 'inf1322', '1h. Deuxième séance reliée à la matière INF1322');

    // 2. TEXTE AVEC LIGNES INVALIDES (LISTE VÉRIFIÉE)
    const messyText = [
        "Lundi 8h-10h : Structures algébriques (Amphi A)",
        "Texte d'introduction au semestre non reconnu",
        "Mardi 10h-12h : Approche orientée objet (Salle TP 2)",
        "12h00 Pause dejeuner",
        "Mercredi 15h-14h : Inversion horaire"
    ].join('\n');

    const messyRes = importer.parseTextSchedule(messyText, { defaultGroup: 'Groupe 2' });
    assert(messyRes.entries.length === 2, '2a. Lignes valides extraites (2 séances)');
    assert(messyRes.unreadLines.length === 3, '2b. Exactement 3 lignes non lues identifiées');
    assert(messyRes.unreadLines[0] === "Texte d'introduction au semestre non reconnu", '2c. Ligne non reconnue 1 présente');
    assert(messyRes.unreadLines[1] === "12h00 Pause dejeuner", '2d. Ligne non reconnue 2 présente');
    assert(messyRes.unreadLines[2] === "Mercredi 15h-14h : Inversion horaire", '2e. Ligne avec inversion horaire identifiée dans les non lues');

    const messyPreview = await importer.extractFromSource({
        type: 'text',
        text: messyText,
        referenceDate: '2026-10-26',
        subjects,
        group: 'Groupe 2'
    });
    assert(messyPreview.unreadLines.length === 3, '2f. Aperçu conserve le tableau unreadLines');
    assert(messyPreview.warnings.some(w => w.includes('3 ligne(s) non lue(s)')), '2g. Avertissement explicite « 3 ligne(s) non lue(s) » dans les avertissements');

    // 3. FICHIER CSV (tests/fixtures/emploi_du_temps.csv)
    const csvContent = fs.readFileSync(path.join(FIXTURES_DIR, 'emploi_du_temps.csv'), 'utf8');
    const csvPreview = await importer.extractFromSource({
        type: 'csv',
        csv: csvContent,
        referenceDate: '2026-10-26',
        subjects,
        group: 'Groupe 2'
    });
    assert(csvPreview.rows.length === 2, '3a. CSV extrait 2 séances pour le Groupe 2 (Lundi et Mardi)');
    assert(csvPreview.groupsFound.includes('Groupe 1') && csvPreview.groupsFound.includes('Groupe 2'), '3b. Groupes détectés dans le CSV : Groupe 1 et Groupe 2');
    assert(csvPreview.rows[0].startTime === '08:00' && csvPreview.rows[0].endTime === '10:00', '3c. Horaires 08:00 - 10:00 du CSV respectés');
    assert(csvPreview.rows[0].room === 'Amphi A', '3d. Salle Amphi A reconnue depuis la colonne Salle');
    assert(csvPreview.rows[0].subjectId === 'mth1321', '3e. Rapprochement avec le cursus mth1321');

    // Changement vers Groupe 1
    const csvG1 = importer.selectGroup(csvPreview, 'Groupe 1', subjects);
    assert(csvG1.rows.length === 1 && csvG1.rows[0].title.includes('Structures algébriques'), '3f. Groupe 1 a sa séance du jeudi');

    // 4. FICHIER XLSX (tests/fixtures/emploi_du_temps.xlsx)
    const xlsxBuf = fs.readFileSync(path.join(FIXTURES_DIR, 'emploi_du_temps.xlsx'));
    const xlsxPreview = await importer.extractFromSource({
        type: 'xlsx',
        buffer: xlsxBuf,
        referenceDate: '2026-10-26',
        subjects,
        group: 'Groupe 2'
    });
    assert(xlsxPreview.rows.length === 2, '4a. XLSX extrait 2 séances pour le Groupe 2');
    assert(xlsxPreview.rows[0].date === '2026-10-26', '4b. Date de la séance du lundi : 2026-10-26');
    assert(xlsxPreview.rows[1].date === '2026-10-27', '4c. Date de la séance du mardi : 2026-10-27');

    // 5. DOCX MINIMAL (tests/fixtures/cours_poo.docx)
    const docxBuf = fs.readFileSync(path.join(FIXTURES_DIR, 'cours_poo.docx'));
    const docxPreview = await importer.extractFromSource({
        type: 'docx',
        buffer: docxBuf,
        referenceDate: '2026-10-26',
        subjects,
        group: 'Groupe 2'
    });
    assert(docxPreview.rows.length >= 2, '5a. DOCX extrait au moins 2 séances textuelles');
    assert(docxPreview.rows.some(r => r.title.includes('Approche orientée objet')), '5b. Séance Approche orientée objet trouvée dans le DOCX');

    // 6. SAISIE EN GRILLE (VALIDATION HEURE FIN > DÉBUT)
    // Erreur si fin <= début
    let gridErr = null;
    try {
        importer.parseGridRows([
            { day: 'Lundi', startTime: '10:00', endTime: '08:00', title: 'Maths' }
        ]);
    } catch (e) {
        gridErr = e;
    }
    assert(gridErr && gridErr.message.includes('doit être après'), '6a. Grille : refus si heure fin <= début avec message clair');

    // Grille valide
    const gridRes = importer.parseGridRows([
        { day: 'Lundi', startTime: '08:00', endTime: '10:00', title: 'Structures algébriques', room: 'Amphi A', type: 'course' },
        { day: 'Mercredi', startTime: '14:00', endTime: '16:00', title: 'Approche orientée objet', room: 'Salle TP 2', type: 'tp' }
    ], { defaultGroup: 'Groupe 2' });
    assert(gridRes.entries.length === 2, '6b. Grille valide retourne 2 entrées');
    assert(gridRes.entries[0].startTime === '08:00' && gridRes.entries[0].endTime === '10:00', '6c. Horaires conservés');

    // 7. ANNULER NE CRÉE RIEN
    const initialEvents = (await storage.loadData('events')) || [];
    const initialImports = (await storage.loadData('timetable_imports')) || [];
    assert(initialEvents.length === 0, '7a. Aucun événement initial');
    assert(initialImports.length === 0, '7b. Aucun import initial');

    // Simulation de prévisualisation sans validation
    const previewToCancel = await app.extractTimetableFromSource({
        type: 'csv',
        csv: csvContent,
        referenceDate: '2026-10-26'
    });
    assert(previewToCancel.rows.length === 2, '7c. Aperçu généré');
    // Annulation : on ne fait rien / on vide pendingTimetablePreview
    app.pendingTimetablePreview = null;
    const eventsAfterCancel = (await storage.loadData('events')) || [];
    const importsAfterCancel = (await storage.loadData('timetable_imports')) || [];
    assert(eventsAfterCancel.length === 0, '7d. Annuler : zéro événement créé en base');
    assert(importsAfterCancel.length === 0, '7e. Annuler : zéro trace dans timetable_imports');

    // 8. VALIDATION CRÉE LES ÉVÉNEMENTS
    const previewToValidate = await app.extractTimetableFromSource({
        type: 'csv',
        csv: csvContent,
        referenceDate: '2026-10-26'
    });
    const applyRes = await app.applyTimetableImport(previewToValidate, {
        rows: previewToValidate.rows.map(r => ({ id: r.id, include: true, subjectId: r.subjectId }))
    });
    assert(applyRes.success === true, '8a. applyTimetableImport réussit');
    assert(applyRes.count === 2, '8b. 2 cours enregistrés');

    const savedEvents = (await storage.loadData('events')) || [];
    assert(savedEvents.length === 2, '8c. 2 événements présents dans events');
    assert(savedEvents.every(e => e.lockStatus === 'locked'), '8d. Tous les cours importés sont verrouillés');
    assert(savedEvents.every(e => e.source === 'school_schedule'), '8e. Source school_schedule bien positionnée');
    assert(savedEvents.some(e => e.date === '2026-10-26' && e.startTime === '08:00'), '8f. Événement du lundi 26/10 08:00 créé');

    const courseProgress = await storage.loadData('course_progress');
    assert(courseProgress && Array.isArray(courseProgress.items), '8g. Avancement des cours course_progress mis à jour');

    // 9. REMPLACEMENT DE SEMAINE DÉJÀ IMPORTÉE (ANTI-DOUBLON)
    // Nouvel import sur la MÊME semaine avec 1 seul cours
    const singleCourseCsv = "Jour;Début;Fin;Matière;Code;Groupe;Salle\nLundi;14:00;16:00;Structures algébriques et applications;MTH1321;Groupe 2;Amphi C";
    const previewReimport = await app.extractTimetableFromSource({
        type: 'csv',
        csv: singleCourseCsv,
        referenceDate: '2026-10-26'
    });
    assert(previewReimport.replacesExistingImport === true, '9a. Aperçu détecte que la semaine 2026-10-26 a déjà été importée');

    const applyReimport = await app.applyTimetableImport(previewReimport, {
        rows: previewReimport.rows.map(r => ({ id: r.id, include: true, subjectId: r.subjectId }))
    });
    assert(applyReimport.success === true, '9b. Réimport validé');
    assert(applyReimport.replaced === 2, '9c. Les 2 anciens cours ont été remplacés');
    assert(applyReimport.count === 1, '9d. Exactement 1 cours est maintenant présent');

    const eventsAfterReimport = (await storage.loadData('events')) || [];
    assert(eventsAfterReimport.length === 1, '9e. Aucun doublon : 1 seul cours en base pour cette semaine');
    assert(eventsAfterReimport[0].startTime === '14:00', '9f. Le nouveau cours (14:00) a bien remplacé les anciens');

    const importsAfterReimport = (await storage.loadData('timetable_imports')) || [];
    const weekImports = importsAfterReimport.filter(i => i.weekStart === '2026-10-26');
    assert(weekImports.length === 1, '9g. Historique : une seule entrée pour la semaine 2026-10-26');

    // 10. RÈGLE (d) : SANS CLÉ, CHARGEMENT D'UN PDF/IMAGE
    // Vérification du message d'aiguillage
    const mockFakeContainer = {
        innerHTML: '',
        querySelector: () => null,
        querySelectorAll: () => []
    };
    const planningView = new PlanningView(mockFakeContainer, app);
    let capturedFeedback = '';
    const mockFeedback = {
        set innerHTML(val) { capturedFeedback = val; },
        get innerHTML() { return capturedFeedback; },
        querySelector: () => null
    };

    // On passe un fichier pdf alors qu'aucune clé n'est présente
    await planningView.handleTimetableFile(
        { name: 'emploi_du_temps.pdf', type: 'application/pdf', size: 1024 },
        {},
        {},
        {},
        { switchTab: () => {}, close: () => {} },
        mockFeedback
    );

    assert(
        capturedFeedback.includes('Pour lire un PDF scanné ou une photo, configure une clé Gemini dans Réglages, ou colle le texte / utilise la grille'),
        '10a. Règle (d) : Message explicite en français pour PDF sans clé'
    );
    assert(
        capturedFeedback.includes('tt-btn-go-text') && capturedFeedback.includes('tt-btn-go-grid'),
        '10b. Règle (d) : Boutons vers « Coller le texte » et « Utiliser la grille » présents'
    );

    console.log(`\n=== BILAN Y1-C : ${passed}/${passed + failures} TESTS PASSÉS ===`);
    if (failures === 0) {
        console.log("🎉 TOUS LES TESTS D'IMPORT SANS CLÉ (Y1-C) SONT VALIDES !");
    } else {
        console.error(`❌ ${failures} ÉCHECS DÉTECTÉS`);
    }
}

runTests().catch(err => {
    console.error("❌ ERREUR NON GÉRÉE DANS test_y1_c_timetable_no_key.mjs :", err);
    process.exit(1);
});
