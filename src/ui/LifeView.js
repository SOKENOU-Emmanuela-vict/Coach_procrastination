export class LifeView {
    constructor(containerId, app) {
        this.container = document.getElementById(containerId);
        this.app = app;
    }
    
    render(state) {
        if (typeof document !== 'undefined' && document.body) {
            document.body.className = 'theme-warm';
        }

        const habits = state.dailyPlan?.habits || [
            { title: "Méditation 10 min", time: "Matin", completed: true },
            { title: "Lecture 20 pages", time: "Soir", completed: false }
        ];

        let html = `
<div class="bureau" style="display:flex; height:100vh;">
    <!-- SIDEBAR -->
    <div class="bureau-sidebar" style="width: 250px; background: var(--bg-sidebar); border-right: 1px solid var(--border-color); padding: 20px; display: flex; flex-direction: column;">
        <div style="font-size:24px; font-weight:bold; margin-bottom:40px; display:flex; align-items:center; gap:10px;">
            <div style="width:30px; height:30px; border-radius:8px; background:var(--bg-main); border:1px solid var(--border-color); display:flex; align-items:center; justify-content:center; color:var(--text-main);">
                <i class="bi bi-book"></i>
            </div>
            Learning OS
        </div>
        
        <!-- ONGLETS -->
        <div style="display:flex; flex-direction:column; gap:5px; flex-grow:1; padding-right:15px;">
            <div class="bureau-nav-item" data-view="desktop" style="display:flex; align-items:center; gap:12px; cursor:pointer; padding:12px 15px; color:var(--text-muted); font-weight:500;">
                <i class="bi bi-house-door" style="font-size:18px;"></i> Bureau
            </div>
            <div class="bureau-nav-item" data-view="planning" style="display:flex; align-items:center; gap:12px; cursor:pointer; padding:12px 15px; color:var(--text-muted); font-weight:500;">
                <i class="bi bi-calendar3" style="font-size:18px;"></i> Planning
            </div>
            <div class="bureau-nav-item" data-view="academic" style="display:flex; align-items:center; gap:12px; cursor:pointer; padding:12px 15px; color:var(--text-muted); font-weight:500;">
                <i class="bi bi-mortarboard" style="font-size:18px;"></i> School
            </div>
            <div class="bureau-nav-item" data-view="languages" style="display:flex; align-items:center; gap:12px; cursor:pointer; padding:12px 15px; color:var(--text-muted); font-weight:500;">
                <i class="bi bi-globe" style="font-size:18px;"></i> Langues
            </div>
            <div class="bureau-nav-item active" data-view="life" style="display:flex; align-items:center; gap:12px; cursor:pointer; background:rgba(14, 165, 233, 0.1); border-left:4px solid var(--accent-primary); border-radius:0 8px 8px 0; padding:12px 15px 12px 11px; color:var(--text-main); font-weight:600;">
                <i class="bi bi-star" style="font-size:18px; color:var(--accent-primary);"></i> Life
            </div>
            <div class="bureau-nav-item" data-view="portfolio" style="display:flex; align-items:center; gap:12px; cursor:pointer; padding:12px 15px; color:var(--text-muted); font-weight:500;">
                <i class="bi bi-kanban" style="font-size:18px;"></i> Projets
            </div>
            <div class="bureau-nav-item" data-view="chat" style="display:flex; align-items:center; gap:12px; cursor:pointer; padding:12px 15px; color:var(--text-muted); font-weight:500;">
                <i class="bi bi-robot" style="font-size:18px;"></i> Coach
            </div>
        </div>
    </div>

    <!-- MAIN CONTENT -->
    <div class="bureau-content" style="flex: 1; padding: 30px; overflow-y: auto; background: var(--bg-main);">
        <!-- TOPBAR: IMAGE A GAUCHE, QUOTE A DROITE -->
        <div style="display:flex; gap:30px; margin-bottom:40px; height: 300px; border-radius:16px; overflow:hidden; background:var(--bg-card); border:1px solid var(--border-color); box-shadow:0 10px 30px rgba(0,0,0,0.1);">
            <!-- Image de fond gauche -->
            <div style="flex:1; background: url('https://images.unsplash.com/photo-1542051812871-75f822180862?q=80&w=1000') center/cover;">
                <div style="width:100%; height:100%; background:linear-gradient(to right, rgba(0,0,0,0.2), rgba(0,0,0,0.7)); display:flex; align-items:flex-end; padding:30px;">
                    <h2 style="color:white; margin:0; font-size:32px; font-weight:bold; letter-spacing:2px;">STAY FOCUSED</h2>
                </div>
            </div>
            <!-- Quote à droite -->
            <div style="flex:1; display:flex; flex-direction:column; justify-content:center; padding:40px; position:relative;">
                <i class="bi bi-quote" style="position:absolute; top:20px; left:20px; font-size:60px; color:var(--text-muted); opacity:0.2;"></i>
                <p style="font-size:24px; font-weight:500; font-style:italic; line-height:1.5; color:var(--text-main); margin-bottom:20px; z-index:1;">
                    "Tu ne peux pas changer ton passé, mais tu peux détruire ton futur si tu restes bloqué dessus."
                </p>
                <div style="text-align:right;">
                    <strong style="color:var(--accent-primary); font-size:18px;">— Miyamoto Musashi</strong>
                </div>
            </div>
        </div>

        <!-- WIDGETS GRID -->
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px;">
            
            <!-- HABITS & LANGUES (COL 1) -->
            <div style="display:flex; flex-direction:column; gap:20px;">
                <!-- Habitudes -->
                <div class="bureau-card" style="background:var(--bg-card); border-radius:12px; border:1px solid var(--border-color); padding:20px;">
                    <div style="display:flex; align-items:center; gap:8px; margin-bottom:15px;">
                        <i class="bi bi-check2-square" style="color:var(--accent-primary); font-size:18px;"></i>
                        <h3 style="margin:0; font-size:16px;">Habitudes du jour</h3>
                    </div>
                    <div style="display:flex; flex-direction:column; gap:10px;">
                        ${habits.map(h => `
                            <div style="display:flex; align-items:center; gap:10px;">
                                <div style="width:20px; height:20px; border-radius:4px; border:2px solid ${h.completed ? 'var(--accent-primary)' : 'var(--border-color)'}; background:${h.completed ? 'var(--accent-primary)' : 'transparent'}; display:flex; align-items:center; justify-content:center; color:white;">
                                    ${h.completed ? '<i class="bi bi-check" style="font-size:16px;"></i>' : ''}
                                </div>
                                <span style="font-size:14px; text-decoration:${h.completed ? 'line-through' : 'none'}; color:${h.completed ? 'var(--text-muted)' : 'var(--text-main)'};">${h.title}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>


            </div>

            <!-- FITNESS & WELLNESS (COL 2) -->
            <div style="display:flex; flex-direction:column; gap:20px;">
                <div class="bureau-card" style="background:var(--bg-card); border-radius:12px; border:1px solid var(--border-color); padding:20px; flex:1;">
                    <div style="display:flex; align-items:center; gap:8px; margin-bottom:20px;">
                        <i class="bi bi-heart-pulse-fill" style="color:#f43f5e; font-size:18px;"></i>
                        <h3 style="margin:0; font-size:16px;">Fitness & Bien-être</h3>
                    </div>
                    
                    <div style="text-align:center; margin-bottom:20px;">
                        <div style="width:120px; height:120px; border-radius:50%; border:8px solid #f43f5e; display:flex; flex-direction:column; align-items:center; justify-content:center; margin:0 auto;">
                            <strong style="font-size:24px;">1850</strong>
                            <span style="font-size:12px; color:var(--text-muted);">kcal brûlées</span>
                        </div>
                    </div>

                    <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px solid var(--border-color);">
                        <span style="font-size:14px;">💧 Hydratation</span>
                        <strong style="font-size:14px;">1.5 / 2L</strong>
                    </div>
                    <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px solid var(--border-color);">
                        <span style="font-size:14px;">🏃 Pas</span>
                        <strong style="font-size:14px;">8,432</strong>
                    </div>
                    <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 0;">
                        <span style="font-size:14px;">😴 Sommeil</span>
                        <strong style="font-size:14px;">7h 30m</strong>
                    </div>
                </div>
            </div>

            <!-- SPOTIFY & PASSIONS (COL 3) -->
            <div style="display:flex; flex-direction:column; gap:20px;">
                <!-- Spotify -->
                <div class="bureau-card" style="background:#1db954; border-radius:12px; padding:20px; color:white;">
                    <div style="display:flex; align-items:center; gap:10px; margin-bottom:20px;">
                        <i class="bi bi-spotify" style="font-size:24px;"></i>
                        <h3 style="margin:0; font-size:16px;">Now Playing</h3>
                    </div>
                    <div style="display:flex; align-items:center; gap:15px;">
                        <div style="width:60px; height:60px; background:#fff; border-radius:8px; overflow:hidden;">
                            <img src="https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?q=80&w=150" style="width:100%; height:100%; object-fit:cover;">
                        </div>
                        <div>
                            <strong style="display:block; font-size:14px; margin-bottom:5px;">Dark Knight OST</strong>
                            <span style="font-size:12px; opacity:0.8;">Hans Zimmer</span>
                        </div>
                    </div>
                    <div style="margin-top:20px; display:flex; align-items:center; justify-content:center; gap:20px; font-size:20px;">
                        <i class="bi bi-skip-backward-fill" style="cursor:pointer;"></i>
                        <i class="bi bi-pause-circle-fill" style="font-size:32px; cursor:pointer;"></i>
                        <i class="bi bi-skip-forward-fill" style="cursor:pointer;"></i>
                    </div>
                </div>

                <!-- Passions & Hobbies -->
                <div class="bureau-card" style="background:var(--bg-card); border-radius:12px; border:1px solid var(--border-color); padding:20px; flex:1;">
                    <div style="display:flex; align-items:center; gap:8px; margin-bottom:15px;">
                        <i class="bi bi-palette" style="color:#8b5cf6; font-size:18px;"></i>
                        <h3 style="margin:0; font-size:16px;">Passions & Hobbies</h3>
                    </div>
                    <div style="display:flex; flex-direction:column; gap:10px;">
                        <div style="display:flex; align-items:center; justify-content:space-between; padding:10px; background:var(--bg-main); border-radius:8px;">
                            <div style="display:flex; align-items:center; gap:10px;">
                                <i class="bi bi-brush" style="font-size:18px;"></i>
                                <span style="font-size:14px; font-weight:500;">Dessin</span>
                            </div>
                            <span style="font-size:12px; color:var(--text-muted);">2h cette sem.</span>
                        </div>
                        <div style="display:flex; align-items:center; justify-content:space-between; padding:10px; background:var(--bg-main); border-radius:8px;">
                            <div style="display:flex; align-items:center; gap:10px;">
                                <i class="bi bi-scissors" style="font-size:18px;"></i>
                                <span style="font-size:14px; font-weight:500;">Couture</span>
                            </div>
                            <span style="font-size:12px; color:var(--text-muted);">Nouvelle pièce</span>
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
                const viewName = e.currentTarget.getAttribute('data-view');
                if (viewName && this.app.router) {
                    this.app.router.render(viewName, this.app.state);
                }
            });
        });
    }
}
