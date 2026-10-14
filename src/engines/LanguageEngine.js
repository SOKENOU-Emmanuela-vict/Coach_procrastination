import { Event } from '../models/Event.js';

export class LanguageEngine {
    constructor(storageProvider) {
        this.storage = storageProvider;
    }

    async getLanguages() {
        const list = await this.storage.loadData('user_languages');
        return Array.isArray(list) ? list : [];
    }

    async saveLanguage(langData) {
        let languages = await this.getLanguages();
        const id = langData.id || `lang_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        
        // Auto-détection du drapeau
        const flags = {
            'anglais': '🇬🇧', 'english': '🇬🇧',
            'français': '🇫🇷', 'french': '🇫🇷',
            'espagnol': '🇪🇸', 'spanish': '🇪🇸',
            'allemand': '🇩🇪', 'german': '🇩🇪',
            'italien': '🇮🇹', 'italian': '🇮🇹',
            'chinois': '🇨🇳', 'chinese': '🇨🇳',
            'japonais': '🇯🇵', 'japanese': '🇯🇵',
            'arabe': '🇸🇦', 'arabic': '🇸🇦',
            'russe': '🇷🇺', 'russian': '🇷🇺',
            'portugais': '🇵🇹', 'portuguese': '🇵🇹'
        };
        const cleanName = (langData.name || '').trim().toLowerCase();
        const defaultIcon = flags[cleanName] || '🌐';

        const existingIndex = languages.findIndex(l => l.id === id);
        const existing = existingIndex >= 0 ? languages[existingIndex] : null;

        const lang = {
            id,
            name: langData.name || existing?.name || 'Nouvelle Langue',
            icon: langData.icon || existing?.icon || defaultIcon,
            level: langData.level !== undefined ? langData.level : (existing?.level || 'A1'),
            goal: langData.goal !== undefined ? langData.goal : (existing?.goal || ''),
            resources: Array.isArray(langData.resources) ? langData.resources : (existing?.resources || []),
            plan: {
                sessionsPerWeek: langData.plan?.sessionsPerWeek ?? existing?.plan?.sessionsPerWeek ?? 3,
                duration: langData.plan?.duration ?? existing?.plan?.duration ?? 30,
                preferredDays: Array.isArray(langData.plan?.preferredDays) 
                    ? langData.plan.preferredDays 
                    : (existing?.plan?.preferredDays || ['monday', 'wednesday', 'friday'])
            },
            tracking: {
                sessionsCompleted: langData.tracking?.sessionsCompleted ?? existing?.tracking?.sessionsCompleted ?? 0,
                minutesStudied: langData.tracking?.minutesStudied ?? existing?.tracking?.minutesStudied ?? 0,
                vocabularyWords: langData.tracking?.vocabularyWords ?? existing?.tracking?.vocabularyWords ?? 0
            }
        };

        if (existingIndex >= 0) {
            languages[existingIndex] = lang;
        } else {
            languages.push(lang);
        }

        await this.storage.saveData('user_languages', languages);
        return lang;
    }

    async deleteLanguage(id) {
        let languages = await this.getLanguages();
        languages = languages.filter(l => l.id !== id);
        await this.storage.saveData('user_languages', languages);
        return true;
    }

    async getLanguage(id) {
        const languages = await this.getLanguages();
        return languages.find(l => l.id === id) || null;
    }

    async addResource(langId, resource) {
        const lang = await this.getLanguage(langId);
        if (!lang) return null;
        const resId = resource.id || `res_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        const newResource = {
            id: resId,
            title: resource.title || 'Ressource',
            type: resource.type || 'link', // 'link' | 'book' | 'app' | 'video'
            value: resource.value || resource.url || ''
        };
        lang.resources = lang.resources || [];
        lang.resources.push(newResource);
        await this.saveLanguage(lang);
        return newResource;
    }

    async updateResource(langId, resourceId, updated) {
        const lang = await this.getLanguage(langId);
        if (!lang) return null;
        const index = (lang.resources || []).findIndex(r => r.id === resourceId);
        if (index === -1) return null;
        lang.resources[index] = {
            ...lang.resources[index],
            ...updated,
            id: resourceId
        };
        await this.saveLanguage(lang);
        return lang.resources[index];
    }

    async deleteResource(langId, resourceId) {
        const lang = await this.getLanguage(langId);
        if (!lang) return false;
        lang.resources = (lang.resources || []).filter(r => r.id !== resourceId);
        await this.saveLanguage(lang);
        return true;
    }

    async updateTracking(langId, { sessionsDelta = 0, minutesDelta = 0, vocabDelta = 0, sessions = null, minutes = null, vocab = null } = {}) {
        const lang = await this.getLanguage(langId);
        if (!lang) return null;
        lang.tracking = lang.tracking || { sessionsCompleted: 0, minutesStudied: 0, vocabularyWords: 0 };
        
        if (sessions !== null) lang.tracking.sessionsCompleted = Math.max(0, sessions);
        else lang.tracking.sessionsCompleted = Math.max(0, lang.tracking.sessionsCompleted + sessionsDelta);

        if (minutes !== null) lang.tracking.minutesStudied = Math.max(0, minutes);
        else lang.tracking.minutesStudied = Math.max(0, lang.tracking.minutesStudied + minutesDelta);

        if (vocab !== null) lang.tracking.vocabularyWords = Math.max(0, vocab);
        else lang.tracking.vocabularyWords = Math.max(0, lang.tracking.vocabularyWords + vocabDelta);

        await this.saveLanguage(lang);
        return lang.tracking;
    }

    /**
     * Crée des séances dans le planning à partir du plan d'apprentissage sur 4 semaines.
     */
    async generatePlanningSessions(langId, planningEngine, baseDate = new Date()) {
        const lang = await this.getLanguage(langId);
        if (!lang || !planningEngine) return { success: false, reason: 'Langue ou Planning introuvable' };

        const plan = lang.plan || { sessionsPerWeek: 3, duration: 30, preferredDays: ['monday', 'wednesday', 'friday'] };
        const duration = parseInt(plan.duration, 10) || 30;
        const preferredDays = plan.preferredDays && plan.preferredDays.length > 0
            ? plan.preferredDays
            : ['monday', 'wednesday', 'friday'];

        const dayMap = {
            'sunday': 0, 'dimanche': 0,
            'monday': 1, 'lundi': 1,
            'tuesday': 2, 'mardi': 2,
            'wednesday': 3, 'mercredi': 3,
            'thursday': 4, 'jeudi': 4,
            'friday': 5, 'vendredi': 5,
            'saturday': 6, 'samedi': 6
        };
        const targetDayNums = preferredDays.map(d => dayMap[d.toLowerCase()]).filter(n => n !== undefined);

        let createdCount = 0;
        const start = new Date(baseDate);
        // Génération sur 28 jours (4 semaines)
        for (let i = 0; i < 28; i++) {
            const cur = new Date(start);
            cur.setDate(start.getDate() + i);
            const dayNum = cur.getDay();

            if (targetDayNums.includes(dayNum)) {
                const dateStr = cur.toLocaleDateString('fr-CA');
                
                // Calcul horaire : par défaut 18:00 à 18:30 (ou ajusté selon durée)
                const startHour = 18;
                const startMin = 0;
                const totalEndMin = startMin + duration;
                const endH = startHour + Math.floor(totalEndMin / 60);
                const endM = totalEndMin % 60;
                const startTime = `${String(startHour).padStart(2, '0')}:${String(startMin).padStart(2, '0')}`;
                const endTime = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;

                const ev = new Event({
                    id: `ev_lang_${lang.id}_${cur.getTime()}`,
                    title: `Pratique ${lang.name} (${lang.level})`,
                    date: dateStr,
                    startTime,
                    endTime,
                    type: 'revision',
                    impact: 'bloc',
                    mandatory: false,
                    lockStatus: 'flexible',
                    priority: 'medium',
                    source: 'language_plan',
                    notes: `Séance planifiée : ${lang.goal || 'Pratique régulière'}`
                });

                if (typeof planningEngine.saveEvent === 'function') {
                    await planningEngine.saveEvent(ev);
                    createdCount++;
                }
            }
        }

        return { success: true, count: createdCount };
    }
}
