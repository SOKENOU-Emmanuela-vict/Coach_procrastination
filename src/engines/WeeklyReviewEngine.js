import { WeeklyReview } from '../models/WeeklyReview.js';

export class WeeklyReviewEngine {
    constructor(storageProvider, planningEngine, schedulerEngine, studyRecordEngine, checkInEngine) {
        this.storage = storageProvider;
        this.planningEngine = planningEngine;
        this.schedulerEngine = schedulerEngine;
        this.studyRecordEngine = studyRecordEngine;
        this.checkInEngine = checkInEngine;
    }

    async buildWeeklySummary(startDateStr, endDateStr) {
        // 1. Data Batching (I/O optimization)
        const allEvents = await this.planningEngine.getEvents() || [];
        const preloadedEvents = allEvents.filter(e => e.date >= startDateStr && e.date <= endDateStr);

        const allHistory = await this.studyRecordEngine.getFullHistory() || [];
        const preloadedHistory = allHistory.filter(r => r.date >= startDateStr && r.date <= endDateStr);

        const preloadedCheckIns = await this.checkInEngine.getCheckIns(startDateStr, endDateStr);

        const preloadedPlans = {};
        
        let currentDate = new Date(startDateStr + 'T12:00:00Z');
        const end = new Date(endDateStr + 'T12:00:00Z');
        const dates = [];

        while (currentDate <= end) {
            const dStr = currentDate.toISOString().split('T')[0];
            dates.push(dStr);
            if (this.schedulerEngine && typeof this.schedulerEngine.generateDailyPlan === 'function') {
                preloadedPlans[dStr] = await this.schedulerEngine.generateDailyPlan(dStr);
            }
            currentDate.setDate(currentDate.getDate() + 1);
        }

        const context = {
            preloadedEvents,
            preloadedHistory,
            preloadedCheckIns,
            preloadedPlans
        };

        // 2. Build Daily Summaries
        const dailySummaries = [];
        for (const dStr of dates) {
            const daily = await this.checkInEngine.buildDailySummary(dStr, context);
            dailySummaries.push(daily);
        }

        // 3. Aggregate Week
        const exec = {
            planned: 0,
            completed: 0,
            partial: 0,
            missed: 0,
            cancelled: 0,
            completionRate: 0,
            plannedMinutes: 0,
            actualMinutes: 0
        };

        const subjectBreakdown = {};
        const adHocSessions = [];
        const followUps = [];
        let lowestEnergyDays = 0;
        let totalSleep = 0;
        let daysWithCheckin = 0;

        for (const daily of dailySummaries) {
            // Execution
            exec.planned += daily.planned.totalSessions;
            exec.plannedMinutes += daily.planned.minutes;
            exec.actualMinutes += daily.actual.minutes;

            exec.completed += daily.execution.completed;
            exec.partial += daily.execution.partial;
            exec.missed += daily.execution.missed;
            exec.cancelled += daily.execution.cancelled;

            // Follow-Ups (intention declarative)
            if (daily.declarative && daily.declarative.needsFollowUp && daily.declarative.needsFollowUp.length > 0) {
                for (const ref of daily.declarative.needsFollowUp) {
                    const item = daily.planned.items.find(i => i.id === ref) || daily.actual.items.find(i => i.id === ref);
                    followUps.push({
                        id: ref,
                        sourceDate: daily.date,
                        title: item ? item.title : ref
                    });
                }
            }

            // Subject Breakdown and AdHocs
            for (const item of daily.actual.items) {
                if (item.type === 'adhoc') {
                    adHocSessions.push({ ...item, date: daily.date });
                    continue; 
                }

                const subKey = item.subjectId || item.skillId || 'Autre';
                if (!subjectBreakdown[subKey]) {
                    subjectBreakdown[subKey] = { title: item.title, planned: 0, completed: 0, partial: 0, missed: 0, cancelled: 0 };
                }

                subjectBreakdown[subKey].planned += 1;
                
                if (item.status === 'completed') subjectBreakdown[subKey].completed += 1;
                else if (item.status === 'partial') subjectBreakdown[subKey].partial += 1;
                else if (item.status === 'missed') subjectBreakdown[subKey].missed += 1;
                else if (item.status === 'cancelled') subjectBreakdown[subKey].cancelled += 1;
            }

            // Trends
            if (daily.declarative) {
                daysWithCheckin++;
                if (daily.declarative.energy === 'low') lowestEnergyDays++;
                if (daily.declarative.sleep && daily.declarative.sleep.durationMinutes) {
                    totalSleep += daily.declarative.sleep.durationMinutes;
                }
            }
        }

        // Global Rate
        const totalValid = exec.planned - exec.cancelled;
        if (totalValid > 0) {
            exec.completionRate = Math.round(((exec.completed + (exec.partial * 0.5)) / totalValid) * 100);
        } else if (exec.completed > 0 || exec.partial > 0) {
            exec.completionRate = 100;
        }

        const trends = {
            lowEnergyDays: lowestEnergyDays,
            averageSleep: daysWithCheckin > 0 ? Math.round(totalSleep / daysWithCheckin) : 0
        };

        return new WeeklyReview({
            weekStart: startDateStr,
            weekEnd: endDateStr,
            execution: exec,
            subjectBreakdown,
            adHocSessions,
            followUps,
            dailySummaries,
            trends
        });
    }
}
