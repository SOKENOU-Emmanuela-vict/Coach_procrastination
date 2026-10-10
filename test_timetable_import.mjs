// Import de l'emploi du temps hebdomadaire (PDF scanné → Gemini simulé → aperçu → cours verrouillés) et avancement des cours.
// Aucun appel réseau : le fournisseur Gemini est simulé (mock_timetable_gemini.mjs) ; fetch est intercepté pour GeminiProvider.
import { App } from './src/core/App.js';
import { MemoryProvider } from './src/services/MemoryProvider.js';
import { ChatHistoryEngine } from './src/engines/ChatHistoryEngine.js';
import { SchedulerEngine } from './src/engines/SchedulerEngine.js';
import { AcademicSeeder } from './src/data/AcademicSeeder.js';
import { TimetableImportEngine, TIMETABLE_RESPONSE_SCHEMA } from './src/engines/TimetableImportEngine.js';
import { CourseProgressEngine } from './src/engines/CourseProgressEngine.js';
import { GeminiProvider } from './src/ai/GeminiProvider.js';
import { GROUND_TRUTH_G2, MESSY_TEXT, MockTimetableLLM } from './mock_timetable_gemini.mjs';

let failures = 0;
function assert(cond, msg) {
    if (cond) console.log(`✅ PASS: ${msg}`);
    else { console.error(`❌ FAIL: ${msg}`); failures++; process.exitCode = 1; }
}

global.window = {};
global.document = {
    getElementById: () => ({ innerHTML: '', addEventListener: () => {}, querySelectorAll: () => [], querySelector: () => null }),
    body: { className: '', classList: { add: () => {}, remove: () => {} } },
    querySelectorAll: () => [],
    querySelector: () => null
};

const FAKE_PDF_B64 = Buffer.from('%PDF-1.4 faux emploi du temps').toString('base64');
const EXPECTED = [
    ['2026-10-05', '16:00', '18:45', 9, 25, 'inf1323', '1INF1323'],
    ['2026-10-06', '13:00', '15:45', 3, 20, 'mth1321', '1MTH1321'],
    ['2026-10-06', '16:00', '18:45', 10, 25, 'inf1322', '1INF1322'],
    ['2026-10-08', '13:00', '15:45', 6, 20, 'mth1321', '1MTH1321'],
    ['2026-10-08', '16:00', '18:45', 12, 25, 'inf1323', '1INF1323'],
    ['2026-10-09', '13:00', '15:45', 9, 20, 'mth1321', '1MTH1321'],
    ['2026-10-10', '08:00', '12:00', 14, 25, 'inf1322', '1INF1322']
];
const signature = (rows) => JSON.stringify(rows.map(r => [r.date, r.startTime, r.endTime, r.hoursDone, r.hoursTotal, r.subjectId, r.componentCode]));

async function setup(response) {
    const storage = new MemoryProvider();
    const chat = new ChatHistoryEngine(storage);
    const scheduler = new SchedulerEngine(storage);
    const app = new App(storage, scheduler, null, null, null, null, chat);
    app.coachEngine.coachAI.llmReasoning = null;
    app.renderView = async () => {};
    await new AcademicSeeder(app.academicEngine).seed();
    await app.refreshAcademicSubjects();
    const llm = new MockTimetableLLM(response);
    app.timetableImporter.llmProvider = llm;
    app.state.userProfile = { name: 'Emmanuela', currentSemesterId: 'sem_s3_26', groupe: null };
    app.clock = () => new Date(2026, 9, 4, 18, 0); // dimanche 04/10/2026 18:00 : import de la semaine du 05/10
    return { app, storage, llm, scheduler };
}
const weekEvents = async (storage, from = '2026-10-05', to = '2026-10-11') =>
    ((await storage.loadData('events')) || []).filter(e => e.date >= from && e.date <= to);

async function run() {
    console.log('=== IMPORT DE L\'EMPLOI DU TEMPS HEBDOMADAIRE ===\n');

    // --- 1. Appel Gemini + aperçu (réponse propre) ---
    const { app, storage, llm, scheduler } = await setup(GROUND_TRUTH_G2);
    const preview = await app.extractTimetable({ base64: FAKE_PDF_B64, mimeType: 'application/pdf', fileName: 'emploi_du_temps.pdf' });
    const call = llm.calls[0];
    assert(llm.calls.length === 1 && call.mimeType === 'application/pdf' && call.data === FAKE_PDF_B64,
        '1. Le PDF est envoyé tel quel à Gemini (inlineData application/pdf, base64), sans rendu pdf.js');
    assert(call.responseSchema === TIMETABLE_RESPONSE_SCHEMA && /Groupe 2/.test(call.prompt) && /XXH/.test(call.prompt) && /page suivante/.test(call.prompt),
        '2. Sortie JSON imposée (schéma) et consignes : groupes, (XXH/YYH), suites de cellules en page 2');
    assert(preview.group === 'Groupe 2' && preview.weekStart === '2026-10-05' && preview.weekEnd === '2026-10-11',
        '3. Groupe par défaut « Groupe 2 » et semaine du lundi 05/10 au dimanche 11/10');
    assert(preview.rows.length === 7 && signature(preview.rows) === JSON.stringify(EXPECTED),
        '4. Les 7 séances du groupe 2 : dates, horaires, heures faites / totales, matière et ECUE corrects');
    assert(preview.rows.every(r => r.matchConfidence >= 0.6 && r.matchStatus === 'mapped' && r.include),
        '5. Chaque intitulé est relié au cursus avec une confiance ≥ 0.6, toutes les lignes cochées');
    assert(preview.rows[0].title === 'Structure de données et applications avec C/Python' && preview.rows[0].teacher === 'M. Vincent ALLADAGNIWEKE'
        && preview.rows[2].componentName === 'Analyse et conception orientée objet',
        '6. Intitulé, enseignant et ECUE (« Analyse et conception orientée objet » → 1INF1322 de INF1322) conservés');
    assert(((await storage.loadData('events')) || []).length === 0, '7. Rien n\'est enregistré avant la validation');

    // --- 2. Réponse désordonnée : même résultat ---
    const messy = app.timetableImporter.buildPreview(MESSY_TEXT, { group: 'Groupe 2', referenceDate: '2026-10-04', subjects: await app.academicEngine.getSubjects(), semesterId: 'sem_s3_26' });
    assert(signature(messy.rows) === JSON.stringify(EXPECTED),
        '8. Réponse désordonnée (texte autour, ```json, groupe 1, suites en page 2, dates absentes) : mêmes 7 séances');
    assert(messy.rows[0].title === 'Structure de données et applications avec C/Python' && messy.rows[0].teacher === 'M. Vincent ALLADAGNIWEKE'
        && messy.rows[2].hoursDone === 10 && /Dovonou/.test(messy.rows[2].teacher),
        '9. Cellules coupées entre les pages fusionnées (intitulé complet, heures et enseignant de la page 2)');
    assert(messy.rows[6].startTime === '08:00' && messy.rows[6].endTime === '12:00', '10. Horaire spécial « 8h à 12h » écrit dans la cellule prioritaire sur celui de la ligne');
    assert(messy.groupsFound.join(',') === 'Groupe 1,Groupe 2', '11. Groupes détectés : Groupe 1 et Groupe 2');
    const g1 = app.timetableImporter.selectGroup(messy, 'Groupe 1', await app.academicEngine.getSubjects());
    assert(g1.rows.length === 9 && g1.rows.every(r => r.group === 'Groupe 1') && g1.rows[0].teacher === 'M. Ratheil HOUNDJI',
        '12. Changement de groupe sans nouvel appel à Gemini : 9 séances du groupe 1');

    // --- 3. Validation : cours verrouillés, hors Focus ---
    await storage.saveData('events', [
        { id: 'perso', title: 'Sport', type: 'sport', date: '2026-10-07', startTime: '17:00', endTime: '18:00', lockStatus: 'flexible' },
        { id: 'rev', title: 'Révision perso', type: 'revision', date: '2026-10-05', startTime: '09:00', endTime: '10:00', lockStatus: 'flexible' }
    ]);
    const res = await app.applyTimetableImport(preview, {});
    let evs = await weekEvents(storage);
    const courses = evs.filter(e => e.source === 'school_schedule');
    assert(res.success && res.count === 7 && courses.length === 7, '13. Validation : 7 cours enregistrés par le moteur de planning');
    assert(courses.every(e => e.type === 'course' && e.lockStatus === 'locked' && e.subjectId && e.componentCode && Number.isFinite(e.hoursDone) && e.importWeek === '2026-10-05'),
        '14. Cours verrouillés, type course, reliés à la matière et à l\'ECUE, avec leurs heures');
    const plan = await scheduler.generateDailyPlan('2026-10-05');
    assert(plan.sessions.length === 1 && plan.sessions[0].id === 'rev', '15. Les cours importés ne deviennent pas des sessions Focus (la révision, oui)');
    assert((await storage.loadData('user_profile')).groupe === 'Groupe 2', '16. Le groupe est mémorisé dans le profil');

    // --- 4. Réimport de la même semaine : remplacement, jamais de doublon ---
    llm.response = MESSY_TEXT;
    const preview2 = await app.extractTimetable({ base64: FAKE_PDF_B64, mimeType: 'application/pdf', fileName: 'edt_bis.pdf' });
    assert(preview2.replacesExistingImport === true, '17. L\'aperçu signale que la semaine a déjà été importée');
    const res2 = await app.applyTimetableImport(preview2, {});
    evs = await weekEvents(storage);
    assert(res2.success && res2.replaced === 7 && evs.filter(e => e.source === 'school_schedule').length === 7,
        '18. Réimport idempotent : les 7 cours de la semaine sont remplacés, pas dupliqués');
    assert(evs.some(e => e.id === 'perso') && evs.some(e => e.id === 'rev'), '19. Les événements personnels sont conservés');
    const imports = await storage.loadData('timetable_imports');
    assert(imports.length === 1 && imports[0].weekStart === '2026-10-05' && imports[0].entries.length === 7, '20. Historique : une seule entrée pour cette semaine');

    // --- 5. Choix dans l'aperçu : ligne décochée, matière corrigée ---
    const rows = preview2.rows.map(r => ({ id: r.id, include: r.date !== '2026-10-10', subjectId: r.date === '2026-10-09' ? 'mth1324' : r.subjectId }));
    const res3 = await app.applyTimetableImport(preview2, { rows });
    evs = (await weekEvents(storage)).filter(e => e.source === 'school_schedule');
    assert(res3.count === 6 && !evs.some(e => e.date === '2026-10-10'), '21. Une ligne décochée n\'est pas enregistrée');
    const fri = evs.find(e => e.date === '2026-10-09');
    assert(fri && fri.subjectId === 'mth1324' && !fri.componentCode, '22. Matière corrigée à la main respectée (ECUE proposée abandonnée)');
    await app.applyTimetableImport(preview2, {}); // retour à l'import complet

    // --- 6. Chevauchements ---
    const bad = await app.applyTimetableImport(preview2, { rows: preview2.rows.map(r => ({ id: r.id, include: true })) }).catch(e => e);
    assert(!(bad instanceof Error), '23. Réimport complet accepté');
    await storage.saveData('events', ((await storage.loadData('events')) || []).concat([
        { id: 'rdv', title: 'Rendez-vous médecin', type: 'personal', date: '2026-10-06', startTime: '14:00', endTime: '15:00', lockStatus: 'locked' }
    ]));
    const res4 = await app.applyTimetableImport(preview2, {});
    assert(res4.success && res4.overlaps.some(o => o.other.id === 'rdv' && o.course.date === '2026-10-06'),
        '24. Un cours officiel qui chevauche un événement verrouillé est enregistré et le chevauchement est signalé');
    const dup = JSON.parse(JSON.stringify(preview2));
    dup.rows.push({ ...dup.rows[1], id: 'tt_dup', title: 'Doublon lu', startTime: '14:00', endTime: '16:00' });
    const err = await app.applyTimetableImport(dup, {}).catch(e => e);
    assert(err instanceof Error && /chevauchent/.test(err.message), '25. Deux séances cochées qui se chevauchent : import refusé avec un message clair');

    // --- 7. Avancement des cours ---
    const subjects = await app.academicEngine.getSubjects();
    const imp = await storage.loadData('timetable_imports');
    let p = CourseProgressEngine.compute(imp, { now: new Date(2026, 9, 8, 20, 0), subjects });
    const alg = p.items.find(i => i.componentCode === '1MTH1321');
    const sdd = p.items.find(i => i.componentCode === '1INF1323');
    const aco = p.items.find(i => i.componentCode === '1INF1322');
    assert(alg.hoursDone === 6 && alg.hoursTotal === 20 && alg.percent === 30 && alg.hoursScheduled === 9 && alg.lastSessionDate === '2026-10-08'
        && alg.nextSession.date === '2026-10-09', '26. Jeudi 08/10 20h : Structures algébriques 6 h / 20 (30 %), dernière séance le 08/10, prochaine le 09/10');
    assert(sdd.hoursDone === 12 && sdd.percent === 48 && aco.hoursDone === 10 && aco.nextSession.startTime === '08:00',
        '27. Structure de données 12 h / 25 (48 %), Analyse et conception 10 h / 25 (prochaine séance samedi 8h)');
    assert(p.bySubject.inf1322 && p.bySubject.inf1322.hoursDone === 10 && p.bySubject.inf1322.hoursTotal === 25 && alg.subjectName === 'Structures algébriques et applications',
        '28. Agrégat par matière (INF1322 via son ECUE) et noms du cursus exposés');
    p = CourseProgressEngine.compute(imp, { now: new Date(2026, 9, 4, 18, 0), subjects });
    assert(p.items.find(i => i.componentCode === '1MTH1321').hoursDone === 0 && p.items.find(i => i.componentCode === '1INF1323').hoursDone === 6,
        '29. Avant la semaine : heures faites = cumul de la 1re séance moins sa durée (0 h et 6 h)');
    p = CourseProgressEngine.compute(imp, { now: new Date(2026, 9, 11, 9, 0), subjects });
    assert(p.items.find(i => i.componentCode === '1INF1322').hoursDone === 14 && p.upcomingSessions.length === 0, '30. Fin de semaine : 14 h / 25 en Analyse et conception, plus de séance à venir');
    const week2 = { weekStart: '2026-10-12', weekEnd: '2026-10-18', entries: [
        { date: '2026-10-13', startTime: '13:00', endTime: '15:45', title: 'Structures algébriques…', subjectId: 'mth1321', componentCode: '1MTH1321', hoursDone: 20, hoursTotal: 20 }] };
    p = CourseProgressEngine.compute(imp.concat([week2]), { now: new Date(2026, 9, 14, 9, 0), subjects });
    const alg2 = p.items.find(i => i.componentCode === '1MTH1321');
    assert(alg2.finished === true && alg2.percent === 100 && alg2.history.length === 2 && alg2.history[0].hoursDone === 9 && alg2.history[1].hoursDone === 20,
        '31. Cours terminé quand heures faites ≥ total ; historique conservé par semaine');
    assert(app.state.courseProgress && app.state.courseProgress.items.length === 3 && (await storage.loadData('course_progress')).items.length === 3,
        '32. Avancement exposé dans l\'état de l\'App et sauvegardé (course_progress)');

    // --- 8. Erreurs et absence de clé ---
    const noKey = new TimetableImportEngine({ storage, planningEngine: app.planningEngine, llmProvider: null });
    let e1 = await noKey.extract({ base64: FAKE_PDF_B64, mimeType: 'application/pdf' }).catch(e => e);
    assert(e1 instanceof Error && e1.code === 'NO_LLM' && /clé API Gemini/.test(e1.message), '33. Sans clé Gemini : message clair, rien n\'est lu ni enregistré');
    e1 = await app.timetableImporter.extract({ base64: FAKE_PDF_B64, mimeType: 'text/plain' }).catch(e => e);
    assert(e1 instanceof Error && /Format non pris en charge/.test(e1.message), '34. Format refusé (seulement PDF ou image)');
    const img = await app.timetableImporter.extract({ base64: FAKE_PDF_B64, mimeType: 'image/jpeg', subjects, group: 'Groupe 2' });
    assert(llm.calls[llm.calls.length - 1].mimeType === 'image/jpeg' && img.rows.length === 7, '35. Une photo (image/jpeg) est aussi acceptée');
    e1 = await app.timetableImporter.extract({ base64: 'A'.repeat(21 * 1024 * 1024), mimeType: 'application/pdf' }).catch(e => e);
    assert(e1 instanceof Error && /volumineux/.test(e1.message), '36. Fichier trop volumineux refusé');
    let e2 = null; try { app.timetableImporter.parseResponse('pas de json ici'); } catch (e) { e2 = e; }
    assert(e2 && /JSON introuvable/.test(e2.message), '37. Réponse illisible : erreur explicite');

    // --- 9. État de l'import de la semaine (rappel du dimanche) ---
    let st = TimetableImportEngine.timetableStatus(imp, new Date(2026, 9, 11, 10, 0));
    assert(st.isSunday && st.targetWeekStart === '2026-10-12' && st.needsImport, '38. Dimanche 11/10 : la semaine à importer est celle du 12/10');
    st = TimetableImportEngine.timetableStatus(imp, new Date(2026, 9, 8, 10, 0));
    assert(!st.needsImport && st.targetWeekStart === '2026-10-05', '39. Jeudi 08/10 : la semaine en cours est déjà importée');

    // --- 10. GeminiProvider.generateFromFile (fetch intercepté, aucun réseau) ---
    const realFetch = global.fetch;
    let captured = null;
    global.fetch = async (url, opts) => { captured = { url, body: JSON.parse(opts.body) }; return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: '```json\n{"entries":[]}\n```' }] } }] }) }; };
    try {
        const gp = new GeminiProvider('CLE_TEST');
        const out = await gp.generateFromFile({ prompt: 'lis', mimeType: 'application/pdf', data: FAKE_PDF_B64, responseSchema: TIMETABLE_RESPONSE_SCHEMA });
        const part = captured.body.contents[0].parts[0];
        assert(part.inlineData.mimeType === 'application/pdf' && part.inlineData.data === FAKE_PDF_B64 && captured.body.contents[0].parts[1].text === 'lis',
            '40. Requête Gemini : fichier en inlineData + consigne texte');
        assert(captured.body.generationConfig.responseMimeType === 'application/json' && !!captured.body.generationConfig.responseSchema
            && captured.body.generationConfig.responseSchema.properties.entries.type === 'ARRAY',
            '41. generationConfig : responseMimeType application/json + responseSchema');
        assert(out === '{"entries":[]}', '42. Réponse nettoyée (sans bloc ```json)');
        const noKeyErr = await new GeminiProvider(null).generateFromFile({ prompt: 'x', mimeType: 'application/pdf', data: 'AA' }).catch(e => e);
        assert(noKeyErr instanceof Error && /Clé API manquante/.test(noKeyErr.message), '43. GeminiProvider sans clé : erreur avant tout appel');
    } finally {
        global.fetch = realFetch;
    }

    console.log(failures === 0 ? '\nTous les tests de l\'import d\'emploi du temps passent.' : `\n${failures} échec(s).`);
}

run().catch(e => { console.error('❌ FAIL: exception', e); process.exitCode = 1; });
