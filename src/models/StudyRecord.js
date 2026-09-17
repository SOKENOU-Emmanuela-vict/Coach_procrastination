export class StudyRecord {
    constructor(id, sessionId, date, startTime, skillIds = []) {
        this.id = id;
        this.sessionId = sessionId;
        this.skillIds = Array.isArray(skillIds) ? skillIds : [skillIds];
        this.date = date; // ISO string (YYYY-MM-DD)
        
        // Time & Duration
        this.startTime = startTime;
        this.endTime = null;
        this.plannedDuration = 0;
        this.actualDuration = 0;
        
        // Status
        this.status = 'pending'; // 'completed', 'partial', 'skipped', 'cancelled'
        this.completionRate = 0; // 0.0 to 1.0
        
        // Qualitative
        this.difficulty = 3; // 1 to 5
        this.energy = 3;
        this.concentration = 3;
        this.mood = 3;
        this.quality = 3; // 1 to 5
        this.notes = "";
        this.reflection = "";
        
        // Context
        this.source = "";
        this.device = "Desktop";
        this.githubLink = "";
        this.revisionPlanned = false;
        this.proof = null; // { type, url, date, description, source }
    }
    
    finish(endTime, actualDuration, status, completionRate, metrics) {
        this.endTime = endTime;
        this.actualDuration = actualDuration;
        this.status = status;
        this.completionRate = completionRate;
        
        if (metrics) {
            this.energy = metrics.energy || 3;
            this.concentration = metrics.concentration || 3;
            this.mood = metrics.mood || 3;
            this.quality = metrics.quality || 3;
            this.difficulty = metrics.difficulty || 3;
            this.notes = metrics.notes || "";
            this.reflection = metrics.reflection || "";
            this.source = metrics.source || "";
            this.device = metrics.device || "Desktop";
            this.proof = metrics.proof || null;
        }
    }
}
