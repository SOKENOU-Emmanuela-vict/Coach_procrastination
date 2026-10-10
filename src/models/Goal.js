export class Goal {
    constructor(config = {}) {
        this.id = config.id || `goal_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        this.title = config.title || '';
        this.domain = config.domain || 'perso'; 
        this.deadline = config.deadline || null;
        this.progress = config.progress || 0; // 0 to 100
        this.milestones = Array.isArray(config.milestones) ? config.milestones : [];
        // { type: 'pages', target: 200 } ou { type: 'streak', target: 30 }
        this.autoMetric = config.autoMetric || null; 
    }
}
