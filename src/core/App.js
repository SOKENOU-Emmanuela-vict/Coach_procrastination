import { Router } from './Router.js?v=11';
import { AppLogger } from '../utils/AppLogger.js';
import { LearningGraphEngine } from '../engines/LearningGraphEngine.js?v=2';
import { ReflectionEngine } from '../engines/ReflectionEngine.js';
import { AcademicEngine } from '../engines/AcademicEngine.js';
import { PlanningEngine } from '../engines/PlanningEngine.js';
import { ProjectEngine } from '../engines/ProjectEngine.js';
import { PlanningIntelligence } from '../engines/PlanningIntelligence.js';
import { CoachOrchestrator } from '../ai/CoachOrchestrator.js';
import { KnowledgeEngine } from '../engines/KnowledgeEngine.js';
import { KnowledgeRetriever } from '../engines/KnowledgeRetriever.js';
import { AcademicSeeder } from '../data/AcademicSeeder.js';
import { CURRICULUM_SEED_VERSION, CURRICULUM_YEAR } from '../data/AcademicCurriculum.js';
import { RiskEngine } from '../engines/RiskEngine.js';
import { parseLocalDate, timeToMinutes, minutesToTime } from '../utils/dateUtils.js';
import { PlanningIntent } from '../models/PlanningIntent.js';
import { Grade } from '../models/Grade.js';
import { CoachContextBuilder } from '../ai/CoachContext.js';
import { detectFlexibleConflictAnswer, flexibleConflictChoices, buildFlexibleConflictQuestion } from '../ai/FlexibleConflictDialog.js';
import { TimetableImportEngine, DEFAULT_GROUP } from '../engines/TimetableImportEngine.js';
import { CourseProgressEngine } from '../engines/CourseProgressEngine.js';
import { SubjectMatcher } from '../engines/SubjectMatcher.js';
import { ExamRevisionPlanner } from '../ai/ExamRevisionPlanner.js';
import { parseExamAnnouncement, parseGradeAnswer, parseGradeStatement, isNotYetAnswer, parseBookProgress, parsePersonalTaskCreation, parseTaskCompletion, parseItemUpdate, parseItemDeletion } from '../ai/ChatIntentParser.js';
import { DailySnapshotEngine } from '../engines/DailySnapshotEngine.js';
import { LanguageEngine } from '../engines/LanguageEngine.js';
import { Event } from '../models/Event.js';
import { EventModal } from '../ui/EventModal.js';
import { deepSanitizeObject } from '../utils/security.js';

// Disponibilités par défaut tant qu'aucune n'a été saisie (seulement après un premier import d'emploi du temps)
export const DEFAULT_STUDY_WINDOW = { startTime: '08:00', endTime: '21:00' };
const GRADE_REASK_DAYS = 3;

export class App {
    constructor(storage, scheduler, studyRecordEngine, checkInEngine, aiEngine, weeklyReviewEngine, chatHistoryEngine, presenceEngine) {
        this.storage = storage;
        this.scheduler = scheduler;
        this.studyRecordEngine = studyRecordEngine;
        this.checkInEngine = checkInEngine;
        this.weeklyReviewEngine = weeklyReviewEngine;
        this.chatHistoryEngine = chatHistoryEngine;
        this.presenceEngine = presenceEngine;
        this.aiEngine = aiEngine;
        this.learningGraphEngine = new LearningGraphEngine(storage);
        this.reflectionEngine = new ReflectionEngine(storage);
        this.academicEngine = new AcademicEngine(storage);
        this.planningEngine = new PlanningEngine(storage);
        this.projectEngine = new ProjectEngine(storage);
        this.languageEngine = new LanguageEngine(storage);
        this.riskEngine = new RiskEngine(storage);
        this.snapshotEngine = new DailySnapshotEngine(storage);
        if (this.checkInEngine) this.checkInEngine.planningEngine = this.planningEngine;
        if (this.weeklyReviewEngine) this.weeklyReviewEngine.planningEngine = this.planningEngine;
        
        this.planningIntelligence = new PlanningIntelligence(this.planningEngine);
        this.knowledgeEngine = new KnowledgeEngine(storage);
        this.knowledgeRetriever = new KnowledgeRetriever(this.knowledgeEngine);
        this.coachEngine = new CoachOrchestrator(this.planningIntelligence, this.knowledgeRetriever, this.riskEngine);
        // Import de l'emploi du temps : même fournisseur Gemini que le coach (aucune clé supplémentaire)
        this.timetableImporter = new TimetableImportEngine({ storage, planningEngine: this.planningEngine, llmProvider: this.coachEngine.llmProvider || null });
        this.clock = () => new Date();
        
        this.state = {
            currentView: 'desktop',
            dailyPlan: { habits: [], sessions: [] },
            dailyStats: null,
            dailySummary: null,
            todayCheckIn: null,
            userProfile: null,
            fullHistory: [],
            analytics: null,
            systemHealth: null,
            coachInsights: null,
            learningGraph: null,
            reflections: null,
            monthlyReport: null,
            academicSummary: null,
            todayEvents: [],
            academicSubjects: [],
            // Avancement des cours (emplois du temps importés) : items par ECUE/matière, bySubject, upcomingSessions
            courseProgress: { items: [], bySubject: {}, upcomingSessions: [], lastImport: null },
            timetableStatus: null,
            userLanguages: [],
            calendarData: {
                events: [],
                availabilities: [],
                conflicts: []
            }
        };
        this.router = new Router('app-root', this);
    }

    /**
     * Tente de synchroniser la clé IA depuis le fichier local (endpoint /api/config/key).
     * Si une clé est renvoyée et différente de la clé en cours, met à jour localStorage et les moteurs IA.
     */
    async syncApiKeyFromFile() {
        try {
            if (typeof window !== 'undefined' && window.localStorage && typeof fetch === 'function') {
                const res = await fetch('/api/config/key');
                if (res.ok) {
                    const data = await res.json();
                    if (data && data.apiKey) {
                        const currentKey = window.localStorage.getItem('gemini_api_key');
                        if (currentKey !== data.apiKey) {
                            this.setGeminiApiKey(data.apiKey);
                            return true;
                        }
                    }
                }
            }
        } catch (_) {}
        return false;
    }

    /** Retourne les 4 derniers caractères de la clé IA active (ex. « ••••1234 »), ou null si aucune clé n'est configurée. */
    getMaskedGeminiApiKey() {
        const key = this.coachEngine && this.coachEngine.llmProvider && this.coachEngine.llmProvider.apiKey
            ? String(this.coachEngine.llmProvider.apiKey).trim()
            : '';
        if (!key) return null;
        const tail = key.length >= 4 ? key.slice(-4) : key;
        return `••••${tail}`;
    }

    /** Enregistre (ou efface si vide) la clé IA dans localStorage et met à jour immédiatement le Coach et l'import d'emploi du temps. */
    setGeminiApiKey(rawKey) {
        const clean = typeof rawKey === 'string' ? rawKey.trim() : '';
        if (typeof window !== 'undefined' && window.localStorage) {
            if (clean && typeof window.localStorage.setItem === 'function') {
                window.localStorage.setItem('gemini_api_key', clean);
            } else if (!clean && typeof window.localStorage.removeItem === 'function') {
                window.localStorage.removeItem('gemini_api_key');
            }
        }
        this.coachEngine = new CoachOrchestrator(this.planningIntelligence, this.knowledgeRetriever, this.riskEngine);
        if (this.timetableImporter) {
            this.timetableImporter.llmProvider = this.coachEngine.llmProvider || null;
        }
        return Boolean(this.coachEngine.llmProvider);
    }
    
    getPedagogicalDateObject(dateObj = new Date()) {
        return new Date(dateObj); // Date standard (pas de décalage)
    }

    getPedagogicalDate(dateObj = new Date()) {
        return this.getPedagogicalDateObject(dateObj).toLocaleDateString('fr-CA');
    }

    async start() {
        AppLogger.info("Lancement de l'application (start)");
        document.getElementById('app-root').innerHTML = '<p style="text-align:center;">Génération du planning... (Etape 1)</p>';
        // document.getElementById('bottom-nav').style.display = 'none';
        this.setupNavigation();
        
        // Auto-chargement de la clé depuis le fichier local (/api/config/key) si fourni
        await this.syncApiKeyFromFile();
        
        // Initialisation des données académiques
        // Anciennes erreurs techniques enregistrées dans la conversation (« Erreur lors de l'analyse… ») : retirées
        try {
            if (this.chatHistoryEngine && typeof this.chatHistoryEngine.purgeTechnicalErrors === 'function') await this.chatHistoryEngine.purgeTechnicalErrors();
        } catch (e) { AppLogger.error("Nettoyage du chat: " + e.message); }

        // Initialisation des données académiques : pas de seeder automatique au premier lancement.
        // L'écran est vide (« Ajouter ta première matière ») et le programme type est importable via « Exemple ».
        // Pour les installations existantes possédant déjà des données, on applique la migration du cursus.
        try {
            const years = await this.academicEngine.getYears();
            if (years && years.length > 0) {
                const seeder = new AcademicSeeder(this.academicEngine);
                await seeder.migrate();
            }
        } catch (e) {
            AppLogger.error("Migration du cursus: " + e.message);
        }
        await this.refreshAcademicSubjects();
        
        document.getElementById('app-root').innerHTML = '<p style="text-align:center;">Génération du planning... (Etape 2)</p>';
        // renderView rafraîchit l'état (plan du jour inclus) avant d'afficher : un seul passage au démarrage.
        await this.renderView('desktop');
        // Messages proactifs du jour dans le chat (rappels d'examen, notes à donner, emploi du temps à importer)
        try { await this.syncProactiveCoachMessages(); } catch (e) { AppLogger.error("Messages du coach: " + e.message); }
        
        this.setupGlobalItemEditor();
    }

    setupGlobalItemEditor() {
        const modal = document.getElementById('global-item-editor-modal');
        if (!modal) return;
        const cancelBtn = document.getElementById('global-btn-modal-cancel');
        if (cancelBtn && typeof cancelBtn.addEventListener === 'function') {
            cancelBtn.addEventListener('click', () => {
                modal.style.display = 'none';
            });
        }
        const saveBtn = document.getElementById('global-btn-modal-save');
        if (saveBtn && typeof saveBtn.addEventListener === 'function') {
            saveBtn.addEventListener('click', async () => {
                const id = document.getElementById('global-modal-item-id').value;
                const type = document.getElementById('global-modal-item-type-select').value;
                const title = document.getElementById('global-modal-item-title').value.trim();
                if (!title) return alert("Le titre/nom est requis");
            
            const baseData = {
                title,
                domain: document.getElementById('global-modal-item-domain').value,
                priority: document.getElementById('global-modal-item-priority').value,
            };

            if (type === 'project') {
                const existing = id ? (await this.projectEngine.getProjects()).find(i => i.id === id) : {};
                await this.projectEngine.saveProject({
                    ...existing, ...baseData, id: id || undefined,
                    targetDate: document.getElementById('global-modal-item-dueDate').value || null,
                });
            } else if (type === 'book') {
                const existing = id ? (await this.projectEngine.getBooks()).find(i => i.id === id) : {};
                await this.projectEngine.saveBook({
                    ...existing, ...baseData, id: id || undefined,
                    totalPages: document.getElementById('global-modal-item-target').value ? parseInt(document.getElementById('global-modal-item-target').value, 10) : 0,
                    targetDate: document.getElementById('global-modal-item-dueDate').value || null,
                });
            } else if (type === 'task') {
                const existing = id ? (await this.projectEngine.getPersonalTasks()).find(i => i.id === id) : {};
                await this.projectEngine.savePersonalTask({
                    ...existing, ...baseData, id: id || undefined,
                    estimatedMinutes: document.getElementById('global-modal-item-duration').value ? parseInt(document.getElementById('global-modal-item-duration').value, 10) : 0,
                    dueDate: document.getElementById('global-modal-item-dueDate').value || null,
                });
            } else if (type === 'habit') {
                const existing = id ? (await this.scheduler.getHabits()).find(i => i.id === id) : {};
                await this.scheduler.saveHabit({
                    ...existing, ...baseData, id: id || `hab_${Date.now()}`,
                    target: document.getElementById('global-modal-item-target').value ? parseFloat(document.getElementById('global-modal-item-target').value) : null,
                });
            } else if (type === 'skill') {
                const existing = id ? (await this.scheduler.getSkills()).find(i => i.id === id) : {};
                await this.scheduler.saveSkill({
                    ...existing, ...baseData, id: id || `skill_${Date.now()}`
                });
            } else if (type === 'subject') {
                const existing = id ? (await this.academicEngine.getSubjects()).find(i => i.id === id) : {};
                const semesterId = this._pendingSemesterId || existing.semesterId || (this.state.academicSemesters?.[0]?.id || 'sem_s3_26');
                await this.academicEngine.saveSubject({
                    ...existing,
                    id: id || `sub_${Date.now()}`,
                    name: baseData.title,
                    semesterId: existing.semesterId || semesterId,
                    cect: existing.cect || 6
                });
                this._pendingSemesterId = null;
                await this.refreshAcademicSubjects();
            } else if (type === 'goal') {
                const existing = id ? (await this.projectEngine.getGoals()).find(i => i.id === id) : {};
                await this.projectEngine.saveGoal({
                    ...existing, ...baseData, id: id || undefined,
                    deadline: document.getElementById('global-modal-item-dueDate').value || null,
                    progress: document.getElementById('global-modal-item-target').value ? parseFloat(document.getElementById('global-modal-item-target').value) : 0
                });
            }

            modal.style.display = 'none';
            this.renderView(this.state.currentView);
        });
        }
    }

    openGlobalItemEditor(data = {}) {
        const modal = document.getElementById('global-item-editor-modal');
        if (!modal) return;
        
        this._pendingSemesterId = data.semesterId || null;
        document.getElementById('global-modal-item-id').value = data.id || '';
        document.getElementById('global-modal-item-type-select').value = data.type || 'project';
        document.getElementById('global-modal-item-title').value = data.title || data.name || '';
        document.getElementById('global-modal-item-domain').value = data.domain || 'perso';
        document.getElementById('global-modal-item-dueDate').value = data.dueDate || data.targetDate || data.deadline || '';
        document.getElementById('global-modal-item-duration').value = data.duration || data.estimatedMinutes || '';
        document.getElementById('global-modal-item-priority').value = data.priority || 'medium';
        document.getElementById('global-modal-item-target').value = data.target || data.totalPages || data.progress || '';
        
        modal.style.display = 'flex';
    }

    /**
     * (Re)génère le plan du jour à partir des événements du jour et marque ce qui est déjà fait.
     * Appelé à chaque rafraîchissement : le plan n'est plus figé au démarrage (nouveaux événements, minuit…).
     */
    async refreshDailyPlan(localDate = this.getPedagogicalDate()) {
        if (!this.scheduler || typeof this.scheduler.generateDailyPlan !== 'function') return this.state.dailyPlan;
        const plan = (await this.scheduler.generateDailyPlan(localDate)) || {};
        plan.date = plan.date || localDate;
        plan.habits = Array.isArray(plan.habits) ? plan.habits : [];
        plan.sessions = Array.isArray(plan.sessions) ? plan.sessions : [];

        const history = await this.storage.loadData('study_history') || [];
        const completedIds = history.filter(r => r.date === localDate).map(r => r.sessionId);
        plan.habits.forEach(h => h.completed = completedIds.includes(h.id));
        plan.sessions.forEach(s => s.completed = completedIds.includes(s.id));

        this.state.dailyPlan = plan;
        return plan;
    }

    /**
     * Contexte unique du coach, identique pour le rafraîchissement de l'interface et pour le chat.
     * @param {Object} options
     * @param {boolean} options.useLLM - appeler le LLM (seulement à la demande : chat)
     * @param {Array} options.chatHistory - derniers messages [{role, content}]
     */
    async buildCoachContext({ useLLM = false, chatHistory = null } = {}) {
        // Avancement des cours + disponibilités par défaut (avant le calcul des créneaux)
        const courseProgress = await this.refreshCourseProgress();
        const gradeRequests = await this.computeGradeRequests();
        const dToday = new Date();
        const localDate = this.getPedagogicalDate(dToday);
        const nowMinutes = dToday.getHours() * 60 + dToday.getMinutes();
        
        const presenceStats = this.presenceEngine ? await this.presenceEngine.getPresenceStats(7) : null;

        // Construction du contexte temporel pour le Coach (J à J+5)
        const temporalEvents = [];
        const availableSlots = [];
        const availabilityDates = []; // jours avec des disponibilités, même occupées par des événements flexibles
        const conflicts = [];
        for (let i = 0; i <= 5; i++) {
            const d = new Date(dToday);
            d.setDate(d.getDate() + i);
            const dateStr = this.getPedagogicalDate(d);
            
            const evs = await this.planningEngine.getEventsForDate(dateStr);
            temporalEvents.push(...evs);
            
            // Le coach propose d'abord du temps réellement libre (événements flexibles compris) ;
            // s'il n'y en a pas, PlanningAI peut proposer un créneau sur un événement flexible en DEMANDANT.
            const slots = await this.planningEngine.getAvailableSlots(dateStr, { subtractFlexible: true });
            const lockedOnlySlots = await this.planningEngine.getAvailableSlots(dateStr);
            if (lockedOnlySlots.length > 0) availabilityDates.push(dateStr);
            slots.forEach(s => {
                if (i === 0) {
                    // Aujourd'hui : on ne garde que ce qui reste à partir de maintenant
                    const start = Math.max(timeToMinutes(s.startTime), nowMinutes);
                    const end = timeToMinutes(s.endTime);
                    if (end - start <= 0) return;
                    availableSlots.push({ date: dateStr, ...s, startTime: minutesToTime(start), durationMinutes: end - start });
                } else {
                    availableSlots.push({ date: dateStr, ...s });
                }
            });

            const dayConflicts = await this.planningEngine.detectConflicts(dateStr);
            conflicts.push(...dayConflicts);
        }

        return {
            userProfile: this.state.userProfile,
            academicSummary: this.state.academicSummary,
            projects: await (async () => {
                const projs = await this.projectEngine.getProjects();
                for (const p of projs) {
                    try { p.determination = await this.projectEngine.calculateProjectDetermination(p.id); } catch (_) {}
                }
                return projs;
            })(),
            books: await this.projectEngine.getBooks(),
            personalTasks: await this.projectEngine.getPersonalTasks(),
            goals: await this.projectEngine.getGoals(),
            userLanguages: (this.state && this.state.userLanguages) || (this.languageEngine ? await this.languageEngine.getLanguages() : []),
            temporalEvents: temporalEvents,
            availableSlots: availableSlots,
            availabilityDates: availabilityDates,
            conflicts: conflicts,
            analytics: { ...this.state.analytics, presenceStats },
            currentDate: localDate,
            chatHistory: chatHistory,
            options: { useLLM },
            courses: {
                progress: (courseProgress && courseProgress.items) || [],
                bySubject: (courseProgress && courseProgress.bySubject) || {},
                upcomingSessions: (courseProgress && courseProgress.upcomingSessions) || [],
                timetable: (this.state && this.state.timetableStatus) || null,
                gradeRequests
            },
            knowledgeRetriever: this.knowledgeRetriever
        };
    }

    // ---------------------------------------------------------------------------------------------
    // Emploi du temps hebdomadaire → cours verrouillés + avancement → coach
    // ---------------------------------------------------------------------------------------------

    _todayStr(now = this.clock()) {
        return this.getPedagogicalDate(now);
    }

    async _loadProfile() {
        const loaded = (this.state && this.state.userProfile) || (await this.storage.loadData('user_profile')) || {};
        return loaded || {};
    }

    /**
     * Recalcule l'avancement des cours (heures faites selon l'heure actuelle) et l'état de l'import de la semaine.
     * Active les disponibilités par défaut (DEFAULT_STUDY_WINDOW) seulement si un emploi du temps a été importé,
     * qu'aucune disponibilité n'a été saisie (voir PlanningEngine._windowsForDate) et que le profil ne l'interdit pas.
     */
    async refreshCourseProgress(now = this.clock()) {
        const imports = (await this.storage.loadData('timetable_imports')) || [];
        const subjects = (this.state && Array.isArray(this.state.academicSubjects) && this.state.academicSubjects.length > 0)
            ? this.state.academicSubjects
            : ((await this.storage.loadData('acad_subjects')) || []);
        const progress = CourseProgressEngine.compute(Array.isArray(imports) ? imports : [], { now, subjects: Array.isArray(subjects) ? subjects : [] });
        const profile = await this._loadProfile();
        if (this.state) {
            this.state.courseProgress = progress;
            this.state.timetableStatus = TimetableImportEngine.timetableStatus(imports, now);
        }
        if (this.planningEngine) {
            this.planningEngine.defaultStudyWindow = (Array.isArray(imports) && imports.length > 0 && profile.useDefaultStudyWindow !== false)
                ? (profile.defaultStudyWindow || DEFAULT_STUDY_WINDOW) : null;
        }
        return progress;
    }

    /**
     * Notes que le coach doit demander :
     *  - évaluation passée sans note (kind 'past_assessment') ;
     *  - cours terminé (heures faites ≥ total) sans évaluation notée ni évaluation à venir (kind 'finished_course').
     */
    async computeGradeRequests(now = this.clock()) {
        const ae = this.academicEngine;
        if (!ae || typeof ae.getAssessments !== 'function' || typeof ae.getGrades !== 'function' || typeof ae.getSubjects !== 'function') return [];
        const today = this._todayStr(now);
        const assessments = (await this.academicEngine.getAssessments()) || [];
        const grades = (await this.academicEngine.getGrades()) || [];
        const subjects = (await this.academicEngine.getSubjects()) || [];
        const hasFinal = (a) => grades.some(g => g.assessmentId === a.id && (g.isFinal || grades.filter(x => x.assessmentId === a.id).length === 1));
        const subjectName = (id) => (subjects.find(s => s.id === id) || {}).name || null;
        const requests = [];
        for (const a of assessments) {
            if (!a || !a.targetDate || hasFinal(a)) continue;
            if (String(a.targetDate) < today) {
                requests.push({ key: `ass_${a.id}`, kind: 'past_assessment', assessmentId: a.id, subjectId: a.subjectId,
                    label: subjectName(a.subjectId) || a.title, title: a.title, targetDate: a.targetDate });
            }
        }
        const progress = (this.state && this.state.courseProgress) || { items: [] };
        for (const it of (progress.items || [])) {
            if (!it.finished || !it.subjectId) continue;
            const own = assessments.filter(a => a.subjectId === it.subjectId && (!a.componentCode || !it.componentCode || a.componentCode === it.componentCode));
            if (own.some(a => hasFinal(a))) continue;
            if (own.some(a => a.targetDate && String(a.targetDate) >= today)) continue; // examen pas encore passé
            if (own.some(a => a.targetDate && String(a.targetDate) < today)) continue; // déjà demandé via l'évaluation passée
            const label = it.componentName && it.componentName !== it.subjectName ? `${it.componentName} (${it.subjectName})` : (it.subjectName || it.title);
            requests.push({ key: `course_${it.key}`, kind: 'finished_course', subjectId: it.subjectId, componentCode: it.componentCode || null,
                label, hoursTotal: it.hoursTotal, lastSessionDate: it.lastSessionDate });
        }
        return requests;
    }

    /**
     * Erreur Gemini (GeminiProvider : status / code) → message clair pour l'interface, avec ce qu'il faut faire.
     * Les autres erreurs (format, taille, JSON) sont renvoyées telles quelles.
     */
    static explainGeminiFailure(err, prefix) {
        if (!err || !err.code || err.name !== 'GeminiError') return err;
        const advice = {
            OVERLOADED: 'Gemini est très demandé en ce moment : réessaie dans quelques minutes.',
            SERVER: 'Réessaie dans quelques minutes.',
            TIMEOUT: 'Réessaie dans quelques minutes (ou envoie une photo plus légère).',
            NETWORK: 'Vérifie ta connexion Internet puis réessaie.',
            QUOTA: 'Le quota de la clé est atteint : réessaie plus tard (ou demain).',
            AUTH: 'La clé Gemini doit être remplacée.',
            MODEL: 'Le modèle Gemini doit être mis à jour dans le code.'
        }[err.code] || 'Réessaie plus tard.';
        const code = err.status ? `code ${err.status}` : err.code;
        const reason = String(err.message || '').replace(/^Erreur API Gemini \([^)]*\) : /, '').replace(/\.$/, '');
        const out = new Error(`${prefix} (${code}) : ${reason}. ${advice}`);
        out.code = err.code;
        out.status = err.status;
        return out;
    }

    /**
     * Étape 1 de l'import : lecture du fichier par Gemini et aperçu (rien n'est enregistré).
     * @param {Object} file - { base64, mimeType, fileName, sizeBytes }
     */
    async extractTimetable(file = {}) {
        const profile = await this._loadProfile();
        const subjects = (await this.academicEngine.getSubjects()) || [];
        let preview;
        try {
            preview = await this.timetableImporter.extract({
                ...file,
                group: profile.groupe || DEFAULT_GROUP,
                referenceDate: this._todayStr(),
                subjects,
                semesterId: profile.currentSemesterId || 'sem_s3_26'
            });
        } catch (err) {
            const explained = App.explainGeminiFailure(err, "Lecture de l'emploi du temps impossible");
            if (this.chatHistoryEngine && typeof this.chatHistoryEngine.saveMessage === 'function') {
                try {
                    await this._sayCoach(`La lecture de l'emploi du temps a échoué : ${explained.message}. Aucun cours n'a pu être lu.`, { intent: null, proactive: 'timetable_failed' });
                } catch (e) {}
            }
            throw explained;
        }
        this.pendingTimetablePreview = preview;

        if (this.chatHistoryEngine && typeof this.chatHistoryEngine.saveMessage === 'function') {
            const rowCount = preview.rows ? preview.rows.length : 0;
            const groupText = (preview.groupsFound && preview.groupsFound.length > 0)
                ? `groupe(s) détecté(s) : ${preview.groupsFound.join(', ')}`
                : 'aucun groupe spécifique détecté';
            if (rowCount === 0) {
                await this._sayCoach(`J'ai analysé le document mais je n'ai trouvé aucun cours (${groupText}).`, { intent: null, proactive: 'timetable_empty' });
            } else {
                await this._sayCoach(`Lecture de l'emploi du temps : ${rowCount} cours lu(s) (${groupText}). Tu peux vérifier l'aperçu et valider.`, { intent: null, proactive: 'timetable_read' });
            }
        }

        return preview;
    }

    /** Aperçu recalculé pour un autre groupe (sans nouvel appel à Gemini). */
    async changeTimetableGroup(preview, group) {
        const subjects = (await this.academicEngine.getSubjects()) || [];
        const updated = this.timetableImporter.selectGroup(preview, group, subjects);
        this.pendingTimetablePreview = updated;
        return updated;
    }

    /**
     * Étape 2 : enregistrement des séances validées (cours verrouillés, hors Focus), avancement, profil.
     * @param {Object} preview
     * @param {Object} choices - { rows: [{ id, include, subjectId }] }
     */
    async applyTimetableImport(preview, choices = {}) {
        const res = await this.timetableImporter.apply(preview || this.pendingTimetablePreview, choices);
        if (!res || !res.success) {
            const err = new Error((res && res.reason) || "Import refusé.");
            err.result = res;
            throw err;
        }
        this.pendingTimetablePreview = null;
        if (this.state) {
            // Le planning affiche la semaine importée (utile le dimanche, quand on importe la semaine suivante)
            this.state.selectedDate = res.weekStart > this._todayStr() ? res.weekStart : null;
            if (this.state.userProfile) this.state.userProfile = { ...this.state.userProfile, groupe: preview.group };
        }
        await this.refreshCourseProgress();
        try { await this._announceTimetableImport(res); } catch (e) { AppLogger.error("Message d'import: " + e.message); }
        return res;
    }

    /**
     * Après un import validé : le coach confirme dans le chat ce qu'il a reçu (cours, avancement) et
     * clôt le rappel « emploi du temps à importer » de cette semaine.
     */
    async _announceTimetableImport(res) {
        if (!res || !res.weekStart || !this.chatHistoryEngine || typeof this.chatHistoryEngine.saveMessage !== 'function') return;
        const [, m, d] = String(res.weekStart).split('-');
        const today = this._todayStr();
        const cp = (this.state && this.state.courseProgress) || { items: [], upcomingSessions: [] };
        const next = (cp.upcomingSessions || []).find(s => s.date >= today);
        const progress = (cp.items || []).filter(it => it.hoursTotal && it.subjectId).slice(0, 4)
            .map(it => `${it.subjectName || it.title} ${it.hoursDone} h/${it.hoursTotal} h`);
        const groupDesc = (res.groupsFound && res.groupsFound.length > 0)
            ? ` (${res.groupsFound.join(', ')})`
            : (res.group ? ` (${res.group})` : ' (aucun groupe détecté)');
        const countText = res.count > 1 ? `${res.count} cours ajoutés à ton planning` : (res.count === 1 ? '1 cours ajouté à ton planning' : 'aucun cours ajouté');
        const parts = [`Bien reçu : emploi du temps de la semaine du ${d}/${m}${groupDesc}, ${countText}.`];
        if (next) parts.push(`Prochain cours : ${next.title} ${next.date === today ? "aujourd'hui" : this._frDate(next.date)} à ${next.startTime}.`);
        if (progress.length) parts.push(`Avancement : ${progress.join(' ; ')}.`);
        parts.push("Dis-moi dès que tu connais la date d'un examen (ex. « examen de Structures algébriques le 15/10 »).");
        await this._sayCoach(parts.join('\n'), { intent: null, proactive: 'timetable_imported' });
        const nudges = await this._loadNudges();
        const key = `timetable_${res.weekStart}`;
        nudges[key] = { ...(nudges[key] || {}), done: true, lastAsked: today };
        await this.storage.saveData('coach_nudges', nudges);
    }

    _daysBetween(fromStr, toStr) {
        return Math.round((parseLocalDate(toStr) - parseLocalDate(fromStr)) / 86400000);
    }

    _frDate(dateStr) {
        const d = parseLocalDate(dateStr);
        return isNaN(d) ? dateStr : d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
    }

    _subjectMatcher(subjects) {
        const semesterId = (this.state && this.state.userProfile && this.state.userProfile.currentSemesterId) || 'sem_s3_26';
        return new SubjectMatcher(subjects, { semesterId });
    }

    async _sayCoach(content, metadata = {}) {
        return this.chatHistoryEngine.saveMessage({ role: 'assistant', content, conversationId: 'default', metadata });
    }

    /**
     * Propose les séances de révision manquantes avant une évaluation (créneaux calculés par PlanningAI,
     * question « on décide ensemble » si seul un créneau sur un événement flexible existe) et les écrit dans le chat.
     * @returns {Promise<Object>} { target, proposed, planned: [...recs] }
     */
    async proposeRevisionSessions(assessment, { intro = null } = {}) {
        const today = this._todayStr();
        const subjects = (await this.academicEngine.getSubjects()) || [];
        const subject = subjects.find(s => s.id === assessment.subjectId) || null;
        await this.refreshCourseProgress();
        const progress = (this.state.courseProgress && this.state.courseProgress.bySubject && this.state.courseProgress.bySubject[assessment.subjectId]) || null;
        const daysRemaining = this._daysBetween(today, assessment.targetDate);
        const alreadyPlanned = ((await this.planningEngine.getEventsForAssessment(assessment.id)) || [])
            .filter(e => e.type === 'revision' && e.date >= today && e.date <= assessment.targetDate).length;
        const { recs, target } = ExamRevisionPlanner.buildRecommendations({
            assessment, subjectName: subject ? subject.name : '', progress, daysRemaining, alreadyPlanned
        });
        if (intro) await this._sayCoach(intro, { intent: null });
        if (recs.length === 0) return { target, proposed: 0, planned: [], alreadyPlanned };
        const data = await this.buildCoachContext({ useLLM: false });
        const planning = CoachContextBuilder.build(data).planning;
        const planned = await this.coachEngine.planningAI.plan(recs, planning);
        for (const rec of planned) {
            await this._sayCoach(rec.message, { intent: rec.intent || null, flexibleConflict: rec.flexibleConflict || null });
        }
        return { target, proposed: planned.filter(r => r.intent || r.flexibleConflict).length, planned, alreadyPlanned };
    }

    /**
     * « j'ai examen de X le 15/10 » : évaluation créée (ou retrouvée) pour la matière reconnue, examen ajouté au planning
     * (événement verrouillé sans horaire), puis séances de révision proposées. Réponse écrite dans le chat.
     */
    async handleExamAnnouncement(parsed) {
        const subjects = (await this.academicEngine.getSubjects()) || [];
        const match = this._subjectMatcher(subjects).match(parsed.subjectPhrase, { short: true });
        if (match.status === 'unmapped') {
            return this._sayCoach(`Je n'ai pas reconnu la matière « ${parsed.subjectPhrase} ». Redis-moi son nom, par exemple : « examen de Structures algébriques le 15/10 ».`);
        }
        if (match.ambiguous) {
            const names = [match.subjectName].concat(match.alternatives.map(a => a.subjectName)).filter((v, i, a) => v && a.indexOf(v) === i).slice(0, 3);
            return this._sayCoach(`Tu parles de quelle matière : ${names.map(n => `« ${n} »`).join(' ou ')} ? Redis-moi la phrase avec le nom complet.`);
        }
        const subject = subjects.find(s => s.id === match.subjectId);
        if (!parsed.date) {
            return this._sayCoach(`C'est noté pour ${subject.name}. Quelle est la date de l'${parsed.type === 'Examen' ? 'examen' : 'évaluation'} ? Par exemple : « ${parsed.type.toLowerCase()} de ${parsed.subjectPhrase} le 15/10 ».`);
        }

        // Évaluation : on réutilise celle de la même matière à la même date (pas de doublon si elle est annoncée deux fois)
        const assessments = (await this.academicEngine.getAssessments()) || [];
        let assessment = assessments.find(a => a.subjectId === subject.id && a.targetDate === parsed.date);
        if (!assessment) {
            assessment = {
                id: `ass_chat_${subject.id}_${parsed.date}_${Math.floor(Math.random() * 1000)}`,
                subjectId: subject.id,
                title: `${parsed.type} — ${subject.name}`,
                type: parsed.type,
                weight: 1,
                maxScore: 20,
                targetDate: parsed.date,
                componentCode: match.componentCode || null,
                source: 'chat'
            };
            await this.academicEngine.saveAssessment(assessment);
        }
        // Examen visible dans le planning (« À venir ») : événement verrouillé, sans horaire, écrit par le moteur
        const examEvents = (await this.planningEngine.getEventsForAssessment(assessment.id)) || [];
        if (!examEvents.some(e => e.type === 'exam')) {
            await this.planningEngine.executeIntent(new PlanningIntent({
                action: 'create', target: 'event', constraints: { date: parsed.date },
                payload: { title: assessment.title, type: 'exam', lockStatus: 'locked', priority: 'high', subjectId: subject.id, assessmentId: assessment.id, source: 'chat' }
            }));
        }
        await this.refreshAcademicSubjects();

        const today = this._todayStr();
        const days = this._daysBetween(today, parsed.date);
        if (days < 0) {
            return this._sayCoach(`J'ai enregistré ${assessment.title} le ${this._frDate(parsed.date)}, mais cette date est passée. As-tu des notes à me donner pour ${subject.name} ? Réponds-moi ici (ex. « 14/20 »).`,
                { intent: null, gradeRequest: { key: `ass_${assessment.id}`, kind: 'past_assessment', assessmentId: assessment.id, subjectId: subject.id, label: subject.name } });
        }
        await this.refreshCourseProgress();
        const progress = (this.state.courseProgress.bySubject || {})[subject.id] || null;
        const when = days === 0 ? "aujourd'hui" : (days === 1 ? 'demain' : `dans ${days} jours`);
        const target = ExamRevisionPlanner.target({ daysRemaining: days, progress });
        const defaultWindows = !!this.planningEngine.defaultStudyWindow && ((await this.planningEngine.getAvailabilityWindows()) || []).length === 0;
        let intro = `C'est noté : ${assessment.title} le ${this._frDate(parsed.date)} (${when}). ${ExamRevisionPlanner.progressText(progress)}`;
        if (days >= 1) {
            intro += ` Je te propose ${target.sessions} séance${target.sessions > 1 ? 's' : ''} de révision de ${target.duration} min avant l'examen, et je te le rappellerai chaque jour d'ici là.`;
            if (defaultWindows) intro += ` (Tu n'as pas encore saisi de disponibilités : je me base sur ${this.planningEngine.defaultStudyWindow.startTime}-${this.planningEngine.defaultStudyWindow.endTime}, en dehors de tes cours.)`;
        } else {
            intro += ` Courage ! Dis-moi ta note quand tu l'auras (ex. « 14/20 »).`;
            return this._sayCoach(intro, { intent: null });
        }
        return this.proposeRevisionSessions(assessment, { intro });
    }

    /** Question « notes à donner » encore ouverte : portée par le dernier tour de parole du coach. */
    async _findPendingGradeRequests() {
        if (!this.chatHistoryEngine || typeof this.chatHistoryEngine.getRecentMessages !== 'function') return [];
        const recent = await this.chatHistoryEngine.getRecentMessages('default', 40);
        let i = recent.length - 1;
        if (i >= 0 && recent[i].role === 'user') i--;
        const requests = [];
        while (i >= 0 && recent[i].role === 'assistant') {
            const md = recent[i].metadata || {};
            if (md.gradeRequest) requests.unshift(md.gradeRequest);
            if (Array.isArray(md.gradeRequests)) requests.unshift(...md.gradeRequests);
            i--;
        }
        const seen = new Set();
        return requests.filter(r => r && r.key && !seen.has(r.key) && seen.add(r.key));
    }

    /**
     * Enregistre une note donnée dans le chat pour une demande du coach (évaluation passée ou cours terminé).
     * Cours terminé sans évaluation : une évaluation « Note — X » (poids 1) est créée à la date du jour.
     * La note est ramenée sur le barème de l'évaluation ; la note de la matière se met à jour (moyenne des évaluations).
     */
    async recordGradeFromChat(request, { score, max = 20 }) {
        const assessments = (await this.academicEngine.getAssessments()) || [];
        let assessment = request.assessmentId ? assessments.find(a => a.id === request.assessmentId) : null;
        if (!assessment) {
            assessment = {
                id: `ass_grade_${request.subjectId}_${Date.now()}`,
                subjectId: request.subjectId,
                title: `Note — ${request.label}`,
                type: 'Examen',
                weight: 1,
                maxScore: max,
                targetDate: this._todayStr(),
                componentCode: request.componentCode || null,
                source: 'chat'
            };
            await this.academicEngine.saveAssessment(assessment);
        }
        const assMax = Number(assessment.maxScore) || 20;
        const value = Math.round((Number(score) * assMax / (Number(max) || assMax)) * 100) / 100;
        await this.saveAssessmentGrade({ assessmentId: assessment.id, score: value, isFinal: true, dateEarned: this._todayStr() });
        await this._markNudge(request.key, { done: true });
        const subject = (this.state.academicSubjects || []).find(s => s.id === assessment.subjectId);
        let avgTxt = '';
        if (subject) {
            if (subject.gradeStatus === 'complete' && subject.grade !== null) avgTxt = ` Note de ${subject.name} : ${subject.grade}/20.`;
            else if (subject.provisionalGrade !== null && subject.provisionalGrade !== undefined) {
                avgTxt = ` Moyenne provisoire de ${subject.name} : ${subject.provisionalGrade}/20 (${subject.gradedAssessments}/${subject.totalAssessments} évaluation${subject.totalAssessments > 1 ? 's' : ''} notée${subject.gradedAssessments > 1 ? 's' : ''}).`;
            }
        }
        await this._sayCoach(`Merci ! J'ai enregistré ${score}/${max} pour ${request.label}.${avgTxt}`, { intent: null });
        return { assessment, score: value };
    }

    async _loadNudges() {
        const n = await this.storage.loadData('coach_nudges');
        return (n && typeof n === 'object' && !Array.isArray(n)) ? n : {};
    }

    async _markNudge(key, fields) {
        if (!key) return;
        const nudges = await this._loadNudges();
        nudges[key] = { ...(nudges[key] || {}), ...fields };
        await this.storage.saveData('coach_nudges', nudges);
    }

    /**
     * Messages du chat qui pilotent la boucle académique, traités par règles (sans LLM) :
     * réponse à une demande de notes, annonce d'examen, note donnée spontanément.
     * @returns {Promise<boolean>} true si le message a été traité
     */
    async _handleAcademicChat(text) {
        // --- INTERCEPTION DU CHECK-IN ---
        if (this.chatHistoryEngine && typeof this.chatHistoryEngine.getRecentMessages === 'function') {
            const recentMsgs = await this.chatHistoryEngine.getRecentMessages('default', 5);
            const lastCoach = recentMsgs.slice().reverse().find(m => m.role === 'assistant');
            if (lastCoach && lastCoach.metadata && lastCoach.metadata.pendingCheckIn) {
                let mood = 'medium';
                let energy = 'medium';
                let motivation = 'medium';
                const t = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                
                if (/(top|super|bien|excellent|heureu|genial)/.test(t)) mood = 'high';
                if (/(triste|deprime|mauvais|bof|pas ouf|mal)/.test(t)) mood = 'low';
                
                if (/(fatigue|epuise|hs|faible|ko)/.test(t)) energy = 'low';
                if (/(en forme|plein d energie|petard|frais)/.test(t)) energy = 'high';
                
                if (/(tres motive|a fond|determine|chaud)/.test(t)) motivation = 'high';
                if (/(demotive|pas envie|flemme)/.test(t)) motivation = 'low';
                
                await this.checkInEngine.saveCheckIn({
                    date: this._todayStr(),
                    mood,
                    energy,
                    motivation,
                    notes: text
                });
                
                let coachResponse = `Check-in enregistré : humeur ${mood}, énergie ${energy}, motivation ${motivation}.`;

                if (energy === 'low' || mood === 'low') {
                    coachResponse += ` Ton niveau est bas aujourd'hui. Veux-tu que j'allège ton planning d'aujourd'hui (réduction des séances, priorité aux examens) ? (réponds "oui" pour accepter, "non" pour garder le plan)`;
                    await this._sayCoach(coachResponse, { intent: null, pendingLightenPlan: true });
                } else {
                    coachResponse += ` On garde le cap !`;
                    await this._sayCoach(coachResponse, { intent: null });
                }
                return true;
            }

            if (lastCoach && lastCoach.metadata && lastCoach.metadata.pendingLightenPlan) {
                const t = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                if (/(oui|ouais|ok|vas y|allez|accepte|all[eé]ge|d accord|daccord|dac|ca marche|parfait)/.test(t)) {
                    const res = await this.planningEngine.lightenDailyPlan(this._todayStr());
                    await this._sayCoach(`C'est fait ! J'ai allégé ton planning (${res.removedCount} séance(s) retirée(s), ${res.shortenedCount} raccourcie(s)). Pense à rafraîchir ou recharger la vue.`, { intent: null });
                } else {
                    await this._sayCoach(`D'accord, on garde le planning tel quel. Courage pour aujourd'hui !`, { intent: null });
                }
                return true;
            }
            
            if (lastCoach && lastCoach.metadata && lastCoach.metadata.pendingItemUpdate) {
                const t = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                const data = lastCoach.metadata.pendingItemUpdate;
                if (/(oui|ouais|ok|d accord|daccord|dac|ca marche|parfait)/.test(t)) {
                    if (data.type === 'project') await this.projectEngine.saveProject({ ...data.item, targetDate: data.newDate });
                    else if (data.type === 'book') await this.projectEngine.saveBook({ ...data.item, targetDate: data.newDate });
                    else if (data.type === 'task') await this.projectEngine.savePersonalTask({ ...data.item, dueDate: data.newDate });
                    await this._sayCoach(`C'est fait ! L'échéance de "${data.item.title}" a été mise à jour.`, { intent: null });
                } else {
                    await this._sayCoach(`D'accord, je n'ai rien modifié.`, { intent: null });
                }
                return true;
            }

            if (lastCoach && lastCoach.metadata && lastCoach.metadata.pendingItemDeletion) {
                const t = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                const data = lastCoach.metadata.pendingItemDeletion;
                if (/(oui|ouais|ok|d accord|daccord|dac|ca marche|parfait|supprime|efface)/.test(t)) {
                    if (data.type === 'project') await this.projectEngine.deleteProject(data.item.id);
                    else if (data.type === 'book') await this.projectEngine.deleteBook(data.item.id);
                    else if (data.type === 'task') await this.projectEngine.deletePersonalTask(data.item.id);
                    await this._sayCoach(`C'est fait ! "${data.item.title}" a été supprimé.`, { intent: null });
                } else {
                    await this._sayCoach(`D'accord, la suppression est annulée.`, { intent: null });
                }
                return true;
            }

            if (lastCoach && lastCoach.metadata && lastCoach.metadata.pendingTaskPlanning) {
                const t = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                const data = lastCoach.metadata.pendingTaskPlanning;
                if (/(oui|ouais|ok|d accord|daccord|dac|ca marche|parfait|planifie|ajoute)/.test(t)) {
                    // Créer l'événement
                    const eventId = `ev_${Date.now()}`;
                    await this.planningEngine.saveEvent({
                        id: eventId,
                        date: data.slot.date,
                        startTime: data.slot.startTime,
                        endTime: data.slot.endTime,
                        title: data.task.title,
                        type: 'personal',
                        taskId: data.task.id,
                        isLocked: true
                    });
                    // Mettre à jour la tâche
                    const savedTask = await this.projectEngine.getPersonalTasks().then(tasks => tasks.find(x => x.id === data.task.id));
                    if (savedTask) {
                        savedTask.status = 'planifiée';
                        await this.projectEngine.savePersonalTask(savedTask);
                    }
                    await this._sayCoach(`C'est fait ! J'ai planifié "${data.task.title}" le ${data.slot.date} à ${data.slot.startTime}.`, { intent: null });
                } else {
                    await this._sayCoach(`D'accord, la tâche reste dans ta liste "à faire".`, { intent: null });
                }
                return true;
            }

            if (lastCoach && lastCoach.metadata && lastCoach.metadata.pendingTaskFollowUp) {
                const t = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                const data = lastCoach.metadata.pendingTaskFollowUp;
                const savedTask = await this.projectEngine.getPersonalTasks().then(tasks => tasks.find(x => x.id === data.task.id));
                
                if (/(oui|ouais|ok|d accord|daccord|dac|ca marche|parfait|fait|fini|termine)/.test(t)) {
                    if (savedTask) {
                        savedTask.status = 'faite';
                        await this.projectEngine.savePersonalTask(savedTask);
                    }
                    await this._sayCoach(`Super ! C'est validé.`, { intent: null });
                } else if (/(non|pas|jamais|pas encore|plus tard|reporte)/.test(t)) {
                    if (savedTask) {
                        savedTask.status = 'reportée';
                        savedTask.reportsCount = (savedTask.reportsCount || 0) + 1;
                        await this.projectEngine.savePersonalTask(savedTask);
                        
                        // RiskEngine : alimenter les reports
                        if (this.riskEngine) {
                            // On pourrait enregistrer un événement de procrastination
                        }

                        // Proposer un nouveau créneau
                        let proposedSlot = null;
                        if (this.planningEngine && this.planningIntelligence) {
                            for (let i = 1; i <= 4; i++) {
                                const d = new Date(this.clock());
                                d.setDate(d.getDate() + i);
                                const dateStr = this.getPedagogicalDate(d);
                                const res = await this.planningIntelligence.findCandidateSlots({ date: dateStr, duration: savedTask.estimatedMinutes || 30, subtractFlexible: true });
                                if (res.candidates && res.candidates.length > 0) {
                                    proposedSlot = res.candidates[0];
                                    break;
                                }
                            }
                        }
                        if (proposedSlot) {
                            await this._sayCoach(`Pas de souci. Veux-tu qu'on reporte "${savedTask.title}" au ${proposedSlot.date} de ${proposedSlot.startTime} à ${proposedSlot.endTime} ? (oui/non)`, {
                                intent: null,
                                pendingTaskPlanning: { task: savedTask, slot: proposedSlot }
                            });
                        } else {
                            await this._sayCoach(`D'accord, je l'ai marquée comme reportée (aucun créneau trouvé pour la replanifier).`, { intent: null });
                        }
                    } else {
                        await this._sayCoach(`D'accord.`, { intent: null });
                    }
                }
                return true;
            }
        }
        // --- FIN INTERCEPTION CHECK-IN ET CONFIRMATIONS ---

        const pending = await this._findPendingGradeRequests();
        const answer = parseGradeAnswer(text);
        const statement = parseGradeStatement(text);
        const subjects = (await this.academicEngine.getSubjects()) || [];

        if (pending.length > 0) {
            if (!answer && !statement && isNotYetAnswer(text)) {
                const until = this.getPedagogicalDate(new Date(this.clock().getTime() + GRADE_REASK_DAYS * 86400000));
                for (const r of pending) await this._markNudge(r.key, { snoozedUntil: until });
                await this._sayCoach(`D'accord, je te redemanderai dans ${GRADE_REASK_DAYS} jours.`, { intent: null });
                return true;
            }
            if (statement) {
                const m = this._subjectMatcher(subjects).match(statement.subjectPhrase, { short: true });
                const req = m.subjectId ? pending.find(r => r.subjectId === m.subjectId) : null;
                if (req) { await this.recordGradeFromChat(req, statement); return true; }
            }
            if (answer && !statement) {
                if (pending.length === 1) { await this.recordGradeFromChat(pending[0], answer); return true; }
                await this._sayCoach(`Pour quelle matière ? ${pending.map(r => `« ${r.label} »`).join(', ')}. Réponds par exemple « ${answer.score}/${answer.max} en ${pending[0].label} ».`,
                    { intent: null, gradeRequests: pending });
                return true;
            }
        }

        const exam = parseExamAnnouncement(text, this.clock());
        if (exam) {
            await this.handleExamAnnouncement(exam);
            return true;
        }

        const bookProgress = parseBookProgress(text);
        if (bookProgress && this.projectEngine) {
            const books = await this.projectEngine.getBooks();
            const titleMatch = bookProgress.titlePhrase ? bookProgress.titlePhrase.toLowerCase() : '';
            const book = books.find(b => b.status === 'reading' && (titleMatch ? b.title.toLowerCase().includes(titleMatch) : true));
            
            if (book) {
                if (bookProgress.unit === 'pages') book.progressPages += bookProgress.amount;
                else book.progressChapters += bookProgress.amount;
                await this.projectEngine.saveBook(book);
                await this._sayCoach(`Super ! J'ai mis à jour ton avancée sur "${book.title}".`, { intent: null });
                return true;
            }
        }

        const pTaskCreation = parsePersonalTaskCreation(text);
        if (pTaskCreation && this.projectEngine) {
            const task = await this.projectEngine.savePersonalTask({ title: pTaskCreation.title, category: 'other', estimatedMinutes: 30 });
            
            // Chercher un créneau libre
            let proposedSlot = null;
            if (this.planningEngine && this.planningIntelligence) {
                // Essayer demain, puis après-demain, etc.
                for (let i = 0; i <= 3; i++) {
                    const d = new Date(this.clock());
                    d.setDate(d.getDate() + i);
                    const dateStr = this.getPedagogicalDate(d);
                    const res = await this.planningIntelligence.findCandidateSlots({ date: dateStr, duration: 30, subtractFlexible: true });
                    if (res.candidates && res.candidates.length > 0) {
                        proposedSlot = res.candidates[0];
                        break;
                    }
                }
            }

            if (proposedSlot) {
                await this._sayCoach(`C'est noté, j'ai ajouté "${task.title}" à tes tâches. Veux-tu que je la planifie le ${proposedSlot.date} de ${proposedSlot.startTime} à ${proposedSlot.endTime} ? (oui/non)`, { 
                    intent: null,
                    pendingTaskPlanning: { task, slot: proposedSlot }
                });
            } else {
                await this._sayCoach(`C'est noté, j'ai ajouté "${task.title}" à tes tâches. (Aucun créneau libre trouvé dans les prochains jours).`, { intent: null });
            }
            return true;
        }

        const taskCompletion = parseTaskCompletion(text);
        if (taskCompletion && this.projectEngine) {
            const tasks = await this.projectEngine.getPersonalTasks();
            const projects = await this.projectEngine.getProjects();
            
            const titleLower = taskCompletion.title.toLowerCase();
            const pTask = tasks.find(t => t.status !== 'faite' && t.title.toLowerCase().includes(titleLower));
            if (pTask) {
                pTask.status = 'faite';
                await this.projectEngine.savePersonalTask(pTask);
                await this._sayCoach(`Parfait ! La tâche "${pTask.title}" est terminée.`, { intent: null });
                return true;
            }
            
            const activeProj = projects.find(p => p.status === 'active' && p.title.toLowerCase().includes(titleLower));
            if (activeProj) {
                activeProj.progress = Math.min(100, activeProj.progress + 20); // increment progress implicitly
                await this.projectEngine.saveProject(activeProj);
                await this._sayCoach(`Génial ! J'ai mis à jour l'avancement du projet "${activeProj.title}".`, { intent: null });
                return true;
            }
        }

        const itemUpdate = parseItemUpdate(text, this.clock());
        if (itemUpdate && this.projectEngine) {
            const titleMatch = itemUpdate.titlePhrase.toLowerCase();
            const projects = await this.projectEngine.getProjects();
            const books = await this.projectEngine.getBooks();
            const tasks = await this.projectEngine.getPersonalTasks();
            let found = null;
            let type = null;

            found = projects.find(p => p.title.toLowerCase().includes(titleMatch));
            if (found) type = 'project';
            if (!found) { found = books.find(b => b.title.toLowerCase().includes(titleMatch)); if (found) type = 'book'; }
            if (!found) { found = tasks.find(t => t.title.toLowerCase().includes(titleMatch)); if (found) type = 'task'; }

            if (found) {
                await this._sayCoach(`Veux-tu vraiment changer l'échéance de "${found.title}" au ${itemUpdate.newDate} ? (oui/non)`, { 
                    intent: null, 
                    pendingItemUpdate: { item: found, type, newDate: itemUpdate.newDate } 
                });
                return true;
            }
        }

        const itemDeletion = parseItemDeletion(text);
        if (itemDeletion && this.projectEngine) {
            const titleMatch = itemDeletion.titlePhrase.toLowerCase();
            const projects = await this.projectEngine.getProjects();
            const books = await this.projectEngine.getBooks();
            const tasks = await this.projectEngine.getPersonalTasks();
            let found = null;
            let type = null;

            found = projects.find(p => p.title.toLowerCase().includes(titleMatch));
            if (found) type = 'project';
            if (!found) { found = books.find(b => b.title.toLowerCase().includes(titleMatch)); if (found) type = 'book'; }
            if (!found) { found = tasks.find(t => t.title.toLowerCase().includes(titleMatch)); if (found) type = 'task'; }

            if (found) {
                await this._sayCoach(`Veux-tu vraiment supprimer l'élément "${found.title}" ? Cette action est irréversible. (oui/non)`, { 
                    intent: null, 
                    pendingItemDeletion: { item: found, type } 
                });
                return true;
            }
        }

        if (statement) {
            const m = this._subjectMatcher(subjects).match(statement.subjectPhrase, { short: true });
            if (m.subjectId && !m.ambiguous) {
                const today = this._todayStr();
                const grades = (await this.academicEngine.getGrades()) || [];
                const open = ((await this.academicEngine.getAssessments()) || [])
                    .filter(a => a.subjectId === m.subjectId && !grades.some(g => g.assessmentId === a.id && g.isFinal))
                    .sort((a, b) => String(b.targetDate || '').localeCompare(String(a.targetDate || '')));
                const target = open.find(a => !a.targetDate || String(a.targetDate) <= today) || null;
                const subject = subjects.find(s => s.id === m.subjectId);
                await this.recordGradeFromChat({
                    key: target ? `ass_${target.id}` : null, kind: target ? 'past_assessment' : 'finished_course',
                    assessmentId: target ? target.id : null, subjectId: m.subjectId, componentCode: m.componentCode || null,
                    label: subject ? subject.name : statement.subjectPhrase
                }, statement);
                return true;
            }
        }
        return false;
    }

    /**
     * Messages proactifs du coach, au plus une fois par jour et par sujet (clé de stockage 'coach_nudges') :
     *  - emploi du temps de la semaine à importer (le dimanche : semaine suivante) ;
     *  - rappel de chaque évaluation à venir (≤ 14 jours) jusqu'au jour J, avec proposition des révisions manquantes ;
     *  - « As-tu des notes à me donner pour X ? » (évaluation passée sans note, cours terminé), redemandé tous les 3 jours.
     * @returns {Promise<number>} nombre de messages ajoutés
     */
    async syncProactiveCoachMessages(now = this.clock()) {
        if (!this.chatHistoryEngine || typeof this.chatHistoryEngine.saveMessage !== 'function' || !this.academicEngine
            || typeof this.academicEngine.getAssessments !== 'function') return 0;
        const today = this._todayStr(now);
        const nudges = await this._loadNudges();
        const posted = [];
        const due = (key, everyDays = 1) => {
            const n = nudges[key] || {};
            if (n.done) return false;
            if (n.snoozedUntil && n.snoozedUntil > today) return false;
            return !n.lastAsked || this._daysBetween(n.lastAsked, today) >= everyDays;
        };
        const mark = (key) => { nudges[key] = { ...(nudges[key] || {}), lastAsked: today }; posted.push(key); };

        await this.refreshCourseProgress(now);

        // --- NUDGE CHECK-IN ---
        const keyCheckIn = `checkin_${today}`;
        if (due(keyCheckIn)) {
            const checkins = await this.storage.loadData('daily_checkins') || {};
            if (!checkins[today]) {
                const pending = await this.storage.loadData('pending_checkin_conv');
                if (!pending || pending.date !== today) {
                    await this.storage.saveData('pending_checkin_conv', { step: 'mood', date: today, data: {} });
                    await this._sayCoach(`Bonjour ! Comment te sens-tu aujourd'hui ? Quelle est ton humeur (bonne, moyenne, morose...) ?`, { intent: null, proactive: 'checkin', pendingCheckInStep: 'mood' });
                }
            }
            mark(keyCheckIn);
        }
        // --- FIN NUDGE CHECK-IN ---

        const tt = this.state.timetableStatus;
        if (tt && tt.needsImport) {
            const key = `timetable_${tt.targetWeekStart}`;
            if (due(key)) {
                const [, m, d] = tt.targetWeekStart.split('-');
                await this._sayCoach(tt.isSunday
                    ? `C'est dimanche ! Envoie-moi l'emploi du temps de la semaine du ${d}/${m} : Planning → « Importer l'emploi du temps (PDF) ».`
                    : `Je n'ai pas encore l'emploi du temps de cette semaine (du ${d}/${m}). Importe-le depuis Planning → « Importer l'emploi du temps (PDF) » pour que je suive l'avancement de tes cours.`,
                    { intent: null, proactive: 'timetable' });
                mark(key);
            }
        }

        const subjects = (await this.academicEngine.getSubjects()) || [];
        const grades = (await this.academicEngine.getGrades()) || [];
        const upcoming = ((await this.academicEngine.getAssessments()) || [])
            .filter(a => a && a.targetDate && String(a.targetDate) >= today && this._daysBetween(today, a.targetDate) <= 14
                && !grades.some(g => g.assessmentId === a.id && g.isFinal))
            .sort((a, b) => String(a.targetDate).localeCompare(String(b.targetDate)));
        for (const a of upcoming) {
            const key = `exam_${a.id}`;
            if (!due(key)) continue;
            mark(key);
            const subject = subjects.find(s => s.id === a.subjectId);
            const days = this._daysBetween(today, a.targetDate);
            const when = days === 0 ? "aujourd'hui" : (days === 1 ? 'demain' : `dans ${days} jours`);
            const progress = (this.state.courseProgress.bySubject || {})[a.subjectId] || null;
            const planned = ((await this.planningEngine.getEventsForAssessment(a.id)) || []).filter(e => e.type === 'revision' && e.date >= today && e.date <= a.targetDate).length;
            const target = ExamRevisionPlanner.target({ daysRemaining: days, progress });
            const intro = `Rappel : ${a.title} ${when} (${this._frDate(a.targetDate)}). ${ExamRevisionPlanner.progressText(progress)} Révisions planifiées d'ici là : ${planned}/${target.sessions}.`;
            if (days >= 1 && planned < target.sessions) await this.proposeRevisionSessions(a, { intro });
            else await this._sayCoach(days === 0 ? `${intro} Bon courage pour aujourd'hui !` : intro, { intent: null, proactive: 'exam' });
        }

        for (const r of await this.computeGradeRequests(now)) {
            if (!due(r.key, GRADE_REASK_DAYS)) continue;
            mark(r.key);
            const why = r.kind === 'finished_course' ? `Le cours ${r.label} est terminé d'après ton emploi du temps.` : `${r.title} (${this._frDate(r.targetDate)}) est passé.`;
            await this._sayCoach(`${why} As-tu des notes à me donner pour ${r.label} ? Réponds-moi ici (ex. « 14/20 »), ou « pas encore ».`,
                { intent: null, proactive: 'grade', gradeRequest: r });
        }

        // --- NUDGE RAPPELS TACHES PERSONNELLES ESCALADANTS (J-2, J-1, Jour J) ---
        if (this.projectEngine) {
            const pTasks = (await this.projectEngine.getPersonalTasks()) || [];
            for (const t of pTasks) {
                if (!t.dueDate || t.status === 'faite' || t.status === 'done' || t.status === 'cancelled') continue;
                const days = this._daysBetween(today, t.dueDate);
                if (days < 0 || days > 2) continue;
                const key = `ptask_remind_${t.id}_${days}`;
                if (!due(key)) continue;
                mark(key);
                let msg;
                if (days === 2) {
                    msg = `📌 Rappel (J-2) : ta tâche « ${t.title} » doit être faite dans 2 jours. Pense à la planifier !`;
                } else if (days === 1) {
                    msg = `⚠️ Rappel (J-1) : ta tâche « ${t.title} » doit être faite demain. C'est le moment de t'y mettre sérieusement !`;
                } else {
                    msg = `🚨 URGENT (Jour J) : ta tâche « ${t.title} » est à rendre aujourd'hui ! Dis-moi quand c'est fait.`;
                    if (typeof window !== 'undefined' && window.dispatchEvent) {
                        window.dispatchEvent(new CustomEvent('toast', { detail: { message: `Tâche urgente : « ${t.title} »` } }));
                    }
                }
                await this._sayCoach(msg, { intent: null, proactive: 'task_remind', taskId: t.id, urgency: days });
            }
        }

        // --- NUDGE ALERTES OBJECTIFS (GOALS) ---
        if (this.projectEngine && typeof this.projectEngine.getGoals === 'function') {
            const goals = (await this.projectEngine.getGoals()) || [];
            for (const g of goals) {
                // Alertes d'échéance
                if (g.deadline && g.progress < 50) {
                    const days = this._daysBetween(today, g.deadline);
                    if (days >= 0 && days <= 5) {
                        const key = `goal_alert_${g.id}_${days}`;
                        if (due(key, 2)) {
                            mark(key);
                            await this._sayCoach(`🚨 Alerte Objectif : Ton objectif "${g.title}" arrive à échéance dans ${days} jours, mais ton avancement n'est que de ${g.progress}%. Faisons un plan pour avancer !`, { intent: null, proactive: 'goal_alert' });
                        }
                    }
                }
                // Alertes de réussite (50%, 80%, 100%)
                const milestones = [50, 80, 100];
                for (const m of milestones) {
                    if (g.progress >= m) {
                        const key = `goal_milestone_${g.id}_${m}`;
                        if (due(key, 9999)) { // une seule fois par jalon
                            mark(key);
                            await this._sayCoach(`🎉 Félicitations ! Tu as atteint ${m}% de ton objectif "${g.title}".`, { intent: null, proactive: 'goal_success' });
                            if (typeof this.appLogger?.info === 'function') this.appLogger.info(`Goal Milestone ${m}%: ${g.title}`);
                            if (typeof window !== 'undefined' && window.dispatchEvent) {
                                window.dispatchEvent(new CustomEvent('toast', { detail: { message: `Objectif "${g.title}" : ${m}% atteint !` } }));
                                window.dispatchEvent(new CustomEvent('badge', { detail: { source: 'goal', message: `Objectif ${m}% : ${g.title}` } }));
                            }
                        }
                    }
                }
            }
        }


        // --- NUDGE TENDANCE DE TRAVAIL (Request 3) ---
        if (this.snapshotEngine && typeof this.snapshotEngine.getTrends === 'function') {
            try {
                const trends = await this.snapshotEngine.getTrends(today);
                let currentTrendState = 'insufficient_data';
                if (!trends.insufficientData) {
                    if (trends.trends.risk === 'down') currentTrendState = 'improving';
                    else if (trends.trends.risk === 'up') currentTrendState = 'worsening';
                    else currentTrendState = 'stable';
                }

                const trendKey = 'trend_state';
                const lastTrendState = nudges[trendKey]?.lastState || null;

                // Ne déclencher qu'une seule fois par changement net de tendance
                if (currentTrendState !== lastTrendState) {
                    nudges[trendKey] = {
                        ...(nudges[trendKey] || {}),
                        lastState: currentTrendState,
                        lastAsked: today
                    };
                    posted.push(trendKey);

                    await this._sayCoach(`📊 ${trends.sentence}`, {
                        intent: null,
                        proactive: 'trend',
                        trendState: currentTrendState,
                        insufficientData: trends.insufficientData
                    });
                }
            } catch (e) {
                AppLogger.warn('Nudge tendance: ' + (e && e.message));
            }
        }

        // --- NUDGE TACHES DU JOUR ---
        if (now.getHours() >= 18) {
            const todayEvents = await this.planningEngine.getEventsForDate(today);
            const personalEvents = todayEvents.filter(e => e.type === 'personal' && e.taskId);
            if (personalEvents.length > 0 && this.projectEngine) {
                const tasks = await this.projectEngine.getPersonalTasks();
                for (const ev of personalEvents) {
                    const t = tasks.find(x => x.id === ev.taskId);
                    if (t && t.status === 'planifiée') {
                        const key = `task_followup_${t.id}_${today}`;
                        if (due(key)) {
                            mark(key);
                            await this._sayCoach(`Tu avais prévu de "${t.title}" aujourd'hui. C'est fait ? (oui/non)`, {
                                intent: null, proactive: 'task', pendingTaskFollowUp: { task: t }
                            });
                            break; // Une seule tâche à la fois
                        }
                    }
                }
            }
        }
        // --- FIN NUDGE TACHES DU JOUR ---

        if (posted.length > 0) {
            // relecture : proposeRevisionSessions a pu écrire d'autres clés entre-temps
            const fresh = await this._loadNudges();
            for (const k of posted) fresh[k] = { ...(fresh[k] || {}), ...nudges[k] };
            await this.storage.saveData('coach_nudges', fresh);
        }
        return posted.length;
    }
    
    async refreshUserStats() {
        const dToday = new Date();
        const localDate = this.getPedagogicalDate(dToday);
        // Semaine affichée après un import du dimanche : on revient à la semaine courante une fois celle-ci passée
        if (this.state.selectedDate && this.state.selectedDate < TimetableImportEngine.mondayOf(dToday)) this.state.selectedDate = null;

        await this.refreshDailyPlan(localDate);
        this.state.dailyStats = await this.studyRecordEngine.getDailyStats(localDate);
        this.state.dailySummary = await this.checkInEngine.buildDailySummary(localDate);
        this.state.todayCheckIn = await this.checkInEngine.getCheckIn(localDate);
        
        const loadedProfile = await this.storage.loadData('user_profile');
        const defaultProfile = { 
            streak: 1, 
            lastActive: null,
            name: "Étudiant",
            formation: null,
            niveau: null,
            groupe: null,
            currentSemesterId: 'sem_s3_26' // Changed to load seeded S3 data
        };
        // Fusion : un profil partiel (ex: créé par StudyRecordEngine avec seulement streak/lastActive)
        // ne doit pas faire disparaître le semestre courant ni le nom.
        this.state.userProfile = { ...defaultProfile, ...(loadedProfile || {}) };
        this.state.fullHistory = await this.studyRecordEngine.getFullHistory();
        
        // Charger les données du graphe d'apprentissage pour les widgets du dashboard
        if (this.learningGraphEngine) {
            this.state.learningGraph = { nodes: await this.learningGraphEngine.evaluateGraph() };
        }
        
        // Les insights et alertes académiques seront ajoutés via CoachAI.
        // systemHealth est déprécié.
        const dTodayLocal = parseLocalDate(localDate);
        this.state.monthlyReport = await this.studyRecordEngine.getMonthlyStats(dTodayLocal.getFullYear(), dTodayLocal.getMonth());
        this.state.allCheckins = await this.storage.loadData('daily_checkins') || {};

        if (this.projectEngine) {
            const rawProjects = await this.projectEngine.getProjects();
            for (let p of rawProjects) {
                if (typeof this.projectEngine.calculateProjectRegularity === 'function') {
                    p.regularity = await this.projectEngine.calculateProjectRegularity(p.id);
                }
            }
            this.state.projects = rawProjects;
            this.state.books = await this.projectEngine.getBooks();
            this.state.personalTasks = await this.projectEngine.getPersonalTasks();
            
            const goals = await this.projectEngine.getGoals();
            let goalsUpdated = false;
            for (const goal of goals) {
                if (goal.autoMetric) {
                    let currentVal = 0;
                    if (goal.autoMetric.type === 'pages') {
                        currentVal = this.state.books.reduce((acc, b) => acc + (b.pagesRead || 0), 0);
                    } else if (goal.autoMetric.type === 'tasks') {
                        currentVal = this.state.personalTasks.filter(t => t.status === 'faite').length;
                    } else if (goal.autoMetric.type === 'streak') {
                        currentVal = this.state.userProfile?.streak || 0;
                    } else if (goal.autoMetric.type === 'sessions') {
                        currentVal = (this.state.fullHistory || []).filter(h => h.status === 'completed').length;
                    }
                    
                    const newProgress = Math.min(100, Math.round((currentVal / goal.autoMetric.target) * 100));
                    if (newProgress > goal.progress) {
                        goal.progress = newProgress;
                        await this.projectEngine.saveGoal(goal);
                        goalsUpdated = true;
                    }
                }
            }
            this.state.goals = goals;
        }
        
        // Données pour le Bureau (Desktop) et Espace Académique
        const semesterId = this.state.userProfile.currentSemesterId || null;
        this.state.academicSummary = semesterId ? await this.academicEngine.getSemesterSummary(semesterId, localDate) : null;
        await this.refreshAcademicSubjects();

        if (this.languageEngine) {
            this.state.userLanguages = await this.languageEngine.getLanguages();
        }

        // Activité réelle transmise au coach (bilans, exécution du jour, régularité)
        this.state.analytics = {
            streak: this.state.userProfile?.streak || 0,
            today: this.state.dailySummary?.execution || null,
            todayPlannedMinutes: this.state.dailySummary?.planned?.minutes || 0,
            todayActualMinutes: this.state.dailySummary?.actual?.minutes || 0,
            todayCheckIn: this.state.todayCheckIn ? {
                energy: this.state.todayCheckIn.energy,
                blockers: this.state.todayCheckIn.blockers,
                dayAssessment: this.state.todayCheckIn.dayAssessment
            } : null,
            month: this.state.monthlyReport ? {
                totalHours: this.state.monthlyReport.totalHours,
                daysActive: this.state.monthlyReport.daysActive,
                proofsGenerated: this.state.monthlyReport.proofsGenerated
            } : null
        };

        // Règles déterministes uniquement : pas d'appel LLM à chaque rafraîchissement (latence + coût).
        const coachContextData = await this.buildCoachContext({ useLLM: false });
        const insights = (await this.coachEngine.getInsights(coachContextData)) || [];
        // Dernier conseil LLM obtenu à la demande (chat), réaffiché sans nouvel appel le même jour
        if (this.llmAdviceCache && this.llmAdviceCache.date === localDate && Array.isArray(insights)) {
            insights.push({ ...this.llmAdviceCache.rec, intent: null, actionable: false, title: "Dernier conseil de l'IA" });
        }
        this.state.coachInsights = insights;
        this.state.todayEvents = await this.planningEngine.getEventsForDate(localDate);
        await this.refreshCalendarData();

        // --- SNAPSHOT JOURNALIER (Request B) ---
        if (this.snapshotEngine) {
            try {
                const riskProfile = this.riskEngine ? await this.riskEngine.evaluateRisk(
                    this.state.academicSummary || {},
                    await this.studyRecordEngine.getFullHistory(),
                    this.state.allCheckins || {}
                ) : null;
                const history = this.state.fullHistory || [];
                await this.snapshotEngine.buildAndSave({
                    date: localDate,
                    riskProfile,
                    checkIn: this.state.todayCheckIn || null,
                    history,
                    dailySummary: this.state.dailySummary || null
                });
                // Stocker les tendances dans le state pour l'UI
                this.state.trends = await this.snapshotEngine.getTrends(localDate);
            } catch (e) {
                AppLogger.warn('Snapshot journalier: ' + (e && e.message));
            }
        }
    }

    /**
     * Applique une proposition du coach.
     * @param {Object} intent
     * @param {Object} [options] - transmis à PlanningEngine.executeIntent : { allowFlexibleOverlap,
     *   flexibleResolution: 'keep'|'move'|'replace', confirmedFlexibleIds } (confirmation d'un chevauchement
     *   avec un événement flexible). Sans options, tout chevauchement est refusé.
     * @returns {Promise<Object>} le résultat ({ success: true, ... })
     * @throws {Error} si le moteur refuse (conflit, référence manquante…) : l'interface affiche l'erreur.
     *   err.result contient la réponse complète du moteur (ex: needsConfirmation, overlappingFlexible).
     */
    async acceptCoachSuggestion(intent, options = {}) {
        if (!intent) return null;
        
        let result = { success: true };
        if (intent.action === 'save_checkin') {
            if (!this.checkInEngine) throw new Error("Le moteur de bilan n'est pas disponible.");
            // Ensure the date is injected if missing
            const payload = { ...(intent.payload || {}) };
            payload.date = payload.date || this.getPedagogicalDate();
            const checkIn = await this.checkInEngine.saveCheckIn(payload);
            result = { success: true, checkIn };
        } else if (intent.action === 'update_project') {
            const { projectId, score, message } = intent.payload || {};
            if (!projectId) throw new Error('Projet non identifié dans la réponse du coach.');
            const projects = await this.projectEngine.getProjects();
            const project = projects.find(p => p.id === projectId);
            if (!project) throw new Error('Projet introuvable.');
            project.coachAssessments = project.coachAssessments || [];
            project.coachAssessments.push({
                date: this.getPedagogicalDate(),
                score: Number(score) || 0,
                message: message || ''
            });
            // Mettre à jour le score de détermination
            const det = await this.projectEngine.calculateProjectDetermination(project.id);
            project.determination = det;
            await this.projectEngine.saveProject(project);
            result = { success: true, project };
        } else if (this.planningEngine) {
            const execResult = await this.planningEngine.executeIntent(intent, { now: new Date(), ...options });
            if (execResult && execResult.success === false) {
                const err = new Error(execResult.reason || "Planification refusée par le moteur.");
                err.result = execResult;
                throw err;
            }
            result = execResult || { success: true };
        }
        
        await this.refreshCalendarData();
        await this.refreshUserStats();
        return result;
    }
    
    /**
     * Mise à jour d'une matière depuis la vue Académique (champs autorisés : name, code, cect).
     */
    async updateSubject(subjectId, fields = {}) {
        const subjects = await this.academicEngine.getSubjects();
        const subject = subjects.find(s => s.id === subjectId);
        if (!subject) throw new Error('Matière introuvable');
        const updated = { ...subject };
        if (typeof fields.name === 'string' && fields.name.trim()) updated.name = fields.name.trim();
        if (typeof fields.code === 'string') updated.code = fields.code.trim();
        if (Number.isFinite(fields.cect) && fields.cect >= 0) updated.cect = fields.cect;
        await this.academicEngine.saveSubject(updated);
        await this.refreshAcademicSubjects();
        await this.renderView('academic');
        return updated;
    }

    /**
     * Matières enrichies de leur note, calculée par AcademicEngine à partir des notes de leurs évaluations
     * (moyenne pondérée par les poids des évaluations, sinon moyenne simple).
     *  - grade : note de la matière, seulement quand TOUTES ses évaluations sont notées (affichée par la vue)
     *  - provisionalGrade : moyenne des évaluations déjà notées (en cours de semestre)
     *  - gradeStatus : 'complete' | 'partial' | 'no_grades' | 'no_assessments'
     * Les champs calculés ne sont jamais réenregistrés dans acad_subjects.
     */
    async refreshAcademicSubjects() {
        if (!this.academicEngine || typeof this.academicEngine.getSubjects !== 'function') return this.state.academicSubjects;
        this.state.academicSemesters = await this.academicEngine.getSemesters();
        this.state.academicAssessments = await this.academicEngine.getAssessments();
        this.state.academicGrades = await this.academicEngine.getGrades();
        const subjects = await this.academicEngine.getSubjects();
        const enriched = [];
        for (const s of subjects) {
            let avg = null;
            try {
                avg = typeof this.academicEngine.getSubjectAverage === 'function' ? await this.academicEngine.getSubjectAverage(s.id) : null;
            } catch (e) { avg = null; }
            enriched.push({
                ...s,
                grade: (avg && avg.status === 'complete' && avg.average !== null) ? avg.average : null,
                provisionalGrade: avg ? avg.average : null,
                gradeStatus: avg ? avg.status : null,
                gradeMethod: avg ? avg.method || null : null,
                gradedAssessments: avg ? avg.gradedCount || 0 : 0,
                totalAssessments: avg ? avg.assessmentCount || 0 : 0
            });
        }
        this.state.academicSubjects = enriched;
        return enriched;
    }

    /**
     * Enregistre la note d'UNE évaluation (modèle par évaluation : la note de la matière en est déduite).
     * @param {Object} params - { assessmentId, score, isFinal = true, attemptNumber, feedback, dateEarned }
     *   score est exprimé sur le maxScore de l'évaluation. Une nouvelle note finale remplace la précédente
     *   (l'ancienne reste dans l'historique, marquée non finale).
     */
    async saveAssessmentGrade({ assessmentId, score, isFinal = true, attemptNumber = null, feedback = '', dateEarned = null } = {}) {
        const assessments = await this.academicEngine.getAssessments();
        const assessment = assessments.find(a => a.id === assessmentId);
        if (!assessment) throw new Error('Évaluation introuvable');
        const value = Number(score);
        const max = Number(assessment.maxScore) || 20;
        if (!Number.isFinite(value) || value < 0 || value > max) throw new Error(`Note invalide (0 à ${max})`);

        const existing = (await this.academicEngine.getGrades()).filter(g => g.assessmentId === assessmentId);
        if (isFinal) {
            for (const g of existing.filter(g => g.isFinal)) {
                await this.academicEngine.saveGrade({ ...g, isFinal: false });
            }
        }
        const grade = new Grade(`gr_${Date.now()}_${Math.floor(Math.random() * 1000)}`, assessmentId, value,
            attemptNumber || existing.length + 1, !!isFinal, feedback || '', dateEarned);
        await this.academicEngine.saveGrade({ ...grade });
        await this.refreshAcademicSubjects();
        return grade;
    }

    async importAcademicExample() {
        const seeder = new AcademicSeeder(this.academicEngine);
        await seeder.seed();
        await this.refreshAcademicSubjects();
        if (this.state.currentView === 'academic') {
            await this.renderView('academic');
        }
        return true;
    }

    async clearAcademicExample() {
        if (!this.academicEngine) return false;
        if (typeof this.academicEngine.clearAllData === 'function') {
            await this.academicEngine.clearAllData();
        } else if (this.storage) {
            await this.storage.saveData('acad_years', []);
            await this.storage.saveData('acad_semesters', []);
            await this.storage.saveData('acad_subjects', []);
            await this.storage.saveData('acad_assessments', []);
            await this.storage.saveData('acad_grades', []);
        }
        await this.refreshAcademicSubjects();
        if (this.state.currentView === 'academic') {
            await this.renderView('academic');
        }
        return true;
    }

    async saveSemester(semesterData) {
        if (!this.academicEngine) return;
        const id = semesterData.id || `sem_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
        const sem = {
            id,
            yearId: semesterData.yearId || 'year_l2_26_27',
            name: semesterData.name || 'Nouveau Semestre',
            status: semesterData.status || 'active',
            metadata: semesterData.metadata || {}
        };
        await this.academicEngine.saveSemester(sem);
        await this.refreshAcademicSubjects();
        return sem;
    }

    async deleteSemester(id) {
        if (!this.academicEngine) return;
        await this.academicEngine.deleteSemester(id);
        await this.refreshAcademicSubjects();
    }

    async saveAssessment(assessmentData) {
        if (!this.academicEngine) return;
        const id = assessmentData.id || `ass_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
        const ass = {
            id,
            subjectId: assessmentData.subjectId,
            title: assessmentData.title || 'Nouvelle épreuve',
            type: assessmentData.type || 'Examen',
            weight: typeof assessmentData.weight === 'number' ? assessmentData.weight : (parseFloat(assessmentData.weight) || 1.0),
            maxScore: typeof assessmentData.maxScore === 'number' ? assessmentData.maxScore : (parseFloat(assessmentData.maxScore) || 20),
            targetDate: assessmentData.targetDate || null
        };
        await this.academicEngine.saveAssessment(ass);
        await this.refreshAcademicSubjects();
        return ass;
    }

    async deleteAssessment(id) {
        if (!this.academicEngine) return;
        await this.academicEngine.deleteAssessment(id);
        await this.refreshAcademicSubjects();
    }

    async deleteGrade(id) {
        if (!this.academicEngine) return;
        await this.academicEngine.deleteGrade(id);
        await this.refreshAcademicSubjects();
    }

    async saveSubjectGrade(subjectId, score) {
        if (!this.academicEngine) return;
        const assessments = (await this.academicEngine.getAssessments()).filter(a => a.subjectId === subjectId);
        let targetAss = assessments[0];
        if (!targetAss) {
            targetAss = await this.saveAssessment({
                subjectId,
                title: "Note globale",
                type: "Examen",
                weight: 1.0,
                maxScore: 20
            });
        }
        return await this.saveAssessmentGrade({
            assessmentId: targetAss.id,
            score: typeof score === 'number' ? score : parseFloat(score),
            isFinal: true
        });
    }

    async deleteSubjectGrade(subjectId) {
        if (!this.academicEngine) return;
        const assessments = (await this.academicEngine.getAssessments()).filter(a => a.subjectId === subjectId);
        const grades = await this.academicEngine.getGrades();
        for (const ass of assessments) {
            const assGrades = grades.filter(g => g.assessmentId === ass.id);
            for (const g of assGrades) {
                await this.academicEngine.deleteGrade(g.id);
            }
        }
        await this.refreshAcademicSubjects();
    }

    /**
     * Sauvegarde complète : toutes les clés du stockage (planning, académique, bilans, chat…).
     * La vue Portfolio ne lit plus le stockage elle-même.
     */
    async exportAllData() {
        const storage = this.storage;
        const dbKeys = typeof storage.getAllKeys === 'function'
            ? await storage.getAllKeys()
            : ['study_history', 'user_profile', 'daily_checkins', 'events', 'availabilities', 'academic_schedule',
               'acad_years', 'acad_semesters', 'acad_subjects', 'acad_assessments', 'acad_grades',
               'projects', 'user_habits', 'user_skills', 'chat_history', 'weekly_reviews'];
        const exportData = { _meta: { app: 'coach_procrastination', format: 1, exportedAt: new Date().toISOString() } };
        for (const key of dbKeys) {
            const value = await storage.loadData(key);
            if (value !== null && value !== undefined) exportData[key] = value;
        }
        return exportData;
    }

    /**
     * Restaure une sauvegarde après validation minimale (objet JSON, clés simples, au moins une donnée connue).
     * Lève Error('format') si le fichier n'est pas une sauvegarde de l'app. Retourne le nombre de clés écrites.
     */
    async importAllData(importedData) {
        if (!importedData || typeof importedData !== 'object' || Array.isArray(importedData)) {
            throw new Error('format');
        }
        // Éliminer les clés de métadonnées et toute tentative d'injection de prototype de premier niveau
        const keys = Object.keys(importedData).filter(k => k !== '_meta' && k !== '__proto__' && k !== 'constructor' && k !== 'prototype');
        const knownKeys = ['study_history', 'user_profile', 'daily_checkins', 'events', 'availabilities', 'acad_subjects', 'acad_assessments', 'acad_grades', 'chat_history'];
        if (keys.length === 0 || !keys.some(k => knownKeys.includes(k)) || keys.some(k => !/^[A-Za-z0-9_\-]+$/.test(k))) {
            throw new Error('format');
        }
        for (const key of keys) {
            // Nettoyage récursif en profondeur contre la Prototype Pollution
            const cleanData = deepSanitizeObject(importedData[key]);
            await this.storage.saveData(key, cleanData);
        }
        // Sauvegarde antérieure au cursus officiel actuel (matières sans année à jour) : on réaligne les
        // métadonnées officielles des matières (CECT, intitulés, enseignants) sans toucher aux notes ni aux liens.
        const importedYear = Array.isArray(importedData.acad_years) ? importedData.acad_years.find(y => y && y.id === CURRICULUM_YEAR.id) : null;
        if (keys.includes('acad_subjects') && !(importedYear && Number(importedYear.seedVersion) >= CURRICULUM_SEED_VERSION)) {
            try {
                await new AcademicSeeder(this.academicEngine).migrate({ force: true });
            } catch (e) {
                AppLogger.error("Migration du cursus après import impossible: " + e.message);
            }
        }
        return keys.length;
    }

    async refreshCalendarData() {
        // Charge toutes les données brutes pour le CalendarView (pas optimal pour 1000 events, mais ok pour la V1)
        this.state.calendarData.events = await this.planningEngine.getEvents();
        this.state.calendarData.availabilities = await this.planningEngine.getAvailabilityWindows();
        
        this.state.calendarData.subjects = await this.storage.loadData('acad_subjects') || [];
        this.state.calendarData.assessments = await this.storage.loadData('acad_assessments') || [];
        this.state.calendarData.projects = await this.storage.loadData('projects') || [];
    }

    async getConflictsForDate(date) {
        return await this.planningEngine.detectConflicts(date);
    }

    async getAvailableSlots(date) {
        return await this.planningEngine.getAvailableSlots(date);
    }
    
    openEventEditor(data = {}) {
        if (!this.eventModal) {
            this.eventModal = new EventModal(this);
        }
        this.eventModal.open(data);
    }

    // --- RELAIS CRUD CALENDRIER / PLANNING SANS IA ---
    async saveCalendarEvent(eventData) {
        const rep = eventData.repetition || 'none';
        let repeatCount = 1;
        let dayStep = 0;
        if (rep === 'daily') {
            repeatCount = 7;
            dayStep = 1;
        } else if (rep === 'weekly') {
            repeatCount = 4;
            dayStep = 7;
        } else if (rep === 'weekly_8') {
            repeatCount = 8;
            dayStep = 7;
        }

        const baseDate = parseLocalDate(eventData.date);

        for (let i = 0; i < repeatCount; i++) {
            const curDate = new Date(baseDate);
            if (dayStep > 0 && i > 0) {
                curDate.setDate(baseDate.getDate() + (i * dayStep));
            }
            const dateStr = curDate.toLocaleDateString('fr-CA');
            const curId = (i === 0 && eventData.id) ? eventData.id : `evt_man_${Date.now()}_${i}_${Math.random().toString(36).substring(2, 6)}`;

            const ev = new Event({
                ...eventData,
                id: curId,
                date: dateStr,
                source: eventData.source || 'manual'
            });
            await this.planningEngine.saveEvent(ev);
        }

        await this.refreshCalendarData();
        const targetView = (this.state && this.state.currentView === 'planning') ? 'planning' : 'calendar';
        if (typeof this.renderView === 'function') {
            await this.renderView(targetView);
        }
    }

    async deleteCalendarEvent(eventId) {
        await this.planningEngine.deleteEvent(eventId);
        await this.refreshCalendarData();
        const targetView = (this.state && this.state.currentView === 'planning') ? 'planning' : 'calendar';
        if (typeof this.renderView === 'function') {
            await this.renderView(targetView);
        }
    }

    async saveCalendarAvailability(windowData) {
        await this.planningEngine.saveAvailabilityWindow(windowData);
        await this.refreshCalendarData();
        await this.renderView('calendar');
    }

    async deleteCalendarAvailability(windowId) {
        await this.planningEngine.deleteAvailabilityWindow(windowId);
        await this.refreshCalendarData();
        await this.renderView('calendar');
    }

    setupNavigation() {
        // Obsolete (bottom-nav was removed)
    }
    
    /**
     * Chemin de navigation unique (barres latérales, boutons) : rafraîchit l'état puis affiche la vue.
     * @param {string} viewName
     * @param {Object} options - { refresh: false } pour un simple réaffichage (ex: chat pendant l'envoi)
     */
    async renderView(viewName, options = {}) {
        if (this.presenceEngine) {
            await this.presenceEngine.logScreenView(viewName);
        }

        if (options.refresh !== false) {
            await this.refreshUserStats();
        }
        
        if (viewName === 'chat' && options.refresh !== false) {
            try { await this.syncProactiveCoachMessages(); } catch (e) { AppLogger.error("Messages du coach: " + e.message); }
        }

        if (viewName === 'weekly') {
            const dToday = new Date();
            const endDate = this.getPedagogicalDate(dToday);
            const dStart = new Date(dToday);
            dStart.setDate(dStart.getDate() - 6);
            const startDate = this.getPedagogicalDate(dStart);
            this.state.weeklySummary = await this.getWeeklyReport(startDate, endDate);
        }
        
        this.state.currentView = viewName;

        // THEME MANAGEMENT
        if (typeof document !== 'undefined' && document.body && document.body.classList) {
            document.body.className = '';
            if (viewName === 'desktop') {
                document.body.classList.add('theme-cyber');
            } else if (viewName === 'academic') {
                document.body.classList.add('theme-light');
            } else if (viewName === 'life') {
                document.body.classList.add('theme-warm');
            } else if (viewName === 'planning') {
                document.body.classList.add('theme-teal');
            } else if (viewName === 'calendar') {
                document.body.classList.add('theme-glass');
            } else {
                document.body.classList.add('theme-cyber'); // Default fallback
            }
        }
        
        await this.router.render(viewName, this.state);
    }

    async startFocusSession(eventOrSession) {
        if (!eventOrSession) {
            this.state.activeFocusSession = null;
            return await this.renderView('focus');
        }
        const duration = eventOrSession.duration || eventOrSession.durationMinutes || eventOrSession.expectedDuration || 45;
        const session = {
            id: eventOrSession.id || ('focus-' + Date.now()),
            title: eventOrSession.title || eventOrSession.type || 'Session d\'étude',
            objective: eventOrSession.objective || eventOrSession.description || eventOrSession.skillLabel || eventOrSession.title || '',
            expectedResult: eventOrSession.expectedResult || '',
            expectedDuration: duration,
            difficulty: eventOrSession.difficulty || '🟢',
            resourceLink: eventOrSession.resourceLink || eventOrSession.url || ''
        };
        this.state.activeFocusSession = session;
        return await this.renderView('focus', session);
    }
    
    async markSessionCompleted(sessionId, metrics = { status: 'completed' }, redirectView = null) {
        try {
            this.state.activeFocusSession = null;
            const session = this.state.dailyPlan && this.state.dailyPlan.sessions ? this.state.dailyPlan.sessions.find(s => s.id === sessionId) : null;
            if (session) {
                if (!session.completed) {
                    session.completed = true;
                    await this.studyRecordEngine.completeSession(session, metrics, this.state.dailyPlan?.date);
                } else {
                    session.completed = false;
                    const planDate = this.state.dailyPlan?.date || this.getPedagogicalDate();
                    await this.studyRecordEngine.uncompleteSession(sessionId, planDate);
                }
                await this.refreshUserStats();
                this.renderView(redirectView || this.state.currentView);
            }
        } catch (e) {
            alert("Erreur JS (Session): " + e.message);
        }
    }

    async submitCheckIn(data) {
        try {
            await this.checkInEngine.saveCheckIn(data);
            AppLogger.info("Daily Check-in sauvegardé avec succès.");
            await this.refreshUserStats();
            this.renderView('bilan');
        } catch (e) {
            AppLogger.error("Erreur lors de la sauvegarde du Check-in : " + e.message);
            alert("Erreur Check-in : " + e.message);
        }
    }

    async getWeeklyReport(startDate, endDate) {
        if (!this.weeklyReviewEngine) {
            AppLogger.error("WeeklyReviewEngine n'est pas initialisé");
            return null;
        }
        return await this.weeklyReviewEngine.buildWeeklySummary(startDate, endDate);
    }

    async addXP(amount) {
        AppLogger.info(`Shift day by ${amount}`);
        this.currentDayIndex = await this.scheduler.shiftDayIndex(amount);
        const localDate = this.getPedagogicalDate(); // Note: date string remains today, but dayIndex dictates the content
        
        const plan = await this.scheduler.generateDailyPlan(localDate);
        const history = await this.storage.loadData('study_history') || [];
        const completedIds = history.filter(r => r.date === localDate).map(r => r.sessionId);
        
        plan.habits.forEach(h => h.completed = completedIds.includes(h.id));
        plan.sessions.forEach(s => s.completed = completedIds.includes(s.id));
        
        this.state.dailyPlan = plan;
        this.renderView('planning');
    }
    
    async markHabitCompleted(habitId) {
        try {
            const habit = this.state.dailyPlan.habits.find(h => h.id === habitId);
            if (habit) {
                if (!habit.completed) {
                    habit.completed = true;
                    const pseudoSession = {
                        id: habit.id,
                        title: habit.title,
                        skillId: habit.skillId,
                        priority: "Normale",
                        expectedDuration: habit.minTime
                    };
                    await this.studyRecordEngine.completeSession(pseudoSession, { status: 'completed', quality: 4 });
                } else {
                    habit.completed = false;
                    const localDate = this.getPedagogicalDate();
                    await this.studyRecordEngine.uncompleteSession(habitId, localDate);
                }
                await this.refreshUserStats();
                this.renderView(this.state.currentView);
            }
        } catch (e) {
            alert("Erreur JS (Habitude): " + e.message);
        }
    }
    
    async saveProgram(programData) {
        await this.scheduler.saveFullProgram(programData);
        await this.refreshUserStats();
        const localDate = this.getPedagogicalDate();
        this.state.dailyPlan = await this.scheduler.generateDailyPlan(localDate);
        this.renderView('program');
    }
    
    async showBilan() {
        await this.refreshUserStats();
        this.renderView('bilan');
    }

    async sendChatMessage(text) {
        if (!text || text.trim() === '') return;
        
        // 1. Sauvegarde du message User
        await this.chatHistoryEngine.saveMessage({
            role: 'user',
            content: text,
            conversationId: 'default' // Pour l'instant une seule conversation
        });
        
        // On demande à la vue de se réafficher (sans recalcul) pour montrer le message de l'user
        this.renderView('chat', { refresh: false });

        // Réponse à une question du coach sur un chevauchement avec un événement flexible ?
        try {
            const pending = await this._findPendingFlexibleConflict();
            const decision = pending ? detectFlexibleConflictAnswer(text) : null;
            if (pending && decision) {
                await this.resolveFlexibleConflict(pending, decision);
                this.renderView('chat', { refresh: false });
                return;
            }
        } catch (e) {
            console.error(e);
            await this.chatHistoryEngine.saveMessage({
                role: 'assistant',
                content: "Je n'ai pas pu appliquer ta réponse : " + e.message,
                conversationId: 'default',
                metadata: { error: true }
            });
            this.renderView('chat', { refresh: false });
            return;
        }
        
        // Boucle académique par règles : note demandée par le coach, annonce d'examen, note donnée spontanément
        try {
            if (this.academicEngine && typeof this.academicEngine.getAssessments === 'function' && await this._handleAcademicChat(text)) {
                this.renderView('chat', { refresh: false });
                return;
            }
        } catch (e) {
            console.error(e);
            await this.chatHistoryEngine.saveMessage({
                role: 'assistant',
                content: "Je n'ai pas pu traiter ce message : " + e.message,
                conversationId: 'default',
                metadata: { error: true }
            });
            this.renderView('chat', { refresh: false });
            return;
        }

        // Dialogue de check-in conversationnel pas-à-pas (humeur -> énergie -> motivation)
        try {
            if (await this._handleCheckInChat(text)) {
                this.renderView('chat', { refresh: false });
                return;
            }
        } catch (e) {
            console.error(e);
            await this.chatHistoryEngine.saveMessage({
                role: 'assistant',
                content: "Erreur lors du bilan : " + e.message,
                conversationId: 'default',
                metadata: { error: true }
            });
            this.renderView('chat', { refresh: false });
            return;
        }

        // Dialogue Coach pour les Langues (une question à la fois : niveau -> objectif -> temps disponible)
        try {
            if (await this._handleLanguageChat(text)) {
                this.renderView('chat', { refresh: false });
                return;
            }
        } catch (e) {
            console.error(e);
            await this.chatHistoryEngine.saveMessage({
                role: 'assistant',
                content: "Erreur lors du suivi de langue : " + e.message,
                conversationId: 'default',
                metadata: { error: true }
            });
            this.renderView('chat', { refresh: false });
            return;
        }

        try {
            // 2. Contexte identique à celui du tableau de bord + mémoire courte de la conversation
            let chatHistory = [];
            if (this.chatHistoryEngine && typeof this.chatHistoryEngine.getRecentMessages === 'function') {
                const recent = await this.chatHistoryEngine.getRecentMessages('default', 11);
                chatHistory = recent.slice(0, -1).map(m => ({ role: m.role, content: m.content })); // sans le message courant
            }
            const coachContextData = await this.buildCoachContext({ useLLM: true, chatHistory });
            const recommendations = await this.coachEngine.getInsights(coachContextData, text);

            // Mise en cache du conseil LLM (réaffiché au rafraîchissement sans nouvel appel)
            const llmRec = (recommendations || []).find(r => r && typeof r.id === 'string' && r.id.startsWith('coach_llm_'));
            if (llmRec) this.llmAdviceCache = { rec: llmRec, date: coachContextData.currentDate };
            
            // 3. Traitement de la réponse
            if (!recommendations || recommendations.length === 0) {
                await this.chatHistoryEngine.saveMessage({
                    role: 'assistant',
                    content: "Je n'ai pas de recommandation particulière pour le moment.",
                    conversationId: 'default'
                });
            } else {
                // Les créneaux libres sont regroupés en une seule bulle (au lieu d'une bulle par créneau),
                // placée à l'endroit du premier créneau pour conserver l'ordre de priorité.
                const slotRecs = recommendations.filter(r => r.title === 'Créneau de disponibilité');
                let slotsEmitted = false;
                for (const rec of recommendations) {
                    if (rec.title === 'Créneau de disponibilité') {
                        if (slotsEmitted) continue;
                        slotsEmitted = true;
                        const lines = slotRecs.slice(0, 5).map(r => {
                            const ev = r.evidence || [];
                            const get = (k) => (ev.find(x => String(x).startsWith(k + '=')) || '').split('=')[1] || '?';
                            return `• ${get('date')} à ${get('startTime')} (${get('duration')} min)`;
                        });
                        const more = slotRecs.length > 5 ? `\n… et ${slotRecs.length - 5} autre(s).` : '';
                        await this.chatHistoryEngine.saveMessage({
                            role: 'assistant',
                            content: `Créneaux libres repérés :\n${lines.join('\n')}${more}`,
                            conversationId: 'default',
                            metadata: { intent: null }
                        });
                        continue;
                    }
                    await this.chatHistoryEngine.saveMessage({
                        role: 'assistant',
                        content: rec.message,
                        conversationId: 'default',
                        // flexibleConflict : question en attente de réponse (pas de bouton, réponse dans le chat)
                        metadata: { intent: rec.intent || null, flexibleConflict: rec.flexibleConflict || null }
                    });
                }
            }
        } catch (e) {
            console.error(e);
            await this.chatHistoryEngine.saveMessage({
                role: 'assistant',
                content: "Je n'ai pas pu analyser ta demande (" + e.message + "). Réessaie dans un instant.",
                conversationId: 'default',
                metadata: { error: true }
            });
        }
        
        // 3.5. Rappel unique du check-in en attente si la question était hors sujet
        try {
            const pendingCheckIn = await this.storage.loadData('pending_checkin_conv');
            const todayStr = this._todayStr();
            if (pendingCheckIn && pendingCheckIn.date === todayStr && pendingCheckIn.postponedDate !== todayStr) {
                const alreadyReminded = pendingCheckIn.lastRemindedDate === todayStr && pendingCheckIn.lastRemindedStep === pendingCheckIn.step;
                if (!alreadyReminded) {
                    pendingCheckIn.lastRemindedDate = todayStr;
                    pendingCheckIn.lastRemindedStep = pendingCheckIn.step;
                    await this.storage.saveData('pending_checkin_conv', pendingCheckIn);
                    
                    let reminderText = "";
                    if (pendingCheckIn.step === 'mood') {
                        reminderText = "💡 (Rappel : ton bilan du jour est en cours. Je n'ai pas bien compris ton humeur ou tu posais une autre question. Peux-tu me dire si elle est plutôt bonne, moyenne ou basse aujourd'hui, ou dis « plus tard » pour reporter ?)";
                    } else if (pendingCheckIn.step === 'energy') {
                        reminderText = "💡 (Rappel : ton bilan du jour est en cours. Je n'ai pas bien saisi ton niveau d'énergie. Te sens-tu avec une énergie haute, moyenne ou basse, ou dis-moi « plus tard » pour reporter ?)";
                    } else if (pendingCheckIn.step === 'motivation') {
                        reminderText = "💡 (Rappel : ton bilan du jour est presque terminé. Peux-tu me préciser si ta motivation est plutôt forte, moyenne ou faible, ou me dire « plus tard » pour reporter ?)";
                    } else {
                        reminderText = "💡 (Rappel : ton bilan du jour est toujours en attente. Dis-moi quand tu veux le reprendre, ou dis « plus tard » pour reporter).";
                    }

                    await this._sayCoach(reminderText, {
                        intent: null,
                        proactive: 'checkin_reminder',
                        pendingCheckInStep: pendingCheckIn.step
                    });
                }
            }
        } catch (err) {
            console.warn("Erreur rappel check-in:", err.message);
        }

        // 4. Réaffichage final
        this.renderView('chat', { refresh: false });
    }

    /**
     * Question « chevauchement avec un événement flexible » encore ouverte : portée par un message du coach
     * dans son DERNIER tour de parole (entre l'avant-dernier et le dernier message de l'utilisateur).
     * Dès que le coach a répondu à autre chose, la question n'est plus en attente.
     * @returns {Promise<Object|null>} le flexibleConflict en attente (le premier du tour s'il y en a plusieurs)
     */
    async _findPendingFlexibleConflict() {
        if (!this.chatHistoryEngine || typeof this.chatHistoryEngine.getRecentMessages !== 'function') return null;
        const recent = await this.chatHistoryEngine.getRecentMessages('default', 40);
        let i = recent.length - 1;
        if (i >= 0 && recent[i].role === 'user') i--; // le message qui vient d'être envoyé
        const turn = [];
        while (i >= 0 && recent[i].role === 'assistant') { turn.unshift(recent[i]); i--; }
        const withConflict = turn.find(m => m.metadata && m.metadata.flexibleConflict && m.metadata.flexibleConflict.intent);
        return withConflict ? withConflict.metadata.flexibleConflict : null;
    }

    _isSlotPast(constraints, now = new Date()) {
        const today = this.getPedagogicalDate(now);
        if (!constraints || !constraints.date) return true;
        if (constraints.date < today) return true;
        return constraints.date === today && constraints.startTime
            && timeToMinutes(constraints.startTime) < now.getHours() * 60 + now.getMinutes();
    }

    /**
     * Applique la décision de l'utilisateur sur un créneau qui chevauche un ou des événements flexibles,
     * et répond dans le chat.
     * @param {Object} conflict - metadata.flexibleConflict d'un message du coach
     * @param {'keep'|'move'|'replace'|'other'} decision
     */
    async resolveFlexibleConflict(conflict, decision) {
        const say = (content, metadata = {}) => this.chatHistoryEngine.saveMessage({ role: 'assistant', content, conversationId: 'default', metadata });
        const slot = conflict.intent.constraints || {};
        const flexible = conflict.overlappingFlexible || [];
        const names = flexible.map(e => `« ${e.title} »`).join(', ');

        if (decision === 'other') {
            return this._replanFlexibleConflict(conflict, "D'accord, je cherche un autre créneau.");
        }
        if (this._isSlotPast(slot)) {
            return this._replanFlexibleConflict(conflict, `Le créneau du ${slot.date} à ${slot.startTime} est déjà passé, je cherche un autre créneau.`);
        }

        let result;
        try {
            result = await this.acceptCoachSuggestion(new PlanningIntent(conflict.intent), {
                flexibleResolution: decision,
                confirmedFlexibleIds: flexible.map(e => e.id)
            });
        } catch (err) {
            const res = err.result || {};
            if (res.moveFailed) {
                const failedNames = res.moveFailed.map(e => `« ${e.title} »`).join(', ');
                return say(`Je n'ai trouvé aucun créneau libre pour déplacer ${failedNames} dans les 7 prochains jours. `
                    + flexibleConflictChoices(flexible, { allowMove: false }), { intent: null, flexibleConflict: conflict });
            }
            if (res.needsConfirmation && Array.isArray(res.overlappingFlexible)) {
                // Un autre événement flexible est apparu sur ce créneau entre-temps : on redemande
                const updated = { ...conflict, overlappingFlexible: res.overlappingFlexible };
                const candidate = { ...slot, overlappingFlexible: res.overlappingFlexible };
                return say(`Ce créneau a changé depuis ma proposition. `
                    + buildFlexibleConflictQuestion({ candidate, deadline: conflict.deadline, duration: conflict.duration || conflict.planningRequest?.duration || 60 })
                        .replace(/^Je n'ai trouvé aucun créneau totalement libre[^.]*\. /, ''),
                    { intent: null, flexibleConflict: updated });
            }
            return this._replanFlexibleConflict(conflict, `Je n'ai pas pu planifier ce créneau (${err.message}).`);
        }

        let msg = `C'est fait : « ${conflict.title} » est planifiée le ${slot.date} de ${slot.startTime} à ${slot.endTime}.`;
        if (decision === 'move' && result && Array.isArray(result.moved)) {
            msg += result.moved.map(m => ` « ${m.title} » est déplacé au ${m.to.date} de ${m.to.startTime} à ${m.to.endTime}.`).join('');
        } else if (decision === 'replace') {
            msg += ` ${names} ${flexible.length > 1 ? 'ont été retirés' : 'a été retiré'} de ton agenda.`;
        } else {
            msg += ` ${names} ${flexible.length > 1 ? 'restent' : 'reste'} en place (les deux se chevauchent).`;
        }
        return say(msg, { intent: null });
    }

    /**
     * Cherche un autre créneau pour la même demande (créneaux refusés exclus) et répond dans le chat :
     * créneau libre (bouton « Accepter »), nouvelle question, ou aucun créneau.
     */
    async _replanFlexibleConflict(conflict, prefix) {
        const slot = conflict.intent.constraints || {};
        const excludedSlots = (conflict.excludedSlots || []).concat([{ date: slot.date, startTime: slot.startTime, endTime: slot.endTime }]);
        const data = await this.buildCoachContext({ useLLM: false });
        const planning = CoachContextBuilder.build(data).planning;
        planning.excludedSlots = excludedSlots;
        const rec = {
            id: `coach_replan_${Date.now()}`,
            type: 'SUGGESTION',
            title: conflict.title || 'Session',
            message: prefix,
            evidence: [],
            actionable: true,
            planningRequest: conflict.planningRequest
        };
        const [planned] = await this.coachEngine.planningAI.plan([rec], planning);
        return this.chatHistoryEngine.saveMessage({
            role: 'assistant',
            content: planned.message,
            conversationId: 'default',
            metadata: { intent: planned.intent || null, flexibleConflict: planned.flexibleConflict || null }
        });
    }

    /**
     * Gère la conversation étape par étape du Check-in quotidien :
     * 1. Humeur (d'abord)
     * 2. Énergie (après reformulation de l'humeur)
     * 3. Motivation (après reformulation de l'énergie)
     * Si l'une des valeurs n'est pas comprise, la redemande sans enregistrer de fausse donnée par défaut.
     */
    async _handleCheckInChat(text) {
        if (!text) return false;
        const today = this._todayStr();
        const pending = await this.storage.loadData('pending_checkin_conv');
        const trimmed = text.trim();

        const isTrigger = /\b(faire\s+(mon\s+)?(check-?in|bilan)|daily\s+check-?in|bilan\s+du\s+jour|check-?in|mon\s+bilan|faire\s+le\s+bilan|reprendre\s+(le\s+)?bilan)\b/i.test(trimmed);
        const isPostpone = /\b(plus\s+tard|passer|reporter|reporte|pas\s+maintenant|snooze|later|skip)\b/i.test(trimmed);

        // 1. Déclenchement manuel ou explicite par l'utilisatrice
        if (!pending || pending.date !== today) {
            if (isTrigger) {
                await this.storage.saveData('pending_checkin_conv', { step: 'mood', date: today, data: {} });
                await this._sayCoach("Bonjour ! Faisons ton bilan du jour ensemble. Pour commencer, quelle est ton humeur aujourd'hui (bonne, moyenne, morose...) ?", {
                    intent: null,
                    proactive: 'checkin',
                    pendingCheckInStep: 'mood'
                });
                return true;
            }
            return false;
        }

        // 2. Report explicite par l'utilisatrice ("plus tard", "passer", etc.)
        if (isPostpone) {
            pending.postponedDate = today;
            await this.storage.saveData('pending_checkin_conv', pending);
            await this._sayCoach("C'est bien noté, on reportera ton bilan à plus tard. Dis-moi « faire mon bilan » quand tu souhaiteras le reprendre !", {
                intent: null,
                proactive: 'checkin_postponed'
            });
            return true;
        }

        // 3. Reprise explicite si déjà en cours ou reporté
        if (isTrigger) {
            pending.postponedDate = null;
            await this.storage.saveData('pending_checkin_conv', pending);
            if (pending.step === 'energy') {
                await this._sayCoach("Reprenons ton bilan ! Ton humeur est déjà enregistrée. Côté énergie, comment te sens-tu (haute, moyenne, basse) ?", {
                    intent: null,
                    proactive: 'checkin',
                    pendingCheckInStep: 'energy'
                });
                return true;
            } else if (pending.step === 'motivation') {
                await this._sayCoach("Reprenons ton bilan ! Humeur et énergie sont déjà enregistrées. Quelle est ta motivation aujourd'hui (forte, moyenne, faible) ?", {
                    intent: null,
                    proactive: 'checkin',
                    pendingCheckInStep: 'motivation'
                });
                return true;
            } else {
                await this._sayCoach("Reprenons ton bilan ! Quelle est ton humeur aujourd'hui (bonne, moyenne, morose...) ?", {
                    intent: null,
                    proactive: 'checkin',
                    pendingCheckInStep: 'mood'
                });
                return true;
            }
        }

        // 4. Étape 1 : Humeur
        if (pending.step === 'mood') {
            const parsedMood = this._parseMoodRule(trimmed);
            if (!parsedMood) {
                return false;
            }
            pending.data.mood = parsedMood;
            pending.step = 'energy';
            await this.storage.saveData('pending_checkin_conv', pending);

            const moodReformulations = {
                high: "Super, content d'apprendre que tu es de bonne humeur !",
                medium: "D'accord, une humeur posée et tranquille.",
                low: "Je comprends, prends soin de toi aujourd'hui."
            };
            const reform = moodReformulations[parsedMood] || "C'est bien noté pour ton humeur.";
            await this._sayCoach(`${reform} Et côté énergie, comment te sens-tu (haute, moyenne, basse) ?`, {
                intent: null,
                proactive: 'checkin',
                pendingCheckInStep: 'energy'
            });
            return true;
        }

        // 5. Étape 2 : Énergie
        if (pending.step === 'energy') {
            const parsedEnergy = this._parseEnergyRule(trimmed);
            if (!parsedEnergy) {
                return false;
            }
            pending.data.energy = parsedEnergy;
            pending.step = 'motivation';
            await this.storage.saveData('pending_checkin_conv', pending);

            const energyReformulations = {
                high: "Plein d'énergie, c'est idéal pour avancer !",
                medium: "Énergie moyenne, c'est stable pour travailler à ton rythme.",
                low: "Énergie basse, pense à ménager tes efforts."
            };
            const reform = energyReformulations[parsedEnergy] || "C'est bien noté pour ton énergie.";
            await this._sayCoach(`${reform} Pour terminer, quelle est ta motivation pour travailler aujourd'hui (forte, moyenne, faible) ?`, {
                intent: null,
                proactive: 'checkin',
                pendingCheckInStep: 'motivation'
            });
            return true;
        }

        // 6. Étape 3 : Motivation & Enregistrement du Check-in authentique
        if (pending.step === 'motivation') {
            const parsedMotivation = this._parseMotivationRule(trimmed);
            if (!parsedMotivation) {
                return false;
            }
            pending.data.motivation = parsedMotivation;

            const checkInData = {
                date: today,
                mood: pending.data.mood,
                energy: pending.data.energy,
                motivation: parsedMotivation
            };

            if (this.checkInEngine && typeof this.checkInEngine.saveCheckIn === 'function') {
                await this.checkInEngine.saveCheckIn(checkInData);
            } else {
                const checkins = await this.storage.loadData('daily_checkins') || {};
                checkins[today] = checkInData;
                await this.storage.saveData('daily_checkins', checkins);
            }
            await this.storage.saveData('pending_checkin_conv', null);

            const labels = {
                high: { mood: 'bonne', energy: 'haute', motivation: 'forte' },
                medium: { mood: 'moyenne', energy: 'moyenne', motivation: 'moyenne' },
                low: { mood: 'morose', energy: 'basse', motivation: 'faible' }
            };
            const lM = labels[checkInData.mood]?.mood || checkInData.mood;
            const lE = labels[checkInData.energy]?.energy || checkInData.energy;
            const lMo = labels[checkInData.motivation]?.motivation || checkInData.motivation;

            await this._sayCoach(`Parfait, c'est bien noté ! Ton bilan du jour est enregistré : humeur ${lM}, énergie ${lE}, motivation ${lMo}. Belle journée de travail !`, {
                intent: null,
                proactive: 'checkin_saved',
                checkIn: checkInData
            });
            if (typeof this.refreshUserStats === 'function') {
                try {
                    await this.refreshUserStats();
                } catch (e) {
                    console.warn("refreshUserStats warning after check-in:", e.message);
                }
            }
            return true;
        }

        return false;
    }

    async _handleLanguageChat(text) {
        if (!text) return false;
        const trimmed = text.trim();
        const pending = await this.storage.loadData('pending_lang_conv');

        // 1. Déclenchement
        if (!pending) {
            const isLangTrigger = /\b(apprendre\s+(une\s+)?langue|plan\s+de\s+langue|coach\s+langue|travailler\s+(l'|mon\s+)?(anglais|espagnol|allemand|italien|japonais|langue)|ameliorer\s+(l'|mon\s+)?(anglais|espagnol|allemand|italien|japonais)|apprendre\s+(l'|le\s+)?(anglais|espagnol|allemand|italien|japonais)|pratiquer\s+(l'|mon\s+)?(anglais|espagnol|allemand|italien|japonais|langue))\b/i.test(trimmed);
            if (!isLangTrigger) return false;

            let detectedLang = null;
            if (/anglais|english/i.test(trimmed)) detectedLang = 'Anglais';
            else if (/espagnol|spanish/i.test(trimmed)) detectedLang = 'Espagnol';
            else if (/allemand|german/i.test(trimmed)) detectedLang = 'Allemand';
            else if (/italien|italian/i.test(trimmed)) detectedLang = 'Italien';
            else if (/japonais|japanese/i.test(trimmed)) detectedLang = 'Japonais';

            const newPending = {
                step: 'level',
                langName: detectedLang,
                data: {}
            };
            await this.storage.saveData('pending_lang_conv', newPending);

            const question = detectedLang 
                ? `Excellente initiative de pratiquer l'${detectedLang} ! Quel est ton niveau actuel (A1, A2, B1, B2, C1, C2...) ?`
                : `Excellente initiative ! Quelle langue souhaites-tu travailler et quel est ton niveau actuel (par exemple : Anglais B1, Espagnol A2...) ?`;

            await this._sayCoach(question, { intent: null, proactive: 'language_coach', pendingLangStep: 'level' });
            return true;
        }

        // 2. Étape 1 : Niveau
        if (pending.step === 'level') {
            let level = null;
            const levelMatch = trimmed.match(/\b(A1|A2|B1|B2|C1|C2|debutant(e)?|intermediaire|avance(e)?)\b/i);
            if (levelMatch) {
                level = levelMatch[1].toUpperCase();
            } else if (trimmed.length <= 15) {
                level = trimmed;
            }

            let langName = pending.langName;
            if (!langName) {
                if (/anglais|english/i.test(trimmed)) langName = 'Anglais';
                else if (/espagnol|spanish/i.test(trimmed)) langName = 'Espagnol';
                else if (/allemand|german/i.test(trimmed)) langName = 'Allemand';
                else if (/italien|italian/i.test(trimmed)) langName = 'Italien';
                else if (/japonais|japanese/i.test(trimmed)) langName = 'Japonais';
                else {
                    const words = trimmed.split(/\s+/);
                    if (words.length > 0 && !levelMatch) langName = words[0];
                }
            }
            if (!langName) langName = 'Anglais';

            if (!level) {
                await this._sayCoach(`Je n'ai pas bien compris ton niveau pour ${langName}. Peux-tu me préciser ton niveau (A1, A2, B1, B2, C1, C2 ou débutant/intermédiaire) ?`, {
                    intent: null,
                    proactive: 'language_coach',
                    pendingLangStep: 'level'
                });
                return true;
            }

            pending.langName = langName;
            pending.data.level = level;
            pending.step = 'goal';
            await this.storage.saveData('pending_lang_conv', pending);

            await this._sayCoach(`C'est bien noté : ${langName} au niveau ${level}. Quel est ton objectif principal avec cette langue (ex: certification TOEIC, voyage, fluidité pro, aisance orale...) ?`, {
                intent: null,
                proactive: 'language_coach',
                pendingLangStep: 'goal'
            });
            return true;
        }

        // 3. Étape 2 : Objectif
        if (pending.step === 'goal') {
            const goal = trimmed;
            if (!goal || goal.length < 2) {
                await this._sayCoach(`Peux-tu me décrire brièvement ton objectif (par exemple : être à l'aise en réunion, passer le C1, voyager...) ?`, {
                    intent: null,
                    proactive: 'language_coach',
                    pendingLangStep: 'goal'
                });
                return true;
            }

            pending.data.goal = goal;
            pending.step = 'time';
            await this.storage.saveData('pending_lang_conv', pending);

            await this._sayCoach(`Super objectif ! Pour terminer la mise en place, quel est ton temps disponible par semaine pour ${pending.langName} (par exemple : 3 séances de 30 minutes, ou 2 heures par semaine) ?`, {
                intent: null,
                proactive: 'language_coach',
                pendingLangStep: 'time'
            });
            return true;
        }

        // 4. Étape 3 : Temps disponible & Sauvegarde
        if (pending.step === 'time') {
            let sessions = 3;
            let duration = 30;

            const sessionsMatch = trimmed.match(/(\d+)\s*(seance|fois|session)/i);
            if (sessionsMatch) sessions = parseInt(sessionsMatch[1], 10);

            const durationMatch = trimmed.match(/(\d+)\s*(min|minute|h|heure)/i);
            if (durationMatch) {
                const val = parseInt(durationMatch[1], 10);
                if (/h|heure/i.test(durationMatch[2])) duration = val * 60;
                else duration = val;
            } else {
                const numMatch = trimmed.match(/(\d+)/);
                if (numMatch && parseInt(numMatch[1], 10) >= 15 && parseInt(numMatch[1], 10) <= 120) {
                    duration = parseInt(numMatch[1], 10);
                }
            }

            pending.data.sessionsPerWeek = sessions;
            pending.data.duration = duration;

            let savedLang = null;
            if (this.languageEngine) {
                const existingList = await this.languageEngine.getLanguages();
                const existing = existingList.find(l => l.name.toLowerCase() === pending.langName.toLowerCase());
                savedLang = await this.languageEngine.saveLanguage({
                    id: existing?.id,
                    name: pending.langName,
                    level: pending.data.level,
                    goal: pending.data.goal,
                    plan: {
                        sessionsPerWeek: sessions,
                        duration: duration,
                        preferredDays: existing?.plan?.preferredDays || ['monday', 'wednesday', 'friday']
                    }
                });

                if (this.planningEngine) {
                    await this.languageEngine.generatePlanningSessions(savedLang.id, this.planningEngine);
                }
            }

            await this.storage.saveData('pending_lang_conv', null);

            await this._sayCoach(`Félicitations ! Ton plan d'apprentissage pour ${pending.langName} est prêt :\n• Niveau : ${pending.data.level}\n• Objectif : ${pending.data.goal}\n• Rythme : ${sessions} séances de ${duration} min par semaine.\nTes créneaux ont été intégrés à ton planning et ton espace Langues est à jour !`, {
                intent: null,
                proactive: 'language_coach_complete',
                language: savedLang
            });

            if (typeof this.refreshUserStats === 'function') {
                try { await this.refreshUserStats(); } catch(e) {}
            }
            return true;
        }

        return false;
    }

    _parseMoodRule(text) {
        if (!text) return null;
        const norm = text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
        if (/\b(pas\s+(bien|terrible|top)|mauvais(e)?|mal|triste|deprime(e)?|morose|anxieu(x|se)|stresse(e)?|demotive(e)?|bof|baisse|difficile|dur(e)?|nul(le)?|baisse)\b/.test(norm)) {
            return 'low';
        }
        if (/\b(top|super|tres\s+bon(ne)?|excellente?|bonne?|joyeu(x|se)|en\s+forme|heureu(x|se)|content(e)?|positif|positive|cool|genial(e)?|high|good|parfaite?|ravie?|bien)\b/.test(norm)) {
            return 'high';
        }
        if (/\b(moyen(ne)?|correct(e)?|ca\s+va|neutre|normal(e)?|medium|ok|passable|comme\s+ci\s+comme\s+ca|tranquille|ordinaire)\b/.test(norm)) {
            return 'medium';
        }
        return null;
    }

    _parseEnergyRule(text) {
        if (!text) return null;
        const norm = text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
        if (/\b(basse|faible|fatigue(e)?|epuise(e)?|hs|ko|creve(e)?|low|peu|nulle?|a\s+plat|vide(e)?|pas\s+d['’]?energie|zero)\b/.test(norm)) {
            return 'low';
        }
        if (/\b(haute|plein(e)?|beaucoup|au\s+max|au\s+top|tres\s+haute|100%|high|forte|booste(e)?|tonique|debordante?|parfaite?|max)\b/.test(norm)) {
            return 'high';
        }
        if (/\b(moyen(ne)?|correcte?|normale?|ca\s+va|medium|moderee?|standard|stable|suffisante?|ok)\b/.test(norm)) {
            return 'medium';
        }
        return null;
    }

    _parseMotivationRule(text) {
        if (!text) return null;
        const norm = text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
        if (/\b(faible|aucune|pas\s+motive(e)?|zero|low|demotive(e)?|flemm(e|ard(e)?)|nulle?|difficile|pas\s+envie|bof)\b/.test(norm)) {
            return 'low';
        }
        if (/\b(forte|tres\s+motive(e)?|a\s+fond|pret(e)?|haute|high|top|determine(e)?|chaud(e)?|booste(e)?|tres\s+forte|max)\b/.test(norm)) {
            return 'high';
        }
        if (/\b(moyen(ne)?|moderee?|ca\s+va|medium|normal(e)?|un\s+peu|correcte?|ok)\b/.test(norm)) {
            return 'medium';
        }
        return null;
    }
}
