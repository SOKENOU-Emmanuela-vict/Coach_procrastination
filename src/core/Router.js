import { DesktopView } from '../ui/DesktopView.js?v=101';
import { AcademicView } from '../ui/AcademicView.js?v=102';
import { PlanningView } from '../ui/PlanningView.js?v=101';
import { FocusView } from '../ui/FocusView.js?v=10';
import { BilanView } from '../ui/BilanView.js?v=4';
import { CoachChatView } from '../ui/CoachChatView.js?v=3';
import { LifeView } from '../ui/LifeView.js?v=99';
import { LanguageView } from '../ui/LanguageView.js?v=99';

export class Router {
    constructor(containerId, app) {
        this.containerId = containerId;
        this.app = app;
        this.views = {
            desktop: new DesktopView(containerId, app),
            academic: new AcademicView(containerId, app),
            life: new LifeView(containerId, app),
            languages: new LanguageView(containerId, app),
            planning: new PlanningView(containerId, app),
            focus: new FocusView(containerId, app),
            bilan: new BilanView(containerId, app),
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
        
        // Redirection des anciennes vues supprimées vers leur remplaçant ou vers le Bureau
        let resolvedViewName = viewName;
        if (viewName === 'calendar') {
            resolvedViewName = 'planning';
        }
        if (viewName === 'portfolio' || viewName === 'dashboard' || viewName === 'weekly' || viewName === 'coach') {
            resolvedViewName = 'desktop';
        }
        if (!this.views[resolvedViewName]) {
            resolvedViewName = 'desktop';
        }

        const view = this.views[resolvedViewName];
        if (view) {
            let data = state;
            if (resolvedViewName === 'planning') data = state;
            if (resolvedViewName === 'focus') {
                data = state.activeFocusSession || (state.dailyPlan && state.dailyPlan.sessions ? state.dailyPlan.sessions.find(s => !s.completed) : null) || null;
            }
            if (resolvedViewName === 'bilan') data = { summary: state.dailySummary, checkIn: state.todayCheckIn, stats: state.dailyStats };
            if (resolvedViewName === 'desktop') data = state;
            if (resolvedViewName === 'academic') data = state;
            if (resolvedViewName === 'chat') {
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
