import { AppLogger } from '../utils/AppLogger.js';

export class ReflectionEngine {
    constructor(storageProvider) {
        this.storage = storageProvider;
    }
    
    async analyzeCheckInTrends() {
        const checkins = await this.storage.loadData('daily_checkins') || {};
        
        let tiredCount = 0;
        let blockCount = 0;
        const keywordsTired = ["fatigué", "fatigue", "sommeil", "dors", "épuisé"];
        const keywordsHard = ["difficile", "bloqué", "dur", "comprends pas"];
        
        Object.values(checkins).forEach(j => {
            const text = ((j.notes || "") + " " + (j.blockers || "") + " " + (j.improve || "")).toLowerCase();
            
            if (keywordsTired.some(kw => text.includes(kw)) || j.energy <= 2) tiredCount++;
            if (keywordsHard.some(kw => text.includes(kw))) blockCount++;
        });
        
        let reflections = [];
        
        if (tiredCount >= 2) {
            reflections.push("Depuis quelques jours tu mentionnes souvent la fatigue. Pense à alléger ton programme.");
        }
        if (blockCount >= 2) {
            reflections.push("Tu sembles rencontrer des difficultés techniques. Prends le temps de revoir les bases de tes projets bloquants.");
        }
        
        AppLogger.info("ReflectionEngine: Analyse sémantique terminée.");
        return reflections;
    }
}
