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
    <div class="bureau-sidebar">
        <div class="bureau-brand">
            <div class="bureau-brand-mark">
                <span></span><span></span><span></span>
            </div>
            <div>
                <strong>Learning OS</strong>
                <small>Student Workspace</small>
            </div>
        </div>
        
        <div class="bureau-nav">
            <button class="bureau-nav-item active" data-route="desktop">
                ${svgHome}
                <span>Dashboard</span>
            </button>
            <button class="bureau-nav-item" data-route="planning">
                ${svgCalendar}
                <span>Schedule</span>
            </button>
            <button class="bureau-nav-item" data-route="academic">
                ${svgSchool}
                <span>Academic</span>
            </button>
            <button class="bureau-nav-item" data-route="coach">
                ${svgCoach}
                <span>Coach AI</span>
            </button>
        </div>

        <div class="bureau-sidebar-bottom">
            <button class="bureau-settings" id="desktop-settings">
                ${svgSettings}
                <span>Settings</span>
            </button>
        </div>
    </div>

    <div class="bureau-content">
        <div class="bureau-topbar">
            <div>
                <span class="bureau-eyebrow">OVERVIEW</span>
                <h1>Hello, ${state.userProfile?.name || 'Student'}</h1>
            </div>
            <div class="bureau-topbar-actions">
                <button class="bureau-icon-button" aria-label="Notifications">${svgBell}</button>
                <div class="bureau-profile">
                    <div class="bureau-profile-avatar">${(state.userProfile?.name || 'S').charAt(0).toUpperCase()}</div>
                    <div>
                        <strong>${state.userProfile?.name || 'Student'}</strong>
                        <small>Active</small>
                    </div>
                </div>
            </div>
        </div>

        <div class="bureau-dashboard">
            <!-- LEFT COLUMN -->
            <div class="bureau-column">`;

        // SCHEDULE
        if (widgets.today) {
            html += `
                <div class="bureau-card">
                    <div class="bureau-card-header">
                        <div>
                            <span class="bureau-card-kicker">TODAY</span>
                            <h2>Daily Schedule</h2>
                        </div>
                    </div>
                    <div class="bureau-timeline">`;
                    
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
                    const statusClass = isFixed ? 'fixed' : '';
                    const statusText = isFixed ? 'FIXED' : 'EVENT';
                    html += `
                        <div class="bureau-timeline-item">
                            <div class="bureau-time">${e.startTime || '--:--'}</div>
                            <div class="bureau-timeline-line"><span></span></div>
                            <div class="bureau-timeline-content">
                                <strong>${e.title}</strong>
                                <small>${e.type || 'Event'}</small>
                                <span class="bureau-status ${statusClass}">${statusText}</span>
                            </div>
                        </div>`;
                });
                sessions.forEach(s => {
                    html += `
                        <div class="bureau-timeline-item">
                            <div class="bureau-time">--:--</div>
                            <div class="bureau-timeline-line"><span></span></div>
                            <div class="bureau-timeline-content">
                                <strong>${s.title}</strong>
                                <small>${s.expectedDuration} min</small>
                                <span class="bureau-status optimizable">OPT</span>
                            </div>
                        </div>`;
                });
            }

            html += `
                    </div>
                </div>`;
        }

        // LANGUAGES
        if (widgets.languages) {
            html += `
                <div class="bureau-card">
                    <div class="bureau-card-header">
                        <div>
                            <span class="bureau-card-kicker">PROGRESS</span>
                            <h2>Languages</h2>
                        </div>
                    </div>
                    <div class="bureau-language-list">`;
            
            const graph = state.learningGraph;
            if (graph && graph.nodes) {
                const engNode = graph.nodes['english_speaking'];
                const eloNode = graph.nodes['eloquence_fr'];
                
                [engNode, eloNode].forEach(node => {
                    if (node) {
                        const progress = node.level || 0;
                        html += `
                            <div>
                                <div class="bureau-language-top">
                                    <strong>${node.label}</strong>
                                </div>
                                <div class="bureau-progress">
                                    <span style="width: ${progress}%;"></span>
                                </div>
                            </div>`;
                    }
                });
            } else {
                html += `<div class="bureau-empty">Data unavailable.</div>`;
            }
            
            html += `
                    </div>
                </div>`;
        }
        
        // SHORTCUTS
        if (widgets.shortcuts) {
            html += `
                <div class="bureau-card">
                    <div class="bureau-card-header">
                        <div>
                            <span class="bureau-card-kicker">QUICK LINKS</span>
                            <h2>Shortcuts</h2>
                        </div>
                        <button id="btn-add-shortcut" class="bureau-add-button">+</button>
                    </div>
                    <div class="bureau-task-list">`;
            
            if (shortcuts.length === 0) {
                html += `<div class="bureau-empty">No shortcuts added.</div>`;
            } else {
                shortcuts.forEach(sc => {
                    html += `
                        <div class="bureau-task">
                            <div class="bureau-task-check"></div>
                            <a href="${sc.url}" target="_blank">${sc.label}</a>
                        </div>`;
                });
            }
            
            html += `
                    </div>
                </div>`;
        }

        html += `
            </div>
            
            <!-- RIGHT COLUMN -->
            <div class="bureau-column bureau-column-side">`;

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
                <div class="bureau-card bureau-focus-card">
                    <span class="bureau-card-kicker">NOW FOCUS</span>
                    <div class="bureau-focus-timer">${focusTime}<span>MIN</span></div>
                    <div class="bureau-focus-info">
                        <strong>${focusSession}</strong>
                        <small>Current objective</small>
                    </div>
                </div>`;
        }

        // ACADEMIC STATS
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
                <div class="bureau-card">
                    <div class="bureau-card-header">
                        <div>
                            <span class="bureau-card-kicker">OVERVIEW</span>
                            <h2>Academic</h2>
                        </div>
                    </div>
                    <div class="bureau-statistics-content">
                        <div class="bureau-ring">
                            <svg viewBox="0 0 100 100">
                                <circle class="bureau-ring-bg" cx="50" cy="50" r="40"></circle>
                                <circle class="bureau-ring-progress" cx="50" cy="50" r="40" stroke-dasharray="${circumference}" stroke-dashoffset="${offset}"></circle>
                            </svg>
                            <strong>${Math.round(percentage)}%</strong>
                        </div>
                        <div class="bureau-stat-text">
                            <strong>${acad?.semester?.name || 'S4'}</strong>
                            <span>Average: ${avgText}</span>
                        </div>
                    </div>
                </div>`;
        }

        // COUNTDOWNS
        if (widgets.upcoming) {
            html += `
                <div class="bureau-card">
                    <div class="bureau-card-header">
                        <div>
                            <span class="bureau-card-kicker">UPCOMING</span>
                            <h2>Assessments</h2>
                        </div>
                    </div>
                    <div>`;
            
            const acad = state.academicSummary;
            if (acad && acad.upcomingAssessments && acad.upcomingAssessments.length > 0) {
                acad.upcomingAssessments.forEach(ass => {
                    html += `
                        <div class="bureau-countdown">
                            <strong>${ass.title}</strong>
                            <div class="bureau-countdown-days">${ass.daysRemaining}<span>DAYS</span></div>
                        </div>`;
                });
            } else {
                html += `<div class="bureau-empty">No upcoming evaluations.</div>`;
            }
            html += `
                    </div>
                </div>`;
        }

        html += `
            </div>
        </div>
    </div>
</div>

<!-- SETTINGS MODAL -->
<div id="desktop-settings-modal" class="bureau-modal" hidden>
    <div class="bureau-modal-backdrop" id="btn-backdrop-close"></div>
    <div class="bureau-modal-card">
        <div class="bureau-modal-header">
            <h2>Dashboard Settings</h2>
            <button class="bureau-modal-close" id="btn-close-settings">&times;</button>
        </div>
        <div class="bureau-settings-list">
            <label class="bureau-setting-row">
                <strong>Focus Timer</strong>
                <input type="checkbox" id="chk-w-now" ${widgets.now ? 'checked' : ''}>
            </label>
            <label class="bureau-setting-row">
                <strong>Today's Schedule</strong>
                <input type="checkbox" id="chk-w-today" ${widgets.today ? 'checked' : ''}>
            </label>
            <label class="bureau-setting-row">
                <strong>Upcoming Countdowns</strong>
                <input type="checkbox" id="chk-w-upcoming" ${widgets.upcoming ? 'checked' : ''}>
            </label>
            <label class="bureau-setting-row">
                <strong>Languages Progress</strong>
                <input type="checkbox" id="chk-w-languages" ${widgets.languages ? 'checked' : ''}>
            </label>
            <label class="bureau-setting-row">
                <strong>Quick Links (Shortcuts)</strong>
                <input type="checkbox" id="chk-w-shortcuts" ${widgets.shortcuts ? 'checked' : ''}>
            </label>
            <label class="bureau-setting-row">
                <strong>Academic Statistics</strong>
                <input type="checkbox" id="chk-w-academic" ${widgets.academic ? 'checked' : ''}>
            </label>
        </div>
        <div class="bureau-modal-footer">
            <button class="bureau-button secondary" id="btn-cancel-settings">Cancel</button>
            <button class="bureau-button primary" id="btn-save-settings">Save changes</button>
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
        const cancelBtn = document.getElementById('btn-cancel-settings');
        const backdropBtn = document.getElementById('btn-backdrop-close');
        const saveBtn = document.getElementById('btn-save-settings');
        const addShortcutBtn = document.getElementById('btn-add-shortcut');

        const closeModal = () => { settingsModal.setAttribute('hidden', ''); };
        const openModal = () => { settingsModal.removeAttribute('hidden'); };

        if (settingsBtn) settingsBtn.addEventListener('click', openModal);
        if (closeBtn) closeBtn.addEventListener('click', closeModal);
        if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
        if (backdropBtn) backdropBtn.addEventListener('click', closeModal);
        
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
                closeModal();
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
