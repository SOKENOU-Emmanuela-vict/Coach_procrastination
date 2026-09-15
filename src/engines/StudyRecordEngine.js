import { AppLogger } from '../utils/AppLogger.js';
import { StudyRecord } from '../models/StudyRecord.js';

export class StudyRecordEngine {
    constructor(storageProvider, xpEngine) {
        this.storage = storageProvider;
        this.xpEngine = xpEngine;
    }
    
    async completeSession(session, metrics = {}) {
        AppLogger.info(`StudyRecordEngine: Enregistrement complet de la session ${session.title}`);
        
        let user = await this.storage.loadData('user_profile') || { xpTotal: 0, streak: 1, lastActive: null };
        const today = new Date().toLocaleDateString('fr-CA');
        
        const quality = metrics.quality || 3;
        const difficulty = session.priority === 'Haute' ? 1.5 : (session.priority === 'Critique' ? 2.0 : 1.2);
        
        // Use actual XP from session or fallback to duration
        const baseXP = session.xp || session.expectedDuration || 15;
        const xpEarned = this.xpEngine.constructor.calculateXP(baseXP, difficulty, 1.0, quality, user.streak || 1);
        
        const record = new StudyRecord(
            `rec_${Date.now()}`,
            session.id,
            today,
            new Date().toISOString(),
            session.skillIds || session.skillId
        );
        record.finish(new Date().toISOString(), session.expectedDuration, metrics.status || 'completed', 1.0, metrics);
        record.xpEarned = xpEarned;
        
        if (metrics.proof && metrics.proof.type) {
            record.proof = {
                id: `prf_${Date.now()}`,
                type: metrics.proof.type,
                title: metrics.proof.title || `Preuve pour ${session.title}`,
                description: metrics.proof.description || '',
                url: metrics.proof.url || '',
                createdAt: new Date().toISOString(),
                verified: false,
                metadata: metrics.proof.metadata || {}
            };
        } else {
            record.proof = null;
        }
        
        record.actualDifficulty = metrics.difficulty || session.difficulty;
        
        let history = await this.storage.loadData('study_history') || [];
        history.push(record);
        await this.storage.saveData('study_history', history);
        
        user.xpTotal += xpEarned;
        
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toLocaleDateString('fr-CA');
        
        if (user.lastActive !== today) {
            user.streak = (user.lastActive === yesterdayStr) ? user.streak + 1 : 1;
            user.lastActive = today;
        }
        await this.storage.saveData('user_profile', user);
        
        AppLogger.info(`StudyRecordEngine: Session terminée avec métriques. +${xpEarned} XP`);
        return { record, user };
    }
    
    async uncompleteSession(sessionId, dateStr) {
        let history = await this.storage.loadData('study_history') || [];
        const recordIndex = history.findIndex(r => r.sessionId === sessionId && r.date === dateStr);
        
        if (recordIndex !== -1) {
            const record = history[recordIndex];
            history.splice(recordIndex, 1);
            await this.storage.saveData('study_history', history);
            
            let user = await this.storage.loadData('user_profile');
            if (user && record.xpEarned) {
                user.xpTotal = Math.max(0, user.xpTotal - record.xpEarned);
                await this.storage.saveData('user_profile', user);
            }
            AppLogger.info(`StudyRecordEngine: Session annulée (${sessionId}), XP retiré.`);
        }
    }
    
    async getDailyStats(dateStr) {
        const history = await this.storage.loadData('study_history') || [];
        const dailyRecords = history.filter(r => r.date === dateStr);
        const xpTotal = dailyRecords.reduce((sum, r) => sum + (r.xpEarned || 0), 0);
        const focusTime = dailyRecords.reduce((sum, r) => sum + (r.actualDuration || r.plannedDuration || 0), 0);
        return { completedTasksCount: dailyRecords.length, xpTotal, focusTime };
    }

    async getMonthlyStats(year, month) {
        const history = await this.storage.loadData('study_history') || [];
        let totalTimeMinutes = 0;
        let daysActive = new Set();
        let proofsCount = 0;

        history.forEach(r => {
            const rDate = new Date(r.date);
            if (rDate.getFullYear() === year && rDate.getMonth() === month) {
                if (r.status === 'completed' || r.status === 'partial') {
                    totalTimeMinutes += r.actualDuration || 0;
                    daysActive.add(r.date);
                    if (r.proof && r.proof.type) proofsCount++;
                }
            }
        });

        return {
            month: month + 1,
            year: year,
            totalHours: (totalTimeMinutes / 60).toFixed(1),
            daysActive: daysActive.size,
            proofsGenerated: proofsCount,
            summary: `En ${month + 1}/${year}, tu as investi ${(totalTimeMinutes / 60).toFixed(1)} heures réparties sur ${daysActive.size} jours. Tu as généré ${proofsCount} preuves tangibles de tes compétences.`
        };
    }

    async saveDailyJournal(dateStr, journalData) {
        let journals = await this.storage.loadData('daily_journals') || {};
        journals[dateStr] = journalData;
        await this.storage.saveData('daily_journals', journals);
        AppLogger.info(`StudyRecordEngine: Journal sauvegardé pour la date ${dateStr}`);
    }

    async getJournal(dateStr) {
        let journals = await this.storage.loadData('daily_journals') || {};
        return journals[dateStr] || null;
    }
    
    async getFullHistory() {
        return await this.storage.loadData('study_history') || [];
    }
}

function getYesterdayDateString() {
    let date = new Date();
    date.setDate(date.getDate() - 1);
    return date.toLocaleDateString('fr-CA');
}
