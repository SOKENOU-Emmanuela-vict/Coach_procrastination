import { AppLogger } from '../utils/AppLogger.js';
import { StudyRecord } from '../models/StudyRecord.js';
import { parseLocalDate } from '../utils/dateUtils.js';

export class StudyRecordEngine {
    constructor(storageProvider) {
        this.storage = storageProvider;
    }
    
    async completeSession(session, metrics = {}, planDate = null) {
        AppLogger.info(`StudyRecordEngine: Enregistrement complet de la session ${session.title}`);
        
        // On part du profil existant (nom, semestre, préférences…) : seuls streak/lastActive sont mis à jour.
        const existingProfile = await this.storage.loadData('user_profile') || {};
        let user = { ...existingProfile };
        if (typeof user.streak !== 'number') user.streak = 0;
        if (user.lastActive === undefined) user.lastActive = null;
        
        const d = new Date();
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
        
        let delayMinutes = 0;
        if (session.startTime) {
            const actualStart = new Date(record.startTime);
            const actualMinutes = actualStart.getHours() * 60 + actualStart.getMinutes();
            const [planH, planM] = session.startTime.split(':').map(Number);
            const planMinutes = planH * 60 + planM;
            if (actualMinutes > planMinutes + 10) { // 10 min grace period
                delayMinutes = actualMinutes - planMinutes;
            }
        }
        metrics.delayMinutes = delayMinutes;
        
        record.finish(new Date().toISOString(), metrics.actualDuration || session.expectedDuration, metrics.status || 'completed', 1.0, metrics);
        
        if (metrics.proof && metrics.proof.type) {
            record.proof = {
                id: `prf_${Date.now()}`,
                type: metrics.proof.type,
                title: metrics.proof.title || `Preuve pour ${session.title}`,
                description: metrics.proof.description || '',
                url: metrics.proof.url || '',
                image: metrics.proof.image || null,
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

    async updateRecord(recordId, updates = {}) {
        let history = await this.storage.loadData('study_history') || [];
        const idx = history.findIndex(r => r.id === recordId);
        if (idx === -1) return null;

        const record = history[idx];
        if (updates.quality !== undefined) {
            record.quality = updates.quality;
            if (record.metrics) record.metrics.quality = updates.quality;
        }
        if (updates.actualDifficulty !== undefined) {
            record.actualDifficulty = updates.actualDifficulty;
            if (record.metrics) record.metrics.difficulty = updates.actualDifficulty;
        }
        if (updates.difficulty !== undefined) {
            record.actualDifficulty = updates.difficulty;
            if (record.metrics) record.metrics.difficulty = updates.difficulty;
        }
        if (updates.reflection !== undefined) {
            record.reflection = updates.reflection;
            if (record.metrics) record.metrics.reflection = updates.reflection;
        }
        if (updates.notes !== undefined) {
            record.notes = updates.notes;
        }
        if (updates.status !== undefined) {
            record.status = updates.status;
            if (record.metrics) record.metrics.status = updates.status;
        }

        history[idx] = record;
        await this.storage.saveData('study_history', history);
        AppLogger.info(`StudyRecordEngine: Enregistrement mis à jour (${recordId}).`);
        return record;
    }

    async deleteRecord(recordId) {
        let history = await this.storage.loadData('study_history') || [];
        const initialLen = history.length;
        history = history.filter(r => r.id !== recordId);
        if (history.length !== initialLen) {
            await this.storage.saveData('study_history', history);
            AppLogger.info(`StudyRecordEngine: Enregistrement supprimé (${recordId}).`);
            return true;
        }
        return false;
    }

    async deleteProof(recordId) {
        let history = await this.storage.loadData('study_history') || [];
        const idx = history.findIndex(r => r.id === recordId);
        if (idx === -1) return false;

        history[idx].proof = null;
        if (history[idx].metrics) {
            history[idx].metrics.proof = null;
        }
        await this.storage.saveData('study_history', history);
        AppLogger.info(`StudyRecordEngine: Preuve supprimée pour ${recordId}.`);
        return true;
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
            const rDate = parseLocalDate(r.date);
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
