export class WeeklyReview {
    constructor(config) {
        this.weekStart = config.weekStart; // YYYY-MM-DD
        this.weekEnd = config.weekEnd; // YYYY-MM-DD
        
        this.execution = config.execution || {
            planned: 0,
            completed: 0,
            partial: 0,
            missed: 0,
            cancelled: 0,
            completionRate: 0,
            plannedMinutes: 0,
            actualMinutes: 0
        };

        this.subjectBreakdown = config.subjectBreakdown || {}; // { [subjectId/title]: { planned, completed, partial, missed, cancelled } }
        this.adHocSessions = config.adHocSessions || [];
        this.followUps = config.followUps || []; // [ { id, title, sourceDate } ]
        this.dailySummaries = config.dailySummaries || []; // array of 7 items
        this.trends = config.trends || {};
    }
}
