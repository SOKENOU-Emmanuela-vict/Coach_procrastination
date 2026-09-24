import { AppLogger } from '../utils/AppLogger.js';
import { Habit } from '../models/Habit.js';

export class SchedulerEngine {
    constructor(storageProvider) {
        this.storage = storageProvider;
    }

    async generateDailyPlan(dateStr) {
        AppLogger.info(`Scheduler: Génération du plan pour la date ${dateStr}`);
        
        let activeHabits = await this.storage.loadData('user_habits');
        let dbSkills = await this.storage.loadData('user_skills');
        let skillsMap = {};
        
        if (dbSkills && Array.isArray(dbSkills)) {
            dbSkills.forEach(s => skillsMap[s.id] = s.label);
        } else {
            skillsMap = {
                'english_speaking': 'Anglais',
                'eloquence_fr': 'Éloquence (Français)',
                'force_n': 'Force-N',
                'reflection': 'Bilan & Planification',
                'cyber_linux': 'Linux',
                'ia_python': 'Python'
            };
        }

        if (!activeHabits) {
            activeHabits = [
                new Habit("hab_3", "Bilan & Objectifs du soir", "reflection", "Critique", 5, "Soir", 7)
            ];
        }

        activeHabits.forEach(h => h.skillLabel = skillsMap[h.skillId] || h.skillId);
        
        return {
            date: dateStr,
            habits: activeHabits,
            sessions: [] // Plus de sessions statiques de bootcamp
        };
    }
}
