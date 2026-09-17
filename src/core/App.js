import { Router } from './Router.js?v=9';
import { AppLogger } from '../utils/AppLogger.js';
import { LearningGraphEngine } from '../engines/LearningGraphEngine.js?v=2';
import { ReflectionEngine } from '../engines/ReflectionEngine.js';
import { AcademicEngine } from '../engines/AcademicEngine.js';
import { PlanningEngine } from '../engines/PlanningEngine.js';
import { PlanningIntelligence } from '../engines/PlanningIntelligence.js';
import { CoachOrchestrator } from '../ai/CoachOrchestrator.js';
import { KnowledgeEngine } from '../engines/KnowledgeEngine.js';
import { KnowledgeRetriever } from '../engines/KnowledgeRetriever.js';

export class App {
    constructor(storage, scheduler, xpEngine, studyRecordEngine, checkInEngine, aiEngine, weeklyReviewEngine, chatHistoryEngine) {
        this.storage = storage;
        this.scheduler = scheduler;
        this.xpEngine = xpEngine;
        this.studyRecordEngine = studyRecordEngine;
        this.checkInEngine = checkInEngine;
        this.weeklyReviewEngine = weeklyReviewEngine;
        this.chatHistoryEngine = chatHistoryEngine;
        this.aiEngine = aiEngine;
        this.learningGraphEngine = new LearningGraphEngine(storage);
        this.reflectionEngine = new ReflectionEngine(storage);
        this.academicEngine = new AcademicEngine(storage);
        this.planningEngine = new PlanningEngine(storage);
        if (this.checkInEngine) this.checkInEngine.planningEngine = this.planningEngine;
        if (this.weeklyReviewEngine) this.weeklyReviewEngine.planningEngine = this.planningEngine;
        
        this.planningIntelligence = new PlanningIntelligence(this.planningEngine);
        this.knowledgeEngine = new KnowledgeEngine(storage);
        this.knowledgeRetriever = new KnowledgeRetriever(this.knowledgeEngine);
        this.coachEngine = new CoachOrchestrator(this.planningIntelligence, this.knowledgeRetriever);
        
        this.state = {
            currentView: 'desktop',
            dailyPlan: { habits: [], sessions: [] },
            dailyStats: null,
            dailySummary: null,
            todayCheckIn: null,
            userProfile: null,
            currentJournal: null,
            yesterdayJournal: null,
            fullHistory: [],
            analytics: null,
            systemHealth: null,
            coachInsights: null,
            learningGraph: null,
            reflections: null,
            monthlyReport: null,
            allJournals: {},
            fullProgram: [],
            academicSummary: null,
            todayEvents: [],
            calendarData: {
                events: [],
                availabilities: [],
                conflicts: []
            }
        };
        this.router = new Router('app-root', this);
    }
    
    async start() {
        AppLogger.info("Lancement de l'application (start)");
        document.getElementById('app-root').innerHTML = '<p style="text-align:center;">Génération du planning... (Etape 1)</p>';
        document.getElementById('bottom-nav').style.display = 'flex';
        this.setupNavigation();
        
        const localDate = new Date().toLocaleDateString('fr-CA');
        
        this.currentDayIndex = await this.scheduler.getDayIndex(localDate);
        
        const plan = await this.scheduler.generateDailyPlan(localDate);
        document.getElementById('app-root').innerHTML = '<p style="text-align:center;">Génération du planning... (Etape 2)</p>';
        
        const history = await this.storage.loadData('study_history') || [];
        const completedIds = history.filter(r => r.date === localDate).map(r => r.sessionId);
        
        plan.habits.forEach(h => h.completed = completedIds.includes(h.id));
        plan.sessions.forEach(s => s.completed = completedIds.includes(s.id));
        
        this.state.dailyPlan = plan;
        document.getElementById('app-root').innerHTML = '<p style="text-align:center;">Génération du planning... (Etape 3)</p>';
        await this.refreshUserStats();
        
        document.getElementById('app-root').innerHTML = '<p style="text-align:center;">Génération du planning... (Etape 4)</p>';
        this.renderView('desktop');
    }
    
    async refreshUserStats() {
        const dToday = new Date();
        const localDate = dToday.toLocaleDateString('fr-CA');
        let dYesterday = new Date();
        dYesterday.setDate(dYesterday.getDate() - 1);
        const yesterdayDate = dYesterday.toLocaleDateString('fr-CA');

        this.state.dailyStats = await this.studyRecordEngine.getDailyStats(localDate);
        this.state.dailySummary = await this.checkInEngine.buildDailySummary(localDate);
        this.state.todayCheckIn = await this.checkInEngine.getCheckIn(localDate);
        
        const loadedProfile = await this.storage.loadData('user_profile');
        this.state.userProfile = loadedProfile || { 
            streak: 1, 
            lastActive: null,
            name: "Étudiant",
            formation: null,
            niveau: null,
            groupe: null,
            currentSemesterId: 's4' // Valeur par défaut pour l'anomalie S4 du prototype
        };
        this.state.currentJournal = await this.studyRecordEngine.getJournal(localDate);
        this.state.yesterdayJournal = await this.studyRecordEngine.getJournal(yesterdayDate);
        this.state.fullHistory = await this.studyRecordEngine.getFullHistory();
        
        // Les insights et alertes académiques seront ajoutés via CoachAI.
        // systemHealth est déprécié.
        const dTodayLocal = new Date(localDate);
        this.state.monthlyReport = await this.studyRecordEngine.getMonthlyStats(dTodayLocal.getFullYear(), dTodayLocal.getMonth());
        this.state.allJournals = await this.storage.loadData('daily_journals') || {};
        this.state.fullProgram = await this.scheduler.getFullProgram();
        
        // Données pour le Bureau (Desktop) et Espace Académique
        const semesterId = this.state.userProfile.currentSemesterId || null;
        this.state.academicSummary = semesterId ? await this.academicEngine.getSemesterSummary(semesterId, localDate) : null;

        // Construction du contexte temporel pour le Coach (J à J+5)
        const temporalEvents = [];
        const availableSlots = [];
        const conflicts = [];
        for (let i = 0; i <= 5; i++) {
            const d = new Date(dToday);
            d.setDate(d.getDate() + i);
            const dateStr = d.toLocaleDateString('fr-CA');
            
            const evs = await this.planningEngine.getEventsForDate(dateStr);
            temporalEvents.push(...evs);
            
            const slots = await this.planningEngine.getAvailableSlots(dateStr);
            slots.forEach(s => availableSlots.push({ date: dateStr, ...s }));

            const dayConflicts = await this.planningEngine.detectConflicts(dateStr);
            conflicts.push(...dayConflicts);
        }

        const coachContextData = {
            userProfile: this.state.userProfile,
            academicSummary: this.state.academicSummary,
            projects: await this.storage.loadData('projects') || [],
            temporalEvents: temporalEvents,
            availableSlots: availableSlots,
            conflicts: conflicts,
            analytics: this.state.analytics,
            currentDate: localDate
        };

        this.state.coachInsights = await this.coachEngine.getInsights(coachContextData);
        this.state.todayEvents = await this.planningEngine.getEventsForDate(localDate);
        await this.refreshCalendarData();
    }

    async acceptCoachSuggestion(intent) {
        if (!this.planningEngine || !intent) return;
        
        await this.planningEngine.executeIntent(intent);
        
        await this.refreshCalendarData();
        await this.refreshUserStats();
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
    
    // --- RELAIS CRUD CALENDRIER ---
    async saveCalendarEvent(eventData) {
        await this.planningEngine.saveEvent(eventData);
        await this.refreshCalendarData();
        await this.refreshUserStats();
        this.renderView('calendar');
    }

    async deleteCalendarEvent(eventId) {
        await this.planningEngine.deleteEvent(eventId);
        await this.refreshCalendarData();
        await this.refreshUserStats();
        this.renderView('calendar');
    }

    async saveCalendarAvailability(windowData) {
        await this.planningEngine.saveAvailabilityWindow(windowData);
        await this.refreshCalendarData();
        await this.refreshUserStats();
        this.renderView('calendar');
    }

    async deleteCalendarAvailability(windowId) {
        await this.planningEngine.deleteAvailabilityWindow(windowId);
        await this.refreshCalendarData();
        await this.refreshUserStats();
        this.renderView('calendar');
    }

    setupNavigation() {
        document.querySelectorAll('#bottom-nav button[data-view]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const viewName = e.currentTarget.getAttribute('data-view');
                this.renderView(viewName);
            });
        });
    }
    
    async renderView(viewName) {
        if (viewName === 'journal' || viewName === 'portfolio' || viewName === 'coach' || viewName === 'bilan' || viewName === 'desktop' || viewName === 'calendar' || viewName === 'academic' || viewName === 'weekly') {
            await this.refreshUserStats();
        }
        
        if (viewName === 'weekly') {
            const dToday = new Date();
            const endDate = dToday.toLocaleDateString('fr-CA');
            const dStart = new Date(dToday);
            dStart.setDate(dStart.getDate() - 6);
            const startDate = dStart.toLocaleDateString('fr-CA');
            this.state.weeklySummary = await this.getWeeklyReport(startDate, endDate);
        }
        
        this.state.currentView = viewName;
        document.querySelectorAll('#bottom-nav button[data-view]').forEach(b => b.classList.remove('active'));
        
        const activeBtn = document.querySelector(`#bottom-nav button[data-view="${viewName}"]`);
        if (activeBtn) activeBtn.classList.add('active');
        
        this.router.render(viewName, this.state);
    }
    
    async markSessionCompleted(sessionId, metrics = { status: 'completed' }, redirectView = null) {
        try {
            const session = this.state.dailyPlan.sessions.find(s => s.id === sessionId);
            if (session) {
                if (!session.completed) {
                    session.completed = true;
                    await this.studyRecordEngine.completeSession(session, metrics);
                } else {
                    session.completed = false;
                    const localDate = new Date().toLocaleDateString('fr-CA');
                    await this.studyRecordEngine.uncompleteSession(sessionId, localDate);
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
        const localDate = new Date().toLocaleDateString('fr-CA'); // Note: date string remains today, but dayIndex dictates the content
        
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
                    const localDate = new Date().toLocaleDateString('fr-CA');
                    await this.studyRecordEngine.uncompleteSession(habitId, localDate);
                }
                await this.refreshUserStats();
                this.renderView(this.state.currentView);
            }
        } catch (e) {
            alert("Erreur JS (Habitude): " + e.message);
        }
    }
    
    async saveJournal(data) {
        const localDate = new Date().toLocaleDateString('fr-CA');
        await this.studyRecordEngine.saveDailyJournal(localDate, data);
        await this.refreshUserStats();
    }
    
    async saveProgram(programData) {
        await this.scheduler.saveFullProgram(programData);
        await this.refreshUserStats();
        const localDate = new Date().toLocaleDateString('fr-CA');
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
        
        // On demande à la vue de se rafraîchir pour afficher le message de l'user
        this.renderView('chat');
        
        try {
            // 2. Appel au Coach Orchestrator
            const recommendations = await this.coachEngine.getInsights(this.state, text);
            
            // 3. Traitement de la réponse
            if (!recommendations || recommendations.length === 0) {
                await this.chatHistoryEngine.saveMessage({
                    role: 'assistant',
                    content: "Je n'ai pas de recommandation particulière pour le moment.",
                    conversationId: 'default'
                });
            } else {
                for (const rec of recommendations) {
                    await this.chatHistoryEngine.saveMessage({
                        role: 'assistant',
                        content: rec.message,
                        conversationId: 'default',
                        metadata: { intent: rec.planningRequest || null }
                    });
                }
            }
        } catch (e) {
            console.error(e);
            await this.chatHistoryEngine.saveMessage({
                role: 'assistant',
                content: "Erreur lors de l'analyse : " + e.message,
                conversationId: 'default'
            });
        }
        
        // 4. Rafraîchissement final
        this.renderView('chat');
    }
}
