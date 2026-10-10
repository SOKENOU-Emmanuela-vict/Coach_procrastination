// Migration du cursus officiel L2 IA pour les installations existantes (données déjà dans IndexedDB).
// Ancien seed (S4 = 26 CECT, 'to_confirm', codes S3-xxx) -> cursus officiel (S4 = 30, vérifié),
// sans perte de notes / évaluations / liens par id, et idempotente.
import { MemoryProvider } from './src/services/MemoryProvider.js';
import { AcademicEngine } from './src/engines/AcademicEngine.js';
import { AcademicSeeder } from './src/data/AcademicSeeder.js';
import { App } from './src/core/App.js';

let failures = 0;
function assert(cond, msg) {
    if (cond) console.log(`✅ PASS: ${msg}`);
    else { console.error(`❌ FAIL: ${msg}`); failures++; process.exitCode = 1; }
}
global.window = global.window || {};
global.document = {
    getElementById: () => ({ innerHTML: '', style: {}, addEventListener: () => {}, querySelectorAll: () => [], querySelector: () => null }),
    querySelectorAll: () => [], querySelector: () => null,
    body: { className: '', classList: { add: () => {}, remove: () => {} } }
};

// Cursus officiel (référence indépendante du code testé)
const OFFICIAL = {
    MTH1321: ['sem_s3_26', 'Structures algébriques et applications', 5, 'Houénou'],
    INF1322: ['sem_s3_26', 'Approche orientée objet (Java/C++)', 6, 'Ratheil & Accrombessi'],
    INF1323: ['sem_s3_26', 'Structures de données et applications C/Python', 5, 'Ratheil'],
    MTH1324: ['sem_s3_26', 'Statistiques et probabilités', 4, 'Ratheil & Peace Souand'],
    INF1325: ['sem_s3_26', "Concepts et applications de l'IA", 4, 'Ratheil'],
    INF1326: ['sem_s3_26', 'Aspects avancés des technologies web', 2, 'Wahabou'],
    INF1327: ['sem_s3_26', 'Bases du génie logiciel (Agile Scrum/Test)', 3, 'John'],
    INF1328: ['sem_s3_26', 'Maintenance des appareils électroniques', 1, 'Akpaoka'],
    INF1421: ['sem_s4_27', 'Programmation avancée en Python et R', 4, 'John'],
    INF1422: ['sem_s4_27', 'Big Data', 4, 'Eric Adjé'],
    INF1423: ['sem_s4_27', 'Outils cloud de collecte et traitement', 8, 'Dako Sidoine'],
    INF1424: ['sem_s4_27', "Concepts de l'apprentissage automatique (Machine Learning)", 4, 'Ratheil'],
    INF1425: ['sem_s4_27', 'Résolution de problème par la recherche', 4, 'Ratheil'],
    GES1426: ['sem_s4_27', 'Gestion des projets', 3, 'Azombakin'],
    MGT1427: ['sem_s4_27', 'Communication managériale', 2, 'Colomb'],
    ANG1428: ['sem_s4_27', 'Anglais pour la communication scientifique', 1, 'Zanklan Pascal']
};

const sub = (id, semesterId, name, cect, coeff, code, extra = {}) => ({
    id, semesterId, name, cect, gradeCoefficient: coeff, importance: 3, difficulty: 3, personalDifficulty: 3,
    components: [{ name: 'Cours', type: 'theory', hours: 10 }, { name: 'TP/TD', type: 'practice', hours: 10 }], color: '#123456', code, ...extra
});

/** Données telles qu'écrites par l'ancien seeder (commit f2de55f) : S4 = 26 CECT détaillés, 'to_confirm'. */
function legacySeed(variant = 'f2de55f') {
    const web = variant === 'aacb18b'
        ? sub('s3_web_adv', 'sem_s3_26', 'Technologies web avancées', 2, null, 'S3-WEB')
        : sub('s3_bd_rel', 'sem_s3_26', 'Bases de données relationnelles', 5, 5, 'S3-WEB');
    const c = (v) => (variant === 'aacb18b' ? null : v); // aacb18b : aucun coefficient en S3
    return {
        acad_years: [{ id: 'year_l2_ia_2627', title: 'Licence 2 IA 2026-2027', startDate: '2026-09-01', endDate: '2027-06-30' }],
        acad_semesters: [
            { id: 'sem_s3_26', yearId: 'year_l2_ia_2627', name: 'S3', status: 'active', metadata: {} },
            { id: 'sem_s4_27', yearId: 'year_l2_ia_2627', name: 'S4', status: 'upcoming', metadata: { officialCectTotal: 30, calculatedDetailedCectTotal: 26, cectDiscrepancy: 4, cectStatus: 'to_confirm' } }
        ],
        acad_subjects: [
            sub('s3_math_alg', 'sem_s3_26', 'Structures algébriques et applications', 5, c(5), 'S3-ALG'),
            sub('s3_poo', 'sem_s3_26', 'Approche orientée objet', 6, c(6), 'S3-POO'),
            sub('s3_algo_c_py', 'sem_s3_26', 'Structures de données C/Python', 5, c(5), 'S3-ALGO'),
            sub('s3_stats', 'sem_s3_26', 'Statistiques & probabilités', 4, c(4), 'S3-STAT'),
            sub('s3_concepts_ia', 'sem_s3_26', "Concepts & applications de l'IA", 4, c(4), 'S3-IA'),
            web,
            sub('s3_genie_log', 'sem_s3_26', 'Génie logiciel', 3, c(3), 'S3-GL'),
            sub('s3_maint_elec', 'sem_s3_26', 'Maintenance électronique', 1, c(1), 'S3-ELEC'),
            sub('s4_inf1421', 'sem_s4_27', 'Programmation avancée en Python et R', 4, null, 'INF1421'),
            sub('s4_inf1422', 'sem_s4_27', 'Big Data', 4, null, 'INF1422'),
            sub('s4_inf1423', 'sem_s4_27', 'Outils cloud de collecte et de traitement des données', 4, null, 'INF1423'),
            sub('s4_inf1424', 'sem_s4_27', "Concepts et applications de l'apprentissage automatique", 4, null, 'INF1424'),
            sub('s4_inf1425', 'sem_s4_27', 'Techniques de résolution de problème par la recherche', 4, null, 'INF1425'),
            sub('s4_ges1426', 'sem_s4_27', 'Gestion des projets', 3, null, 'GES1426'),
            sub('s4_mgt1427', 'sem_s4_27', 'Communication managériale', 2, null, 'MGT1427'),
            sub('s4_ang1428', 'sem_s4_27', 'Anglais pour la communication scientifique', 1, null, 'ANG1428')
        ]
    };
}

async function makeStorage(data) {
    const storage = new MemoryProvider();
    for (const [k, v] of Object.entries(data)) await storage.saveData(k, v);
    return storage;
}
async function snapshot(storage) {
    const out = {};
    for (const k of (await storage.getAllKeys()).sort()) out[k] = await storage.loadData(k);
    return JSON.stringify(out);
}
const s4Total = (subjects) => subjects.filter(s => s.semesterId === 'sem_s4_27').reduce((a, s) => a + (s.cect || 0), 0);
function officialOk(subjects) {
    return Object.entries(OFFICIAL).every(([code, [semId, name, cect, teacher]]) => {
        const m = subjects.filter(s => s.code === code);
        return m.length === 1 && m[0].semesterId === semId && m[0].name === name && m[0].cect === cect && m[0].teacher === teacher;
    });
}

async function run() {
    console.log('=== MIGRATION DU CURSUS (installations existantes) ===\n');

    // ---------- A. Ancienne installation (S4 = 26) avec des données utilisatrices ----------
    const data = legacySeed('f2de55f');
    data.acad_semesters[0].status = 'completed';                   // statut modifié par l'utilisatrice
    data.acad_subjects.find(s => s.id === 's3_stats').gradeCoefficient = 7;       // coefficient personnalisé
    data.acad_subjects.find(s => s.id === 's4_inf1423').personalDifficulty = 5;   // réglage personnel
    data.acad_subjects.push(sub('perso_1', 'sem_s4_27', 'Projet perso', 0, null, 'PERSO')); // matière ajoutée à la main
    data.acad_assessments = [
        { id: 'a_cloud_cc', subjectId: 's4_inf1423', title: 'CC Cloud', type: 'cc', weight: 0.4, maxScore: 20, targetDate: '2027-03-01' },
        { id: 'a_cloud_ex', subjectId: 's4_inf1423', title: 'Examen Cloud', type: 'exam', weight: 0.6, maxScore: 20, targetDate: '2027-04-01' },
        { id: 'a_web', subjectId: 's3_bd_rel', title: 'Projet Web', type: 'projet', weight: 1, maxScore: 20, targetDate: '2026-12-01' },
        { id: 'a_alg', subjectId: 's3_math_alg', title: 'Partiel', type: 'exam', weight: 1, maxScore: 20, targetDate: '2026-11-15' }
    ];
    data.acad_grades = [
        { id: 'g1', assessmentId: 'a_cloud_cc', score: 14, isFinal: true },
        { id: 'g2', assessmentId: 'a_cloud_ex', score: 11, isFinal: true },
        { id: 'g3', assessmentId: 'a_web', score: 16, isFinal: true },
        { id: 'g4', assessmentId: 'a_alg', score: 9.5, isFinal: true }
    ];
    data.events = [{ id: 'ev1', title: 'Révision — Outils cloud', type: 'revision', subjectId: 's4_inf1423', assessmentId: 'a_cloud_ex', date: '2027-03-25', startTime: '14:00', endTime: '16:00', lockStatus: 'flexible' }];
    data.knowledge_documents = [{ id: 'doc1', title: 'Cours cloud.pdf', linkedTo: { subjectId: 's4_inf1423' } }];
    data.study_history = [{ id: 'r1', subjectId: 's3_math_alg', date: '2026-10-01' }];

    const storage = await makeStorage(data);
    const engine = new AcademicEngine(storage);
    const avgBefore = await engine.getSubjectAverage('s4_inf1423');
    const before = JSON.parse(await snapshot(storage));

    const seeder = new AcademicSeeder(engine);
    const r1 = await seeder.seed();
    const mig = seeder.lastMigration;
    assert(r1 === false && mig && mig.applied === true && mig.fromVersion === 1, 'A1. Année existante : pas de ré-initialisation, migration v1 → v2 appliquée');

    const subjects = await engine.getSubjects();
    const semesters = await engine.getSemesters();
    const s4 = semesters.find(s => s.id === 'sem_s4_27');
    const s3 = semesters.find(s => s.id === 'sem_s3_26');
    const official = subjects.filter(s => s.id !== 'perso_1');
    assert(s4Total(official) === 30, 'A2. S4 : 26 → 30 CECT détaillés');
    assert(s4.metadata.officialCectTotal === 30 && s4.metadata.calculatedDetailedCectTotal === 30 && s4.metadata.cectDiscrepancy === 0 && s4.metadata.cectStatus === 'verified', "A3. S4 : 30 officiels / 30 détaillés / écart 0 / 'verified'");
    const cect4 = await engine.getCectStatus('sem_s4_27');
    assert(cect4.status === 'verified' && cect4.cectDiscrepancy === 0, "A4. getCectStatus('sem_s4_27') : vérifié, sans écart");
    const summary = await engine.getSemesterSummary('sem_s4_27', '2026-10-08');
    assert(!summary.alerts.some(a => a.code === 'CECT_DISCREPANCY'), "A5. Plus d'alerte « écart documentaire CECT » dans le résumé S4");
    assert(s3.metadata.cectStatus === 'verified' && s3.metadata.officialCectTotal === 30 && s3.status === 'completed', "A6. S3 : 30 CECT vérifiés, statut 'completed' de l'utilisatrice conservé");
    assert(officialOk(subjects), 'A7. Les 16 matières ont exactement le code, l\'intitulé, les CECT, le semestre et l\'enseignant officiels');
    assert(subjects.length === 17, 'A8. Aucune matière supprimée ni dupliquée (16 officielles + 1 perso)');

    const ids = subjects.map(s => s.id).sort().join(',');
    assert(ids === before.acad_subjects.map(s => s.id).sort().join(','), 'A9. Tous les ids de matières sont conservés (aucun renommage)');
    const cloud = subjects.find(s => s.id === 's4_inf1423');
    assert(cloud.code === 'INF1423' && cloud.cect === 8 && cloud.teacher === 'Dako Sidoine' && cloud.personalDifficulty === 5, 'A10. s4_inf1423 : 4 → 8 CECT, enseignant ajouté, difficulté perso conservée');
    const web = subjects.find(s => s.id === 's3_bd_rel');
    assert(web.code === 'INF1326' && web.name === 'Aspects avancés des technologies web' && web.cect === 2 && web.gradeCoefficient === 2, "A11. Ancienne « Bases de données relationnelles » (S3-WEB, 5 CECT) → INF1326, 2 CECT, coefficient aligné");
    assert(subjects.find(s => s.id === 's3_stats').gradeCoefficient === 7, 'A12. Coefficient personnalisé (7) conservé');
    assert(subjects.find(s => s.id === 's3_math_alg').code === 'MTH1321', 'A13. Ancien code S3-ALG → MTH1321');
    assert(JSON.stringify(subjects.find(s => s.id === 'perso_1')) === JSON.stringify(before.acad_subjects.find(s => s.id === 'perso_1')), 'A14. Matière ajoutée à la main laissée intacte');

    const after = JSON.parse(await snapshot(storage));
    for (const key of ['acad_assessments', 'acad_grades', 'events', 'knowledge_documents', 'study_history']) {
        assert(JSON.stringify(after[key]) === JSON.stringify(before[key]), `A15. ${key} inchangé (notes, évaluations et liens par id préservés)`);
    }
    const avgAfter = await engine.getSubjectAverage('s4_inf1423');
    assert(avgAfter.average === avgBefore.average && avgAfter.average === 12.2 && avgAfter.status === 'complete', 'A16. La note de la matière (12.2, à partir de ses évaluations) est identique après migration');
    const validation = await engine.validateAcademicData();
    assert(!validation.errors.some(e => e.includes('missing subject')) && !validation.warnings.some(w => w.includes('CECT discrepancy')), 'A17. Validation : aucune évaluation orpheline, plus d\'avertissement d\'écart CECT');
    const yearAfter = (await engine.getYears()).find(y => y.id === 'year_l2_ia_2627');
    assert(yearAfter.seedVersion === 2 && yearAfter.title === 'Licence 2 IA 2026-2027', 'A18. seedVersion = 2 enregistré sur l\'année');

    // Idempotence
    const snap1 = await snapshot(storage);
    const r2 = await seeder.seed();
    assert(r2 === false && seeder.lastMigration.applied === false && seeder.lastMigration.reason === 'UP_TO_DATE', 'A19. 2e démarrage : migration ignorée (déjà à jour)');
    assert(await snapshot(storage) === snap1, 'A20. 2e démarrage : aucune donnée modifiée');
    const forced = await seeder.migrate({ force: true });
    assert(forced.applied === true && forced.changes.length === 0 && await snapshot(storage) === snap1, 'A21. Migration forcée une 2e fois : 0 changement (idempotente)');

    // ---------- B. Toute première version (aacb18b) : S3 sans coefficients, 'Technologies web avancées' ----------
    const storageB = await makeStorage(legacySeed('aacb18b'));
    const engineB = new AcademicEngine(storageB);
    await new AcademicSeeder(engineB).seed();
    const subB = await engineB.getSubjects();
    assert(officialOk(subB) && subB.length === 16, 'B1. Version aacb18b : cursus officiel exact, 16 matières');
    assert(subB.filter(s => s.semesterId === 'sem_s3_26').every(s => s.gradeCoefficient === s.cect) && subB.filter(s => s.semesterId === 'sem_s4_27').every(s => s.gradeCoefficient === null),
        'B2. Coefficients S3 manquants complétés (= CECT), S4 laissés à null');

    // ---------- C. Installation avec le seed récent (ids mth1321…, sans enseignant ni seedVersion) ----------
    const storageC = new MemoryProvider();
    const engineC = new AcademicEngine(storageC);
    const seederC = new AcademicSeeder(engineC);
    await seederC.seed();
    const years = await storageC.loadData('acad_years'); delete years[0].seedVersion; await storageC.saveData('acad_years', years);
    const subsC = await storageC.loadData('acad_subjects');
    subsC.forEach(s => { delete s.teacher; });
    subsC.find(s => s.code === 'INF1423').name = 'Outils cloud de collecte et de traitement des données';
    await storageC.saveData('acad_subjects', subsC);
    await seederC.seed();
    const afterC = await engineC.getSubjects();
    assert(seederC.lastMigration.applied && officialOk(afterC) && afterC.map(s => s.id).join() === subsC.map(s => s.id).join(), 'C1. Seed récent : intitulés/enseignants mis à jour, mêmes ids, même ordre');

    // ---------- D. Matière officielle absente + doublon de code ----------
    const dataD = legacySeed('f2de55f');
    dataD.acad_subjects = dataD.acad_subjects.filter(s => s.id !== 's4_ang1428');
    dataD.acad_subjects.push(sub('inf1421', 'sem_s4_27', 'Python & R (copie)', 4, null, 'INF1421'));
    dataD.acad_assessments = [{ id: 'aD', subjectId: 's4_inf1421', title: 'TP', type: 'tp', weight: 1, maxScore: 20 }];
    const storageD = await makeStorage(dataD);
    const engineD = new AcademicEngine(storageD);
    const seederD = new AcademicSeeder(engineD);
    await seederD.seed();
    const subD = await engineD.getSubjects();
    assert(subD.some(s => s.id === 'ang1428' && s.code === 'ANG1428' && s.cect === 1) && seederD.lastMigration.changes.some(c => c.type === 'subject_created' && c.code === 'ANG1428'), 'D1. Matière officielle manquante (ANG1428) recréée');
    assert(subD.some(s => s.id === 's4_inf1421') && subD.some(s => s.id === 'inf1421') && seederD.lastMigration.warnings.length === 1, 'D2. Doublon INF1421 : rien n\'est supprimé, un avertissement est remonté');
    assert(subD.find(s => s.id === 's4_inf1421').name === 'Programmation avancée en Python et R' && subD.find(s => s.id === 'inf1421').name === 'Python & R (copie)',
        'D3. Doublon : la matière qui porte les évaluations (s4_inf1421) est mise à jour, la copie est laissée telle quelle');

    // ---------- E. De bout en bout : App.start() sur une ancienne installation ----------
    const storageE = await makeStorage(legacySeed('f2de55f'));
    const app = new App(storageE, { generateDailyPlan: async () => ({ habits: [], sessions: [] }) },
        { getDailyStats: async () => null, getFullHistory: async () => [], getMonthlyStats: async () => null },
        { buildDailySummary: async () => null, getCheckIn: async () => null }, null, null, null);
    app.renderView = async () => {};
    await app.start();
    const stateSubjects = app.state.academicSubjects;
    assert(stateSubjects.length === 16 && s4Total(stateSubjects) === 30 && stateSubjects.find(s => s.code === 'INF1423')?.cect === 8, 'E1. App.start() : l\'interface reçoit le cursus migré (S4 = 30, INF1423 = 8 CECT)');

    // ---------- F. Import d'une ancienne sauvegarde (cursus à 26 CECT) dans une installation à jour ----------
    const oldBackup = { _meta: { app: 'coach_procrastination' }, acad_subjects: legacySeed('f2de55f').acad_subjects,
        acad_assessments: [{ id: 'aF', subjectId: 's4_inf1423', title: 'CC', type: 'cc', weight: 1, maxScore: 20 }],
        acad_grades: [{ id: 'gF', assessmentId: 'aF', score: 13, isFinal: true }] };
    await app.importAllData(oldBackup);
    const subF = await storageE.loadData('acad_subjects');
    assert(officialOk(subF) && s4Total(subF) === 30 && subF.some(s => s.id === 's4_inf1423'), 'F1. Import d\'une ancienne sauvegarde : cursus réaligné (S4 = 30), ids conservés');
    assert(JSON.stringify(await storageE.loadData('acad_grades')) === JSON.stringify(oldBackup.acad_grades) && (await new AcademicEngine(storageE).getSubjectAverage('s4_inf1423')).average === 13,
        'F2. Import : notes importées intactes et toujours liées à leur matière');

    // ---------- G. Import d'une sauvegarde récente (seedVersion à jour) : les modifications de l'utilisatrice sont gardées ----------
    const recent = JSON.parse(JSON.stringify(await app.exportAllData()));
    recent.acad_subjects.find(s => s.code === 'INF1422').name = 'Big Data (mon intitulé)';
    await app.importAllData(recent);
    assert((await storageE.loadData('acad_subjects')).find(s => s.code === 'INF1422').name === 'Big Data (mon intitulé)', 'G1. Import d\'une sauvegarde déjà à jour : pas de migration forcée, intitulé personnalisé conservé');

    console.log(`\n=== ${failures === 0 ? 'TOUS LES TESTS PASSENT' : failures + ' ÉCHEC(S)'} ===`);
}

run().catch(e => { console.error('❌ FAIL: exception', e); process.exitCode = 1; });
