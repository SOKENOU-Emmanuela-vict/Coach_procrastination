import { DailyCheckIn } from '../models/DailyCheckIn.js';

export class CheckInEngine {
    constructor(storageProvider, planningEngine, schedulerEngine, studyRecordEngine) {
        this.storage = storageProvider;
        this.planningEngine = planningEngine;
        this.schedulerEngine = schedulerEngine;
        this.studyRecordEngine = studyRecordEngine;
    }

    async saveCheckIn(checkInData) {
        const checkIn = new DailyCheckIn(checkInData);
        
        // Validation: reference checking for needsFollowUp
        if (checkIn.needsFollowUp && checkIn.needsFollowUp.length > 0) {
            const evs = await this.storage.loadData('events') || [];
            const history = await this.storage.loadData('study_history') || [];
            for (const ref of checkIn.needsFollowUp) {
                const found = evs.find(e => e.id === ref) || history.find(r => r.sessionId === ref);
                if (!found) {
                    throw new Error(`Reference inexistante : ${ref}`);
                }
            }
        }

        let checkins = await this.storage.loadData('daily_checkins') || {};
        checkins[checkIn.date] = checkIn;
        await this.storage.saveData('daily_checkins', checkins);
        return checkIn;
    }

    async getCheckIn(dateStr) {
        const checkins = await this.storage.loadData('daily_checkins') || {};
        return checkins[dateStr] ? new DailyCheckIn(checkins[dateStr]) : null;
    }
    
    async getCheckIns(startDate, endDate) {
        const checkins = await this.storage.loadData('daily_checkins') || {};
        return Object.values(checkins)
            .filter(c => c.date >= startDate && c.date <= endDate)
            .map(c => new DailyCheckIn(c));
    }

    async buildDailySummary(dateStr) {
        // 1. Fetch Planned
        const events = await this.planningEngine.getEventsForDate(dateStr) || [];
        let dailyPlan = { sessions: [] };
        if (this.schedulerEngine && typeof this.schedulerEngine.generateDailyPlan === 'function') {
             dailyPlan = await this.schedulerEngine.generateDailyPlan(dateStr);
        }
        const bootcampSessions = dailyPlan.sessions || [];

        // Deduplication rule: IDs are strictly distinct. A Set ensures no duplicate references.
        const plannedMap = new Map();
        
        events.forEach(e => {
            if (!plannedMap.has(e.id)) {
                plannedMap.set(e.id, {
                    id: e.id,
                    title: e.title,
                    type: e.type || 'event',
                    plannedDuration: e.duration || e.targetDuration || 0,
                    source: 'event',
                    subjectId: e.subjectId,
                    projectId: e.projectId,
                    taskId: e.taskId
                });
            }
        });

        bootcampSessions.forEach(s => {
            if (!plannedMap.has(s.id)) {
                plannedMap.set(s.id, {
                    id: s.id,
                    title: s.title,
                    type: 'session',
                    plannedDuration: s.expectedDuration || 0,
                    source: 'bootcamp',
                    skillId: s.skillId
                });
            }
        });

        const plannedItems = Array.from(plannedMap.values());

        // 2. Fetch Actual Execution (StudyRecords)
        const history = await this.studyRecordEngine.getFullHistory() || [];
        const dailyRecords = history.filter(r => r.date === dateStr);

        let completed = 0;
        let partial = 0;
        let missed = 0;
        let cancelled = 0;
        let completedMinutes = 0;
        let plannedMinutes = 0;

        const actualItems = [];

        for (const item of plannedItems) {
            plannedMinutes += item.plannedDuration;
            
            // Find execution record
            const record = dailyRecords.find(r => r.sessionId === item.id);
            if (record) {
                item.status = record.status; // 'completed', 'partial', 'skipped', 'cancelled'
                item.actualDuration = record.actualDuration || 0;
                item.proof = record.proof || null;
                
                completedMinutes += item.actualDuration;

                if (record.status === 'completed') completed++;
                else if (record.status === 'partial') partial++;
                else if (record.status === 'cancelled') cancelled++;
                else missed++; // skipped is missed

                actualItems.push(item);
            } else {
                item.status = 'missed'; // no record = missed
                item.actualDuration = 0;
                item.proof = null;
                missed++;
                actualItems.push(item);
            }
        }

        // Add ad-hoc executions (sessions done that weren't planned initially)
        for (const record of dailyRecords) {
            if (!plannedMap.has(record.sessionId)) {
                const adhocItem = {
                    id: record.sessionId,
                    title: 'Ad-hoc Session', 
                    type: 'adhoc',
                    plannedDuration: record.plannedDuration || 0,
                    actualDuration: record.actualDuration || 0,
                    status: record.status,
                    source: 'adhoc',
                    proof: record.proof || null
                };
                
                completedMinutes += adhocItem.actualDuration;
                if (record.status === 'completed') completed++;
                else if (record.status === 'partial') partial++;
                else if (record.status === 'cancelled') cancelled++;
                
                actualItems.push(adhocItem);
            }
        }

        // Taux d'execution
        const totalValidPlanned = plannedItems.length - cancelled; 
        let completionRate = 0;
        if (totalValidPlanned > 0) {
            // Un partial = 0.5 completion ? Non, restons rigoureux : completionRate = completed / validPlanned
            // Ou on peut faire (completed + 0.5 * partial) / validPlanned.
            // On reste simple comme demandé
            completionRate = Math.round(((completed + (partial * 0.5)) / totalValidPlanned) * 100);
        } else if (completed > 0 || partial > 0) {
            completionRate = 100; // ad-hoc uniquement
        }

        // 3. Fetch Declarative CheckIn
        const checkIn = await this.getCheckIn(dateStr);

        return {
            date: dateStr,
            planned: {
                totalSessions: plannedItems.length,
                minutes: plannedMinutes,
                items: plannedItems
            },
            actual: {
                totalSessions: actualItems.length,
                minutes: completedMinutes,
                items: actualItems
            },
            execution: {
                completed,
                partial,
                missed,
                cancelled,
                completionRate
            },
            declarative: checkIn || null
        };
    }
}
