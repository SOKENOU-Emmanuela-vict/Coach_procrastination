import { AcademicYear } from '../models/AcademicYear.js';
import { Semester } from '../models/Semester.js';
import { Subject } from '../models/Subject.js';
import { AppLogger } from '../utils/AppLogger.js';

/**
 * Script d'initialisation des données académiques officielles L2 IA.
 * Ce script est idempotent : il n'écrasera pas les données si elles existent déjà.
 */
export class AcademicSeeder {
    constructor(academicEngine) {
        this.academicEngine = academicEngine;
    }

    async seed() {
        AppLogger.info("Démarrage du seeder académique L2 IA...");

        // 1. Vérification d'idempotence (si l'année existe, on s'arrête pour ne rien écraser)
        const years = await this.academicEngine.getYears();
        if (years.find(y => y.id === 'year_l2_ia_2627')) {
            AppLogger.info("Seeder académique: Les données existent déjà. Initialisation ignorée.");
            return false;
        }

        // 2. Année Académique
        const l2Year = new AcademicYear('year_l2_ia_2627', 'Licence 2 IA 2026-2027', '2026-09-01', '2027-06-30');
        await this.academicEngine.saveYear(l2Year);

        // 3. Semestres S3 et S4
        const s3 = new Semester('sem_s3_26', 'year_l2_ia_2627', 'S3', 'active');
        const s4 = new Semester('sem_s4_27', 'year_l2_ia_2627', 'S4', 'upcoming', {
            officialCectTotal: 30,
            calculatedDetailedCectTotal: 26,
            cectDiscrepancy: 4,
            cectStatus: "to_confirm"
        });
        await this.academicEngine.saveSemester(s3);
        await this.academicEngine.saveSemester(s4);

        // 4. Matières S3 (Total 30 CECT)
        // Note: gradeCoefficient est défini à null car le document officiel ne certifie pas si CECT = Coeff.
        const s3Subjects = [
            new Subject('s3_math_alg', 'sem_s3_26', 'Structures algébriques et applications', 5, null, 5, 4, 4, [
                { name: 'Cours', type: 'theory', hours: 30 },
                { name: 'TP/TD', type: 'practice', hours: 20 }
            ], '#e74c3c', 'S3-ALG'),
            
            new Subject('s3_poo', 'sem_s3_26', 'Approche orientée objet', 6, null, 5, 4, 4, [
                { name: 'Analyse et conception orientée objet (Cours)', type: 'theory', hours: 10 },
                { name: 'Analyse et conception orientée objet (TP/TD)', type: 'practice', hours: 15 },
                { name: 'Java et C++ (Cours)', type: 'theory', hours: 20 },
                { name: 'Java et C++ (TP/TD)', type: 'practice', hours: 30 }
            ], '#3498db', 'S3-POO'),

            new Subject('s3_algo_c_py', 'sem_s3_26', 'Structures de données C/Python', 5, null, 5, 4, 4, [
                { name: 'Cours', type: 'theory', hours: 20 },
                { name: 'TP/TD', type: 'practice', hours: 30 }
            ], '#f1c40f', 'S3-ALGO'),

            new Subject('s3_stats', 'sem_s3_26', 'Statistiques & probabilités', 4, null, 3, 3, 3, [
                { name: 'Cours', type: 'theory', hours: 20 },
                { name: 'TP/TD', type: 'practice', hours: 30 }
            ], '#9b59b6', 'S3-STAT'),

            new Subject('s3_concepts_ia', 'sem_s3_26', "Concepts & applications de l'IA", 4, null, 5, 4, 4, [
                { name: 'Cours', type: 'theory', hours: 20 },
                { name: 'TP/TD', type: 'practice', hours: 30 }
            ], '#1abc9c', 'S3-IA'),

            new Subject('s3_web_adv', 'sem_s3_26', 'Technologies web avancées', 2, null, 3, 3, 3, [
                { name: 'Cours', type: 'theory', hours: 10 },
                { name: 'TP/TD', type: 'practice', hours: 15 }
            ], '#e67e22', 'S3-WEB'),

            new Subject('s3_genie_log', 'sem_s3_26', 'Génie logiciel', 3, null, 3, 3, 3, [
                { name: 'Cours', type: 'theory', hours: 20 },
                { name: 'TP/TD', type: 'practice', hours: 20 }
            ], '#34495e', 'S3-GL'),

            new Subject('s3_maint_elec', 'sem_s3_26', 'Maintenance électronique', 1, null, 2, 2, 2, [
                { name: 'Cours', type: 'theory', hours: 5 },
                { name: 'TP/TD', type: 'practice', hours: 10 }
            ], '#95a5a6', 'S3-ELEC')
        ];

        for (const sub of s3Subjects) {
            await this.academicEngine.saveSubject(sub);
        }

        // 5. Matières S4 (Total 8 Matières)
        const s4Subjects = [
            new Subject('s4_inf1421', 'sem_s4_27', 'Programmation avancée en Python et R', 4, null, 5, 4, 4, [
                { name: 'Cours', type: 'theory', hours: 20 },
                { name: 'TP/TD', type: 'practice', hours: 30 }
            ], '#3498db', 'INF1421'),
            
            new Subject('s4_inf1422', 'sem_s4_27', 'Big Data', 4, null, 5, 4, 4, [
                { name: 'Bases et concepts du Big data (Cours)', type: 'theory', hours: 10 },
                { name: 'Bases et concepts du Big data (TP/TD)', type: 'practice', hours: 15 },
                { name: 'Bases de données pour le big data (Cours)', type: 'theory', hours: 10 },
                { name: 'Bases de données pour le big data (TP/TD)', type: 'practice', hours: 15 }
            ], '#2ecc71', 'INF1422'),

            new Subject('s4_inf1423', 'sem_s4_27', 'Outils cloud de collecte et de traitement des données', 4, null, 5, 4, 4, [
                { name: 'Collecte et traitement des données (Cours)', type: 'theory', hours: 15 },
                { name: 'Collecte et traitement des données (TP/TD)', type: 'practice', hours: 20 },
                { name: 'Outils cloud pour le scientifique de la donnée (Cours)', type: 'theory', hours: 15 },
                { name: 'Outils cloud pour le scientifique de la donnée (TP/TD)', type: 'practice', hours: 20 }
            ], '#e67e22', 'INF1423'),

            new Subject('s4_inf1424', 'sem_s4_27', "Concepts et applications de l'apprentissage automatique", 4, null, 5, 4, 4, [
                { name: 'Algorithmes d’apprentissage automatique supervisés (Cours)', type: 'theory', hours: 10 },
                { name: 'Algorithmes d’apprentissage automatique supervisés (TP/TD)', type: 'practice', hours: 15 },
                { name: 'Algorithmes d’apprentissage automatique non supervisés (Cours)', type: 'theory', hours: 10 },
                { name: 'Algorithmes d’apprentissage automatique non supervisés (TP/TD)', type: 'practice', hours: 15 }
            ], '#9b59b6', 'INF1424'),

            new Subject('s4_inf1425', 'sem_s4_27', 'Techniques de résolution de problème par la recherche', 4, null, 5, 4, 4, [
                { name: 'Cours', type: 'theory', hours: 15 },
                { name: 'TP/TD', type: 'practice', hours: 25 }
            ], '#e74c3c', 'INF1425'),

            new Subject('s4_ges1426', 'sem_s4_27', 'Gestion des projets', 3, null, 3, 3, 3, [
                { name: 'Conduite de projets informatiques (Cours)', type: 'theory', hours: 10 },
                { name: 'Conduite de projets informatiques (TP/TD)', type: 'practice', hours: 15 },
                { name: 'Stage d’immersion et discipline (Cours)', type: 'theory', hours: 0 },
                { name: 'Stage d’immersion et discipline (TP/TD)', type: 'practice', hours: 0 }
            ], '#f1c40f', 'GES1426'),

            new Subject('s4_mgt1427', 'sem_s4_27', 'Communication managériale', 2, null, 3, 3, 3, [
                { name: 'Cours', type: 'theory', hours: 5 },
                { name: 'TP/TD', type: 'practice', hours: 15 }
            ], '#1abc9c', 'MGT1427'),

            new Subject('s4_ang1428', 'sem_s4_27', 'Anglais pour la communication scientifique', 1, null, 2, 2, 2, [
                { name: 'Cours', type: 'theory', hours: 5 },
                { name: 'TP/TD', type: 'practice', hours: 10 }
            ], '#34495e', 'ANG1428')
        ];

        for (const sub of s4Subjects) {
            await this.academicEngine.saveSubject(sub);
        }

        AppLogger.info("Seeder académique: Toutes les données L2 IA (S3/S4) ont été intégrées avec succès.");
        return true;
    }
}
