export class CalendarView {
    constructor(containerId, app) {
        this.container = document.getElementById(containerId);
        this.app = app;
    }
    
    render(state) {
        document.body.className = 'theme-glass';

        const svgHome = `<svg viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>`;
        const svgCalendar = `<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>`;
        const svgUsers = `<svg viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>`;
        const svgSettings = `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>`;

        let html = `
<div style="min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px;">
    <!-- GLASS PANEL CONTAINER -->
    <div class="glass-panel" style="width: 1200px; height: 800px; display: flex; overflow: hidden; position:relative;">
        
        <!-- SIDEBAR -->
        <div style="width: 250px; border-right: 1px solid var(--border-color); padding: 30px 20px; display: flex; flex-direction: column;">
            
            <div style="display:flex; align-items:center; gap:12px; margin-bottom: 40px;">
                <div style="width:32px; height:32px; border-radius:8px; background:linear-gradient(135deg, var(--accent-secondary), #3b82f6); display:flex; align-items:center; justify-content:center; font-weight:bold; font-size:18px;">R</div>
                <div>
                    <strong style="display:block; font-size:16px; letter-spacing:1px;">RSK</strong>
                    <small style="font-size:10px; color:var(--text-muted); letter-spacing:1px;">CALENDAR 2026</small>
                </div>
            </div>

            <!-- MENU -->
            <div class="bureau-nav">
                <button class="bureau-nav-item" data-route="desktop">
                    ${svgHome} <span>Dashboard</span>
                </button>
                <button class="bureau-nav-item active" data-route="calendar">
                    ${svgCalendar} <span>Events</span>
                </button>
                <button class="bureau-nav-item" data-route="planning">
                    ${svgUsers} <span>Contacts</span>
                </button>
                <button class="bureau-nav-item" data-route="desktop">
                    ${svgSettings} <span>Settings</span>
                </button>
            </div>

            <!-- CALENDARS TOGGLES -->
            <div style="margin-top: 40px;">
                <span style="font-size:11px; color:var(--text-muted); text-transform:uppercase; letter-spacing:1px; margin-bottom:15px; display:block;">Calendars</span>
                <div style="display:flex; flex-direction:column; gap:15px;">
                    
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <div style="display:flex; align-items:center; gap:10px;">
                            <span style="color:var(--accent-secondary);">💼</span>
                            <span style="font-size:13px; color:var(--text-muted);">Work</span>
                        </div>
                        <div style="width:32px; height:18px; border-radius:10px; background:var(--accent-secondary); position:relative; cursor:pointer;">
                            <div style="width:14px; height:14px; background:white; border-radius:50%; position:absolute; right:2px; top:2px;"></div>
                        </div>
                    </div>
                    
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <div style="display:flex; align-items:center; gap:10px;">
                            <span style="color:#10b981;">👤</span>
                            <span style="font-size:13px; color:var(--text-muted);">Personal</span>
                        </div>
                        <div style="width:32px; height:18px; border-radius:10px; background:#10b981; position:relative; cursor:pointer;">
                            <div style="width:14px; height:14px; background:white; border-radius:50%; position:absolute; right:2px; top:2px;"></div>
                        </div>
                    </div>

                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <div style="display:flex; align-items:center; gap:10px;">
                            <span style="color:var(--accent-primary);">🏖️</span>
                            <span style="font-size:13px; color:var(--text-muted);">Holidays</span>
                        </div>
                        <div style="width:32px; height:18px; border-radius:10px; background:var(--accent-primary); position:relative; cursor:pointer;">
                            <div style="width:14px; height:14px; background:white; border-radius:50%; position:absolute; right:2px; top:2px;"></div>
                        </div>
                    </div>

                </div>
            </div>

        </div>

        <!-- MAIN AREA -->
        <div style="flex: 1; display:flex; flex-direction:column; padding: 30px 40px; overflow-y:auto;">
            
            <!-- TOPBAR -->
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 30px;">
                <div style="display:flex; align-items:center; background: rgba(255,255,255,0.05); border:1px solid var(--border-color); border-radius:20px; padding:8px 15px; width:300px;">
                    <input type="text" placeholder="Search events, dates, people..." style="background:transparent; border:none; color:white; outline:none; flex:1; font-size:14px;">
                    <svg viewBox="0 0 24 24" width="16" height="16" stroke="var(--text-muted)" fill="none" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                </div>
                
                <div style="display:flex; align-items:center; gap:20px;">
                    <div style="display:flex; background:rgba(0,0,0,0.3); border-radius:20px; padding:5px;">
                        <div style="width:30px; height:30px; border-radius:50%; background:var(--accent-primary); display:flex; align-items:center; justify-content:center;">
                            <span style="font-size:14px;">☀️</span>
                        </div>
                        <div style="width:30px; height:30px; border-radius:50%; display:flex; align-items:center; justify-content:center; opacity:0.5;">
                            <span style="font-size:14px;">🌙</span>
                        </div>
                    </div>
                    
                    <button style="background:linear-gradient(90deg, #3b82f6, var(--accent-primary)); border:none; color:white; padding:10px 20px; border-radius:20px; font-weight:600; font-size:14px; cursor:pointer; box-shadow:0 0 15px rgba(139,92,246,0.4);">
                        Add Event +
                    </button>
                </div>
            </div>

            <!-- CALENDAR GRID -->
            <div style="flex:1; background:rgba(0,0,0,0.2); border-radius:16px; border:1px solid var(--border-color); display:flex; flex-direction:column; overflow:hidden;">
                
                <!-- HEADER -->
                <div style="display:flex; justify-content:space-between; align-items:center; padding:20px;">
                    <h2 style="margin:0; font-size:18px; font-weight:700;">OCTOBER <span style="color:var(--text-muted); font-weight:400;">2026</span></h2>
                    <div style="display:flex; gap:10px;">
                        <button style="background:rgba(255,255,255,0.05); border:1px solid var(--border-color); color:white; width:30px; height:30px; border-radius:8px; cursor:pointer;">&lt;</button>
                        <button style="background:rgba(255,255,255,0.05); border:1px solid var(--border-color); color:white; width:30px; height:30px; border-radius:8px; cursor:pointer;">&gt;</button>
                    </div>
                </div>

                <!-- DAYS LABELS -->
                <div style="display:grid; grid-template-columns: repeat(7, 1fr); text-align:center; padding:10px 0; border-bottom:1px solid var(--border-color); font-size:11px; color:var(--text-muted); letter-spacing:1px;">
                    <div>S</div><div>M</div><div>T</div><div>W</div><div>T</div><div>F</div><div>S</div>
                </div>

                <!-- CELLS -->
                <div style="flex:1; display:grid; grid-template-columns: repeat(7, 1fr); grid-template-rows: repeat(5, 1fr);">
                    
                    <!-- WEEK 1 -->
                    <div style="border-right:1px solid rgba(255,255,255,0.05); border-bottom:1px solid rgba(255,255,255,0.05); padding:10px;"><span style="color:rgba(255,255,255,0.2);">27</span></div>
                    <div style="border-right:1px solid rgba(255,255,255,0.05); border-bottom:1px solid rgba(255,255,255,0.05); padding:10px;"><span style="color:rgba(255,255,255,0.2);">28</span></div>
                    <div style="border-right:1px solid rgba(255,255,255,0.05); border-bottom:1px solid rgba(255,255,255,0.05); padding:10px;"><span style="color:rgba(255,255,255,0.2);">29</span></div>
                    <div style="border-right:1px solid rgba(255,255,255,0.05); border-bottom:1px solid rgba(255,255,255,0.05); padding:10px;">1</div>
                    <div style="border-right:1px solid rgba(255,255,255,0.05); border-bottom:1px solid rgba(255,255,255,0.05); padding:10px;">2</div>
                    <div style="border-right:1px solid rgba(255,255,255,0.05); border-bottom:1px solid rgba(255,255,255,0.05); padding:10px;">3</div>
                    <div style="border-bottom:1px solid rgba(255,255,255,0.05); padding:10px;">4</div>

                    <!-- WEEK 2 -->
                    <div style="border-right:1px solid rgba(255,255,255,0.05); border-bottom:1px solid rgba(255,255,255,0.05); padding:10px;">5</div>
                    <div style="border-right:1px solid rgba(255,255,255,0.05); border-bottom:1px solid rgba(255,255,255,0.05); padding:10px;">6</div>
                    <div style="border-right:1px solid rgba(255,255,255,0.05); border-bottom:1px solid rgba(255,255,255,0.05); padding:10px;">7</div>
                    <div style="border-right:1px solid rgba(255,255,255,0.05); border-bottom:1px solid rgba(255,255,255,0.05); padding:10px; position:relative;">
                        8
                        <div style="position:absolute; bottom:5px; left:0; right:-100%; height:25px; background:var(--accent-primary); border-radius:4px; padding:4px 8px; font-size:10px; font-weight:600; color:white; z-index:10;">
                            Product Launch RSK<br><span style="font-weight:400; font-size:8px;">10:00 AM</span>
                        </div>
                    </div>
                    <div style="border-right:1px solid rgba(255,255,255,0.05); border-bottom:1px solid rgba(255,255,255,0.05); padding:10px;">9</div>
                    <div style="border-right:1px solid rgba(255,255,255,0.05); border-bottom:1px solid rgba(255,255,255,0.05); padding:10px; position:relative;">
                        10
                        <div style="position:absolute; bottom:5px; left:0; right:10px; height:25px; background:#3b82f6; border-radius:4px; padding:4px 8px; font-size:10px; font-weight:600; color:white; z-index:10;">
                            Team Sync<br><span style="font-weight:400; font-size:8px;">2:00 PM</span>
                        </div>
                    </div>
                    <div style="border-bottom:1px solid rgba(255,255,255,0.05); padding:10px;">11</div>

                    <!-- WEEK 3 -->
                    <div style="border-right:1px solid rgba(255,255,255,0.05); border-bottom:1px solid rgba(255,255,255,0.05); padding:10px;">
                        <div style="width:24px; height:24px; border-radius:50%; background:#3b82f6; display:flex; align-items:center; justify-content:center; color:white; font-size:12px;">12</div>
                    </div>
                    <div style="border-right:1px solid rgba(255,255,255,0.05); border-bottom:1px solid rgba(255,255,255,0.05); padding:10px; position:relative;">
                        13
                        <div style="position:absolute; bottom:5px; left:0; right:10px; height:25px; background:#3b82f6; border-radius:4px; padding:4px 8px; font-size:10px; font-weight:600; color:white; z-index:10;">
                            Team Sync<br><span style="font-weight:400; font-size:8px;">2:00 PM</span>
                        </div>
                    </div>
                    <div style="border-right:1px solid rgba(255,255,255,0.05); border-bottom:1px solid rgba(255,255,255,0.05); padding:10px;">14</div>
                    <div style="border-right:1px solid rgba(255,255,255,0.05); border-bottom:1px solid rgba(255,255,255,0.05); padding:10px;">15</div>
                    <div style="border-right:1px solid rgba(255,255,255,0.05); border-bottom:1px solid rgba(255,255,255,0.05); padding:10px;">16</div>
                    <div style="border-right:1px solid rgba(255,255,255,0.05); border-bottom:1px solid rgba(255,255,255,0.05); padding:10px;">17</div>
                    <div style="border-bottom:1px solid rgba(255,255,255,0.05); padding:10px;">18</div>

                    <!-- WEEK 4 -->
                    <div style="border-right:1px solid rgba(255,255,255,0.05); border-bottom:1px solid rgba(255,255,255,0.05); padding:10px;">19</div>
                    <div style="border-right:1px solid rgba(255,255,255,0.05); border-bottom:1px solid rgba(255,255,255,0.05); padding:10px; position:relative;">
                        20
                        <div style="position:absolute; bottom:5px; left:0; right:-300%; height:25px; background:#f97316; border-radius:4px; padding:4px 8px; font-size:10px; font-weight:600; color:white; z-index:10;">
                            Tech Conf '26<br><span style="font-weight:400; font-size:8px;">Multi-day</span>
                        </div>
                    </div>
                    <div style="border-right:1px solid rgba(255,255,255,0.05); border-bottom:1px solid rgba(255,255,255,0.05); padding:10px;">21</div>
                    <div style="border-right:1px solid rgba(255,255,255,0.05); border-bottom:1px solid rgba(255,255,255,0.05); padding:10px;">22</div>
                    <div style="border-right:1px solid rgba(255,255,255,0.05); border-bottom:1px solid rgba(255,255,255,0.05); padding:10px;">23</div>
                    <div style="border-right:1px solid rgba(255,255,255,0.05); border-bottom:1px solid rgba(255,255,255,0.05); padding:10px;">24</div>
                    <div style="border-bottom:1px solid rgba(255,255,255,0.05); padding:10px; position:relative;">
                        25
                        <div style="position:absolute; bottom:5px; left:0; right:10px; height:25px; background:var(--accent-secondary); border-radius:4px; padding:4px 8px; font-size:10px; font-weight:600; color:white; z-index:11;">
                            Investor Pitch<br><span style="font-weight:400; font-size:8px;">11:30 AM</span>
                        </div>
                    </div>
                    
                    <!-- WEEK 5 -->
                    <div style="border-right:1px solid rgba(255,255,255,0.05); padding:10px;">26</div>
                    <div style="border-right:1px solid rgba(255,255,255,0.05); padding:10px;">27</div>
                    <div style="border-right:1px solid rgba(255,255,255,0.05); padding:10px;">28</div>
                    <div style="border-right:1px solid rgba(255,255,255,0.05); padding:10px;">29</div>
                    <div style="border-right:1px solid rgba(255,255,255,0.05); padding:10px;">30</div>
                    <div style="border-right:1px solid rgba(255,255,255,0.05); padding:10px;">31</div>
                    <div style="padding:10px;"><span style="color:rgba(255,255,255,0.2);">1</span></div>

                </div>
            </div>

            <!-- BOTTOM WIDGETS -->
            <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:20px; margin-top:20px;">
                
                <div style="background:rgba(0,0,0,0.2); border:1px solid var(--border-color); border-radius:12px; padding:15px;">
                    <div style="display:flex; justify-content:space-between; margin-bottom:15px; font-size:11px; color:var(--text-muted); letter-spacing:1px; text-transform:uppercase;">
                        <span>Upcoming Events</span>
                        <span>...</span>
                    </div>
                    
                    <div style="display:flex; flex-direction:column; gap:12px;">
                        <div style="display:flex; gap:10px; align-items:center;">
                            <div style="width:28px; height:28px; border-radius:8px; background:var(--accent-primary); display:flex; align-items:center; justify-content:center; font-size:12px; font-weight:bold;">13</div>
                            <div style="flex:1;">
                                <div style="font-size:12px; font-weight:600;">Product Launch RSK</div>
                                <div style="font-size:10px; color:var(--text-muted);">10:00 AM</div>
                            </div>
                            <span style="font-size:11px; color:var(--text-muted);">10:00 AM</span>
                        </div>
                        <div style="display:flex; gap:10px; align-items:center;">
                            <div style="width:28px; height:28px; border-radius:8px; background:#3b82f6; display:flex; align-items:center; justify-content:center; font-size:12px; font-weight:bold;">15</div>
                            <div style="flex:1;">
                                <div style="font-size:12px; font-weight:600;">Team Sync</div>
                                <div style="font-size:10px; color:var(--text-muted);">2:00 PM</div>
                            </div>
                            <span style="font-size:11px; color:var(--text-muted);">2:00 PM</span>
                        </div>
                        <div style="display:flex; gap:10px; align-items:center;">
                            <div style="width:28px; height:28px; border-radius:8px; background:var(--accent-secondary); display:flex; align-items:center; justify-content:center; font-size:12px; font-weight:bold;">26</div>
                            <div style="flex:1;">
                                <div style="font-size:12px; font-weight:600;">Investor Pitch</div>
                                <div style="font-size:10px; color:var(--text-muted);">11:30 AM</div>
                            </div>
                            <span style="font-size:11px; color:var(--text-muted);">11:30 AM</span>
                        </div>
                    </div>
                </div>

                <div style="background:rgba(0,0,0,0.2); border:1px solid var(--border-color); border-radius:12px; padding:15px;">
                    <div style="display:flex; justify-content:space-between; margin-bottom:15px; font-size:11px; color:var(--text-muted); letter-spacing:1px; text-transform:uppercase;">
                        <span>Birthdays</span>
                        <span>...</span>
                    </div>
                    
                    <div style="display:flex; flex-direction:column; gap:12px;">
                        <div style="display:flex; gap:10px; align-items:center;">
                            <div style="width:28px; height:28px; border-radius:50%; background:#4b5563; display:flex; align-items:center; justify-content:center; font-size:12px;">JN</div>
                            <div>
                                <div style="font-size:12px; font-weight:600;">Jane Nomes</div>
                                <div style="font-size:10px; color:var(--text-muted);">Oct 13</div>
                            </div>
                        </div>
                        <div style="display:flex; gap:10px; align-items:center;">
                            <div style="width:28px; height:28px; border-radius:50%; background:#4b5563; display:flex; align-items:center; justify-content:center; font-size:12px;">MS</div>
                            <div>
                                <div style="font-size:12px; font-weight:600;">Marily Smith</div>
                                <div style="font-size:10px; color:var(--text-muted);">Oct 15</div>
                            </div>
                        </div>
                        <div style="display:flex; gap:10px; align-items:center;">
                            <div style="width:28px; height:28px; border-radius:50%; background:#4b5563; display:flex; align-items:center; justify-content:center; font-size:12px;">JM</div>
                            <div>
                                <div style="font-size:12px; font-weight:600;">Jon Math</div>
                                <div style="font-size:10px; color:var(--text-muted);">Oct 25</div>
                            </div>
                        </div>
                    </div>
                </div>

                <div style="background:rgba(0,0,0,0.2); border:1px solid var(--border-color); border-radius:12px; padding:15px;">
                    <div style="display:flex; justify-content:space-between; margin-bottom:15px; font-size:11px; color:var(--text-muted); letter-spacing:1px; text-transform:uppercase;">
                        <span>Task Overview</span>
                        <span>...</span>
                    </div>
                    <div style="display:flex; align-items:center; justify-content:center; height:100px; color:var(--text-muted); font-size:12px;">
                        No tasks for today.
                    </div>
                </div>

            </div>

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
    }
}
