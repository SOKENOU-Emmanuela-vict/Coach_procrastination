import { AppLogger } from '../utils/AppLogger.js';
import { Habit } from '../models/Habit.js';
import { DefaultBootcampProgram } from '../data/BootcampProgram.js?v=10';

export class SchedulerEngine {
    constructor(storageProvider) {
        this.storage = storageProvider;
    }
    
    async getFullProgram() {
        let program = await this.storage.loadData('bootcamp_program');
        const currentVersion = "2.9.2_exact_links";
        const savedVersion = await this.storage.loadData('bootcamp_program_version');
        
        // MIGRATION / UPGRADE : Si la version en cache n'est pas la bonne et que ce n'est PAS un bootcamp généré par l'IA
        const hasBlocks = program && Array.isArray(program) && program.length > 0 && program[0] && program[0].days && program[0].days[0] && program[0].days[0].sessions;
        
        if (!program || !hasBlocks || (savedVersion !== currentVersion && savedVersion !== "AI_GENERATED")) {
            program = this.generateDefaultProgram();
            await this.storage.saveData('bootcamp_program', program);
            await this.storage.saveData('bootcamp_program_version', currentVersion);
            AppLogger.info(`Scheduler: Programme par défaut mis à jour vers ${currentVersion}`);
        }
        return program;
    }

    async saveFullProgram(program) {
        await this.storage.saveData('bootcamp_program', program);
        AppLogger.info("Scheduler: Programme sauvegardé.");
    }

    async getDayIndex(dateStr) {
        let offset = await this.storage.loadData('bootcamp_offset');
        let startDateStr = await this.storage.loadData('bootcamp_start_date');
        
        if (!startDateStr) {
            startDateStr = '2026-08-04T12:00:00';
            await this.storage.saveData('bootcamp_start_date', startDateStr);
        }

        const startDate = new Date(startDateStr);
        const currentObj = new Date(dateStr + 'T12:00:00');
        const diffTime = currentObj - startDate;
        let naturalDayIndex = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));

        if (offset === null || offset === undefined) {
            let legacyDayIndex = await this.storage.loadData('current_day_index');
            if (legacyDayIndex !== null && legacyDayIndex !== undefined) {
                offset = legacyDayIndex - naturalDayIndex;
            } else {
                offset = 0;
            }
            await this.storage.saveData('bootcamp_offset', offset);
        }

        let programLength = 27; // Par défaut 4 semaines (28 jours)
        const program = await this.getFullProgram();
        if (program && program.length > 0) {
            programLength = (program.length * 7) - 1;
        }

        let dayIndex = naturalDayIndex + offset;
        dayIndex = Math.min(Math.max(0, dayIndex), programLength);
        
        // Save current_day_index for any legacy components that might still read it directly
        await this.storage.saveData('current_day_index', dayIndex);
        return dayIndex;
    }

    async shiftDayIndex(amount) {
        let offset = await this.storage.loadData('bootcamp_offset') || 0;
        offset += amount;
        await this.storage.saveData('bootcamp_offset', offset);
        
        const localDate = new Date().toLocaleDateString('fr-CA');
        return await this.getDayIndex(localDate);
    }

    async generateDailyPlan(dateStr) {
        AppLogger.info(`Scheduler: Génération du plan pour la date ${dateStr}`);
        
        // Récupérer les habitudes et skills générés par l'IA s'ils existent
        let activeHabits = await this.storage.loadData('bootcamp_habits');
        let dbSkills = await this.storage.loadData('bootcamp_skills');
        let skillsMap = {};
        
        if (dbSkills && Array.isArray(dbSkills)) {
            dbSkills.forEach(s => skillsMap[s.id] = s.label);
        } else {
            skillsMap = {
                'english_speaking': 'Anglais',
                'eloquence_fr': 'Éloquence (Français)',
                'force_n': 'Force-N (Certification)',
                'reading': 'Lecture / Culture',
                'reflection': 'Bilan & Planification',
                'cyber_linux': 'Linux',
                'cyber_network': 'Réseau / Cisco',
                'ia_pandas': 'Data / Pandas',
                'data_excel': 'Data / Excel',
                'dev_git': 'Git / GitHub',
                'cyber_osint': 'OSINT',
                'ia_ml': 'Machine Learning',
                'ia_python': 'Python',
                'cyber_tryhackme': 'Cybersécurité',
                'machine_learning': 'Machine Learning'
            };
        }

        if (!activeHabits) {
            activeHabits = [
                new Habit("hab_3", "Bilan & Objectifs du soir", "reflection", "Critique", 5, "Soir", 7)
            ];
        }

        activeHabits.forEach(h => h.skillLabel = skillsMap[h.skillId] || h.skillId);
        
        const program = await this.getFullProgram();
        
        let todaySessions = [];
        
        let dayIndex = await this.getDayIndex(dateStr);
        const weekIndex = Math.floor(dayIndex / 7);
        const dayOfWeek = dayIndex % 7;
        if (program[weekIndex] && program[weekIndex].days[dayOfWeek]) {
            todaySessions = program[weekIndex].days[dayOfWeek].sessions;
        }
        
        let currentHour = 9;
        let currentMinute = 30;

        const sessionsForToday = todaySessions.map((s, idx) => {
            const startTimeStr = s.startTime || `${currentHour.toString().padStart(2, '0')}h${currentMinute.toString().padStart(2, '0')}`;
            
            // Calculer l'heure de la prochaine session (+ durée + 15m pause)
            let totalMinutes = s.expectedDuration + 15;
            currentMinute += totalMinutes;
            while (currentMinute >= 60) {
                currentHour += 1;
                currentMinute -= 60;
                
                // Pause déjeuner si on dépasse midi (on reprend à 14h)
                if (currentHour === 12) {
                    currentHour = 14;
                    currentMinute = 0;
                }
            }
            
            return {
                id: `sess_${dateStr}_${idx}`,
                title: s.title,
                skillId: s.skillId,
                skillLabel: skillsMap[s.skillId] || 'Général',
                expectedDuration: s.expectedDuration,
                priority: s.priority || "Normale",
                resourceLink: s.resourceLink,
                startTime: startTimeStr,
                objective: s.objective || "",
                expectedResult: s.expectedResult || "",
                proof: s.proof || "",
                difficulty: s.difficulty || "🟢",
                xp: s.xp || 60,
                block: s.block || ""
            };
        });

        AppLogger.info(`Scheduler: ${activeHabits.length} habitudes et ${sessionsForToday.length} sessions générées.`);
        return { date: dateStr, weekIndex: weekIndex, habits: activeHabits, sessions: sessionsForToday };
    }

    generateDefaultProgram() {
        return DefaultBootcampProgram;
    }
}
