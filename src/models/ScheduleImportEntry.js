export class ScheduleImportEntry {
    constructor(config) {
        this.id = config.id || `sch_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        this.dayOfWeek = config.dayOfWeek; // 'monday', 'tuesday', etc.
        this.startTime = config.startTime; // HH:MM
        this.endTime = config.endTime; // HH:MM
        this.title = config.title;
        this.type = config.type || 'class';
        this.subjectId = config.subjectId || null;
        this.source = config.source || 'school_schedule';
        this.lockStatus = config.lockStatus || 'locked';
        this.status = config.status || 'proposed'; // 'proposed', 'applied', 'invalid', 'ambiguous'
        this.originalText = config.originalText || null;
    }

    getIdentityKey() {
        return `${this.dayOfWeek}_${this.subjectId || this.title.toLowerCase().trim()}`;
    }
}
