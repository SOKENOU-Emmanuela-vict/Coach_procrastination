export class PersonalTask {
    constructor(config = {}) {
        this.id = config.id || `ptask_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        this.title = config.title || '';
        this.category = config.category || 'admin'; // admin, household, errands, other
        this.status = config.status || 'todo'; // todo, done
        this.priority = config.priority || 'medium'; // high, medium, low
        this.dueDate = config.dueDate || null;
        this.estimatedMinutes = config.estimatedMinutes || 30;
    }
}
