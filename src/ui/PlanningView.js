export class PlanningView {
    constructor(containerId, app) {
        this.container = document.getElementById(containerId);
        this.app = app;
    }
    
    render(state) {
        document.body.className = 'theme-teal';

        const svgHome = `<svg viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>`;
        const svgCalendar = `<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>`;
        const svgSchool = `<svg viewBox="0 0 24 24"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>`;

        let html = `
<div class="bureau">
    <!-- SIDEBAR TEAL -->
    <div class="bureau-sidebar">
        <div class="bureau-brand">
            <div style="display:flex; gap: 8px; align-items:center;">
                <div style="width: 24px; height: 24px; background: var(--text-main); border-radius: 6px; display:flex; align-items:center; justify-content:center;">
                    <span style="color:#000; font-weight:bold; font-size:14px;">L</span>
                </div>
                <strong>Learning OS</strong>
            </div>
        </div>
        
        <div class="bureau-nav">
            <button class="bureau-nav-item" data-route="desktop">
                ${svgHome} <span>Bureau</span>
            </button>
            <button class="bureau-nav-item active" data-route="planning">
                <svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                <span>Planning</span>
            </button>
            <button class="bureau-nav-item" data-route="calendar">
                ${svgCalendar} <span>Événements</span>
            </button>
            <button class="bureau-nav-item" data-route="academic">
                ${svgSchool} <span>School</span>
            </button>
            <button class="bureau-nav-item" data-route="languages">
                <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg> 
                <span>Langues</span>
            </button>
            <button class="bureau-nav-item" data-route="life">
                <svg viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
                <span>Life/Projets</span>
            </button>
        </div>
        
        <!-- MOTS DU COACH TEAL -->
        <div style="margin-top:auto; background:var(--bg-card); padding:15px; border-radius:12px; border:1px solid var(--border-color);">
            <div style="display:flex; align-items:center; gap:10px; margin-bottom:8px;">
                <span style="color:var(--accent-primary);">🤖</span>
                <strong style="font-size:12px; color:var(--text-main);">Le Coach</strong>
            </div>
            <p style="margin:0; font-size:11px; color:var(--text-muted); line-height:1.4;">
                Super rythme ! N'oublie pas de planifier tes révisions pour l'examen de Physique.
            </p>
        </div>
    </div>

    <!-- MAIN CONTENT -->
    <div class="bureau-content">
        <!-- TOPBAR -->
        <div class="bureau-topbar">
            <div>
                <h1 style="font-size: 24px; font-weight: 700; color:var(--text-main); letter-spacing:1px;">PLANNING</h1>
                <p style="color: var(--text-muted); font-size:14px; margin-top:5px;">Organise ton temps, maximise ton impact.</p>
            </div>
            <div class="bureau-topbar-actions" style="display:flex; gap:15px; align-items:center;">
                <div style="text-align:right;">
                    <strong style="display:block; font-size:20px; color:var(--accent-primary);">10:24</strong>
                    <span style="color:var(--text-muted); font-size:12px;">⛅ 16°C Paris</span>
                </div>
                <div class="bureau-profile-avatar" style="width:40px; height:40px; border-radius:50%; background:var(--accent-primary); display:flex; align-items:center; justify-content:center; font-weight:bold; color:#000;">
                    ${(state.userProfile?.name || 'M').charAt(0).toUpperCase()}
                </div>
            </div>
        </div>

        <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 20px;">
            
            <!-- TIMELINE (Option D Left part) -->
            <div class="bureau-card" style="display:flex; flex-direction:column;">
                
                <!-- HEADER DAYS -->
                <div style="display:grid; grid-template-columns: 50px repeat(5, 1fr); gap:10px; border-bottom: 1px solid var(--border-color); padding-bottom:15px; margin-bottom:15px;">
                    <div></div>
                    <div style="text-align:center;">
                        <div style="font-size:12px; color:var(--text-muted);">Lun</div>
                        <strong style="font-size:16px;">25</strong>
                    </div>
                    <div style="text-align:center;">
                        <div style="font-size:12px; color:var(--text-muted);">Mar</div>
                        <strong style="font-size:16px;">26</strong>
                    </div>
                    <div style="text-align:center;">
                        <div style="font-size:12px; color:var(--accent-primary);">Mer</div>
                        <strong style="font-size:16px; color:var(--accent-primary);">27</strong>
                        <div style="width:4px; height:4px; background:var(--accent-primary); border-radius:50%; margin:4px auto 0;"></div>
                    </div>
                    <div style="text-align:center;">
                        <div style="font-size:12px; color:var(--text-muted);">Jeu</div>
                        <strong style="font-size:16px;">28</strong>
                    </div>
                    <div style="text-align:center;">
                        <div style="font-size:12px; color:var(--text-muted);">Ven</div>
                        <strong style="font-size:16px;">29</strong>
                    </div>
                </div>

                <!-- TIME BLOCKS GRID -->
                <div style="display:grid; grid-template-columns: 50px repeat(5, 1fr); gap:10px; flex-grow:1; position:relative;">
                    
                    <!-- TIME LABELS -->
                    <div style="display:flex; flex-direction:column; justify-content:space-between; color:var(--text-muted); font-size:12px;">
                        <div>08:00</div>
                        <div>10:00</div>
                        <div>12:00</div>
                        <div>14:00</div>
                        <div>16:00</div>
                        <div>18:00</div>
                    </div>

                    <!-- LUN -->
                    <div style="position:relative; border-left:1px dashed rgba(255,255,255,0.05);">
                        <!-- block -->
                        <div style="position:absolute; top:10%; left:5px; right:5px; height:20%; background:rgba(14,165,233,0.15); border:1px solid #0ea5e9; border-radius:8px; padding:10px;">
                            <strong style="font-size:12px; color:#0ea5e9;">Anglais</strong>
                            <div style="font-size:10px; color:var(--text-muted); margin-top:4px;">09:00 - 10:30</div>
                        </div>
                        <div style="position:absolute; top:40%; left:5px; right:5px; height:15%; background:rgba(250,204,21,0.15); border:1px solid #facc15; border-radius:8px; padding:10px;">
                            <strong style="font-size:12px; color:#facc15;">Physique</strong>
                            <div style="font-size:10px; color:var(--text-muted); margin-top:4px;">14:00 - 15:00</div>
                        </div>
                    </div>

                    <!-- MAR -->
                    <div style="position:relative; border-left:1px dashed rgba(255,255,255,0.05);">
                        <div style="position:absolute; top:50%; left:5px; right:5px; height:25%; background:rgba(139,92,246,0.15); border:1px solid #8b5cf6; border-radius:8px; padding:10px;">
                            <strong style="font-size:12px; color:#8b5cf6;">Sport</strong>
                            <div style="font-size:10px; color:var(--text-muted); margin-top:4px;">15:00 - 17:00</div>
                        </div>
                    </div>

                    <!-- MER (Active day) -->
                    <div style="position:relative; border-left:1px dashed rgba(255,255,255,0.05);">
                        <div style="position:absolute; top:35%; left:0; right:0; height:1px; background:var(--accent-primary); z-index:10;">
                            <div style="position:absolute; left:-4px; top:-4px; width:8px; height:8px; border-radius:50%; background:var(--accent-primary);"></div>
                        </div>
                        
                        <div style="position:absolute; top:15%; left:5px; right:5px; height:15%; background:rgba(14,165,233,0.15); border:1px solid #0ea5e9; border-radius:8px; padding:10px;">
                            <strong style="font-size:12px; color:#0ea5e9;">Anglais</strong>
                            <div style="font-size:10px; color:var(--text-muted); margin-top:4px;">10:00 - 11:30</div>
                        </div>
                        <div style="position:absolute; top:60%; left:5px; right:5px; height:25%; background:rgba(34,197,94,0.15); border:1px solid #22c55e; border-radius:8px; padding:10px;">
                            <strong style="font-size:12px; color:#22c55e;">Projet Code</strong>
                            <div style="font-size:10px; color:var(--text-muted); margin-top:4px;">16:00 - 18:00</div>
                        </div>
                    </div>

                    <!-- JEU -->
                    <div style="position:relative; border-left:1px dashed rgba(255,255,255,0.05);">
                    </div>

                    <!-- VEN -->
                    <div style="position:relative; border-left:1px dashed rgba(255,255,255,0.05);">
                         <div style="position:absolute; top:5%; left:5px; right:5px; height:25%; background:rgba(250,204,21,0.15); border:1px solid #facc15; border-radius:8px; padding:10px;">
                            <strong style="font-size:12px; color:#facc15;">Physique</strong>
                            <div style="font-size:10px; color:var(--text-muted); margin-top:4px;">08:30 - 10:30</div>
                        </div>
                    </div>

                </div>
            </div>

            <!-- RIGHT PANEL (Option D Right part) -->
            <div style="display:flex; flex-direction:column; gap:20px;">
                
                <!-- OBJECTIFS DU MOIS -->
                <div class="bureau-card">
                    <span class="bureau-eyebrow">Objectifs du mois</span>
                    <div style="margin-top:20px; display:flex; flex-direction:column; gap:20px;">
                        <div>
                            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                                <strong style="font-size:14px;">Anglais</strong>
                                <span style="font-size:12px; color:var(--text-muted);">8/10h</span>
                            </div>
                            <div style="height:6px; background:var(--bg-main); border-radius:3px;">
                                <div style="width:80%; height:100%; background:#0ea5e9; border-radius:3px;"></div>
                            </div>
                        </div>
                        <div>
                            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                                <strong style="font-size:14px;">Projet Code</strong>
                                <span style="font-size:12px; color:var(--text-muted);">12/15h</span>
                            </div>
                            <div style="height:6px; background:var(--bg-main); border-radius:3px;">
                                <div style="width:80%; height:100%; background:#22c55e; border-radius:3px;"></div>
                            </div>
                        </div>
                        <div>
                            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                                <strong style="font-size:14px;">Sport</strong>
                                <span style="font-size:12px; color:var(--text-muted);">3/8h</span>
                            </div>
                            <div style="height:6px; background:var(--bg-main); border-radius:3px;">
                                <div style="width:37%; height:100%; background:#8b5cf6; border-radius:3px;"></div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- ALERTS -->
                <div class="bureau-card" style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3);">
                    <div style="color: #ef4444; font-weight:bold; font-size:14px; display:flex; align-items:center; gap:8px;">
                        <span>⚠️</span> 2 examens
                    </div>
                    <div style="margin-top:15px; display:flex; flex-direction:column; gap:10px;">
                        <div style="font-size:14px;">
                            <strong>Mathématiques</strong><br>
                            <span style="color:var(--text-muted); font-size:12px;">15 Juin 2026</span>
                        </div>
                        <div style="font-size:14px;">
                            <strong>Physique</strong><br>
                            <span style="color:var(--text-muted); font-size:12px;">18 Juin 2026</span>
                        </div>
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
