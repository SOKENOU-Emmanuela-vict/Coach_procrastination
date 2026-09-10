export class DesktopView {
    constructor(containerId, app) {
        this.container = document.getElementById(containerId);
        this.app = app;
    }
    
    render(state) {
        const userPrefs = state.userProfile?.preferences?.desktop || {};
        const widgets = userPrefs.widgets || {
            now: true,
            today: true,
            upcoming: true,
            academic: true,
            languages: true,
            shortcuts: true
        };
        const shortcuts = userPrefs.shortcuts || [];

        document.body.className = 'theme-desktop';

        const svgHome = `<svg viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>`;
        const svgCalendar = `<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>`;
        const svgSchool = `<svg viewBox="0 0 24 24"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>`;
        const svgCoach = `<svg viewBox="0 0 24 24"><path d="M12 2v20"></path><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>`;
        const svgSettings = `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>`;
        const svgBell = `<svg viewBox="0 0 24 24"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>`;
        const svgAdd = `<svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>`;

        let html = `
<div class="bureau">
    <aside class="bureau-sidebar">
        <div class="bureau-brand">
            <span class="bureau-brand-name">Learning OS</span>
        </div>
        <nav class="bureau-navigation">
            <button class="bureau-nav-item active" data-route="desktop">
                <span class="bureau-nav-icon">${svgHome}</span> Bureau
            </button>
            <button class="bureau-nav-item" data-route="planning">
                <span class="bureau-nav-icon">${svgCalendar}</span> Planning
            </button>
            <button class="bureau-nav-item" data-route="academic">
                <span class="bureau-nav-icon">${svgSchool}</span> School
            </button>
            <button class="bureau-nav-item" data-route="coach">
                <span class="bureau-nav-icon">${svgCoach}</span> Coach
            </button>
        </nav>
    </aside>

    <main class="bureau-content">
        <header class="bureau-topbar">
            <div class="bureau-page-label">Overview</div>
            <div class="bureau-topbar-actions">
                <button id="desktop-settings" class="bureau-icon-button" aria-label="Settings">${svgSettings}</button>
                <button class="bureau-icon-button" aria-label="Notifications">${svgBell}</button>
                <button class="bureau-profile" aria-label="Profile">
                    <div class="bureau-profile-dot"></div>
                </button>
            </div>
        </header>

        <div class="bureau-dashboard">
            <!-- PRIMARY COLUMN -->
            <div class="bureau-primary">`;

        // TODAY'S PLAN
        if (widgets.today) {
            html += `
                <section class="bureau-panel">
                    <div class="bureau-panel-heading">
                        <div>
                            <span class="bureau-kicker">TODAY</span>
                            <h2>Today's Plan</h2>
                        </div>
                    </div>
                    <div class="bureau-schedule">`;

            const events = state.todayEvents || [];
            const sessions = state.dailyPlan && state.dailyPlan.sessions ? state.dailyPlan.sessions : [];
            const sortedEvents = [...events].sort((a, b) => {
                const tA = a.startTime || '23:59';
                const tB = b.startTime || '23:59';
                return tA.localeCompare(tB);
            });

            if (sortedEvents.length === 0 && sessions.length === 0) {
                html += `<div class="bureau-empty">No events planned today.</div>`;
            } else {
                sortedEvents.forEach(e => {
                    const isFixed = e.lockStatus === 'locked';
                    const statusClass = isFixed ? 'is-fixed' : '';
                    const statusText = isFixed ? 'FIXED' : 'OPT';
                    html += `
                        <div class="bureau-schedule-row">
                            <div class="bureau-schedule-time">${e.startTime || '--:--'}</div>
                            <div class="bureau-schedule-content">
                                <div class="bureau-schedule-title">${e.title}</div>
                                <div class="bureau-schedule-meta">${e.type || 'Event'}</div>
                            </div>
                            <div class="bureau-status ${statusClass}">${statusText}</div>
                        </div>`;
                });
                sessions.forEach(s => {
                    const completedClass = s.completed ? 'is-completed' : '';
                    html += `
                        <div class="bureau-schedule-row ${completedClass}">
                            <div class="bureau-schedule-time">--:--</div>
                            <div class="bureau-schedule-content">
                                <div class="bureau-schedule-title">${s.title}</div>
                                <div class="bureau-schedule-meta">${s.expectedDuration} min</div>
                            </div>
                            <div class="bureau-status is-optimizable">OPT</div>
                        </div>`;
                });
            }
            html += `
                    </div>
                </section>`;
        }

        // TASKS / SHORTCUTS
        if (widgets.shortcuts) {
            html += `
                <section class="bureau-panel">
                    <div class="bureau-panel-heading">
                        <div>
                            <span class="bureau-kicker">QUICK ACCESS</span>
                            <h2>Shortcuts</h2>
                        </div>
                        <button id="btn-add-shortcut" class="bureau-add-button">${svgAdd}</button>
                    </div>
                    <div class="bureau-task-list">`;
            
            if (shortcuts.length === 0) {
                html += `<div class="bureau-empty">No shortcuts added.</div>`;
            } else {
                shortcuts.forEach(sc => {
                    html += `
                        <div class="bureau-task">
                            <div class="bureau-checkbox"></div>
                            <a href="${sc.url}" target="_blank">${sc.label}</a>
                        </div>`;
                });
            }
            html += `
                    </div>
                </section>`;
        }

        // LANGUAGES
        if (widgets.languages) {
            html += `
                <section class="bureau-panel">
                    <div class="bureau-panel-heading">
                        <div>
                            <span class="bureau-kicker">PROGRESS</span>
                            <h2>Languages</h2>
                        </div>
                    </div>
                    <div>`;
            
            const graph = state.learningGraph;
            if (graph && graph.nodes) {
                const engNode = graph.nodes['english_speaking'];
                const eloNode = graph.nodes['eloquence_fr'];
                
                [engNode, eloNode].forEach(node => {
                    if (node) {
                        const level = Math.floor(node.xp / 100) + 1;
                        const progress = node.xp % 100;
                        html += `
                            <div class="bureau-language">
                                <div class="bureau-language-heading">
                                    <span>${node.label}</span>
                                    <span class="bureau-language-level">LVL ${level}</span>
                                </div>
                                <div class="bureau-progress">
                                    <span class="bureau-progress-value" style="width: ${progress}%;"></span>
                                </div>
                            </div>`;
                    }
                });
            } else {
                html += `<div class="bureau-empty">Data unavailable.</div>`;
            }
            html += `
                    </div>
                </section>`;
        }

        html += `
            </div>
            
            <!-- SECONDARY COLUMN -->
            <div class="bureau-secondary">`;

        // FOCUS
        if (widgets.now) {
            const sessions = state.dailyPlan && state.dailyPlan.sessions ? state.dailyPlan.sessions : [];
            const nextSession = sessions.find(s => !s.completed);
            let focusTime = '00:00';
            let focusSession = 'No active session';
            if (nextSession) {
                focusTime = `${nextSession.expectedDuration}:00`;
                focusSession = nextSession.title;
            }

            html += `
                <section class="bureau-panel bureau-panel-focus">
                    <span class="bureau-kicker">NOW</span>
                    <div class="bureau-focus-value">${focusTime}</div>
                    <div class="bureau-focus-label">${focusSession}</div>
                </section>`;
        }

        // ACADEMIC STATISTICS
        if (widgets.academic) {
            const acad = state.academicSummary;
            let avgValue = 0;
            let avgText = "--";
            if (acad && acad.average && acad.average.status === "complete") {
                avgValue = acad.average.value;
                avgText = `${avgValue.toFixed(1)}`;
            }
            const percentage = (avgValue / 20) * 100;
            const circumference = 251.2;
            const offset = circumference - (percentage / 100) * circumference;

            html += `
                <section class="bureau-panel">
                    <div class="bureau-panel-heading">
                        <div>
                            <span class="bureau-kicker">OVERVIEW</span>
                            <h2>Academic</h2>
                        </div>
                    </div>
                    <div class="bureau-statistics">
                        <div class="bureau-ring">
                            <svg viewBox="0 0 100 100">
                                <circle class="bureau-ring-track" cx="50" cy="50" r="40"></circle>
                                <circle class="bureau-ring-value" cx="50" cy="50" r="40" stroke-dasharray="${circumference}" stroke-dashoffset="${offset}"></circle>
                            </svg>
                            <span>${Math.round(percentage)}%</span>
                        </div>
                        <div class="bureau-stat-list">
                            <div class="bureau-stat-item">
                                <span>Semester</span>
                                <strong>${acad?.semester?.name || 'S4'}</strong>
                            </div>
                            <div class="bureau-stat-item">
                                <span>Average</span>
                                <strong>${avgText}</strong>
                            </div>
                        </div>
                    </div>
                </section>`;
        }

        // COUNTDOWNS
        if (widgets.upcoming) {
            html += `
                <section class="bureau-panel">
                    <div class="bureau-panel-heading">
                        <div>
                            <span class="bureau-kicker">UPCOMING</span>
                            <h2>Assessments</h2>
                        </div>
                    </div>
                    <div class="bureau-countdown-list">`;
            
            const acad = state.academicSummary;
            if (acad && acad.upcomingAssessments && acad.upcomingAssessments.length > 0) {
                acad.upcomingAssessments.forEach(ass => {
                    html += `
                        <div class="bureau-countdown">
                            <span>${ass.title}</span>
                            <strong>${ass.daysRemaining}d</strong>
                        </div>`;
                });
            } else {
                html += `<div class="bureau-empty">No upcoming evaluations.</div>`;
            }
            
            html += `
                    </div>
                </section>`;
        }

        html += `
            </div>
        </div>
    </main>
</div>

<div id="desktop-settings-modal" class="bureau-overlay">
    <div class="bureau-settings">
        <div class="bureau-settings-header">
            <h2 style="margin:0; font-size:16px; font-weight:600; color:var(--bureau-text);">Settings</h2>
        </div>
        <div class="bureau-settings-options">
            <label class="bureau-setting">
                <input type="checkbox" id="chk-w-now" ${widgets.now ? 'checked' : ''}> Focus Timer
            </label>
            <label class="bureau-setting">
                <input type="checkbox" id="chk-w-today" ${widgets.today ? 'checked' : ''}> Today's Plan
            </label>
            <label class="bureau-setting">
                <input type="checkbox" id="chk-w-upcoming" ${widgets.upcoming ? 'checked' : ''}> Upcoming Countdowns
            </label>
            <label class="bureau-setting">
                <input type="checkbox" id="chk-w-languages" ${widgets.languages ? 'checked' : ''}> Languages Progress
            </label>
            <label class="bureau-setting">
                <input type="checkbox" id="chk-w-shortcuts" ${widgets.shortcuts ? 'checked' : ''}> Quick Access Tasks
            </label>
            <label class="bureau-setting">
                <input type="checkbox" id="chk-w-academic" ${widgets.academic ? 'checked' : ''}> Academic Statistics
            </label>
        </div>
        <div class="bureau-settings-actions">
            <button id="btn-close-settings" class="bureau-button bureau-button-secondary">Cancel</button>
            <button id="btn-save-settings" class="bureau-button bureau-button-primary">Save</button>
        </div>
    </div>
</div>
`;

        this.container.innerHTML = html;

        // BINDINGS
        this.container.querySelectorAll('.bureau-nav-item').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const route = e.currentTarget.getAttribute('data-route');
                if (this.app && typeof this.app.renderView === 'function') {
                    this.app.renderView(route);
                }
            });
        });

        const settingsBtn = document.getElementById('desktop-settings');
        const settingsModal = document.getElementById('desktop-settings-modal');
        const closeBtn = document.getElementById('btn-close-settings');
        const saveBtn = document.getElementById('btn-save-settings');
        const addShortcutBtn = document.getElementById('btn-add-shortcut');

        if (settingsBtn) settingsBtn.addEventListener('click', () => { settingsModal.style.display = 'flex'; });
        if (closeBtn) closeBtn.addEventListener('click', () => { settingsModal.style.display = 'none'; });
        
        if (saveBtn) {
            saveBtn.addEventListener('click', async () => {
                const wNow = document.getElementById('chk-w-now').checked;
                const wToday = document.getElementById('chk-w-today').checked;
                const wUpcoming = document.getElementById('chk-w-upcoming').checked;
                const wLang = document.getElementById('chk-w-languages').checked;
                const wShort = document.getElementById('chk-w-shortcuts').checked;
                const wAcad = document.getElementById('chk-w-academic').checked;

                if (!state.userProfile.preferences) state.userProfile.preferences = {};
                if (!state.userProfile.preferences.desktop) state.userProfile.preferences.desktop = { shortcuts: [] };
                
                state.userProfile.preferences.desktop.widgets = {
                    now: wNow, today: wToday, upcoming: wUpcoming, languages: wLang, shortcuts: wShort, academic: wAcad
                };

                await this.app.storage.saveData('user_profile', state.userProfile);
                settingsModal.style.display = 'none';
                this.render(state);
            });
        }

        if (addShortcutBtn) {
            addShortcutBtn.addEventListener('click', async () => {
                const label = prompt("Shortcut Name (e.g. GitHub):");
                if (!label) return;
                const url = prompt("Shortcut URL:");
                if (!url) return;

                if (!state.userProfile.preferences) state.userProfile.preferences = {};
                if (!state.userProfile.preferences.desktop) state.userProfile.preferences.desktop = { widgets: widgets, shortcuts: [] };
                if (!state.userProfile.preferences.desktop.shortcuts) state.userProfile.preferences.desktop.shortcuts = [];
                
                state.userProfile.preferences.desktop.shortcuts.push({ label, url });
                await this.app.storage.saveData('user_profile', state.userProfile);
                this.render(state);
            });
        }
    }
}
