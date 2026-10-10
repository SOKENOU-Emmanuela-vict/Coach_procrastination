/**
 * Cursus officiel L2 IA 2026-2027 (S3 + S4) : source unique utilisée par le seeder (nouvelles installations)
 * et par la migration des données déjà présentes dans IndexedDB.
 *
 * Valeurs officielles (code, intitulé, CECT, enseignant(s)) fournies par l'étudiante. S4 = 30 CECT officiels,
 * vérifiés (aucun écart). Les composantes (heures cours / TP) et les réglages internes (couleur, importance,
 * difficulté, coefficient) reprennent les valeurs historiques du seeder.
 *
 * Augmenter CURRICULUM_SEED_VERSION à chaque modification de ce fichier : les installations existantes
 * seront mises à jour au prochain démarrage (voir AcademicSeeder.migrate()).
 */
export const CURRICULUM_SEED_VERSION = 2;

export const CURRICULUM_YEAR = {
    id: 'year_l2_ia_2627',
    title: 'Licence 2 IA 2026-2027',
    startDate: '2026-09-01',
    endDate: '2027-06-30'
};

export const CURRICULUM_SEMESTERS = [
    { id: 'sem_s3_26', name: 'S3', defaultStatus: 'active', officialCectTotal: 30 },
    { id: 'sem_s4_27', name: 'S4', defaultStatus: 'upcoming', officialCectTotal: 30 }
];

/**
 * legacyIds / legacyCodes : identifiants et codes utilisés par les anciennes versions du seeder,
 * pour retrouver la matière d'une installation existante même si son code n'était pas encore officiel.
 * gradeCoefficient : S3 = CECT (comme avant) ; S4 = null (coefficients non communiqués).
 */
export const CURRICULUM_SUBJECTS = [
    // ---- Semestre 3 (30 CECT) ----
    {
        id: 'mth1321', semesterId: 'sem_s3_26', code: 'MTH1321',
        name: 'Structures algébriques et applications', cect: 5, teacher: 'Houénou',
        gradeCoefficient: 5, importance: 5, difficulty: 4, personalDifficulty: 4, color: '#e74c3c',
        legacyIds: ['s3_math_alg'], legacyCodes: ['S3-ALG'],
        components: [
            { code: '1MTH1321', name: 'Structures algébriques et leurs applications', teacher: 'Houénou', type: 'theory', hours: 30, practiceHours: 20 }
        ]
    },
    {
        id: 'inf1322', semesterId: 'sem_s3_26', code: 'INF1322',
        name: 'Approche orientée objet (Java/C++)', cect: 6, teacher: 'Ratheil & Accrombessi',
        gradeCoefficient: 6, importance: 5, difficulty: 4, personalDifficulty: 4, color: '#3498db',
        legacyIds: ['s3_poo'], legacyCodes: ['S3-POO'],
        components: [
            { code: '1INF1322', name: 'Analyse et conception orientée objet', teacher: 'Ratheil', type: 'theory', hours: 10, practiceHours: 15 },
            { code: '2INF1322', name: 'Langage de programmation Java et C++', teacher: 'Accrombessi', type: 'practice', hours: 20, practiceHours: 30 }
        ]
    },
    {
        id: 'inf1323', semesterId: 'sem_s3_26', code: 'INF1323',
        name: 'Structures de données et applications C/Python', cect: 5, teacher: 'Ratheil',
        gradeCoefficient: 5, importance: 5, difficulty: 4, personalDifficulty: 4, color: '#f1c40f',
        legacyIds: ['s3_algo_c_py'], legacyCodes: ['S3-ALGO'],
        components: [
            { code: '1INF1323', name: 'Structure de données et applications avec C/Python', teacher: 'Ratheil', type: 'theory', hours: 20, practiceHours: 30 }
        ]
    },
    {
        id: 'mth1324', semesterId: 'sem_s3_26', code: 'MTH1324',
        name: 'Statistiques et probabilités', cect: 4, teacher: 'Ratheil & Peace Souand',
        gradeCoefficient: 4, importance: 3, difficulty: 3, personalDifficulty: 3, color: '#9b59b6',
        legacyIds: ['s3_stats'], legacyCodes: ['S3-STAT'],
        components: [
            { code: '1MTH1324', name: 'Concepts théoriques en statistiques et probabilités', teacher: 'Ratheil', type: 'theory', hours: 15, practiceHours: 10 },
            { code: '2MTH1324', name: 'Applications de l’analyse statistique', teacher: 'Peace Souand', type: 'practice', hours: 5, practiceHours: 20 }
        ]
    },
    {
        id: 'inf1325', semesterId: 'sem_s3_26', code: 'INF1325',
        name: "Concepts et applications de l'IA", cect: 4, teacher: 'Ratheil',
        gradeCoefficient: 4, importance: 5, difficulty: 4, personalDifficulty: 4, color: '#1abc9c',
        legacyIds: ['s3_concepts_ia'], legacyCodes: ['S3-IA'],
        components: [
            { code: '1INF1325', name: 'Concepts et application de l’intelligence artificielle', teacher: 'Ratheil', type: 'theory', hours: 20, practiceHours: 30 }
        ]
    },
    {
        // Anciennes versions : 's3_web_adv' (Technologies web avancées) puis 's3_bd_rel' (« Bases de données
        // relationnelles », 5 CECT, matière erronée qui portait déjà le code S3-WEB).
        id: 'inf1326', semesterId: 'sem_s3_26', code: 'INF1326',
        name: 'Aspects avancés des technologies web', cect: 2, teacher: 'Wahabou',
        gradeCoefficient: 2, importance: 4, difficulty: 3, personalDifficulty: 3, color: '#e67e22',
        legacyIds: ['s3_web_adv', 's3_bd_rel'], legacyCodes: ['S3-WEB'],
        components: [
            { code: '1INF1326', name: 'Aspects avancés des technologies web', teacher: 'Wahabou', type: 'theory', hours: 10, practiceHours: 15 }
        ]
    },
    {
        id: 'inf1327', semesterId: 'sem_s3_26', code: 'INF1327',
        name: 'Bases du génie logiciel (Agile Scrum/Test)', cect: 3, teacher: 'John',
        gradeCoefficient: 3, importance: 3, difficulty: 3, personalDifficulty: 3, color: '#34495e',
        legacyIds: ['s3_genie_log'], legacyCodes: ['S3-GL'],
        components: [
            { code: '1INF1327', name: 'Assurance qualité et test de logiciel', teacher: 'John', type: 'theory', hours: 10, practiceHours: 10 },
            { code: '2INF1327', name: 'Méthode Agile Scrum', teacher: 'John', type: 'practice', hours: 10, practiceHours: 10 }
        ]
    },
    {
        id: 'inf1328', semesterId: 'sem_s3_26', code: 'INF1328',
        name: 'Maintenance des appareils électroniques', cect: 1, teacher: 'Akpaoka',
        gradeCoefficient: 1, importance: 2, difficulty: 2, personalDifficulty: 2, color: '#95a5a6',
        legacyIds: ['s3_maint_elec'], legacyCodes: ['S3-ELEC'],
        components: [
            { code: '1INF1328', name: 'Maintenance des appareils électroniques', teacher: 'Akpaoka', type: 'theory', hours: 5, practiceHours: 10 }
        ]
    },

    // ---- Semestre 4 (30 CECT officiels, vérifiés) ----
    {
        id: 'inf1421', semesterId: 'sem_s4_27', code: 'INF1421',
        name: 'Programmation avancée en Python et R', cect: 4, teacher: 'John',
        gradeCoefficient: null, importance: 5, difficulty: 4, personalDifficulty: 4, color: '#3498db',
        legacyIds: ['s4_inf1421'], legacyCodes: [],
        components: [
            { code: '1INF1421', name: 'Programmation avancée en Python et R', teacher: 'John', type: 'theory', hours: 20, practiceHours: 30 }
        ]
    },
    {
        id: 'inf1422', semesterId: 'sem_s4_27', code: 'INF1422',
        name: 'Big Data', cect: 4, teacher: 'Eric Adjé',
        gradeCoefficient: null, importance: 5, difficulty: 4, personalDifficulty: 4, color: '#2ecc71',
        legacyIds: ['s4_inf1422'], legacyCodes: [],
        components: [
            { code: '1INF1422', name: 'Bases et concepts du Big data', teacher: 'Eric Adjé', type: 'theory', hours: 10, practiceHours: 15 },
            { code: '2INF1422', name: 'Bases de données pour le big data', teacher: 'Eric Adjé', type: 'practice', hours: 10, practiceHours: 15 }
        ]
    },
    {
        id: 'inf1423', semesterId: 'sem_s4_27', code: 'INF1423',
        name: 'Outils cloud de collecte et traitement', cect: 8, teacher: 'Dako Sidoine',
        gradeCoefficient: null, importance: 5, difficulty: 4, personalDifficulty: 4, color: '#e67e22',
        legacyIds: ['s4_inf1423'], legacyCodes: [],
        components: [
            { code: '1INF1423', name: 'Collecte et traitement des données', teacher: 'Dako Sidoine', type: 'theory', hours: 15, practiceHours: 20 },
            { code: '2INF1423', name: 'Outils cloud pour le scientifique de la donnée', teacher: 'Dako Sidoine', type: 'practice', hours: 15, practiceHours: 20 }
        ]
    },
    {
        id: 'inf1424', semesterId: 'sem_s4_27', code: 'INF1424',
        name: "Concepts de l'apprentissage automatique (Machine Learning)", cect: 4, teacher: 'Ratheil',
        gradeCoefficient: null, importance: 5, difficulty: 4, personalDifficulty: 4, color: '#9b59b6',
        legacyIds: ['s4_inf1424'], legacyCodes: [],
        components: [
            { code: '1INF1424', name: 'Algorithmes d’apprentissage automatique supervisés', teacher: 'Ratheil', type: 'theory', hours: 10, practiceHours: 15 },
            { code: '2INF1424', name: 'Algorithmes d’apprentissage automatique non supervisés', teacher: 'Ratheil', type: 'practice', hours: 10, practiceHours: 15 }
        ]
    },
    {
        id: 'inf1425', semesterId: 'sem_s4_27', code: 'INF1425',
        name: 'Résolution de problème par la recherche', cect: 4, teacher: 'Ratheil',
        gradeCoefficient: null, importance: 5, difficulty: 4, personalDifficulty: 4, color: '#e74c3c',
        legacyIds: ['s4_inf1425'], legacyCodes: [],
        components: [
            { code: '1INF1425', name: 'Techniques de résolution de problème par la recherche', teacher: 'Ratheil', type: 'theory', hours: 15, practiceHours: 25 }
        ]
    },
    {
        id: 'ges1426', semesterId: 'sem_s4_27', code: 'GES1426',
        name: 'Gestion des projets', cect: 3, teacher: 'Azombakin',
        gradeCoefficient: null, importance: 3, difficulty: 3, personalDifficulty: 3, color: '#f1c40f',
        legacyIds: ['s4_ges1426'], legacyCodes: [],
        components: [
            { code: '1GES1426', name: 'Conduite de projets informatiques', teacher: 'Azombakin', type: 'theory', hours: 10, practiceHours: 15 },
            { code: '2GES1426', name: 'Stage d’immersion et discipline', teacher: 'Azombakin', type: 'practice', hours: 0, practiceHours: 0 }
        ]
    },
    {
        id: 'mgt1427', semesterId: 'sem_s4_27', code: 'MGT1427',
        name: 'Communication managériale', cect: 2, teacher: 'Colomb',
        gradeCoefficient: null, importance: 3, difficulty: 3, personalDifficulty: 3, color: '#1abc9c',
        legacyIds: ['s4_mgt1427'], legacyCodes: [],
        components: [
            { code: '1MGT1427', name: 'Communication managériale', teacher: 'Colomb', type: 'theory', hours: 5, practiceHours: 15 }
        ]
    },
    {
        id: 'ang1428', semesterId: 'sem_s4_27', code: 'ANG1428',
        name: 'Anglais pour la communication scientifique', cect: 1, teacher: 'Zanklan Pascal',
        gradeCoefficient: null, importance: 2, difficulty: 2, personalDifficulty: 2, color: '#34495e',
        legacyIds: ['s4_ang1428'], legacyCodes: [],
        components: [
            { code: '1ANG1428', name: 'Anglais pour la communication scientifique', teacher: 'Zanklan Pascal', type: 'theory', hours: 5, practiceHours: 10 }
        ]
    }
];

/** Somme des CECT officiels d'un semestre, calculée à partir du cursus ci-dessus. */
export function curriculumCectTotal(semesterId) {
    return CURRICULUM_SUBJECTS.filter(s => s.semesterId === semesterId).reduce((acc, s) => acc + s.cect, 0);
}
