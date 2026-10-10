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
            sessions: await this._buildSessionsFromEvents(dateStr)
        };
    }

    /**
     * Transforme les événements de travail personnel du jour (révisions, projets, langues, perso…)
     * en sessions pour le mode Focus. Les cours et examens (obligatoires, suivis de toute façon)
     * restent dans l'agenda mais ne deviennent JAMAIS des sessions Focus — y compris les cours importés
     * depuis l'emploi du temps (type 'class', source 'school_schedule').
     * L'id de session = id de l'événement, ce qui évite tout double comptage dans les bilans.
     */
    async _buildSessionsFromEvents(dateStr) {
        const rawEvents = await this.storage.loadData('events');
        const events = Array.isArray(rawEvents) ? rawEvents : [];
        const passiveTypes = ['course', 'cours', 'class', 'classe', 'cm', 'td', 'tp', 'lecture', 'lesson', 'tutorial', 'exam', 'examen', 'cc'];
        const typeLabels = { revision: 'Révision', project: 'Projet', projet: 'Projet', langue: 'Langue', language: 'Langue', personal: 'Personnel', life: 'Life' };

        return events
            .filter(e => e && e.date === dateStr)
            .filter(e => !passiveTypes.includes((e.type || '').toLowerCase()) && e.source !== 'school_schedule')
            .sort((a, b) => (a.startTime || '99:99').localeCompare(b.startTime || '99:99'))
            .map(e => {
                let duration = 0;
                if (e.startTime && e.endTime) duration = this._timeToMins(e.endTime) - this._timeToMins(e.startTime);
                if (!(duration > 0)) duration = e.targetDuration || e.duration || 25; // défaut : un pomodoro
                const typeKey = (e.type || '').toLowerCase();
                return {
                    id: e.id,
                    title: e.title || typeLabels[typeKey] || 'Session',
                    objective: typeLabels[typeKey] || e.type || '',
                    expectedDuration: duration,
                    startTime: e.startTime || null,
                    endTime: e.endTime || null,
                    priority: e.priority === 'high' ? 'Haute' : (e.priority === 'low' ? 'Basse' : 'Normale'),
                    subjectId: e.subjectId || null,
                    projectId: e.projectId || null,
                    skillId: e.subjectId || e.projectId || null,
                    resourceLink: e.resourceLink || null,
                    source: 'event',
                    completed: false
                };
            });
    }

    async getFullProgram() {
        // Maintien de compatibilité minimale pour l'accès aux données legacy du bootcamp
        return await this.storage.loadData('bootcamp_program') || null;
    }

    async getAvailableSlots(dateStr) {
        AppLogger.info(`Scheduler: Recherche de créneaux libres pour le ${dateStr}`);
        
        // Plage de base (08:00 - 22:00)
        const wakeTime = 8 * 60; // 08:00
        const sleepTime = 22 * 60; // 22:00
        
        let busyBlocks = [];

        // Récupérer les événements du calendrier
        let rawEvents = await this.storage.loadData('user_events');
        let events = [];
        if (Array.isArray(rawEvents)) {
            events = rawEvents;
        } else if (rawEvents && rawEvents.events) {
            events = rawEvents.events;
        }
        
        const dayEvents = events.filter(e => e.date === dateStr);
        
        for (const e of dayEvents) {
            if (e.startTime && e.endTime) {
                busyBlocks.push({
                    start: this._timeToMins(e.startTime),
                    end: this._timeToMins(e.endTime)
                });
            }
        }

        // TODO: Ajouter la vérification des habitudes qui ont un créneau fixe
        // Pour le moment on ne gère que les événements stricts

        // Fusionner et trier les blocs occupés
        busyBlocks.sort((a, b) => a.start - b.start);
        
        const mergedBlocks = [];
        for (const block of busyBlocks) {
            if (mergedBlocks.length === 0) {
                mergedBlocks.push(block);
            } else {
                let last = mergedBlocks[mergedBlocks.length - 1];
                if (block.start <= last.end) {
                    last.end = Math.max(last.end, block.end);
                } else {
                    mergedBlocks.push(block);
                }
            }
        }

        // Calculer les trous (créneaux libres)
        const freeSlots = [];
        let currentStart = wakeTime;

        for (const block of mergedBlocks) {
            // Ignorer les blocs avant le réveil
            if (block.end <= wakeTime) continue;
            
            // Ajuster le début du bloc s'il commence avant le réveil
            const blockStart = Math.max(block.start, wakeTime);

            if (currentStart < blockStart) {
                freeSlots.push({
                    startTime: this._minsToTime(currentStart),
                    endTime: this._minsToTime(blockStart)
                });
            }
            currentStart = Math.max(currentStart, block.end);
        }

        if (currentStart < sleepTime) {
            freeSlots.push({
                startTime: this._minsToTime(currentStart),
                endTime: this._minsToTime(sleepTime)
            });
        }

        return freeSlots;
    }

    _timeToMins(timeStr) {
        if (!timeStr) return 0;
        const [h, m] = timeStr.split(':').map(Number);
        return h * 60 + m;
    }

    _minsToTime(mins) {
        const h = Math.floor(mins / 60);
        const m = mins % 60;
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
    }
}
