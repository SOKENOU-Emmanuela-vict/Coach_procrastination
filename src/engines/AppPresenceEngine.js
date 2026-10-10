import { AppLogger } from '../utils/AppLogger.js';
import { parseLocalDate } from '../utils/dateUtils.js';

export class AppPresenceEngine {
    constructor(storageProvider) {
        this.storage = storageProvider;
        this.currentSession = null;
    }

    /**
     * Enregistre l'ouverture d'un écran. Met à jour la durée de l'écran précédent.
     */
    async logScreenView(viewId) {
        let presenceLogs = await this.storage.loadData('app_presence_logs') || [];
        const now = Date.now();
        const dateStr = new Date().toLocaleDateString('fr-CA');
        
        if (this.currentSession) {
            this.currentSession.duration = Math.floor((now - this.currentSession.timestamp) / 1000);
            const idx = presenceLogs.findIndex(p => p.id === this.currentSession.id);
            if (idx !== -1) {
                presenceLogs[idx] = this.currentSession;
            }
        }

        this.currentSession = {
            id: `pres_${now}_${Math.random().toString(36).substring(2, 6)}`,
            date: dateStr,
            timestamp: now,
            screen: viewId,
            duration: 0
        };
        presenceLogs.push(this.currentSession);
        
        // Nettoyage : garder max 60 jours
        const limitDate = new Date();
        limitDate.setDate(limitDate.getDate() - 60);
        const cutoff = limitDate.getTime();
        presenceLogs = presenceLogs.filter(p => p.timestamp > cutoff);

        await this.storage.saveData('app_presence_logs', presenceLogs);
        AppLogger.info(`AppPresenceEngine: Écran ${viewId} loggé.`);
    }

    /**
     * Termine la session courante proprement (ex: beforeunload).
     */
    async flushCurrentSession() {
        if (!this.currentSession) return;
        const now = Date.now();
        this.currentSession.duration = Math.floor((now - this.currentSession.timestamp) / 1000);
        let presenceLogs = await this.storage.loadData('app_presence_logs') || [];
        const idx = presenceLogs.findIndex(p => p.id === this.currentSession.id);
        if (idx !== -1) {
            presenceLogs[idx] = this.currentSession;
            await this.storage.saveData('app_presence_logs', presenceLogs);
        }
        this.currentSession = null;
    }

    /**
     * Récupère les statistiques de présence sur les N derniers jours.
     * @param {number} days 
     */
    async getPresenceStats(days = 7) {
        const presenceLogs = await this.storage.loadData('app_presence_logs') || [];
        const history = await this.storage.loadData('study_history') || [];
        const checkins = await this.storage.loadData('daily_checkins') || {};

        const limitDate = new Date();
        limitDate.setDate(limitDate.getDate() - days);
        const limitStr = limitDate.toLocaleDateString('fr-CA');

        const recentLogs = presenceLogs.filter(p => p.date >= limitStr);
        
        const daysWithOpening = new Set(recentLogs.map(p => p.date));
        const daysWithoutOpening = days - daysWithOpening.size;

        // Ouverture sans action : jours où l'app a été ouverte, mais aucune session terminée et aucun check-in
        let openingsWithoutAction = 0;
        
        for (const d of daysWithOpening) {
            const hasStudy = history.some(r => r.date === d && r.actualDuration > 0);
            const hasCheckin = !!checkins[d];
            if (!hasStudy && !hasCheckin) {
                openingsWithoutAction++;
            }
        }

        return {
            daysWithoutOpening,
            openingsWithoutAction,
            totalOpenings: daysWithOpening.size,
            logs: recentLogs
        };
    }
}
