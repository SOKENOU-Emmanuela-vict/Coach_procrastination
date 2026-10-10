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

        const daysBefore = (baseDate, n) => {
            const d = new Date(baseDate);
            d.setDate(d.getDate() - n);
            return d.toLocaleDateString('fr-CA');
        };

        const date7Start  = daysBefore(today, 7);
        const date30Start = daysBefore(today, 30);
        const dateBase14Start = daysBefore(today, 44); // baseline = J-44 à J-30
        const dateBase14End   = daysBefore(today, 30);

        const inRange = (snap, start, end) => snap.date >= start && snap.date <= end;

        const w7   = snapshots.filter(s => inRange(s, date7Start, today));
        const w30  = snapshots.filter(s => inRange(s, date30Start, today));
        const base = snapshots.filter(s => inRange(s, dateBase14Start, dateBase14End));

        const avg = (arr, key) => {
            const vals = arr.map(s => s[key]).filter(v => v !== null && v !== undefined);
            return vals.length > 0 ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
        };

        const window7 = { days: w7.length, avgRisk: avg(w7, 'risk'), avgCompletion: avg(w7, 'completion'), avgMinutes: avg(w7, 'minutesStudied') };
        const window30 = { days: w30.length, avgRisk: avg(w30, 'risk'), avgCompletion: avg(w30, 'completion'), avgMinutes: avg(w30, 'minutesStudied') };
        const baseline14 = { days: base.length, avgRisk: avg(base, 'risk'), avgCompletion: avg(base, 'completion'), avgMinutes: avg(base, 'minutesStudied'), insufficientData: base.length < 7 };

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

        return { window7, window30, baseline14, trends, today };
    }
}
