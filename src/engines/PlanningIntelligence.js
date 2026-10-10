import { AppLogger } from '../utils/AppLogger.js';

export class PlanningIntelligence {
    constructor(planningEngine) {
        this.planningEngine = planningEngine;
    }

    _timeToMinutes(timeStr) {
        if (!timeStr) return 0;
        const [h, m] = timeStr.split(':').map(Number);
        return h * 60 + m;
    }

    _minutesToTime(minutes) {
        const h = Math.floor(minutes / 60);
        const m = minutes % 60;
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
    }

    /**
     * Recherche de créneaux candidats pour un événement
     * @param {Object} params 
     * @param {string} params.date - Date cible (YYYY-MM-DD)
     * @param {number} params.duration - targetDuration en minutes
     * @param {number} [params.notBefore] - minutes depuis minuit : aucun créneau ne commence avant (ex: heure actuelle)
     * @param {boolean} [params.subtractFlexible] - les événements flexibles occupent aussi le temps
     * @param {Array} [params.reserved] - créneaux déjà attribués [{date,startTime,endTime}] à ne pas réutiliser
     * @returns {Promise<Object>} { candidates: Array, reason: string }
     */
    async findCandidateSlots({ date, duration, notBefore = null, subtractFlexible = false, reserved = [] }) {
        if (!duration || typeof duration !== 'number' || duration <= 0) {
            return {
                candidates: [],
                reason: "INVALID_DURATION"
            };
        }

        const availableSlots = await this.planningEngine.getAvailableSlots(date, { subtractFlexible });
        
        if (!availableSlots || availableSlots.length === 0) {
            return {
                candidates: [],
                reason: "NO_AVAILABLE_SLOT"
            };
        }

        const candidates = [];

        const reservedToday = (reserved || []).filter(r => r.date === date)
            .map(r => ({ start: this._timeToMinutes(r.startTime), end: this._timeToMinutes(r.endTime) }));

        for (const slot of availableSlots) {
            let slotStartMin = this._timeToMinutes(slot.startTime);
            const slotEndMin = this._timeToMinutes(slot.endTime);
            if (notBefore !== null && notBefore !== undefined) slotStartMin = Math.max(slotStartMin, notBefore);
            // Décaler après les créneaux déjà réservés par une recommandation précédente
            let moved = true;
            while (moved) {
                moved = false;
                for (const r of reservedToday) {
                    if (slotStartMin < r.end && slotStartMin + duration > r.start) {
                        slotStartMin = r.end;
                        moved = true;
                    }
                }
            }
            const slotDuration = slotEndMin - slotStartMin;

            if (slotDuration >= duration) {
                const candidateStartMin = slotStartMin;
                const candidateEndMin = slotStartMin + duration;

                candidates.push({
                    date: date,
                    startTime: this._minutesToTime(candidateStartMin),
                    endTime: this._minutesToTime(candidateEndMin),
                    duration: duration,
                    reason: "available"
                });
            }
        }

        if (candidates.length === 0) {
            return {
                candidates: [],
                reason: "NO_SLOT_LONG_ENOUGH"
            };
        }

        return {
            candidates: candidates,
            reason: "SUCCESS"
        };
    }

    /**
     * Repli quand aucun créneau totalement libre n'existe : créneaux qui respectent les événements
     * VERROUILLÉS mais chevauchent un ou plusieurs événements FLEXIBLES. Chaque candidat porte la liste
     * des événements flexibles concernés, pour que le coach demande à l'utilisateur quoi faire.
     * Dans chaque plage libre, on retient la position qui chevauche le moins (puis la plus tôt).
     * @param {Object} params - { date, duration, notBefore, reserved, excludeAssessmentId }
     *   excludeAssessmentId : on ne propose jamais un créneau posé sur une révision de la même évaluation (doublon)
     * @returns {Promise<Object>} { candidates: [{date,startTime,endTime,duration,reason,overlappingFlexible,overlapMinutes}], reason }
     */
    async findSlotsOverlappingFlexible({ date, duration, notBefore = null, reserved = [], excludeAssessmentId = null }) {
        if (!duration || typeof duration !== 'number' || duration <= 0) {
            return { candidates: [], reason: "INVALID_DURATION" };
        }
        const lockedFreeSlots = await this.planningEngine.getAvailableSlots(date, { subtractFlexible: false });
        if (!lockedFreeSlots || lockedFreeSlots.length === 0) {
            return { candidates: [], reason: "NO_AVAILABLE_SLOT" };
        }
        const dayEvents = await this.planningEngine.getEventsForDate(date);
        const flexible = dayEvents.filter(e => e.lockStatus !== 'locked' && e.startTime && e.endTime)
            .map(e => ({ ev: e, start: this._timeToMinutes(e.startTime), end: this._timeToMinutes(e.endTime) }));
        const reservedToday = (reserved || []).filter(r => r.date === date)
            .map(r => ({ start: this._timeToMinutes(r.startTime), end: this._timeToMinutes(r.endTime) }));

        const candidates = [];
        for (const slot of lockedFreeSlots) {
            let slotStart = this._timeToMinutes(slot.startTime);
            const slotEnd = this._timeToMinutes(slot.endTime);
            if (notBefore !== null && notBefore !== undefined) slotStart = Math.max(slotStart, notBefore);
            // Positions candidates : début de plage, fin de chaque événement flexible / créneau réservé
            const starts = new Set([slotStart]);
            flexible.forEach(f => { if (f.end > slotStart && f.end < slotEnd) starts.add(f.end); });
            reservedToday.forEach(r => { if (r.end > slotStart && r.end < slotEnd) starts.add(r.end); });

            let best = null;
            for (const s of [...starts].sort((a, b) => a - b)) {
                const e = s + duration;
                if (e > slotEnd) continue;
                if (reservedToday.some(r => s < r.end && e > r.start)) continue;
                const hits = flexible.filter(f => s < f.end && e > f.start);
                if (excludeAssessmentId && hits.some(h => h.ev.assessmentId === excludeAssessmentId)) continue;
                const overlapMinutes = hits.reduce((acc, h) => acc + (Math.min(e, h.end) - Math.max(s, h.start)), 0);
                if (!best || overlapMinutes < best.overlapMinutes) best = { s, e, hits, overlapMinutes };
            }
            if (best) {
                candidates.push({
                    date: date,
                    startTime: this._minutesToTime(best.s),
                    endTime: this._minutesToTime(best.e),
                    duration: duration,
                    reason: best.hits.length > 0 ? "overlaps_flexible" : "available",
                    overlappingFlexible: best.hits.map(h => ({
                        id: h.ev.id, title: h.ev.title || h.ev.type || h.ev.id, type: h.ev.type || null,
                        date: h.ev.date, startTime: h.ev.startTime, endTime: h.ev.endTime
                    })),
                    overlapMinutes: best.overlapMinutes
                });
            }
        }

        if (candidates.length === 0) return { candidates: [], reason: "NO_SLOT_LONG_ENOUGH" };
        return { candidates, reason: "SUCCESS" };
    }
}
