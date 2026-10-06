import { AppLogger } from '../utils/AppLogger.js';
import { StudyRecord } from '../models/StudyRecord.js';

export class StudyRecordEngine {
    constructor(storageProvider) {
        this.storage = storageProvider;
    }
    
    async completeSession(session, metrics = {}, planDate = null) {
        AppLogger.info(`StudyRecordEngine: Enregistrement complet de la session ${session.title}`);
        
        let user = await this.storage.loadData('user_profile') || { streak: 1, lastActive: null };
        
        const d = new Date();
        if (d.getHours() < 4) d.setDate(d.getDate() - 1);
        const today = d.toLocaleDateString('fr-CA');
        const sessionDate = planDate || today;
        
        const quality = metrics.quality || 3;
        const difficulty = session.priority === 'Haute' ? 1.5 : (session.priority === 'Critique' ? 2.0 : 1.2);
        
        const recordId = `rec_${session.id}_${sessionDate}`;
        
        const record = new StudyRecord(
            recordId,
            session.id,
            sessionDate,
            new Date().toISOString(),
            session.skillId || session.subjectId || session.projectId || (Array.isArray(session.skillIds) ? session.skillIds[0] : session.skillIds)
        );
        record.finish(new Date().toISOString(), metrics.actualDuration || session.expectedDuration, metrics.status || 'completed', 1.0, metrics);
        
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
        const existingIndex = history.findIndex(r => r.id === recordId);
        if (existingIndex !== -1) {
            history[existingIndex] = record;
            AppLogger.info(`StudyRecordEngine: Mise à jour du StudyRecord existant (upsert)`);
        } else {
            history.push(record);
        }
        await this.storage.saveData('study_history', history);
        
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toLocaleDateString('fr-CA');
        
        if (user.lastActive !== today) {
            user.streak = (user.lastActive === yesterdayStr) ? user.streak + 1 : 1;
            user.lastActive = today;
        }
        await this.storage.saveData('user_profile', user);
        
        AppLogger.info(`StudyRecordEngine: Session terminée avec métriques.`);
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
            AppLogger.info(`StudyRecordEngine: Session annulée (${sessionId}).`);
        }
    }
    
    async getDailyStats(dateStr) {
        const history = await this.storage.loadData('study_history') || [];
        const dailyRecords = history.filter(r => r.date === dateStr);
        const focusTime = dailyRecords.reduce((sum, r) => sum + (r.actualDuration || r.plannedDuration || 0), 0);
        return { completedTasksCount: dailyRecords.length, focusTime };
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


    async getFullHistory() {
        return await this.storage.loadData('study_history') || [];
    }
}

function getYesterdayDateString() {
    let date = new Date();
    date.setDate(date.getDate() - 1);
    return date.toLocaleDateString('fr-CA');
}
