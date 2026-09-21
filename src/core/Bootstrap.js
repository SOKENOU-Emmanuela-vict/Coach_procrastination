import { IndexedDBProvider } from '../services/IndexedDBProvider.js';
import { SchedulerEngine } from '../engines/SchedulerEngine.js?v=11';
import { StudyRecordEngine } from '../engines/StudyRecordEngine.js';
import { CheckInEngine } from '../engines/CheckInEngine.js';
import { CoachOrchestrator } from '../ai/CoachOrchestrator.js';
import { AIGeneratorEngine } from '../engines/AIGeneratorEngine.js';
import { AcademicEngine } from '../engines/AcademicEngine.js';
import { AcademicSeeder } from '../data/AcademicSeeder.js';
import { App } from './App.js?v=13';
import { AppLogger } from '../utils/AppLogger.js';
import { WeeklyReviewEngine } from '../engines/WeeklyReviewEngine.js';
import { ChatHistoryEngine } from '../engines/ChatHistoryEngine.js';

export class Bootstrap {
    static async init() {
        AppLogger.info("Démarrage du Bootstrap du Learning OS...");
        
        let storage, scheduler, studyRecordEngine, checkInEngine, aiEngine, weeklyReviewEngine, chatHistoryEngine;
        
        try {
            storage = new IndexedDBProvider();
            await storage.initPromise;
            
            // Migration script
            const ls = window.localStorage;
            if (ls.getItem('study_history') && !ls.getItem('migration_done')) {
                AppLogger.info("Starting migration from LocalStorage to IndexedDB...");
                for (let i = 0; i < ls.length; i++) {
                    const key = ls.key(i);
                    if (key !== 'migration_done') {
                        try {
                            const data = JSON.parse(ls.getItem(key));
                            await storage.saveData(key, data);
                        } catch(e) {}
                    }
                }
                ls.setItem('migration_done', 'true');
                AppLogger.info("Migration to IndexedDB complete!");
            }
            
            const savedVersion = await storage.loadData('bootcamp_program_version');
            if (savedVersion !== "2.8_eloquence_no_ted") {
                await storage.clearData('bootcamp_program');
                await storage.saveData('bootcamp_program_version', "2.8_eloquence_no_ted");
                AppLogger.info("Cache du programme purgé (v2.8 : TED complètement remplacé par Storytelling en français) !");
            }

            // Nettoyage des fausses notes générées par erreur (si présentes)
            const grades = await storage.loadData('acad_grades');
            if (grades && grades.some(g => g.id.startsWith('grd_ass_s3_'))) {
                AppLogger.info("Nettoyage des fausses notes et évaluations académiques...");
                const cleanGrades = grades.filter(g => !g.id.startsWith('grd_ass_s3_'));
                await storage.saveData('acad_grades', cleanGrades);

                const assessments = await storage.loadData('acad_assessments');
                if (assessments) {
                    const cleanAssessments = assessments.filter(a => !a.id.startsWith('ass_s3_'));
                    await storage.saveData('acad_assessments', cleanAssessments);
            }

            // Migration des anciens journaux vers le nouveau format CheckIn
            const oldJournals = await storage.loadData('daily_journals');
            if (oldJournals) {
                AppLogger.info("Migration des anciens journaux vers daily_checkins...");
                const checkins = await storage.loadData('daily_checkins') || {};
                let migrated = false;
                for (const date in oldJournals) {
                    if (!checkins[date]) {
                        const j = oldJournals[date];
                        checkins[date] = {
                            id: `chk_migrated_${date}`,
                            date: date,
                            energy: j.energy || 'medium',
                            sleep: { durationMinutes: 420, quality: 'fair' }, // Valeur par défaut
                            blockers: j.blockers || [],
                            notes: `(Ancien Journal)\nHumeur: ${j.mood || '?'}\nAppris: ${j.learned || '?'}\n` + (j.notes || ''),
                            dayAssessment: 'completed',
                            needsFollowUp: [],
                            createdAt: new Date().toISOString(),
                            updatedAt: new Date().toISOString()
                        };
                        migrated = true;
                    }
                }
                if (migrated) {
                    await storage.saveData('daily_checkins', checkins);
                }
                await storage.deleteData('daily_journals');
                AppLogger.info("Migration journaux terminée et clé daily_journals supprimée.");
            }
        } catch (e) { AppLogger.error("Erreur Storage: " + e.message); }
        
        try {
            scheduler = new SchedulerEngine(storage);
        } catch (e) { AppLogger.error("Erreur Scheduler: " + e.message); }
        
        try {
            scheduler = new SchedulerEngine(storage);
        } catch (e) { AppLogger.error("Erreur Scheduler: " + e.message); }
        
        try {
            studyRecordEngine = new StudyRecordEngine(storage);
        } catch (e) { AppLogger.error("Erreur StudyRecord: " + e.message); }
        
        try {
            checkInEngine = new CheckInEngine(storage, null, scheduler, studyRecordEngine);
        } catch (e) { AppLogger.error("Erreur CheckIn: " + e.message); }
        
        try {
            weeklyReviewEngine = new WeeklyReviewEngine(storage, null, scheduler, studyRecordEngine, checkInEngine);
        } catch (e) { AppLogger.error("Erreur WeeklyReview: " + e.message); }
        
        try {
            aiEngine = new AIGeneratorEngine(storage);
        } catch (e) { AppLogger.error("Erreur AI: " + e.message); }
        
        try {
            chatHistoryEngine = new ChatHistoryEngine(storage);
        } catch (e) { AppLogger.error("Erreur ChatHistory: " + e.message); }
        
        if (!storage || !scheduler || !studyRecordEngine || !checkInEngine || !aiEngine || !chatHistoryEngine) {
            console.error("Erreur critique: Moteurs non initialisés.");
            return;
        }

        // On vérifie s'il y a un utilisateur
        const user = await storage.loadData('user_profile');
        
        try {
            const academicEngine = new AcademicEngine(storage);
            const seeder = new AcademicSeeder(academicEngine);
            await seeder.seed();
        } catch (e) { AppLogger.error("Erreur Seeder: " + e.message); }
        
        const app = new App(storage, scheduler, studyRecordEngine, checkInEngine, aiEngine, weeklyReviewEngine, chatHistoryEngine);
        try {
            await app.start();
        } catch (err) {
            AppLogger.error("Erreur dans app.start(): " + err.message);
            const root = document.getElementById('app-root');
            if (root) {
                root.innerHTML = `<div style="color:red; padding:20px; text-align:center;">
                    <h3>Erreur de démarrage : ${err.message}</h3>
                    <button onclick="localStorage.clear(); window.location.reload(true);" style="background:#00f2fe;color:#0f2027;padding:10px 20px;border-radius:15px;border:none;cursor:pointer;margin-top:10px;font-weight:bold;">
                        🔄 Réinitialiser l'application
                    </button>
                </div>`;
            }
            throw err;
        }
        
        AppLogger.info("Bootstrap terminé. Application prête.");
        return app;
    }
}
