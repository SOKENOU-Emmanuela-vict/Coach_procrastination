import { AppLogger } from '../utils/AppLogger.js';
import { parseLocalDate } from '../utils/dateUtils.js';

export class RiskEngine {
    constructor(storageProvider) {
        this.storage = storageProvider;
    }

    /**
     * Analyse l'état de l'utilisateur et calcule un score de risque de procrastination (0 à 100).
     * @param {Object} context - Le contexte actuel (généré par CoachContextBuilder)
     * @returns {Promise<Object>} - L'évaluation du risque
     */
    async evaluateRisk(context) {
        let riskScore = 0;
        let riskFactors = [];
        let protectiveFactors = [];

        const todayStr = context.currentDate || new Date().toLocaleDateString('fr-CA');

        // 1. Analyse des Streaks (Historique)
        const userProfile = context.user || await this.storage.loadData('user_profile') || {};
        const streak = userProfile.streak || 0;
        
        if (streak === 0) {
            riskScore += 25;
            riskFactors.push({ type: 'behavioral', description: 'Streak perdu (0 jour d\'affilée)', weight: 25 });
        } else if (streak < 3) {
            riskScore += 10;
            riskFactors.push({ type: 'behavioral', description: 'Streak faible, routine fragile', weight: 10 });
        } else {
            protectiveFactors.push({ type: 'behavioral', description: `Bonne dynamique d'apprentissage (${streak} jours)`, weight: -15 });
            riskScore -= 15;
        }

        // 2. Analyse des sessions d'hier/aujourd'hui (Régularité)
        const history = await this.storage.loadData('study_history') || [];
        
        // Calcul du taux de complétion récent (sur les 3 derniers jours)
        const threeDaysAgo = parseLocalDate(todayStr);
        threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
        const threeDaysAgoStr = threeDaysAgo.toLocaleDateString('fr-CA');
        
        const recentSessions = history.filter(r => r.date && r.date >= threeDaysAgoStr);
        if (recentSessions.length > 0) {
            const completed = recentSessions.filter(r => r.status === 'completed' || r.actualDuration > 0);
            const completionRate = completed.length / recentSessions.length;
            
            if (completionRate < 0.5) {
                riskScore += 30;
                riskFactors.push({ type: 'execution', description: `Faible taux de réalisation des sessions prévues (${Math.round(completionRate*100)}%)`, weight: 30 });
            } else if (completionRate >= 0.8) {
                protectiveFactors.push({ type: 'execution', description: 'Excellent taux de réalisation récent', weight: -20 });
                riskScore -= 20;
            }
        } else if (streak > 0) {
            // Pas de sessions trackées récemment mais streak > 0 ? Incohérence ou jours de repos.
            riskScore += 5;
        }

        // 3. Analyse des deadlines (Académique)
        // Le résumé académique expose upcomingAssessments[].targetDate (ancien format : assessments[].date)
        const academicList = context.academic ? (context.academic.upcomingAssessments || context.academic.assessments || []) : [];
        if (academicList.length > 0) {
            const todayTime = parseLocalDate(todayStr).getTime();
            const upcoming = academicList.filter(a => {
                const target = a.targetDate || a.date;
                if (!target) return false;
                const days = typeof a.daysRemaining === 'number'
                    ? a.daysRemaining
                    : Math.round((parseLocalDate(target).getTime() - todayTime) / (1000 * 60 * 60 * 24));
                return days >= 0 && days <= 7;
            });

            if (upcoming.length > 0) {
                // Y a-t-il des révisions prévues pour ces évaluations / matières ?
                const plannedRevisions = (context.planning?.events || []).filter(e => e.type === 'revision' && upcoming.some(a => (e.assessmentId && e.assessmentId === a.id) || (a.subjectId && a.subjectId === e.subjectId)));
                
                if (plannedRevisions.length === 0) {
                    riskScore += 40;
                    riskFactors.push({ type: 'academic', description: `${upcoming.length} évaluation(s) imminente(s) (≤ 7j) sans révision planifiée.`, weight: 40 });
                } else {
                    protectiveFactors.push({ type: 'academic', description: 'Anticipation des évaluations imminentes.', weight: -20 });
                    riskScore -= 20;
                }
            }
        }

        // 4. Analyse des Check-ins (Bien-être / Charge mentale)
        const checkins = await this.storage.loadData('daily_checkins') || {};
        const todayCheckin = checkins[todayStr];
        
        if (todayCheckin) {
            // DailyCheckIn.energy vaut 'low' | 'medium' | 'high' (ancien format numérique 1-5 toléré)
            const energy = todayCheckin.energy;
            if (energy === 'low' || (typeof energy === 'number' && energy < 3)) {
                riskScore += 20;
                riskFactors.push({ type: 'wellness', description: 'Niveau d\'énergie faible déclaré au check-in.', weight: 20 });
            }
            if (todayCheckin.mood === 'low') {
                riskScore += 15;
                riskFactors.push({ type: 'wellness', description: 'Humeur basse déclarée au check-in.', weight: 15 });
            }
            if (todayCheckin.motivation === 'low') {
                riskScore += 15;
                riskFactors.push({ type: 'wellness', description: 'Motivation faible déclarée au check-in.', weight: 15 });
            }
            if (typeof todayCheckin.stress === 'number' && todayCheckin.stress > 3) {
                riskScore += 20;
                riskFactors.push({ type: 'wellness', description: 'Niveau de stress élevé déclaré au check-in.', weight: 20 });
            }
            const blockers = Array.isArray(todayCheckin.blockers) ? todayCheckin.blockers : (Array.isArray(todayCheckin.obstacles) ? todayCheckin.obstacles : []);
            const procrastination = blockers.some(b => String(b).toLowerCase().includes('procrastin'));
            if (procrastination) {
                riskScore += 25;
                riskFactors.push({ type: 'behavioral', description: 'Lutte active contre la procrastination avouée.', weight: 25 });
            } else if (blockers.length > 0) {
                riskScore += 10;
                riskFactors.push({ type: 'wellness', description: `Blocage(s) déclaré(s) au check-in : ${blockers.join(', ')}.`, weight: 10 });
            }
            if (todayCheckin.dayAssessment === 'missed') {
                riskScore += 15;
                riskFactors.push({ type: 'execution', description: 'Journée déclarée comme manquée au check-in.', weight: 15 });
            }
        } else {
            riskScore += 10;
            riskFactors.push({ type: 'engagement', description: 'Check-in quotidien non réalisé.', weight: 10 });
        }

        // 5. Analyse de la Présence (Engagement dans l'app)
        if (context.analytics && context.analytics.presenceStats) {
            const ps = context.analytics.presenceStats;
            if (ps.daysWithoutOpening >= 3) {
                riskScore += 25;
                riskFactors.push({ type: 'engagement', description: `Absence prolongée (${ps.daysWithoutOpening} jours sans ouvrir l'appli sur les 7 derniers).`, weight: 25 });
            } else if (ps.daysWithoutOpening === 0) {
                protectiveFactors.push({ type: 'engagement', description: 'Ouvre l\'application tous les jours.', weight: -10 });
                riskScore -= 10;
            }

            if (ps.openingsWithoutAction >= 3) {
                riskScore += 15;
                riskFactors.push({ type: 'engagement', description: `Ouverture de l'application sans action à ${ps.openingsWithoutAction} reprises (procrastination passive).`, weight: 15 });
            }
        }

        // 5.5 Analyse des tâches personnelles (Reports)
        const pTasks = context.personalTasks || [];
        const reportedTasks = pTasks.filter(t => t.reportsCount > 0 && t.status !== 'faite');
        if (reportedTasks.length > 0) {
            const totalReports = reportedTasks.reduce((sum, t) => sum + (t.reportsCount || 0), 0);
            if (totalReports >= 5) {
                riskScore += 20;
                riskFactors.push({ type: 'execution', description: `Procrastination active : ${totalReports} reports cumulés sur les tâches personnelles.`, weight: 20 });
            } else {
                riskScore += 10;
                riskFactors.push({ type: 'execution', description: `Quelques reports de tâches personnelles (${totalReports}).`, weight: 10 });
            }
        }

        // 5.6 Analyse des tâches personnelles (Échéances imminentes)
        const imminentTasks = pTasks.filter(t => {
            if (t.status === 'faite' || !t.dueDate) return false;
            const days = Math.round((parseLocalDate(t.dueDate).getTime() - parseLocalDate(todayStr).getTime()) / (1000 * 60 * 60 * 24));
            return days >= 0 && days <= 2;
        });

        if (imminentTasks.length > 0) {
            riskScore += 20;
            riskFactors.push({ type: 'execution', description: `${imminentTasks.length} tâche(s) personnelle(s) arrivent à échéance (≤ 2j) et ne sont pas terminées.`, weight: 20 });
        }

        // 6. Normalisation du score
        riskScore = Math.max(0, Math.min(100, riskScore));

        let riskLevel = 'LOW';
        if (riskScore >= 70) riskLevel = 'CRITICAL';
        else if (riskScore >= 40) riskLevel = 'WARNING';

        AppLogger.info(`RiskEngine: Évaluation terminée. Score=${riskScore}, Level=${riskLevel}`);

        return {
            score: riskScore,
            level: riskLevel,
            factors: riskFactors,
            protective: protectiveFactors,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Calcule l'évolution de la procrastination (retards, reports, annulations)
     * sur les 7 derniers jours comparés aux 23 jours précédents (total 30j).
     */
    async getProcrastinationTrends(endDateStr) {
        const allHistory = await this.storage.loadData('study_history') || [];
        
        const end = new Date(endDateStr + 'T12:00:00Z');
        
        const d7 = new Date(end); d7.setDate(d7.getDate() - 7);
        const d30 = new Date(end); d30.setDate(d30.getDate() - 30);
        
        const d7Str = d7.toISOString().split('T')[0];
        const d30Str = d30.toISOString().split('T')[0];
        
        let last7 = { delayMinutes: 0, postponed: 0, missed: 0, count: 0 };
        let prev23 = { delayMinutes: 0, postponed: 0, missed: 0, count: 0 };
        
        for (const r of allHistory) {
            if (r.date > endDateStr || r.date < d30Str) continue;
            
            const isLast7 = r.date > d7Str;
            const target = isLast7 ? last7 : prev23;
            
            target.count++;
            if (r.status === 'missed') target.missed++;
            if (r.delayMinutes) target.delayMinutes += r.delayMinutes;
            if (r.postponedCount) target.postponed += r.postponedCount;
        }

        // Moyennes par session
        const last7Delay = last7.count > 0 ? (last7.delayMinutes / last7.count) : 0;
        const prev23Delay = prev23.count > 0 ? (prev23.delayMinutes / prev23.count) : 0;

        let evolution = 'stable';
        if (last7Delay > prev23Delay * 1.2) evolution = 'worse';
        else if (last7Delay < prev23Delay * 0.8) evolution = 'better';

        return {
            last7Days: last7,
            previous23Days: prev23,
            evolutionDelay: evolution
        };
    }
}
