import { AppLogger } from '../utils/AppLogger.js';

/**
 * DailySnapshotEngine — Request B
 *
 * Sauvegarde un snapshot quotidien (risk, completion, energy, mood) et
 * fournit une comparaison 7j vs 30j par rapport à une baseline 14j.
 *
 * Structure d'un snapshot (clé storage: 'daily_snapshots'):
 * {
 *   date: 'YYYY-MM-DD',
 *   risk: 0-100,           // issus de RiskEngine
 *   completion: 0-100,     // % tâches + sessions du jour complétées
 *   energy: 'low'|'medium'|'high'|null,
 *   mood: 'bad'|'ok'|'good'|null,
 *   sessionsCompleted: number,
 *   minutesStudied: number
 * }
 */
export class DailySnapshotEngine {
    constructor(storage) {
        this.storage = storage;
    }

    // --- Persistance ---

    async getSnapshots() {
        return await this.storage.loadData('daily_snapshots') || [];
    }

    async saveSnapshot(snapshot) {
        const snapshots = await this.getSnapshots();
        const idx = snapshots.findIndex(s => s.date === snapshot.date);
        if (idx !== -1) snapshots[idx] = snapshot;
        else snapshots.push(snapshot);
        // Garder max 180 jours
        snapshots.sort((a, b) => a.date.localeCompare(b.date));
        if (snapshots.length > 180) snapshots.splice(0, snapshots.length - 180);
        await this.storage.saveData('daily_snapshots', snapshots);
        AppLogger.info(`DailySnapshotEngine: Snapshot ${snapshot.date} sauvegardé.`);
        return snapshot;
    }

    // --- Construction du snapshot ---

    /**
     * Construit et sauvegarde le snapshot du jour depuis les moteurs de l'app.
     * @param {Object} params
     * @param {string} params.date         - YYYY-MM-DD
     * @param {Object} params.riskProfile  - { score } issu de RiskEngine
     * @param {Object} params.checkIn      - DailyCheckIn du jour (énergie, humeur…)
     * @param {Array}  params.history      - study_history du jour
     * @param {Object} params.dailySummary - { planned, actual } du jour
     */
    async buildAndSave({ date, riskProfile = null, checkIn = null, history = [], dailySummary = null }) {
        const sessionsCompleted = (history || []).filter(r => r.date === date && r.status === 'completed').length;
        const minutesStudied = (history || []).filter(r => r.date === date && r.status === 'completed')
            .reduce((s, r) => s + (r.duration || 0), 0);

        // Completion : ratio actual / planned (minutes)
        const planned = dailySummary?.planned?.minutes || 0;
        const actual = dailySummary?.actual?.minutes || 0;
        const completion = planned > 0 ? Math.min(100, Math.round((actual / planned) * 100)) : (sessionsCompleted > 0 ? 100 : 0);

        // Énergie et humeur depuis le check-in
        const energy = checkIn?.energy || null;
        const mood = checkIn?.mood || checkIn?.dayAssessment || null;

        const snapshot = {
            date,
            risk: riskProfile?.score ?? null,
            completion,
            energy,
            mood,
            sessionsCompleted,
            minutesStudied
        };
        return await this.saveSnapshot(snapshot);
    }

    // --- Analyse de tendance ---

    /**
     * Compare la moyenne sur `windowDays` jours avec la baseline de 14 jours précédents.
     * Retourne { window7, window30, baseline14, trends }.
     * 
     * Chaque objet window contient : { avgRisk, avgCompletion, avgMinutes, days }.
     * trends contient : { risk: 'up'|'down'|'stable', completion: idem, minutes: idem }.
     *
     * ⚠️ Si la baseline < 14 jours réels de données, indique insufficientData=true.
     */
    async getTrends(today = new Date().toLocaleDateString('fr-CA')) {
        const snapshots = await this.getSnapshots();

        // Trier par date croissante
        const sorted = snapshots
            .filter(s => s && s.date && (!today || s.date <= today))
            .sort((a, b) => a.date.localeCompare(b.date));

        const avg = (arr, key) => {
            const vals = arr.map(s => s[key]).filter(v => v !== null && v !== undefined);
            return vals.length > 0 ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
        };

        const totalDays = sorted.length;
        const insufficientData = totalDays < 21;

        // La ligne de base = mes 14 PREMIERS jours de snapshots
        const base = sorted.slice(0, Math.min(14, totalDays));

        // Fenêtre 7 jours récents = 7 derniers snapshots enregistrés
        const w7 = sorted.slice(-Math.min(7, totalDays));

        // Fenêtre 30 jours (jusqu'à 30 derniers snapshots)
        const w30 = sorted.slice(-Math.min(30, totalDays));

        const window7 = {
            days: w7.length,
            avgRisk: avg(w7, 'risk'),
            avgCompletion: avg(w7, 'completion'),
            avgMinutes: avg(w7, 'minutesStudied')
        };
        const window30 = {
            days: w30.length,
            avgRisk: avg(w30, 'risk'),
            avgCompletion: avg(w30, 'completion'),
            avgMinutes: avg(w30, 'minutesStudied')
        };
        const baseline14 = {
            days: base.length,
            avgRisk: avg(base, 'risk'),
            avgCompletion: avg(base, 'completion'),
            avgMinutes: avg(base, 'minutesStudied'),
            insufficientData
        };

        const trendDir = (current, ref) => {
            if (current === null || ref === null) return 'unknown';
            const delta = current - ref;
            if (Math.abs(delta) <= 5) return 'stable';
            return delta > 0 ? 'up' : 'down';
        };

        const trends = {
            risk: trendDir(window7.avgRisk, baseline14.avgRisk),
            completion: trendDir(window7.avgCompletion, baseline14.avgCompletion),
            minutes: trendDir(window7.avgMinutes, baseline14.avgMinutes)
        };

        const result = { window7, window30, baseline14, trends, today, insufficientData };
        result.sentence = this.formatTrendSentence(result);
        return result;
    }

    /**
     * Produit une phrase en français, chiffrée et bienveillante résumant la tendance :
     * « tu t'améliores » / « stable » / « tu procrastines plus qu'avant ».
     * Si insufficientData : le dit sans conclure.
     */
    formatTrendSentence(trendsData) {
        if (!trendsData || trendsData.insufficientData) {
            return "Données insuffisantes pour établir une tendance fiable : il faut au moins 21 jours de recul (14 jours de référence et 7 jours récents).";
        }

        const baseRisk = trendsData.baseline14?.avgRisk;
        const currRisk = trendsData.window7?.avgRisk;

        if (baseRisk !== null && baseRisk !== undefined && currRisk !== null && currRisk !== undefined) {
            const delta = currRisk - baseRisk;
            const sign = delta > 0 ? `+${delta}` : `${delta}`;
            if (delta <= -5) {
                return `Tu t'améliores : ton risque moyen est passé de ${baseRisk} à ${currRisk} sur 7 jours (${sign} points).`;
            } else if (delta >= 5) {
                return `Tu procrastines plus qu'avant : ton risque moyen est passé de ${baseRisk} à ${currRisk} sur 7 jours (${sign} points).`;
            } else {
                return `Tendance stable : ton risque moyen est passé de ${baseRisk} à ${currRisk} sur 7 jours (${sign} points).`;
            }
        }

        // Fallback si pas de risque mais completion
        const baseComp = trendsData.baseline14?.avgCompletion;
        const currComp = trendsData.window7?.avgCompletion;
        if (baseComp !== null && baseComp !== undefined && currComp !== null && currComp !== undefined) {
            const delta = currComp - baseComp;
            const sign = delta > 0 ? `+${delta}` : `${delta}`;
            if (delta >= 5) {
                return `Tu t'améliores : ton taux de complétion est passé de ${baseComp}% à ${currComp}% sur 7 jours (${sign} points).`;
            } else if (delta <= -5) {
                return `Tu procrastines plus qu'avant : ton taux de complétion est passé de ${baseComp}% à ${currComp}% sur 7 jours (${sign} points).`;
            } else {
                return `Tendance stable : ton taux de complétion est passé de ${baseComp}% à ${currComp}% sur 7 jours (${sign} points).`;
            }
        }

        return "Tendance stable : aucune variation significative observée sur les 7 derniers jours.";
    }
}
