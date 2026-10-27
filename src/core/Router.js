import { DashboardView } from '../ui/DashboardView.js?v=99';
import { DesktopView } from '../ui/DesktopView.js?v=101';
import { CalendarView } from '../ui/CalendarView.js?v=101';
import { AcademicView } from '../ui/AcademicView.js?v=102';
import { PlanningView } from '../ui/PlanningView.js?v=101';
import { FocusView } from '../ui/FocusView.js?v=10';
import { BilanView } from '../ui/BilanView.js?v=4';
import { PortfolioView } from '../ui/PortfolioView.js?v=5';
import { WeeklyView } from '../ui/WeeklyView.js';
import { CoachChatView } from '../ui/CoachChatView.js?v=3';
import { LifeView } from '../ui/LifeView.js?v=99';
import { LanguageView } from '../ui/LanguageView.js?v=99';

export class Router {
    constructor(containerId, app) {
        this.containerId = containerId;
        this.app = app;
        this.views = {
            desktop: new DesktopView(containerId, app),
            calendar: new CalendarView(containerId, app),
            academic: new AcademicView(containerId, app),
            life: new LifeView(containerId, app),
            languages: new LanguageView(containerId, app),
            coach: new DashboardView(containerId, app),
            dashboard: new DashboardView(containerId, app),
            planning: new PlanningView(containerId, app),
            focus: new FocusView(containerId, app),
            bilan: new BilanView(containerId, app),
            portfolio: new PortfolioView(containerId, app),
            weekly: new WeeklyView(containerId, app),
            chat: new CoachChatView(containerId, app)
        };
    }

    _animateViewTransition() {
        if (typeof window === 'undefined' || !window.gsap) return;
        const reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (reducedMotion) return;

        const target = document.querySelector('.bureau-content') || document.getElementById(this.containerId || 'app-root');
        if (target) {
            window.gsap.fromTo(target,
                { opacity: 0.85, y: 6 },
                { opacity: 1, y: 0, duration: 0.25, ease: 'power2.out', clearProps: 'all' }
            );
        }
    }

    async render(viewName, state) {
        if (viewName !== 'focus' && this.views.focus && this.views.focus.timerInterval) {
            clearInterval(this.views.focus.timerInterval);
        }
        
        // Nettoyage préventif des animations GSAP en cours
        if (typeof window !== 'undefined' && window.gsap) {
            const target = document.querySelector('.bureau-content') || document.getElementById(this.containerId || 'app-root');
            if (target) window.gsap.killTweensOf(target);
        }

        const renderToken = Date.now();
        this.currentRenderToken = renderToken;
        
        const view = this.views[viewName];
        if (view) {
            let data = state;
            if (viewName === 'planning') data = state;
            if (viewName === 'focus') {
                data = state.activeFocusSession || (state.dailyPlan && state.dailyPlan.sessions ? state.dailyPlan.sessions.find(s => !s.completed) : null) || null;
            }
            if (viewName === 'bilan') data = { summary: state.dailySummary, checkIn: state.todayCheckIn, stats: state.dailyStats };
            if (viewName === 'portfolio') data = state;
            if (viewName === 'desktop') data = state;
            if (viewName === 'calendar') data = state;
            if (viewName === 'academic') data = state;
            if (viewName === 'weekly') data = state.weeklySummary;
            if (viewName === 'chat') {
                // Fetch chat history asynchronously inside the router
                const messages = await this.app.chatHistoryEngine.getConversation('default');
                if (this.currentRenderToken === renderToken) {
                    await view.render(messages);
                    this._animateViewTransition();
                }
                return;
            }
            
            if (this.currentRenderToken === renderToken) {
                await view.render(data);
                this._animateViewTransition();
            }
        } else {
            console.error(`View ${viewName} not found`);
        }
    }
}
