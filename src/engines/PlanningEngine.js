import { AppLogger } from '../utils/AppLogger.js';
import { Event } from '../models/Event.js';

export class PlanningEngine {
    constructor(storageProvider) {
        this.storage = storageProvider;
    }

    // --- CRUD Events ---
    async getEvents() {
        return await this.storage.loadData('events') || [];
    }

    async saveEvent(event) {
        const validatedEvent = new Event(event);
        let items = await this.getEvents();
        const index = items.findIndex(i => i.id === validatedEvent.id);
        if (index >= 0) items[index] = validatedEvent; else items.push(validatedEvent);
        await this.storage.saveData('events', items);
    }

    async deleteEvent(eventId) {
        let items = await this.getEvents();
        const initialLength = items.length;
        items = items.filter(i => i.id !== eventId);
        if (items.length !== initialLength) {
            await this.storage.saveData('events', items);
        }
    }

    // --- Intent Execution ---
    async executeIntent(intent) {
        if (!intent || typeof intent.validateStructure !== 'function') return { success: false, reason: "Invalid Intent Object" };
        
        const structureCheck = intent.validateStructure();
        if (!structureCheck.valid) return { success: false, reason: structureCheck.reason };

        if (intent.target !== 'event') return { success: false, reason: "Target not supported" };
        if (intent.action !== 'create') return { success: false, reason: "Action not supported" };

        const subjects = await this.storage.loadData('acad_subjects') || [];
        const assessments = await this.storage.loadData('acad_assessments') || [];
        const projects = await this.storage.loadData('projects') || [];

        // Validation des références
        if (intent.payload.subjectId && !subjects.find(s => s.id === intent.payload.subjectId)) {
            return { success: false, reason: `Subject ${intent.payload.subjectId} not found` };
        }
        if (intent.payload.assessmentId && !assessments.find(a => a.id === intent.payload.assessmentId)) {
            return { success: false, reason: `Assessment ${intent.payload.assessmentId} not found` };
        }

        const evConfig = {
            id: `ev_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
            title: intent.payload.title || 'Nouvel événement',
            date: intent.constraints.date,
            startTime: intent.constraints.startTime || null,
            endTime: intent.constraints.endTime || null,
            duration: intent.payload.duration || 0,
            targetDuration: intent.payload.targetDuration || null,
            type: intent.payload.type || 'defaut',
            impact: 'bloc',
            mandatory: true,
            lockStatus: intent.payload.lockStatus || 'flexible',
            priority: intent.payload.priority || 'high',
            subjectId: intent.payload.subjectId || null,
            assessmentId: intent.payload.assessmentId || null,
            projectId: intent.payload.projectId || null,
            taskId: intent.payload.taskId || null,
            source: intent.payload.source || 'system'
        };

        // Si des horaires sont fournis, on checke les conflits avant l'insertion
        if (evConfig.date && evConfig.startTime && evConfig.endTime) {
            // On simule l'ajout pour voir si ça génère un conflit critique
            const currentEvents = await this.getEventsForDate(evConfig.date);
            currentEvents.push(evConfig);
            
            // Re-use du check interne de conflit
            for (let i = 0; i < currentEvents.length - 1; i++) {
                const ev1 = currentEvents[i];
                if (!ev1.startTime || !ev1.endTime) continue;
                
                if (this._doTimesOverlap(ev1.startTime, ev1.endTime, evConfig.startTime, evConfig.endTime)) {
                    if (ev1.lockStatus === 'locked' && evConfig.lockStatus === 'locked') {
                        return { success: false, reason: "CRITICAL_CONFLICT: Cannot insert locked event over another locked event" };
                    }
                }
            }
        }

        await this.saveEvent(evConfig);
        return { success: true, eventId: evConfig.id };
    }

    // --- CRUD Availability Windows ---
    async getAvailabilityWindows() {
        return await this.storage.loadData('availabilities') || [];
    }

    async saveAvailabilityWindow(window) {
        let items = await this.getAvailabilityWindows();
        const index = items.findIndex(i => i.id === window.id);
        if (index >= 0) items[index] = window; else items.push(window);
        await this.storage.saveData('availabilities', items);
    }

    async deleteAvailabilityWindow(windowId) {
        let items = await this.getAvailabilityWindows();
        const initialLength = items.length;
        items = items.filter(i => i.id !== windowId);
        if (items.length !== initialLength) {
            await this.storage.saveData('availabilities', items);
        }
    }

    // --- Requêtes ---
    async getEventsForDate(date) {
        const events = await this.getEvents();
        return events.filter(e => e.date === date);
    }

    async getEventsForSubject(subjectId) {
        const events = await this.getEvents();
        return events.filter(e => e.subjectId === subjectId);
    }

    async getEventsForAssessment(assessmentId) {
        const events = await this.getEvents();
        return events.filter(e => e.assessmentId === assessmentId);
    }

    async getEventsForProject(projectId) {
        const events = await this.getEvents();
        return events.filter(e => e.projectId === projectId);
    }

    async getEventsForTask(projectId, taskId) {
        const events = await this.getEvents();
        return events.filter(e => e.projectId === projectId && e.taskId === taskId);
    }

    // --- Validation et Conflits ---
    
    _timeToMinutes(timeStr) {
        if (!timeStr) return 0;
        const [h, m] = timeStr.split(':').map(Number);
        return h * 60 + m;
    }

    _doTimesOverlap(start1, end1, start2, end2) {
        const s1 = this._timeToMinutes(start1);
        const e1 = this._timeToMinutes(end1);
        const s2 = this._timeToMinutes(start2);
        const e2 = this._timeToMinutes(end2);
        
        // Un chevauchement existe si le début de 1 est avant la fin de 2 ET le début de 2 est avant la fin de 1
        return (s1 < e2 && s2 < e1);
    }

    async detectConflicts(date) {
        const events = await this.getEventsForDate(date);
        const subjects = await this.storage.loadData('acad_subjects') || [];
        const assessments = await this.storage.loadData('acad_assessments') || [];
        const projects = await this.storage.loadData('projects') || [];
        
        const conflicts = [];

        // 1. Validation individuelle (TIME_CONFLICT & DATA_CONFLICT)
        for (const ev of events) {
            // TIME_CONFLICT
            if (ev.startTime && ev.endTime) {
                if (this._timeToMinutes(ev.startTime) >= this._timeToMinutes(ev.endTime)) {
                    conflicts.push({ type: 'TIME_CONFLICT', event: ev, message: `L'heure de fin doit être après l'heure de début` });
                }
            }

            // DATA_CONFLICT (Academic)
            if (ev.subjectId && !subjects.find(s => s.id === ev.subjectId)) {
                conflicts.push({ type: 'DATA_CONFLICT', event: ev, message: `Le subjectId ${ev.subjectId} est introuvable` });
            }
            if (ev.assessmentId && !assessments.find(a => a.id === ev.assessmentId)) {
                conflicts.push({ type: 'DATA_CONFLICT', event: ev, message: `L'assessmentId ${ev.assessmentId} est introuvable` });
            }

            // DATA_CONFLICT (Project)
            if (ev.taskId && !ev.projectId) {
                conflicts.push({ type: 'DATA_CONFLICT', event: ev, message: `taskId présent mais projectId manquant` });
            }
            if (ev.projectId) {
                const project = projects.find(p => p.id === ev.projectId);
                if (!project) {
                    conflicts.push({ type: 'DATA_CONFLICT', event: ev, message: `Le projectId ${ev.projectId} est introuvable` });
                } else if (ev.taskId) {
                    const task = (project.tasks || []).find(t => t.id === ev.taskId);
                    if (!task) {
                        conflicts.push({ type: 'DATA_CONFLICT', event: ev, message: `Le taskId ${ev.taskId} est introuvable dans le projet` });
                    }
                }
            }
        }

        // 2. Chevauchements (WARNING_CONFLICT & CRITICAL_CONFLICT)
        for (let i = 0; i < events.length; i++) {
            for (let j = i + 1; j < events.length; j++) {
                const ev1 = events[i];
                const ev2 = events[j];
                
                if (!ev1.startTime || !ev1.endTime || !ev2.startTime || !ev2.endTime) continue;

                if (this._doTimesOverlap(ev1.startTime, ev1.endTime, ev2.startTime, ev2.endTime)) {
                    if (ev1.lockStatus === 'locked' && ev2.lockStatus === 'locked') {
                        conflicts.push({ type: 'CRITICAL_CONFLICT', events: [ev1, ev2], message: `Superposition de deux événements verrouillés` });
                    } else if (ev1.lockStatus === 'flexible' && ev2.lockStatus === 'flexible') {
                        conflicts.push({ type: 'WARNING_CONFLICT', events: [ev1, ev2], message: `Superposition de deux événements flexibles` });
                    } else {
                        conflicts.push({ type: 'WARNING_CONFLICT', events: [ev1, ev2], message: `Un événement flexible empiète sur un événement verrouillé` });
                    }
                }
            }
        }

        return conflicts;
    }

    // --- Disponibilités ---
    
    _minutesToTime(minutes) {
        const h = Math.floor(minutes / 60);
        const m = minutes % 60;
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
    }

    async getAvailableSlots(date) {
        const allWindows = (await this.getAvailabilityWindows()).filter(w => w.date === date);
        const events = await this.getEventsForDate(date);
        
        // On ne soustrait QUE les events locked
        const lockedEvents = events.filter(e => e.lockStatus === 'locked' && e.startTime && e.endTime);
        
        // Convert to minutes for easier math
        const freeIntervals = [];

        // 1. Initialiser avec toutes les fenêtres de disponibilité
        for (const w of allWindows) {
            freeIntervals.push({
                start: this._timeToMinutes(w.startTime),
                end: this._timeToMinutes(w.endTime)
            });
        }

        // 2. Soustraire chaque locked event
        for (const le of lockedEvents) {
            const blockStart = this._timeToMinutes(le.startTime);
            const blockEnd = this._timeToMinutes(le.endTime);

            // On boucle à l'envers car on modifie le tableau en place
            for (let i = freeIntervals.length - 1; i >= 0; i--) {
                const interval = freeIntervals[i];

                // Si le block est complètement en dehors de l'intervalle, on ignore
                if (blockEnd <= interval.start || blockStart >= interval.end) continue;

                // Si le block englobe complètement l'intervalle, on le supprime
                if (blockStart <= interval.start && blockEnd >= interval.end) {
                    freeIntervals.splice(i, 1);
                } 
                // Si le block coupe l'intervalle en deux
                else if (blockStart > interval.start && blockEnd < interval.end) {
                    const originalEnd = interval.end;
                    interval.end = blockStart;
                    freeIntervals.splice(i + 1, 0, { start: blockEnd, end: originalEnd });
                }
                // Si le block ampute la fin de l'intervalle
                else if (blockStart > interval.start && blockStart < interval.end) {
                    interval.end = blockStart;
                }
                // Si le block ampute le début de l'intervalle
                else if (blockEnd > interval.start && blockEnd < interval.end) {
                    interval.start = blockEnd;
                }
            }
        }

        // 3. Reconvertir en string HH:MM et filtrer les intervalles vides (durée 0)
        const finalSlots = [];
        for (const interval of freeIntervals) {
            if (interval.end > interval.start) {
                finalSlots.push({
                    startTime: this._minutesToTime(interval.start),
                    endTime: this._minutesToTime(interval.end),
                    durationMinutes: interval.end - interval.start
                });
            }
        }

        // On trie chronologiquement
        finalSlots.sort((a, b) => this._timeToMinutes(a.startTime) - this._timeToMinutes(b.startTime));

        return finalSlots;
    }
}
