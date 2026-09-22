import { DashboardView } from '../ui/DashboardView.js?v=99';
import { DesktopView } from '../ui/DesktopView.js?v=99';
import { CalendarView } from '../ui/CalendarView.js?v=99';
import { AcademicView } from '../ui/AcademicView.js?v=99';
import { PlanningView } from '../ui/PlanningView.js?v=99';
import { FocusView } from '../ui/FocusView.js?v=10';
import { BilanView } from '../ui/BilanView.js?v=4';
import { PortfolioView } from '../ui/PortfolioView.js?v=5';
import { ProgramView } from '../ui/ProgramView.js?v=6';
import { AgentView } from '../ui/AgentView.js';
import { WeeklyView } from '../ui/WeeklyView.js';
import { CoachChatView } from '../ui/CoachChatView.js';
import { LifeView } from '../ui/LifeView.js?v=99';
import { LanguageView } from '../ui/LanguageView.js?v=99';

export class Router {
    constructor(containerId, app) {
        this.app = app;
        this.views = {
            desktop: new DesktopView(containerId, app),
            calendar: new CalendarView(containerId, app),
            academic: new AcademicView(containerId, app),
            life: new LifeView(containerId, app),
            languages: new LanguageView(containerId, app),
            coach: new DashboardView(containerId, app),
            planning: new PlanningView(containerId, app),
            focus: new FocusView(containerId, app),
            bilan: new BilanView(containerId, app),
            portfolio: new PortfolioView(containerId, app),
            program: new ProgramView(containerId, app),
            agent: new AgentView(containerId, app),
            weekly: new WeeklyView(containerId, app),
            chat: new CoachChatView(containerId, app)
        };
    }

    render(viewName, state) {
        const view = this.views[viewName];
        if (view) {
            let data = state;
            if (viewName === 'planning') data = state.dailyPlan;
            if (viewName === 'focus') {
                data = state.dailyPlan.sessions.find(s => !s.completed) || null;
            }
            if (viewName === 'bilan') data = { summary: state.dailySummary, checkIn: state.todayCheckIn, stats: state.dailyStats };
            if (viewName === 'portfolio') data = state;
            if (viewName === 'program') data = state.fullProgram;
            if (viewName === 'desktop') data = state;
            if (viewName === 'calendar') data = state;
            if (viewName === 'academic') data = state;
            if (viewName === 'weekly') data = state.weeklySummary;
            if (viewName === 'chat') {
                // Fetch chat history asynchronously inside the router
                this.app.chatHistoryEngine.getConversation('default').then(messages => {
                    view.render(messages);
                });
                return; // Render is done asynchronously
            }
            
            view.render(data);
        } else {
            console.error(`View ${viewName} not found`);
        }
    }
}
