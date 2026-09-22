export class DesktopView {
    constructor(containerId, app) {
        this.container = document.getElementById(containerId);
        this.app = app;
    }

    render(state) {
        document.body.className = 'theme-cyber';
        const userName = state.userProfile?.name || 'Mathieu';
        
        // Obtenir la date en format long (ex: Lundi 23 Juin 2026)
        const dateOptions = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
        let dateStr = new Date().toLocaleDateString('fr-FR', dateOptions);
        dateStr = dateStr.charAt(0).toUpperCase() + dateStr.slice(1);

        let html = `
<div class="bureau">
    <!-- SIDEBAR -->
    <div class="bureau-sidebar">
        <div style="font-size:24px; font-weight:bold; margin-bottom:40px; display:flex; align-items:center; gap:10px;">
            <div style="width:30px; height:30px; border-radius:8px; background:var(--accent-primary); display:flex; align-items:center; justify-content:center; color:#fff;">⚡</div>
            Learning OS
        </div>
        
        <!-- ONGLETS -->
        <div style="display:flex; flex-direction:column; gap:15px; flex-grow:1;">
            <div class="bureau-nav-item active" data-view="desktop">
                <span class="nav-icon">🏠</span> Bureau
            </div>
            <div class="bureau-nav-item" data-view="planning">
                <span class="nav-icon">📅</span> Planning
            </div>
            <div class="bureau-nav-item" data-view="academic">
                <span class="nav-icon">🎓</span> School
            </div>
            <div class="bureau-nav-item" data-view="languages">
                <span class="nav-icon">🌐</span> Langues
            </div>
            <div class="bureau-nav-item" data-view="life">
                <span class="nav-icon">🌟</span> Projets
            </div>
            <!-- Ressources transversal n'est plus une vue complète, mais on le garde visuellement -->
            <div class="bureau-nav-item" data-view="ressources">
                <span class="nav-icon">📚</span> Ressources
            </div>
            <div class="bureau-nav-item" data-view="chat">
                <span class="nav-icon">🤖</span> Coach
            </div>
            <div class="bureau-nav-item" data-view="objectifs">
                <span class="nav-icon">🎯</span> Objectifs
            </div>
            <div class="bureau-nav-item" data-view="parametres" style="margin-top:auto;">
                <span class="nav-icon">⚙️</span> Paramètres
            </div>
        </div>
        
        <!-- WIDGET XP -->
        <div style="background:var(--bg-card); padding:15px; border-radius:12px; margin-top:20px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                <span style="font-size:12px; font-weight:bold;">Niveau 12</span>
                <span style="font-size:10px; color:var(--text-muted);">1245 / 5000 XP</span>
            </div>
            <div style="height:6px; background:var(--border-color); border-radius:3px; overflow:hidden;">
                <div style="height:100%; width:25%; background:var(--accent-primary); border-radius:3px;"></div>
            </div>
        </div>
    </div>

    <!-- MAIN CONTENT -->
    <div class="bureau-content">
        <!-- TOPBAR -->
        <div class="bureau-topbar">
            <div>
                <span style="font-size:14px; color:var(--text-muted);">${dateStr}</span>
                <h1 style="margin:5px 0 0 0; font-size:24px;">Bonjour, ${userName}</h1>
            </div>
            <div style="display:flex; align-items:center; gap:20px;">
                <div style="display:flex; align-items:center; gap:10px; background:var(--bg-card); padding:10px 15px; border-radius:20px;">
                    <span>⛅</span>
                    <span style="font-weight:bold;">22°</span>
                    <span style="color:var(--text-muted);">Paris</span>
                </div>
                <div style="display:flex; align-items:center; gap:10px; background:var(--bg-card); padding:10px 15px; border-radius:20px;">
                    <span>🕒</span>
                    <span style="font-weight:bold;">10:24</span>
                </div>
                <div style="width:40px; height:40px; border-radius:50%; background:var(--accent-primary); display:flex; align-items:center; justify-content:center; color:white; font-weight:bold; font-size:18px;">
                    ${userName.charAt(0)}
                </div>
            </div>
        </div>

        <!-- GRID PRINCIPALE -->
        <div style="display:grid; grid-template-columns: repeat(3, 1fr); grid-auto-rows: minmax(180px, auto); gap:20px;">
            
            <!-- ROW 1 -->
            <!-- Session en cours -->
            <div class="bureau-card" style="background: linear-gradient(135deg, var(--accent-primary), #0a1128); color:white; display:flex; flex-direction:column; justify-content:space-between;">
                <div>
                    <span style="font-size:12px; text-transform:uppercase; letter-spacing:1px; opacity:0.8;">Session en cours</span>
                    <h3 style="margin:10px 0 5px 0; font-size:20px;">Anglais (Grammaire)</h3>
                    <span style="font-size:14px; opacity:0.8;">45 min restantes</span>
                </div>
                <div style="display:flex; align-items:center; gap:15px; margin-top:20px;">
                    <button style="background:white; color:var(--accent-primary); border:none; padding:10px 20px; border-radius:8px; font-weight:bold; cursor:pointer; flex-grow:1;">
                        Voir le cours
                    </button>
                    <button style="background:rgba(255,255,255,0.2); color:white; border:none; width:40px; height:40px; border-radius:8px; display:flex; align-items:center; justify-content:center; cursor:pointer;">
                        ▶
                    </button>
                </div>
            </div>

            <!-- Prochains rendez-vous -->
            <div class="bureau-card">
                <h3 style="margin:0 0 20px 0; font-size:16px;">Prochains rendez-vous</h3>
                <div style="display:flex; flex-direction:column; gap:15px;">
                    <div style="display:flex; gap:15px;">
                        <div style="display:flex; flex-direction:column; align-items:center; min-width:40px;">
                            <strong style="font-size:14px;">11:00</strong>
                            <span style="font-size:12px; color:var(--text-muted);">13:00</span>
                        </div>
                        <div style="border-left:2px solid var(--accent-primary); padding-left:15px;">
                            <strong style="font-size:14px;">Algèbre linéaire</strong>
                            <div style="font-size:12px; color:var(--text-muted); margin-top:3px;">Amphi B</div>
                        </div>
                    </div>
                    <div style="display:flex; gap:15px;">
                        <div style="display:flex; flex-direction:column; align-items:center; min-width:40px;">
                            <strong style="font-size:14px;">14:30</strong>
                            <span style="font-size:12px; color:var(--text-muted);">16:00</span>
                        </div>
                        <div style="border-left:2px solid #84a98c; padding-left:15px;">
                            <strong style="font-size:14px;">Projet de groupe JS</strong>
                            <div style="font-size:12px; color:var(--text-muted); margin-top:3px;">Salle 124</div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- 3 révisions -->
            <div class="bureau-card">
                <h3 style="margin:0 0 20px 0; font-size:16px; color:#f43f5e;">⚠️ 3 révisions en retard</h3>
                <div style="display:flex; flex-direction:column; gap:12px;">
                    <div style="background:var(--bg-main); padding:10px 15px; border-radius:8px; display:flex; justify-content:space-between; align-items:center; border: 1px solid rgba(244, 63, 94, 0.2);">
                        <strong style="font-size:14px;">Résistance des matériaux</strong>
                        <span style="font-size:12px; color:#f43f5e; background:rgba(244,63,94,0.1); padding:3px 8px; border-radius:12px;">-2 jours</span>
                    </div>
                    <div style="background:var(--bg-main); padding:10px 15px; border-radius:8px; display:flex; justify-content:space-between; align-items:center; border: 1px solid rgba(244, 63, 94, 0.2);">
                        <strong style="font-size:14px;">Physique quantique</strong>
                        <span style="font-size:12px; color:#f43f5e; background:rgba(244,63,94,0.1); padding:3px 8px; border-radius:12px;">-1 jour</span>
                    </div>
                    <div style="background:var(--bg-main); padding:10px 15px; border-radius:8px; display:flex; justify-content:space-between; align-items:center; border: 1px solid rgba(244, 63, 94, 0.2);">
                        <strong style="font-size:14px;">Bases de données SQL</strong>
                        <span style="font-size:12px; color:#f43f5e; background:rgba(244,63,94,0.1); padding:3px 8px; border-radius:12px;">-1 jour</span>
                    </div>
                </div>
            </div>

            <!-- ROW 2 -->
            <!-- Raccourcis -->
            <div class="bureau-card" style="grid-column: 1 / 3;">
                <h3 style="margin:0 0 20px 0; font-size:16px;">Raccourcis</h3>
                <div style="display:grid; grid-template-columns: repeat(4, 1fr); gap:15px;">
                    <div style="display:flex; flex-direction:column; align-items:center; gap:8px; cursor:pointer; padding:15px; background:var(--bg-main); border-radius:12px; border:1px solid var(--border-color); transition:all 0.2s;">
                        <span style="font-size:24px;">🧠</span>
                        <span style="font-size:12px; font-weight:bold;">Anki</span>
                    </div>
                    <div style="display:flex; flex-direction:column; align-items:center; gap:8px; cursor:pointer; padding:15px; background:var(--bg-main); border-radius:12px; border:1px solid var(--border-color); transition:all 0.2s;">
                        <span style="font-size:24px;">📓</span>
                        <span style="font-size:12px; font-weight:bold;">Notion</span>
                    </div>
                    <div style="display:flex; flex-direction:column; align-items:center; gap:8px; cursor:pointer; padding:15px; background:var(--bg-main); border-radius:12px; border:1px solid var(--border-color); transition:all 0.2s;">
                        <span style="font-size:24px;">🐙</span>
                        <span style="font-size:12px; font-weight:bold;">GitHub</span>
                    </div>
                    <div style="display:flex; flex-direction:column; align-items:center; gap:8px; cursor:pointer; padding:15px; background:var(--bg-main); border-radius:12px; border:1px solid var(--border-color); transition:all 0.2s;">
                        <span style="font-size:24px;">▶️</span>
                        <span style="font-size:12px; font-weight:bold;">YouTube</span>
                    </div>
                    <div style="display:flex; flex-direction:column; align-items:center; gap:8px; cursor:pointer; padding:15px; background:var(--bg-main); border-radius:12px; border:1px solid var(--border-color); transition:all 0.2s;">
                        <span style="font-size:24px;">🎨</span>
                        <span style="font-size:12px; font-weight:bold;">Figma</span>
                    </div>
                    <div style="display:flex; flex-direction:column; align-items:center; gap:8px; cursor:pointer; padding:15px; background:var(--bg-main); border-radius:12px; border:1px solid var(--border-color); transition:all 0.2s;">
                        <span style="font-size:24px;">🎵</span>
                        <span style="font-size:12px; font-weight:bold;">Spotify</span>
                    </div>
                    <div style="display:flex; flex-direction:column; align-items:center; gap:8px; cursor:pointer; padding:15px; background:var(--bg-main); border-radius:12px; border:1px solid var(--border-color); transition:all 0.2s;">
                        <span style="font-size:24px;">📁</span>
                        <span style="font-size:12px; font-weight:bold;">Drive</span>
                    </div>
                    <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; gap:8px; cursor:pointer; padding:15px; background:var(--bg-main); border-radius:12px; border:1px dashed var(--border-color); color:var(--text-muted); transition:all 0.2s;">
                        <span style="font-size:20px;">+</span>
                        <span style="font-size:12px;">Ajouter</span>
                    </div>
                </div>
            </div>

            <!-- Progrès langues -->
            <div class="bureau-card">
                <h3 style="margin:0 0 20px 0; font-size:16px;">Progrès langues</h3>
                <div style="display:flex; flex-direction:column; gap:20px; flex-grow:1; justify-content:center;">
                    <div style="display:flex; align-items:center; gap:15px;">
                        <div style="width:50px; height:50px; border-radius:50%; border:4px solid var(--accent-primary); display:flex; align-items:center; justify-content:center; font-weight:bold; font-size:14px;">65%</div>
                        <div>
                            <strong style="display:block; font-size:14px;">Anglais</strong>
                            <span style="font-size:12px; color:var(--text-muted);">Niveau Intermédiaire B2</span>
                        </div>
                    </div>
                    <div style="display:flex; align-items:center; gap:15px;">
                        <div style="width:50px; height:50px; border-radius:50%; border:4px solid #84a98c; border-top-color:transparent; display:flex; align-items:center; justify-content:center; font-weight:bold; font-size:14px;">42%</div>
                        <div>
                            <strong style="display:block; font-size:14px;">Russe</strong>
                            <span style="font-size:12px; color:var(--text-muted);">Niveau Débutant A2</span>
                        </div>
                    </div>
                    <div style="display:flex; align-items:center; gap:15px;">
                        <div style="width:50px; height:50px; border-radius:50%; border:4px solid #f43f5e; border-top-color:transparent; border-right-color:transparent; display:flex; align-items:center; justify-content:center; font-weight:bold; font-size:14px;">18%</div>
                        <div>
                            <strong style="display:block; font-size:14px;">Mandarin</strong>
                            <span style="font-size:12px; color:var(--text-muted);">Niveau Débutant A1</span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- ROW 3 -->
            <!-- Aujourd'hui -->
            <div class="bureau-card">
                <h3 style="margin:0 0 20px 0; font-size:16px;">Aujourd'hui</h3>
                <div style="display:flex; gap:20px;">
                    <div style="background:var(--bg-main); padding:20px; border-radius:12px; flex:1; text-align:center; border:1px solid var(--border-color);">
                        <strong style="font-size:32px; color:var(--accent-primary); display:block;">3</strong>
                        <span style="font-size:12px; color:var(--text-muted); text-transform:uppercase;">Sessions</span>
                    </div>
                    <div style="background:var(--bg-main); padding:20px; border-radius:12px; flex:1; text-align:center; border:1px solid var(--border-color);">
                        <strong style="font-size:32px; color:#10b981; display:block;">2<span style="font-size:16px;">h</span>45</strong>
                        <span style="font-size:12px; color:var(--text-muted); text-transform:uppercase;">Travail</span>
                    </div>
                </div>
            </div>

            <!-- Focus du jour -->
            <div class="bureau-card">
                <h3 style="margin:0 0 20px 0; font-size:16px;">Focus du jour</h3>
                <div style="background:rgba(16, 185, 129, 0.1); border:1px solid rgba(16, 185, 129, 0.3); border-radius:12px; padding:20px; display:flex; align-items:center; gap:20px;">
                    <div style="width:60px; height:60px; border-radius:50%; background:#10b981; color:white; display:flex; align-items:center; justify-content:center; font-size:24px; font-weight:bold;">
                        2/3
                    </div>
                    <div>
                        <strong style="font-size:18px; display:block; margin-bottom:5px; color:#10b981;">Réviser Anglais</strong>
                        <span style="font-size:14px; color:var(--text-muted);">Vous êtes sur la bonne voie, continuez !</span>
                    </div>
                </div>
            </div>

            <!-- Le Coach -->
            <div class="bureau-card" style="background: linear-gradient(to right, var(--bg-card), rgba(16,185,129,0.05)); border: 1px solid rgba(16,185,129,0.2);">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
                    <h3 style="margin:0; font-size:16px;">Le Coach</h3>
                    <span style="font-size:20px;">🤖</span>
                </div>
                <div style="background:var(--bg-main); padding:15px; border-radius:12px; border-bottom-left-radius:2px; font-size:14px; line-height:1.5; color:var(--text-main); margin-bottom:15px; border:1px solid var(--border-color);">
                    "Tu as fait un super boulot sur ton projet hier. Aujourd'hui, concentre-toi sur l'algèbre pour ne pas prendre de retard. Prêt ?"
                </div>
                <div style="display:flex; gap:10px;">
                    <input type="text" placeholder="Demander conseil..." style="flex:1; padding:10px 15px; border-radius:8px; border:1px solid var(--border-color); background:var(--bg-main); color:var(--text-main);">
                    <button style="background:var(--accent-primary); color:white; border:none; padding:0 20px; border-radius:8px; cursor:pointer;">➔</button>
                </div>
            </div>

        </div>
    </div>
</div>
        `;
        
        this.container.innerHTML = html;

        // Navigation locale
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
