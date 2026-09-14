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
     * @returns {Promise<Object>} { candidates: Array, reason: string }
     */
    async findCandidateSlots({ date, duration }) {
        if (!duration || typeof duration !== 'number' || duration <= 0) {
            return {
                candidates: [],
                reason: "INVALID_DURATION"
            };
        }

        const availableSlots = await this.planningEngine.getAvailableSlots(date);
        
        if (!availableSlots || availableSlots.length === 0) {
            return {
                candidates: [],
                reason: "NO_AVAILABLE_SLOT"
            };
        }

        const candidates = [];

        for (const slot of availableSlots) {
            const slotStartMin = this._timeToMinutes(slot.startTime);
            const slotEndMin = this._timeToMinutes(slot.endTime);
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
}
