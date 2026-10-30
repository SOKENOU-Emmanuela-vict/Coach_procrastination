export class Project {
    constructor(idOrConfig, title = null) {
        if (typeof idOrConfig === 'object' && idOrConfig !== null) {
            const config = idOrConfig;
            this.id = config.id;
            this.title = config.title || '';
            this.type = config.type || (config.location ? 'stage' : 'project'); // project | stage
            this.domain = config.domain || 'projet'; // ecole, langue, fitness, lecture, projet, perso
            this.description = config.description || config.notes || '';
            this.notes = config.notes || config.description || '';
            this.status = config.status || 'active'; // active, paused, completed
            this.startDate = config.startDate || null;
            this.endDate = config.endDate || config.targetDate || null;
            this.targetDate = config.targetDate || config.endDate || null;
            this.duration = config.duration || '';
            this.location = config.location || '';
            this.category = config.category || 'skill'; // skill, hobby, wellbeing, life
            this.priority = config.priority || 'medium'; // high, medium, low
            this.tasks = (config.tasks || config.steps || []).map(t => {
                if (typeof t === 'string') return { id: `step_${Date.now()}_${Math.floor(Math.random() * 1000)}`, title: t, status: 'todo' };
                return t;
            });
            this.coachAssessments = config.coachAssessments || [];
            this.determination = config.determination || null;
            this.sessionsPlanned = config.sessionsPlanned ?? null;
            this.sessionsDone = config.sessionsDone ?? null;
            if (config.subjectId !== undefined) {
                this.subjectId = config.subjectId;
            }
        } else {
            // Legacy constructor compat: new Project(id, title)
            this.id = idOrConfig;
            this.title = title || '';
            this.type = 'project';
            this.domain = 'projet';
            this.description = '';
            this.notes = '';
            this.status = 'active'; 
            this.startDate = null;
            this.endDate = null;
            this.targetDate = null;
            this.duration = '';
            this.location = '';
            this.category = 'skill';
            this.priority = 'medium';
            this.tasks = [];
        }
    }

    get steps() {
        return this.tasks;
    }

    set steps(val) {
        this.tasks = val;
    }

    get progress() {
        if (!this.tasks || this.tasks.length === 0) return 0;
        const doneTasks = this.tasks.filter(t => t.status === 'done' || t.completed === true).length;
        return Math.round((doneTasks / this.tasks.length) * 100);
    }

    addTask(task) {
        const item = typeof task === 'string' ? { title: task } : { ...task };
        if (!item.id) item.id = `tsk_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        if (!item.status) item.status = 'todo';
        this.tasks.push(item);
        return item;
    }

    addStep(step) {
        return this.addTask(step);
    }
}
