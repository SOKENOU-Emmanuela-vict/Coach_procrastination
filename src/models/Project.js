export class Project {
    constructor(idOrConfig, title = null) {
        if (typeof idOrConfig === 'object' && idOrConfig !== null) {
            const config = idOrConfig;
            this.id = config.id;
            this.title = config.title || '';
            this.description = config.description || '';
            this.status = config.status || 'active'; // active, paused, completed
            this.targetDate = config.targetDate || null;
            this.goalId = config.goalId || null;
            this.priority = config.priority || 'medium'; // high, medium, low
            this.tasks = config.tasks || [];
        } else {
            // Legacy constructor compat: new Project(id, title)
            this.id = idOrConfig;
            this.title = title || '';
            this.description = '';
            this.status = 'active'; 
            this.targetDate = null;
            this.goalId = null;
            this.priority = 'medium';
            this.tasks = [];
        }
    }

    get progress() {
        if (!this.tasks || this.tasks.length === 0) return 0;
        const doneTasks = this.tasks.filter(t => t.status === 'done').length;
        return Math.round((doneTasks / this.tasks.length) * 100);
    }
}
