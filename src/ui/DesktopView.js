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

        let html = `
<div class="bureau">
    <aside class="bureau-sidebar">
        <div class="bureau-brand">
            <div class="brand-icon">
                <svg viewBox="0 0 24 24">
                    <path d="M12 2L2 12l10 10 10-10L12 2zm0 14.5L6.5 11 12 5.5 17.5 11 12 16.5z"/>
                </svg>
            </div>
            <div class="brand-text">Learning OS</div>
        </div>
        <nav class="bureau-nav">
            <button class="nav-item active" data-route="desktop">
                <span class="nav-icon">${svgHome}</span> Home
            </button>
            <button class="nav-item" data-route="planning">
                <span class="nav-icon">${svgCalendar}</span> Calendar
            </button>
            <button class="nav-item" data-route="academic">
                <span class="nav-icon">${svgSchool}</span> Courses
            </button>
            <button class="nav-item" data-route="coach">
                <span class="nav-icon">${svgCoach}</span> Community
            </button>
        </nav>
    </aside>

    <main class="bureau-main">
        <header class="bureau-header">
            <h1 class="header-title">Welcome back, ${state.userProfile?.name || 'Student'} 👋</h1>
            <div class="header-actions">
                <button class="action-btn" id="desktop-settings" aria-label="Settings">${svgSettings}</button>
                <button class="action-btn" aria-label="Notifications">${svgBell}</button>
            </div>
        </header>

        <div class="bureau-dashboard">
            <div class="dashboard-left">
                <!-- TOP STATS -->
                <div class="stats-row">`;
                
        // Card 1: Academic
        if (widgets.academic) {
            const acad = state.academicSummary;
            let avgValue = 0;
            if (acad && acad.average && acad.average.status === "complete") {
                avgValue = acad.average.value;
            }
            html += `
                    <div class="stat-card">
                        <div class="stat-top">
                            <div class="stat-icon green">
                                <svg viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
                            </div>
                            <div class="stat-info">
                                <span class="stat-value">${avgValue.toFixed(1)}</span>
                                <span class="stat-label">Semester Avg</span>
                            </div>
                        </div>
                        <div class="stat-bottom" data-route="academic">
                            View details <svg viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                        </div>
                    </div>`;
        }

        // Card 2: Events
        if (widgets.today) {
            const events = state.todayEvents || [];
            html += `
                    <div class="stat-card">
                        <div class="stat-top">
                            <div class="stat-icon purple">
                                <svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                            </div>
                            <div class="stat-info">
                                <span class="stat-value">${events.length}</span>
                                <span class="stat-label">Events Today</span>
                            </div>
                        </div>
                        <div class="stat-bottom" data-route="planning">
                            View details <svg viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                        </div>
                    </div>`;
        }

        // Card 3: Focus
        if (widgets.now) {
            const sessions = state.dailyPlan && state.dailyPlan.sessions ? state.dailyPlan.sessions : [];
            const nextSession = sessions.find(s => !s.completed);
            let focusTime = 0;
            if (nextSession) {
                focusTime = nextSession.expectedDuration;
            }
            html += `
                    <div class="stat-card">
                        <div class="stat-top">
                            <div class="stat-icon orange">
                                <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                            </div>
                            <div class="stat-info">
                                <span class="stat-value">${focusTime}</span>
                                <span class="stat-label">Min Focus</span>
                            </div>
                        </div>
                        <div class="stat-bottom" data-route="planning">
                            View details <svg viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                        </div>
                    </div>`;
        }

        html += `
                </div>

                <!-- LANGUAGES (Continue Learning) -->`;
        if (widgets.languages) {
            html += `
                <div class="section-container">
                    <div class="section-header">
                        <h2 class="section-title">Continue Learning</h2>
                        <button class="btn-see-all">See All</button>
                    </div>
                    <table class="lang-table">
                        <thead>
                            <tr>
                                <th>Course Name</th>
                                <th>Progress</th>
                                <th style="text-align:right">Status</th>
                            </tr>
                        </thead>
                        <tbody>`;
            const graph = state.learningGraph;
            if (graph && graph.nodes) {
                const engNode = graph.nodes['english_speaking'];
                const eloNode = graph.nodes['eloquence_fr'];
                
                let iconColors = ['blue', 'purple'];
                [engNode, eloNode].forEach((node, idx) => {
                    if (node) {
                        const level = Math.floor(node.xp / 100) + 1;
                        const progress = node.xp % 100;
                        const statusClass = progress === 100 ? 'completed' : 'in-progress';
                        const statusText = progress === 100 ? 'Completed' : 'In Progress';
                        const color = iconColors[idx % 2];
                        html += `
                            <tr class="lang-row">
                                <td>
                                    <div class="lang-course">
                                        <div class="lang-icon ${color}">
                                            <svg viewBox="0 0 24 24"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
                                        </div>
                                        <div>
                                            <div class="lang-name">${node.label}</div>
                                            <div class="lang-level">Level ${level}</div>
                                        </div>
                                    </div>
                                </td>
                                <td class="lang-progress-cell">
                                    <div class="lang-progress-wrapper">
                                        <div class="lang-progress-bar">
                                            <div class="lang-progress-fill" style="width: ${progress}%"></div>
                                        </div>
                                        <div class="lang-progress-text">${progress}%</div>
                                    </div>
                                </td>
                                <td class="lang-status-cell">
                                    <span class="status-badge ${statusClass}">${statusText}</span>
                                </td>
                            </tr>`;
                    }
                });
            } else {
                html += `<tr><td colspan="3"><div class="empty-state">Data unavailable.</div></td></tr>`;
            }
            html += `
                        </tbody>
                    </table>
                </div>`;
        }

        // SHORTCUTS (Recommended for you)
        if (widgets.shortcuts) {
            html += `
                <div class="section-container" style="border:none; padding:0; background:transparent; box-shadow:none;">
                    <div class="section-header">
                        <h2 class="section-title">Recommended for you</h2>
                        <button id="btn-add-shortcut" class="action-btn" style="width:32px; height:32px;"><svg viewBox="0 0 24 24" style="width:16px; height:16px;"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg></button>
                    </div>
                    <div class="rec-grid">`;
            
            if (shortcuts.length === 0) {
                html += `<div class="empty-state" style="grid-column: span 3;">No shortcuts added.</div>`;
            } else {
                const colors = ['teal', 'yellow', 'blue', 'purple', 'orange'];
                shortcuts.forEach((sc, i) => {
                    const c = colors[i % colors.length];
                    html += `
                        <a href="${sc.url}" target="_blank" class="rec-card">
                            <div class="rec-color-block ${c}">
                                <div class="rec-icon-inner">
                                    <svg viewBox="0 0 24 24"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
                                </div>
                            </div>
                            <div class="rec-info">
                                <div class="rec-text">
                                    <div class="rec-title">${sc.label}</div>
                                    <div class="rec-desc">Shortcut</div>
                                </div>
                            </div>
                        </a>`;
                });
            }
            html += `
                    </div>
                </div>`;
        }

        html += `
            </div>

            <div class="dashboard-right">`;

        // TODAY'S PLAN (Schedule List)
        if (widgets.today) {
            html += `
                <div class="section-container">
                    <div class="section-header" style="margin-bottom:16px;">
                        <h2 class="section-title">Today's Schedule</h2>
                    </div>
                    <div class="schedule-list">`;
            
            const events = state.todayEvents || [];
            const sessions = state.dailyPlan && state.dailyPlan.sessions ? state.dailyPlan.sessions : [];
            const sortedEvents = [...events].sort((a, b) => {
                const tA = a.startTime || '23:59';
                const tB = b.startTime || '23:59';
                return tA.localeCompare(tB);
            });

            if (sortedEvents.length === 0 && sessions.length === 0) {
                html += `<div class="empty-state">No events planned today.</div>`;
            } else {
                sortedEvents.forEach(e => {
                    const isFixed = e.lockStatus === 'locked';
                    const c = isFixed ? 'fixed' : '';
                    html += `
                        <div class="schedule-item">
                            <div class="schedule-time">${e.startTime || '--:--'}</div>
                            <div class="schedule-card ${c}">
                                <div class="schedule-title">${e.title}</div>
                                <div class="schedule-meta">${e.type || 'Event'}</div>
                            </div>
                        </div>`;
                });
                sessions.forEach(s => {
                    const c = s.completed ? 'completed' : '';
                    html += `
                        <div class="schedule-item">
                            <div class="schedule-time">--:--</div>
                            <div class="schedule-card ${c}">
                                <div class="schedule-title">${s.title}</div>
                                <div class="schedule-meta">${s.expectedDuration} min</div>
                            </div>
                        </div>`;
                });
            }
            html += `
                    </div>
                </div>`;
        }

        // COUNTDOWNS (Upcoming)
        if (widgets.upcoming) {
            html += `
                <div class="section-container">
                    <div class="section-header" style="margin-bottom:12px;">
                        <h2 class="section-title">Assessments</h2>
                    </div>
                    <div class="countdown-list">`;
            
            const acad = state.academicSummary;
            if (acad && acad.upcomingAssessments && acad.upcomingAssessments.length > 0) {
                acad.upcomingAssessments.forEach(ass => {
                    html += `
                        <div class="countdown-item">
                            <span class="countdown-title">${ass.title}</span>
                            <span class="countdown-days">${ass.daysRemaining} days left</span>
                        </div>`;
                });
            } else {
                html += `<div class="empty-state">No upcoming evaluations.</div>`;
            }
            html += `
                    </div>
                </div>`;
        }

        html += `
            </div>
        </div>
    </main>
</div>

<div id="desktop-settings-modal" class="modal-overlay">
    <div class="modal-content">
        <h2 class="modal-title">Settings</h2>
        <div class="modal-body">
            <label class="modal-label">
                <input type="checkbox" id="chk-w-academic" ${widgets.academic ? 'checked' : ''}> Academic Status
            </label>
            <label class="modal-label">
                <input type="checkbox" id="chk-w-today" ${widgets.today ? 'checked' : ''}> Today's Schedule & Events
            </label>
            <label class="modal-label">
                <input type="checkbox" id="chk-w-now" ${widgets.now ? 'checked' : ''}> Focus Time
            </label>
            <label class="modal-label">
                <input type="checkbox" id="chk-w-languages" ${widgets.languages ? 'checked' : ''}> Continue Learning (Languages)
            </label>
            <label class="modal-label">
                <input type="checkbox" id="chk-w-shortcuts" ${widgets.shortcuts ? 'checked' : ''}> Recommended (Shortcuts)
            </label>
            <label class="modal-label">
                <input type="checkbox" id="chk-w-upcoming" ${widgets.upcoming ? 'checked' : ''}> Upcoming Assessments
            </label>
        </div>
        <div class="modal-actions">
            <button id="btn-close-settings" class="btn btn-secondary">Cancel</button>
            <button id="btn-save-settings" class="btn btn-primary">Save Changes</button>
        </div>
    </div>
</div>
`;

        this.container.innerHTML = html;

        // BINDINGS
        this.container.querySelectorAll('.nav-item').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const route = e.currentTarget.getAttribute('data-route');
                if (this.app && typeof this.app.renderView === 'function') {
                    this.app.renderView(route);
                }
            });
        });
        
        this.container.querySelectorAll('.stat-bottom').forEach(btn => {
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
