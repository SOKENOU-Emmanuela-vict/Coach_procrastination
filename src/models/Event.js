export class Event {
    constructor(idOrConfig, type, date, impact = 'bloc', priorityLegacy = 'Haute', mandatory = true) {
        if (typeof idOrConfig === 'object' && idOrConfig !== null) {
            const config = idOrConfig;
            this.id = config.id;
            this.title = config.title || null;
            this.type = config.type; 
            this.date = config.date; // YYYY-MM-DD
            this.startTime = config.startTime || null; // HH:MM
            this.endTime = config.endTime || null; // HH:MM
            this.lockStatus = config.lockStatus || 'flexible'; // 'locked', 'flexible'
            
            if (config.targetDuration !== undefined && config.targetDuration !== null) {
                if (typeof config.targetDuration !== 'number' || isNaN(config.targetDuration) || config.targetDuration <= 0) {
                    throw new Error("Invalid targetDuration: must be a positive number");
                }
                this.targetDuration = config.targetDuration;
            } else {
                this.targetDuration = null;
            }

            this.priority = config.priority || 'medium'; // 'high', 'medium', 'low'
            this.subjectId = config.subjectId || null;
            this.assessmentId = config.assessmentId || null;
            this.semesterId = config.semesterId || null;
            this.academicYearId = config.academicYearId || null;
            this.projectId = config.projectId || null;
            this.taskId = config.taskId || null;
            this.bookId = config.bookId || null;
            this.personalTaskId = config.personalTaskId || null;
            this.source = config.source || 'system';
            this.postponedCount = typeof config.postponedCount === 'number' ? config.postponedCount : 0;
            
            // Cours importé depuis l'emploi du temps : ECUE, enseignant, salle, avancement (XXH/YYH), semaine d'import.
            // Champs ajoutés seulement s'ils sont fournis (les autres événements gardent leur forme).
            if (config.componentCode) this.componentCode = config.componentCode;
            if (config.teacher) this.teacher = config.teacher;
            if (config.room) this.room = config.room;
            if (Number.isFinite(config.hoursDone)) this.hoursDone = config.hoursDone;
            if (Number.isFinite(config.hoursTotal)) this.hoursTotal = config.hoursTotal;
            if (config.importWeek) this.importWeek = config.importWeek;

            // Legacy compat
            this.impact = config.impact || 'bloc';
            this.mandatory = config.mandatory !== undefined ? config.mandatory : true;

            // Durée persistée (un getter serait perdu par structuredClone / JSON en IndexedDB)
            const computed = Event.computeDuration(this);
            this.duration = computed > 0 ? computed : (typeof config.duration === 'number' && config.duration > 0 ? config.duration : 0);
        } else {
            // Constructor Legacy
            this.id = idOrConfig;
            this.title = null;
            this.type = type;
            this.date = date;
            this.impact = impact;
            this.priority = priorityLegacy === 'Haute' ? 'high' : (priorityLegacy === 'Basse' ? 'low' : 'medium');
            this.mandatory = mandatory;
            
            // Nouvelles props par défaut
            this.startTime = null;
            this.endTime = null;
            this.targetDuration = null;
            this.lockStatus = 'flexible';
            this.subjectId = null;
            this.assessmentId = null;
            this.semesterId = null;
            this.academicYearId = null;
            this.projectId = null;
            this.taskId = null;
            this.source = 'system';
            this.postponedCount = 0;
            this.duration = 0;
        }
    }

    /**
     * Durée en minutes calculée à partir de startTime/endTime (fonctionne aussi sur un objet brut relu du stockage).
     */
    static computeDuration(ev) {
        if (!ev || !ev.startTime || !ev.endTime) return 0;
        const [startH, startM] = ev.startTime.split(':').map(Number);
        const [endH, endM] = ev.endTime.split(':').map(Number);
        return (endH * 60 + endM) - (startH * 60 + startM);
    }
}
