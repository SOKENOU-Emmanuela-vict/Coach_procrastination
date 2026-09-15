export class DailyCheckIn {
    constructor(config) {
        if (!config.date || !config.date.match(/^\d{4}-\d{2}-\d{2}$/) || isNaN(new Date(config.date).getTime())) {
            throw new Error("Date invalide pour le Daily Check-in.");
        }
        if (config.sleep && (typeof config.sleep.durationMinutes !== 'number' || config.sleep.durationMinutes < 0)) {
            throw new Error("La durée du sommeil ne peut pas être négative.");
        }
        if (config.energy && !['low', 'medium', 'high'].includes(config.energy)) {
            throw new Error("Niveau d'énergie invalide.");
        }

        this.id = config.id || `chk_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        this.date = config.date; 
        
        this.energy = config.energy || 'medium'; 
        this.sleep = config.sleep || { durationMinutes: 0, quality: 'fair' };
        
        this.blockers = Array.isArray(config.blockers) ? config.blockers : [];
        this.notes = config.notes || '';
        
        this.dayAssessment = config.dayAssessment || 'completed';
        
        this.needsFollowUp = Array.isArray(config.needsFollowUp) ? config.needsFollowUp : [];
        
        this.createdAt = config.createdAt || new Date().toISOString();
        this.updatedAt = new Date().toISOString();
    }
}
