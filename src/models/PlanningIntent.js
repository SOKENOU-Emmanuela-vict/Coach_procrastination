export class PlanningIntent {
    /**
     * @param {Object} params 
     * @param {string} params.action - 'create', 'move', 'update', 'delete'
     * @param {string} params.target - 'event'
     * @param {Object} params.constraints - Contraintes (ex: { date: "YYYY-MM-DD" })
     * @param {Object} params.payload - Les données à appliquer (ex: title, duration, lockStatus)
     */
    constructor({ version = 1, action, target, constraints = {}, payload = {} }) {
        this.version = version;
        this.action = action;
        this.target = target;
        this.constraints = constraints;
        this.payload = payload;
    }

    validateStructure() {
        if (this.version !== 1) {
            return { valid: false, reason: `Unsupported version: ${this.version}` };
        }

        const validActions = ['create', 'move', 'update', 'delete'];
        const validTargets = ['event'];

        if (!validActions.includes(this.action)) {
            return { valid: false, reason: `Invalid action: ${this.action}` };
        }
        if (!validTargets.includes(this.target)) {
            return { valid: false, reason: `Invalid target: ${this.target}` };
        }
        if (typeof this.constraints !== 'object' || this.constraints === null) {
            return { valid: false, reason: 'constraints must be an object' };
        }
        if (typeof this.payload !== 'object' || this.payload === null) {
            return { valid: false, reason: 'payload must be an object' };
        }

        return { valid: true };
    }
}
