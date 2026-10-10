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

        // Emploi du temps hebdomadaire (import PDF/photo) : séance datée + avancement du cours.
        // Champs facultatifs, absents des imports texte historiques.
        if (config.date !== undefined) this.date = config.date || null; // YYYY-MM-DD
        if (config.group !== undefined) this.group = config.group || null; // 'Groupe 2'
        if (config.hoursDone !== undefined) this.hoursDone = Number.isFinite(config.hoursDone) ? config.hoursDone : null; // heures faites APRÈS la séance
        if (config.hoursTotal !== undefined) this.hoursTotal = Number.isFinite(config.hoursTotal) ? config.hoursTotal : null; // volume total prévu
        if (config.teacher !== undefined) this.teacher = config.teacher || null;
        if (config.room !== undefined) this.room = config.room || null;
        if (config.componentCode !== undefined) this.componentCode = config.componentCode || null; // ECUE (ex. 1INF1322)
        if (config.matchConfidence !== undefined) this.matchConfidence = config.matchConfidence;
        if (config.flags !== undefined) this.flags = Array.isArray(config.flags) ? config.flags : [];
    }

    getIdentityKey() {
        return `${this.dayOfWeek}_${this.subjectId || this.title.toLowerCase().trim()}`;
    }
}
