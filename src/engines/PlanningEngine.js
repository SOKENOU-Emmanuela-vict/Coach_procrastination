import { AppLogger } from '../utils/AppLogger.js';
import { Event } from '../models/Event.js';
import { parseLocalDate } from '../utils/dateUtils.js';

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
    /**
     * Exécute un intent de création d'événement.
     * Règle de chevauchement :
     *  - un événement VERROUILLÉ (cours, examen…) bloque toujours ;
     *  - un événement FLEXIBLE (révision, sortie, sport…) n'est jamais écrasé en silence : sans confirmation
     *    explicite, le moteur refuse avec `needsConfirmation: true` et la liste des événements concernés,
     *    pour que le coach demande à l'utilisateur ce qu'il préfère.
     * @param {PlanningIntent} intent
     * @param {Object} [options]
     * @param {boolean} [options.allowFlexibleOverlap] - équivaut à flexibleResolution 'keep'
     * @param {'keep'|'move'|'replace'} [options.flexibleResolution] - décision de l'utilisateur :
     *    garder les deux, déplacer l'événement flexible, ou le supprimer
     * @param {Array<string>} [options.confirmedFlexibleIds] - événements flexibles sur lesquels porte la confirmation
     *    (si un autre événement flexible est apparu entre-temps, il faut redemander). Absent = tous.
     * @param {Date} [options.now] - pour 'move' : le nouvel horaire ne peut pas être dans le passé
     * @param {number} [options.moveSearchDays] - pour 'move' : nombre de jours explorés (défaut 7)
     */
    async executeIntent(intent, options = {}) {
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

        let rawType = (intent.payload.type || '').toLowerCase();
        let canonType = 'personal';
        if (rawType.includes('révision') || rawType.includes('revision')) canonType = 'revision';
        else if (rawType.includes('exam') || rawType.includes('eval') || rawType === 'cc') canonType = 'exam';
        else if (rawType.includes('cours') || rawType.includes('td') || rawType.includes('tp') || rawType.includes('course')) canonType = 'course';
        else if (rawType) canonType = rawType; // fallback if specific type needed

        let eventTitle = intent.payload.title || 'Nouvel événement';
        if (canonType === 'revision' && intent.payload.subjectId) {
            const subject = subjects.find(s => s.id === intent.payload.subjectId);
            if (subject) {
                eventTitle = `Révision — ${subject.name || subject.title || intent.payload.subjectId}`;
            }
        }

        const evConfig = {
            id: `ev_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
            title: eventTitle,
            date: intent.constraints.date,
            startTime: intent.constraints.startTime || null,
            endTime: intent.constraints.endTime || null,
            duration: intent.payload.duration || 0,
            targetDuration: intent.payload.targetDuration || null,
            type: canonType,
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

        // Validation complète via detectConflicts (seuls les conflits impliquant le nouvel événement comptent)
        if (evConfig.date) {
            const conflicts = await this.detectConflicts(evConfig.date, evConfig);
            const blockingConflicts = conflicts
                .filter(c => this._involves(c, evConfig))
                .filter(c => c.type === 'CRITICAL_CONFLICT' || c.type === 'TIME_CONFLICT' || c.type === 'DATA_CONFLICT');
            
            if (blockingConflicts.length > 0) {
                return { success: false, reason: `${blockingConflicts[0].type}: ${blockingConflicts[0].message}` };
            }

            // Chevauchements : un événement verrouillé bloque toujours ; un événement flexible exige
            // une décision explicite de l'utilisateur (garder les deux / déplacer / remplacer).
            if (evConfig.startTime && evConfig.endTime) {
                const { locked, flexible } = await this.findOverlaps(evConfig.date, evConfig.startTime, evConfig.endTime);
                if (locked.length > 0) {
                    const l = locked[0];
                    return { success: false, reason: `CRITICAL_CONFLICT: Le créneau empiète sur l'événement verrouillé '${this._label(l)}' (${l.startTime}-${l.endTime})` };
                }
                if (flexible.length > 0) {
                    // Double acceptation de la même proposition : jamais de doublon, même confirmé
                    const duplicate = flexible.find(e => evConfig.assessmentId && e.assessmentId === evConfig.assessmentId && e.type === evConfig.type);
                    const resolution = options.flexibleResolution || (options.allowFlexibleOverlap ? 'keep' : null);
                    if (duplicate && resolution !== 'replace') {
                        return { success: false, reason: `OVERLAP_CONFLICT: '${this._label(duplicate)}' est déjà planifié sur ce créneau (${duplicate.startTime}-${duplicate.endTime})`, duplicate: true };
                    }
                    const confirmedIds = Array.isArray(options.confirmedFlexibleIds) ? options.confirmedFlexibleIds : null;
                    const unconfirmed = !resolution ? flexible
                        : (confirmedIds ? flexible.filter(e => !confirmedIds.includes(e.id)) : []);
                    if (unconfirmed.length > 0) {
                        const f = unconfirmed[0];
                        return {
                            success: false,
                            reason: `OVERLAP_CONFLICT: Le créneau chevauche l'événement flexible '${this._label(f)}' (${f.startTime}-${f.endTime}) : confirmation requise`,
                            needsConfirmation: true,
                            overlappingFlexible: flexible.map(e => this._summary(e)),
                            unconfirmedFlexible: unconfirmed.map(e => this._summary(e))
                        };
                    }
                    return await this._applyWithFlexibleResolution(evConfig, flexible, resolution, options);
                }
            }
        }

        await this.saveEvent(evConfig);
        return { success: true, eventId: evConfig.id };
    }

    _label(ev) {
        return (ev && (ev.title || ev.type || ev.id)) || '';
    }

    _summary(ev) {
        return { id: ev.id, title: this._label(ev), type: ev.type || null, date: ev.date, startTime: ev.startTime, endTime: ev.endTime, lockStatus: ev.lockStatus || 'flexible' };
    }

    /**
     * Événements qui chevauchent [startTime, endTime] le jour `date`, séparés en verrouillés / flexibles.
     * Tout événement non verrouillé est considéré comme flexible.
     * @param {Object} [opts] - { excludeIds: [], baseEvents: Array }
     */
    async findOverlaps(date, startTime, endTime, opts = {}) {
        const excludeIds = opts.excludeIds || [];
        const dayEvents = opts.baseEvents ? opts.baseEvents.filter(e => e.date === date) : await this.getEventsForDate(date);
        const overlaps = dayEvents.filter(e => !excludeIds.includes(e.id) && e.startTime && e.endTime
            && this._doTimesOverlap(e.startTime, e.endTime, startTime, endTime));
        return {
            locked: overlaps.filter(e => e.lockStatus === 'locked'),
            flexible: overlaps.filter(e => e.lockStatus !== 'locked')
        };
    }

    /**
     * Applique la décision de l'utilisateur sur les événements flexibles chevauchés, puis enregistre
     * le nouvel événement. Écriture unique (tout ou rien).
     */
    async _applyWithFlexibleResolution(evConfig, flexible, resolution, options = {}) {
        let items = await this.getEvents();
        const result = { success: true, eventId: evConfig.id, resolution, moved: [], removed: [], kept: [] };

        if (resolution === 'replace') {
            const ids = flexible.map(e => e.id);
            result.removed = flexible.map(e => this._summary(e));
            items = items.filter(e => !ids.includes(e.id));
        } else if (resolution === 'move') {
            const occupied = [evConfig]; // le nouvel événement + les événements déjà déplacés
            const failed = [];
            const updates = [];
            for (const ev of flexible) {
                const target = await this._findSlotForMove(ev, items, occupied, options);
                if (!target) { failed.push(this._summary(ev)); continue; }
                const movedEv = { ...ev, date: target.date, startTime: target.startTime, endTime: target.endTime, postponedCount: (ev.postponedCount || 0) + 1 };
                occupied.push(movedEv);
                updates.push(movedEv);
                result.moved.push({ ...this._summary(ev), from: { date: ev.date, startTime: ev.startTime, endTime: ev.endTime }, to: target });
            }
            if (failed.length > 0) {
                return {
                    success: false,
                    reason: `MOVE_FAILED: Aucun créneau libre trouvé pour déplacer '${failed.map(f => f.title).join("', '")}'`,
                    needsConfirmation: true,
                    moveFailed: failed,
                    overlappingFlexible: flexible.map(e => this._summary(e))
                };
            }
            for (const u of updates) {
                const idx = items.findIndex(e => e.id === u.id);
                if (idx >= 0) items[idx] = new Event(u);
            }
        } else {
            result.kept = flexible.map(e => this._summary(e));
        }

        items.push(new Event(evConfig));
        await this.storage.saveData('events', items);
        return result;
    }

    /**
     * Cherche un nouvel horaire libre (fenêtres de disponibilité, sans aucun autre événement) pour un
     * événement flexible, à partir de son jour d'origine et sur `moveSearchDays` jours, jamais dans le passé.
     */
    async _findSlotForMove(ev, allEvents, occupied, options = {}) {
        const duration = this._timeToMinutes(ev.endTime) - this._timeToMinutes(ev.startTime);
        if (!(duration > 0)) return null;
        const now = options.now instanceof Date ? options.now : null;
        const todayStr = now ? now.toLocaleDateString('fr-CA') : null;
        const nowMinutes = now ? now.getHours() * 60 + now.getMinutes() : 0;
        const days = options.moveSearchDays || 7;
        const start = parseLocalDate(ev.date);
        for (let i = 0; i < days; i++) {
            const d = new Date(start);
            d.setDate(start.getDate() + i);
            const dateStr = d.toLocaleDateString('fr-CA');
            if (todayStr && dateStr < todayStr) continue;
            const blocks = allEvents.filter(e => e.id !== ev.id && e.date === dateStr)
                .concat(occupied.filter(o => o.date === dateStr))
                .filter(e => e.startTime && e.endTime);
            const free = this._computeFreeSlots(await this._windowsForDate(dateStr), blocks);
            for (const slot of free) {
                let s = this._timeToMinutes(slot.startTime);
                if (todayStr && dateStr === todayStr) s = Math.max(s, Math.ceil(nowMinutes / 15) * 15);
                if (this._timeToMinutes(slot.endTime) - s >= duration) {
                    return { date: dateStr, startTime: this._minutesToTime(s), endTime: this._minutesToTime(s + duration) };
                }
            }
        }
        return null;
    }

    /**
     * Fenêtres de disponibilité d'un jour. Tant que l'étudiante n'a saisi AUCUNE disponibilité, et seulement si
     * `defaultStudyWindow` est réglé (l'App le fait une fois un emploi du temps importé), une fenêtre par défaut
     * est utilisée (ex. 08:00-21:00) : les cours et autres événements en sont ensuite retirés comme d'habitude.
     */
    async _windowsForDate(date) {
        const all = await this.getAvailabilityWindows();
        const own = all.filter(w => w.date === date);
        if (own.length > 0 || all.length > 0 || !this.defaultStudyWindow) return own;
        const w = this.defaultStudyWindow;
        if (!w.startTime || !w.endTime) return own;
        return [{ id: `default_${date}`, date, startTime: w.startTime, endTime: w.endTime, isDefault: true }];
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

    // --- Schedule Ingestion (B.11) ---
    async applyScheduleImport(validEntries, startDateStr) {
        // Validation atomique de tout l'import sur 4 semaines (28 jours)
        const events = await this.getEvents();
        const newEvents = [];
        const start = parseLocalDate(startDateStr);
        const endDate = new Date(start);
        endDate.setDate(start.getDate() + 27);
        const endStr = endDate.toLocaleDateString('fr-CA');

        // Les événements d'un import précédent sur la même période vont être remplacés :
        // ils ne doivent pas entrer en conflit avec le nouvel import (réimport idempotent).
        const isReplaced = (e) => e.source === 'school_schedule' && e.date >= startDateStr && e.date <= endStr;
        const keptEvents = events.filter(e => !isReplaced(e));
        const dayMap = { 'sunday': 0, 'monday': 1, 'tuesday': 2, 'wednesday': 3, 'thursday': 4, 'friday': 5, 'saturday': 6 };

        // Generate events for 28 days
        for (let i = 0; i < 28; i++) {
            const current = new Date(start);
            current.setDate(start.getDate() + i);
            const currentDayNum = current.getDay();
            const dateStr = current.toLocaleDateString('fr-CA');

            for (const entry of validEntries) {
                if (dayMap[entry.dayOfWeek] === currentDayNum) {
                    const evConfig = {
                        id: `ev_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
                        title: entry.title,
                        date: dateStr,
                        startTime: entry.startTime,
                        endTime: entry.endTime,
                        type: entry.type,
                        impact: 'bloc',
                        mandatory: true,
                        lockStatus: entry.lockStatus,
                        priority: 'high',
                        subjectId: entry.subjectId,
                        source: entry.source
                    };
                    
                    // Conflit validation : contre les événements conservés + ceux déjà générés par ce même import
                    const conflicts = await this.detectConflicts(dateStr, evConfig, keptEvents.concat(newEvents));
                    const blocking = conflicts
                        .filter(c => this._involves(c, evConfig))
                        .filter(c => c.type === 'CRITICAL_CONFLICT' || c.type === 'TIME_CONFLICT' || c.type === 'DATA_CONFLICT');
                    if (blocking.length > 0) {
                        return { 
                            success: false, 
                            reason: `Conflit critique détécté pour ${entry.title} le ${dateStr} : ${blocking[0].message}` 
                        };
                    }
                    newEvents.push(evConfig);
                }
            }
        }

        // Si tout est valide, on sauvegarde l'abstrait (référence) et on persiste les concrets.
        await this.storage.saveData('academic_schedule', validEntries);
        
        // Pour éviter de dupliquer à l'infini si on réapplique, on supprime d'abord les événements 
        // school_schedule sur cette période (approche de synchronisation simple).
        const filteredEvents = keptEvents.slice();

        for (const ne of newEvents) {
            filteredEvents.push(new Event(ne));
        }

        await this.storage.saveData('events', filteredEvents);
        return { success: true, count: newEvents.length };
    }

    /**
     * Emploi du temps hebdomadaire importé (PDF/photo validé par l'étudiante) : écriture unique.
     *  - remplace les cours importés (source 'school_schedule') de la semaine [weekStart, weekEnd] : réimport idempotent ;
     *  - refuse tout conflit bloquant (horaire inversé, matière inconnue, deux cours importés qui se chevauchent) ;
     *  - un cours officiel est obligatoire : s'il chevauche un autre événement déjà présent, il est quand même
     *    enregistré et le chevauchement est renvoyé dans `overlaps` (le coach le signale ensuite comme conflit d'agenda).
     * @param {Array} newEvents - événements 'course' verrouillés
     * @param {Object} range - { weekStart, weekEnd } (YYYY-MM-DD)
     * @returns {Promise<Object>} { success, count, replaced, overlaps } ou { success: false, reason }
     */
    async applyWeeklyTimetable(newEvents, { weekStart, weekEnd } = {}) {
        if (!weekStart || !weekEnd || !Array.isArray(newEvents)) return { success: false, reason: 'Semaine ou séances manquantes' };
        const events = await this.getEvents();
        const isReplaced = (e) => e.source === 'school_schedule' && e.date >= weekStart && e.date <= weekEnd;
        const kept = events.filter(e => !isReplaced(e));
        const replaced = events.length - kept.length;
        const accepted = [];
        const overlaps = [];
        for (const raw of newEvents) {
            if (!raw.date || raw.date < weekStart || raw.date > weekEnd) {
                return { success: false, reason: `Séance hors de la semaine importée : ${raw.title} (${raw.date})` };
            }
            const ev = new Event(raw);
            const conflicts = await this.detectConflicts(ev.date, ev, kept.concat(accepted));
            const blocking = conflicts.filter(c => this._involves(c, ev)).filter(c =>
                c.type === 'TIME_CONFLICT' || c.type === 'DATA_CONFLICT'
                || (c.type === 'CRITICAL_CONFLICT' && c.events.some(o => o !== ev && accepted.includes(o))));
            if (blocking.length > 0) {
                return { success: false, reason: `Conflit pour ${ev.title} le ${ev.date} : ${blocking[0].message}` };
            }
            if (ev.startTime && ev.endTime) {
                const { locked, flexible } = await this.findOverlaps(ev.date, ev.startTime, ev.endTime, { baseEvents: kept });
                locked.concat(flexible).forEach(o => overlaps.push({ course: this._summary(ev), other: this._summary(o) }));
            }
            accepted.push(ev);
        }
        await this.storage.saveData('events', kept.concat(accepted));
        return { success: true, count: accepted.length, replaced, overlaps };
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

    _involves(conflict, ev) {
        if (!conflict || !ev) return false;
        if (conflict.event === ev) return true;
        return Array.isArray(conflict.events) && conflict.events.includes(ev);
    }

    async detectConflicts(date, additionalEvent = null, baseEvents = null) {
        const events = baseEvents ? baseEvents.filter(e => e.date === date) : await this.getEventsForDate(date);
        if (additionalEvent) {
            events.push(additionalEvent);
        }
        const subjects = await this.storage.loadData('acad_subjects') || [];
        const assessments = await this.storage.loadData('acad_assessments') || [];
        const projects = await this.storage.loadData('projects') || [];
        const books = await this.storage.loadData('books') || [];
        const personalTasks = await this.storage.loadData('personal_tasks') || [];
        
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

            // DATA_CONFLICT (Books & PersonalTasks)
            if (ev.bookId && !books.find(b => b.id === ev.bookId)) {
                conflicts.push({ type: 'DATA_CONFLICT', event: ev, message: `Le bookId ${ev.bookId} est introuvable` });
            }
            if (ev.personalTaskId && !personalTasks.find(t => t.id === ev.personalTaskId)) {
                conflicts.push({ type: 'DATA_CONFLICT', event: ev, message: `Le personalTaskId ${ev.personalTaskId} est introuvable` });
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

    /**
     * @param {string} date
     * @param {Object} options
     * @param {boolean} options.subtractFlexible - si true, les événements flexibles occupent aussi le créneau
     *   (utilisé par le coach : aucun déplacement automatique n'existe, proposer un créneau occupé créerait un doublon).
     *   Par défaut (false) : seuls les événements verrouillés sont soustraits (règle historique du moteur).
     */
    async getAvailableSlots(date, options = {}) {
        const allWindows = await this._windowsForDate(date);
        const events = await this.getEventsForDate(date);
        
        // Par défaut on ne soustrait QUE les events locked
        const lockedEvents = events.filter(e => (options.subtractFlexible || e.lockStatus === 'locked') && e.startTime && e.endTime);
        return this._computeFreeSlots(allWindows, lockedEvents);
    }

    /**
     * Fenêtres de disponibilité moins les blocs occupés, en créneaux HH:MM triés.
     */
    _computeFreeSlots(allWindows, lockedEvents) {
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

    /**
     * Allège le plan du jour en réduisant ou supprimant des événements flexibles.
     * Respecte les événements verrouillés et les révisions d'évaluations proches (<= 5 jours).
     */
    async lightenDailyPlan(date) {
        const allEvents = await this.getEvents();
        const dayEvents = allEvents.filter(e => e.date === date && e.lockStatus === 'flexible' && e.startTime && e.endTime);
        const assessments = await this.storage.loadData('acad_assessments') || [];
        
        const removedIds = new Set();
        const shortenedEvents = []; 
        
        const todayTime = parseLocalDate(date).getTime();

        for (const ev of dayEvents) {
            let safeToModify = true;
            if (ev.assessmentId) {
                const ass = assessments.find(a => a.id === ev.assessmentId);
                if (ass && ass.targetDate) {
                    const daysRemaining = Math.round((parseLocalDate(ass.targetDate).getTime() - todayTime) / (1000 * 60 * 60 * 24));
                    if (daysRemaining >= 0 && daysRemaining <= 5) {
                        safeToModify = false;
                    }
                }
            }
            if (!safeToModify) continue;

            const startMinutes = this._timeToMinutes(ev.startTime);
            const endMinutes = this._timeToMinutes(ev.endTime);
            const duration = endMinutes - startMinutes;
            
            if (duration <= 45) {
                removedIds.add(ev.id);
            } else {
                const newDuration = Math.max(30, Math.round((duration / 2) / 15) * 15);
                const updatedEv = new Event(ev);
                updatedEv.endTime = this._minutesToTime(startMinutes + newDuration);
                shortenedEvents.push(updatedEv);
            }
        }
        
        let newAllEvents = [];
        for (const e of allEvents) {
            if (removedIds.has(e.id)) continue;
            const shortened = shortenedEvents.find(s => s.id === e.id);
            if (shortened) {
                newAllEvents.push(shortened);
            } else {
                newAllEvents.push(e);
            }
        }
        
        await this.storage.saveData('events', newAllEvents);
        
        return {
            removedCount: removedIds.size,
            shortenedCount: shortenedEvents.length
        };
    }
}
