export class LifeView {
    constructor(containerId, app) {
        this.container = document.getElementById(containerId);
        this.app = app;
    }
    
    async render(state) {
        if (typeof document !== 'undefined' && document.body) {
            document.body.className = 'theme-warm';
        }

        const habits = await this.app.scheduler.getHabits() || [];
        const goals = (this.app.projectEngine && typeof this.app.projectEngine.getGoals === 'function') 
            ? await this.app.projectEngine.getGoals() : [];

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
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
                        <div style="display:flex; align-items:center; gap:8px;">
                            <i class="bi bi-check2-square" style="color:var(--accent-primary); font-size:18px;"></i>
                            <h3 style="margin:0; font-size:16px;">Habitudes (Toutes)</h3>
                        </div>
                        <button type="button" class="btn-open-modal" data-type="habit" style="background:transparent; border:none; color:var(--accent-primary); cursor:pointer;">
                            <i class="bi bi-plus-circle" style="font-size:18px;"></i>
                        </button>
                    </div>
                    <div style="display:flex; flex-direction:column; gap:10px;">
                        ${habits.length > 0 ? habits.map(h => `
                            <div style="display:flex; justify-content:space-between; align-items:center; gap:10px;">
                                <div style="display:flex; align-items:center; gap:10px;">
                                    <span style="font-size:14px; color:var(--text-main);">${h.title}</span>
                                </div>
                                <div style="display:flex; gap:8px;">
                                    <button class="btn-edit-item" data-id="${h.id}" data-type="habit" style="background:transparent; border:none; color:var(--accent-primary); cursor:pointer;"><i class="bi bi-pencil"></i></button>
                                    <button class="btn-delete-item" data-id="${h.id}" data-type="habit" style="background:transparent; border:none; color:#f44336; cursor:pointer;"><i class="bi bi-trash"></i></button>
                                </div>
                            </div>
                        `).join('') : '<p style="font-size:13px; color:var(--text-muted); margin:0;">Aucune habitude enregistrée.</p>'}
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
                    
                    <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px solid var(--border-color);">
                        <span style="font-size:14px;">💧 Hydratation</span>
                        <strong style="font-size:14px; color:var(--accent-primary);">${state?.todayCheckIn?.water ? state.todayCheckIn.water + ' L' : 'Non renseigné'}</strong>
                    </div>
                    <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px solid var(--border-color);">
                        <span style="font-size:14px;">😴 Sommeil</span>
                        <strong style="font-size:14px; color:var(--accent-primary);">${state?.todayCheckIn?.sleep?.durationMinutes ? (Math.round((state.todayCheckIn.sleep.durationMinutes / 60) * 10) / 10) + ' h' : 'Non renseigné'}</strong>
                    </div>
                    <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px solid var(--border-color);">
                        <span style="font-size:14px;">⚡ Énergie</span>
                        <strong style="font-size:14px; color:var(--accent-primary);">${state?.todayCheckIn?.energy ? (state.todayCheckIn.energy === 'high' ? '🟢 Haute' : state.todayCheckIn.energy === 'medium' ? '🟡 Moyenne' : '🔴 Basse') : 'Non renseigné'}</strong>
                    </div>
                    <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 0;">
                        <span style="font-size:14px;">📈 Bilan du jour</span>
                        <strong style="font-size:14px; color:var(--accent-primary);">${state?.todayCheckIn?.dayAssessment ? state.todayCheckIn.dayAssessment : 'Non renseigné'}</strong>
                    </div>
                </div>
            </div>

            <!-- SPOTIFY & PASSIONS (COL 3) -->
            <div style="display:flex; flex-direction:column; gap:20px;">
                <!-- Spotify -->
                <div class="bureau-card" style="background:#1db954; border-radius:12px; padding:20px; color:white;">
                    <div style="display:flex; align-items:center; gap:10px; margin-bottom:15px;">
                        <i class="bi bi-spotify" style="font-size:24px;"></i>
                        <h3 style="margin:0; font-size:16px;">Ambiance Musicale</h3>
                    </div>
                    <p style="font-size:13px; opacity:0.9; margin: 0 0 15px 0; line-height: 1.4;">
                        Lance ta musique ou playlist de concentration pour accompagner tes sessions de focus.
                    </p>
                    <a href="https://open.spotify.com" target="_blank" rel="noopener noreferrer" style="display:inline-flex; align-items:center; gap:8px; background:white; color:#1db954; font-weight:bold; padding:8px 16px; border-radius:20px; text-decoration:none; font-size:13px; box-shadow:0 2px 8px rgba(0,0,0,0.2);">
                        <i class="bi bi-box-arrow-up-right"></i> Ouvrir Spotify
                    </a>
                </div>

                <!-- Objectifs -->
                <div class="bureau-card" style="background:var(--bg-card); border-radius:12px; border:1px solid var(--border-color); padding:20px; flex:1;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
                        <div style="display:flex; align-items:center; gap:8px;">
                            <i class="bi bi-bullseye" style="color:#8b5cf6; font-size:18px;"></i>
                            <h3 style="margin:0; font-size:16px;">Objectifs & Jalons</h3>
                        </div>
                        <button type="button" class="btn-open-modal" data-type="goal" style="background:transparent; border:none; color:var(--accent-primary); cursor:pointer;">
                            <i class="bi bi-plus-circle" style="font-size:18px;"></i>
                        </button>
                    </div>
                    <div style="display:flex; flex-direction:column; gap:10px;">
                        ${goals.length > 0 ? goals.map(g => `
                            <div style="display:flex; align-items:center; justify-content:space-between; padding:10px; background:var(--bg-main); border-radius:8px;">
                                <div>
                                    <div style="font-size:14px; font-weight:500;">${g.title}</div>
                                    <div style="font-size:12px; color:var(--text-muted);">Deadline: ${g.deadline || 'Aucune'}</div>
                                </div>
                                <div style="display:flex; align-items:center; gap:10px;">
                                    <span style="font-size:12px; font-weight:bold; color:var(--accent-primary);">${g.progress}%</span>
                                    <button class="btn-edit-item" data-id="${g.id}" data-type="goal" style="background:transparent; border:none; color:var(--accent-primary); cursor:pointer;"><i class="bi bi-pencil"></i></button>
                                </div>
                            </div>
                        `).join('') : '<p style="font-size:13px; color:var(--text-muted); margin:0;">Aucun objectif défini.</p>'}
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
                if (viewName) {
                    this.app.renderView(viewName);
                }
            });
        });

        // Event listeners pour les boutons Edit/Delete (Habitudes)
        this.container.querySelectorAll('.btn-open-modal').forEach(btn => {
            btn.addEventListener('click', () => {
                const type = btn.getAttribute('data-type') || 'habit';
                this.app.openGlobalItemEditor({ type });
            });
        });

        this.container.querySelectorAll('.btn-edit-item').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.currentTarget.getAttribute('data-id');
                const type = e.currentTarget.getAttribute('data-type');
                let item = null;
                if (type === 'habit') item = (await this.app.scheduler.getHabits()).find(i => i.id === id);
                if (type === 'goal') item = (await this.app.projectEngine.getGoals()).find(i => i.id === id);
                if (item) this.app.openGlobalItemEditor({ ...item, type });
            });
        });

        this.container.querySelectorAll('.btn-delete-item').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.currentTarget.getAttribute('data-id');
                const type = e.currentTarget.getAttribute('data-type');
                if (confirm('Êtes-vous sûr de vouloir supprimer cet élément ?')) {
                    if (type === 'habit') await this.app.scheduler.deleteHabit(id);
                    if (type === 'goal') await this.app.projectEngine.deleteGoal(id);
                    this.app.renderView('life');
                }
            });
        });
    }
}
