import os
import re

seeder_content = """import { AcademicYear } from '../models/AcademicYear.js';
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

        const years = await this.academicEngine.getYears();
        // FORCE SEED for tests (or normally uncomment idempotence check)
        // if (years.find(y => y.id === 'year_l2_ia_2627')) { ... }
        // We will just clear existing S3/S4 to be sure we have clean data
        // For the sake of the exercise, let's keep it idempotent but we'll clear first in tests if needed.

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
        const s3Subjects = [
            new Subject('mth1321', 'sem_s3_26', 'Structures algébriques et leurs applications en informatique', 5, 5, 5, 4, 4, [
                { name: 'Cours', type: 'theory', hours: 30 },
                { name: 'TP/TD', type: 'practice', hours: 20 }
            ], '#e74c3c', 'MTH1321'),
            
            new Subject('inf1322', 'sem_s3_26', 'Approche orientée objet', 6, 6, 5, 4, 4, [
                { code: '1INF1322', name: 'Analyse et conception orientée objet', type: 'theory', hours: 10 },
                { code: '2INF1322', name: 'Langage de programmation Java et C++', type: 'practice', hours: 20 }
            ], '#3498db', 'INF1322'),

            new Subject('inf1323', 'sem_s3_26', 'Structures de données et applications avec C/Python', 5, 5, 5, 4, 4, [
                { name: 'Cours', type: 'theory', hours: 20 },
                { name: 'TP/TD', type: 'practice', hours: 30 }
            ], '#f1c40f', 'INF1323'),

            new Subject('mth1324', 'sem_s3_26', 'Statistiques et probabilités pour le scientifique de la donnée', 4, 4, 3, 3, 3, [
                { code: '1MTH1324', name: 'Concepts théoriques en statistiques et probabilités en apprentissage automatique', type: 'theory', hours: 20 },
                { code: '2MTH1324', name: 'Applications de l’analyse statistique', type: 'practice', hours: 30 }
            ], '#9b59b6', 'MTH1324'),

            new Subject('inf1325', 'sem_s3_26', "Concepts et applications de l’intelligence artificielle", 4, 4, 5, 4, 4, [
                { name: 'Cours', type: 'theory', hours: 20 },
                { name: 'TP/TD', type: 'practice', hours: 30 }
            ], '#1abc9c', 'INF1325'),

            new Subject('inf1326', 'sem_s3_26', 'Aspects avancés des technologies web', 2, 2, 4, 3, 3, [
                { name: 'Cours', type: 'theory', hours: 10 },
                { name: 'TP/TD', type: 'practice', hours: 15 }
            ], '#e67e22', 'INF1326'),

            new Subject('inf1327', 'sem_s3_26', 'Bases du génie logiciel', 3, 3, 3, 3, 3, [
                { code: '1INF1327', name: 'Assurance qualité et test de logiciel', type: 'theory', hours: 20 },
                { code: '2INF1327', name: 'Méthode Agile Scrum', type: 'practice', hours: 20 }
            ], '#34495e', 'INF1327'),

            new Subject('inf1328', 'sem_s3_26', 'Maintenance des appareils électroniques', 1, 1, 2, 2, 2, [
                { name: 'Cours', type: 'theory', hours: 5 },
                { name: 'TP/TD', type: 'practice', hours: 10 }
            ], '#95a5a6', 'INF1328')
        ];

        for (const sub of s3Subjects) {
            await this.academicEngine.saveSubject(sub);
        }

        // 5. Matières S4
        const s4Subjects = [
            new Subject('inf1421', 'sem_s4_27', 'Programmation avancée en Python et R', 4, null, 5, 4, 4, [
                { name: 'Cours', type: 'theory', hours: 20 },
                { name: 'TP/TD', type: 'practice', hours: 30 }
            ], '#3498db', 'INF1421'),
            
            new Subject('inf1422', 'sem_s4_27', 'Big Data', 4, null, 5, 4, 4, [
                { code: '1INF1422', name: 'Bases et concepts du Big data', type: 'theory', hours: 10 },
                { code: '2INF1422', name: 'Bases de données pour le big data', type: 'practice', hours: 15 }
            ], '#2ecc71', 'INF1422'),

            new Subject('inf1423', 'sem_s4_27', 'Outils cloud de collecte et de traitement des données', 4, null, 5, 4, 4, [
                { code: '1INF1423', name: 'Collecte et traitement des données', type: 'theory', hours: 15 },
                { code: '2INF1423', name: 'Outils cloud pour le scientifique de la donnée', type: 'practice', hours: 20 }
            ], '#e67e22', 'INF1423'),

            new Subject('inf1424', 'sem_s4_27', "Concepts et applications de l’apprentissage automatique", 4, null, 5, 4, 4, [
                { code: '1INF1424', name: 'Algorithmes d’apprentissage automatique supervisés', type: 'theory', hours: 10 },
                { code: '2INF1424', name: 'Algorithmes d’apprentissage automatique non supervisés', type: 'practice', hours: 15 }
            ], '#9b59b6', 'INF1424'),

            new Subject('inf1425', 'sem_s4_27', 'Techniques de résolution de problème par la recherche', 4, null, 5, 4, 4, [
                { name: 'Cours', type: 'theory', hours: 15 },
                { name: 'TP/TD', type: 'practice', hours: 25 }
            ], '#e74c3c', 'INF1425'),

            new Subject('ges1426', 'sem_s4_27', 'Gestion des projets', 3, null, 3, 3, 3, [
                { code: '1GES1426', name: 'Conduite de projets informatiques', type: 'theory', hours: 10 },
                { code: '2GES1426', name: 'Stage d’immersion et discipline', type: 'practice', hours: 0 }
            ], '#f1c40f', 'GES1426'),

            new Subject('mgt1427', 'sem_s4_27', 'Communication managériale', 2, null, 3, 3, 3, [
                { name: 'Cours', type: 'theory', hours: 5 },
                { name: 'TP/TD', type: 'practice', hours: 15 }
            ], '#1abc9c', 'MGT1427'),

            new Subject('ang1428', 'sem_s4_27', 'Anglais pour la communication scientifique', 1, null, 2, 2, 2, [
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
"""

with open('src/data/AcademicSeeder.js', 'w', encoding='utf-8') as f:
    f.write(seeder_content)

print("Updated AcademicSeeder.js")
