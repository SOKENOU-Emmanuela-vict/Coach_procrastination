export class PersonalTask {
    constructor(config = {}) {
        this.id = config.id || `ptask_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        this.title = config.title || '';
        this.domain = config.domain || 'perso'; // ecole, langue, fitness, lecture, projet, perso
        this.category = config.category || 'admin'; // admin, household, errands, other
        this.status = config.status || 'à faire'; // à faire, planifiée, faite, reportée
        if (this.status === 'todo' || this.status === 'pending') this.status = 'à faire';
        if (this.status === 'done' || this.status === 'completed') this.status = 'faite';

        this.priority = config.priority || 'medium'; // high, medium, low
        this.dueDate = config.dueDate || null;
        this.estimatedMinutes = config.estimatedMinutes || 30;
        this.reportsCount = config.reportsCount || 0;
    }
}
