import { DashboardView } from '../ui/DashboardView.js?v=6';
import { DesktopView } from '../ui/DesktopView.js';
import { CalendarView } from '../ui/CalendarView.js';
import { AcademicView } from '../ui/AcademicView.js';
import { PlanningView } from '../ui/PlanningView.js?v=8';
import { FocusView } from '../ui/FocusView.js?v=10';
import { BilanView } from '../ui/BilanView.js?v=4';
import { JournalView } from '../ui/JournalView.js?v=5';
import { PortfolioView } from '../ui/PortfolioView.js?v=5';
import { ProgramView } from '../ui/ProgramView.js?v=6';
import { AgentView } from '../ui/AgentView.js';

export class Router {
    constructor(containerId, app) {
        this.views = {
            desktop: new DesktopView(containerId, app),
            calendar: new CalendarView(containerId, app),
            academic: new AcademicView(containerId, app),
            coach: new DashboardView(containerId, app),
            planning: new PlanningView(containerId, app),
            focus: new FocusView(containerId, app),
            bilan: new BilanView(containerId, app),
            journal: new JournalView(containerId, app),
            portfolio: new PortfolioView(containerId, app),
            program: new ProgramView(containerId, app),
            agent: new AgentView(containerId, app)
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
            if (viewName === 'bilan') data = state.dailyStats;
            if (viewName === 'journal') data = state.currentJournal;
            if (viewName === 'portfolio') data = state;
            if (viewName === 'program') data = state.fullProgram;
            if (viewName === 'desktop') data = state;
            if (viewName === 'calendar') data = state;
            if (viewName === 'academic') data = state;
            
            view.render(data);
        } else {
            console.error(`View ${viewName} not found`);
        }
    }
}
