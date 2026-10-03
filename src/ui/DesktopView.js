export class DesktopView {
    constructor(containerId, app) {
        this.container = document.getElementById(containerId);
        this.app = app;
    }

    render(state) {
        if (typeof document !== 'undefined' && document.body) {
            document.body.className = 'theme-cyber';
        }
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
        <div style="display:flex; flex-direction:column; gap:5px; flex-grow:1; padding-right:15px;">
            <div class="bureau-nav-item active" data-view="desktop" style="display:flex; align-items:center; gap:12px; cursor:pointer; background:rgba(14, 165, 233, 0.1); border-left:4px solid var(--accent-primary); border-radius:0 8px 8px 0; padding:12px 15px 12px 11px; color:var(--text-main); font-weight:600;">
                <i class="bi bi-house-door" style="font-size:18px; color:var(--accent-primary);"></i> Bureau
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
            <div class="bureau-nav-item" data-view="life" style="display:flex; align-items:center; gap:12px; cursor:pointer; padding:12px 15px; color:var(--text-muted); font-weight:500;">
                <i class="bi bi-star" style="font-size:18px;"></i> Life
            </div>
            <div class="bureau-nav-item" data-view="chat" style="display:flex; align-items:center; gap:12px; cursor:pointer; padding:12px 15px; color:var(--text-muted); font-weight:500;">
                <i class="bi bi-robot" style="font-size:18px;"></i> Coach
            </div>
        </div>
        <!-- WIDGET XP -->
        <div style="background:var(--bg-card); padding:15px; border-radius:12px; margin-top:20px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                <span style="font-size:12px; font-weight:bold;">Niveau ${state.userProfile?.gamification?.level || 1}</span>
                <span style="font-size:10px; color:var(--text-muted);">${state.userProfile?.gamification?.xp || 0} / ${state.userProfile?.gamification?.nextLevelXp || 1000} XP</span>
            </div>
            <div style="height:6px; background:var(--border-color); border-radius:3px; overflow:hidden;">
                <div style="height:100%; width:${Math.min(100, ((state.userProfile?.gamification?.xp || 0) / (state.userProfile?.gamification?.nextLevelXp || 1000)) * 100)}%; background:var(--accent-primary); border-radius:3px;"></div>
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
                ${(() => {
                    const now = new Date();
                    const currentDateStr = now.toLocaleDateString('fr-CA');
                    const currentTimeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
                    const todayEvents = (state.calendarData?.events || []).filter(e => e.date === currentDateStr);
                    let currentEvent = null;
                    todayEvents.forEach(e => {
                        if (!e.startTime) return;
                        const startH = parseInt(e.startTime.split(':')[0]);
                        const startM = parseInt(e.startTime.split(':')[1] || 0);
                        let endH = startH + 1, endM = startM;
                        if (e.endTime) {
                            endH = parseInt(e.endTime.split(':')[0]);
                            endM = parseInt(e.endTime.split(':')[1] || 0);
                        } else if (e.targetDuration) {
                            const totalM = startM + e.targetDuration;
                            endH = startH + Math.floor(totalM / 60);
                            endM = totalM % 60;
                        }
                        const endTimeStr = `${endH.toString().padStart(2, '0')}:${endM.toString().padStart(2, '0')}`;
                        if (e.startTime <= currentTimeStr && endTimeStr > currentTimeStr) {
                            currentEvent = { ...e, endTimeStr };
                        }
                    });

                    if (currentEvent) {
                        return `
                        <div>
                            <span style="font-size:12px; text-transform:uppercase; letter-spacing:1px; opacity:0.8;">Session en cours</span>
                            <h3 style="margin:10px 0 5px 0; font-size:20px;">${currentEvent.title || currentEvent.type}</h3>
                            <span style="font-size:14px; opacity:0.8;">${currentEvent.startTime} - ${currentEvent.endTimeStr}</span>
                        </div>
                        <div style="display:flex; align-items:center; gap:15px; margin-top:20px;">
                            <button id="btn-desktop-course" style="background:white; color:var(--accent-primary); border:none; padding:10px 20px; border-radius:8px; font-weight:bold; cursor:pointer; flex-grow:1;">
                                Continuer
                            </button>
                        </div>`;
                    }
                    return `
                        <div>
                            <span style="font-size:12px; text-transform:uppercase; letter-spacing:1px; opacity:0.8;">Repos</span>
                            <h3 style="margin:10px 0 5px 0; font-size:20px;">Aucune session en cours</h3>
                        </div>
                    `;
                })()}
            </div>

            <!-- Prochains rendez-vous -->
            <div class="bureau-card">
                <h3 style="margin:0 0 20px 0; font-size:16px;">Prochains événements</h3>
                <div style="display:flex; flex-direction:column; gap:15px;">
                    ${(() => {
                        const now = new Date();
                        const currentDateStr = now.toLocaleDateString('fr-CA');
                        const currentTimeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
                        const todayEvents = (state.calendarData?.events || []).filter(e => e.date === currentDateStr && e.startTime > currentTimeStr);
                        todayEvents.sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));
                        
                        if (todayEvents.length === 0) return '<div style="color:var(--text-muted); font-size:14px;">Aucun événement prévu.</div>';
                        
                        return todayEvents.slice(0, 3).map((e, i) => {
                            const colors = ['var(--accent-primary)', '#84a98c', '#ef4444'];
                            const color = colors[i % colors.length];
                            return `
                            <div style="display:flex; gap:15px;">
                                <div style="display:flex; flex-direction:column; align-items:center; min-width:40px;">
                                    <strong style="font-size:14px;">${e.startTime}</strong>
                                </div>
                                <div style="border-left:2px solid ${color}; padding-left:15px;">
                                    <strong style="font-size:14px;">${e.title || e.type}</strong>
                                </div>
                            </div>`;
                        }).join('');
                    })()}
                </div>
            </div>

            <!-- Résumé Académique -->
            <div class="bureau-card">
                <h3 style="margin:0 0 20px 0; font-size:16px; display:flex; align-items:center; gap:8px; color:var(--accent-primary);">
                    <i class="bi bi-mortarboard"></i> Résumé Académique
                </h3>
                <div style="display:flex; flex-direction:column; gap:15px;">
                    <div style="background:var(--bg-main); padding:15px; border-radius:8px; display:flex; justify-content:space-between; align-items:center; border: 1px solid var(--border-color);">
                        <strong style="font-size:14px;">Moyenne Générale</strong>
                        <span style="font-size:14px; color:var(--text-muted); font-weight:bold;">${state.academicSummary?.overallAverage ? state.academicSummary.overallAverage.toFixed(1) : '--'} / 20</span>
                    </div>
                    <div style="background:var(--bg-main); padding:15px; border-radius:8px; display:flex; justify-content:space-between; align-items:center; border: 1px solid var(--border-color);">
                        <strong style="font-size:14px;">Crédits Validés</strong>
                        <span style="font-size:14px; color:var(--text-muted); font-weight:bold;">${state.academicSummary?.earnedCredits || '--'} / ${state.academicSummary?.targetCredits || '--'}</span>
                    </div>
                </div>
            </div>

            <!-- ROW 2 -->
            <!-- Raccourcis -->
            <div class="bureau-card" style="grid-column: 1 / 3;">
                <h3 style="margin:0 0 20px 0; font-size:16px;">Raccourcis</h3>
                <div style="display:grid; grid-template-columns: repeat(4, 1fr); gap:15px;">
                    <a href="https://github.com" target="_blank" style="text-decoration:none; color:inherit;">
                        <div style="display:flex; flex-direction:column; align-items:center; gap:8px; cursor:pointer; padding:15px; background:var(--bg-main); border-radius:12px; border:1px solid var(--border-color); transition:all 0.2s;">
                            <i class="bi bi-github" style="font-size:24px;"></i>
                            <span style="font-size:12px; font-weight:bold;">GitHub</span>
                        </div>
                    </a>
                    <a href="https://youtube.com" target="_blank" style="text-decoration:none; color:inherit;">
                        <div style="display:flex; flex-direction:column; align-items:center; gap:8px; cursor:pointer; padding:15px; background:var(--bg-main); border-radius:12px; border:1px solid var(--border-color); transition:all 0.2s;">
                            <i class="bi bi-youtube" style="font-size:24px; color:#ff0000;"></i>
                            <span style="font-size:12px; font-weight:bold;">YouTube</span>
                        </div>
                    </a>
                    <a href="https://google.com" target="_blank" style="text-decoration:none; color:inherit;">
                        <div style="display:flex; flex-direction:column; align-items:center; gap:8px; cursor:pointer; padding:15px; background:var(--bg-main); border-radius:12px; border:1px solid var(--border-color); transition:all 0.2s;">
                            <i class="bi bi-browser-chrome" style="font-size:24px; color:#4285F4;"></i>
                            <span style="font-size:12px; font-weight:bold;">Chrome</span>
                        </div>
                    </a>
                    <a href="https://open.spotify.com" target="_blank" style="text-decoration:none; color:inherit;">
                        <div style="display:flex; flex-direction:column; align-items:center; gap:8px; cursor:pointer; padding:15px; background:var(--bg-main); border-radius:12px; border:1px solid var(--border-color); transition:all 0.2s;">
                            <i class="bi bi-spotify" style="font-size:24px; color:#1DB954;"></i>
                            <span style="font-size:12px; font-weight:bold;">Spotify</span>
                        </div>
                    </a>
                </div>
            </div>

            <!-- Progrès langues -->
            <div class="bureau-card">
                <h3 style="margin:0 0 20px 0; font-size:16px;">Progrès langues</h3>
                <div style="display:flex; flex-direction:column; gap:20px; flex-grow:1; justify-content:center;">
                    ${(() => {
                        const langNodes = (state.learningGraph?.nodes || []).filter(n => n.type === 'language' || n.category === 'language');
                        if (langNodes.length === 0) {
                            return '<div style="color:var(--text-muted); font-size:14px; text-align:center;">Aucune langue suivie.</div>';
                        }
                        return langNodes.slice(0, 3).map((l, i) => {
                            const colors = ['var(--accent-primary)', '#84a98c', '#f43f5e'];
                            const color = colors[i % colors.length];
                            const prog = l.progress || 0;
                            return `
                            <div style="display:flex; align-items:center; gap:15px;">
                                <div style="width:50px; height:50px; border-radius:50%; border:4px solid ${color}; border-top-color:${prog < 50 ? 'transparent' : color}; display:flex; align-items:center; justify-content:center; font-weight:bold; font-size:14px;">${prog}%</div>
                                <div>
                                    <strong style="display:block; font-size:14px;">${l.title || l.name}</strong>
                                    <span style="font-size:12px; color:var(--text-muted);">Niveau ${l.level || 'Non défini'}</span>
                                </div>
                            </div>`;
                        }).join('');
                    })()}
                </div>
            </div>

            <!-- ROW 3 -->
            <!-- Aujourd'hui -->
            <div class="bureau-card">
                <h3 style="margin:0 0 20px 0; font-size:16px;">Aujourd'hui</h3>
                <div style="display:flex; gap:20px;">
                    <div style="background:var(--bg-main); padding:20px; border-radius:12px; flex:1; text-align:center; border:1px solid var(--border-color);">
                        <strong style="font-size:32px; color:var(--accent-primary); display:block;">${state.dailyPlan?.sessions?.length || 0}</strong>
                        <span style="font-size:12px; color:var(--text-muted); text-transform:uppercase;">Sessions</span>
                    </div>
                    <div style="background:var(--bg-main); padding:20px; border-radius:12px; flex:1; text-align:center; border:1px solid var(--border-color);">
                        <strong style="font-size:32px; color:#10b981; display:block;">${(state.dailyPlan?.sessions || []).filter(s => s.completed).length}</strong>
                        <span style="font-size:12px; color:var(--text-muted); text-transform:uppercase;">Complétées</span>
                    </div>
                </div>
            </div>

            <!-- Life & Bien-être -->
            <div class="bureau-card">
                <h3 style="margin:0 0 20px 0; font-size:16px;">Life & Bien-être</h3>
                <div style="display:flex; flex-direction:column; gap:15px;">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <div style="display:flex; align-items:center; gap:10px;">
                            <i class="bi bi-droplet-fill" style="color:#0ea5e9; font-size:20px;"></i>
                            <span style="font-size:14px; font-weight:bold;">Hydratation</span>
                        </div>
                        <span style="font-size:14px; font-weight:bold; color:var(--accent-primary);">${state.todayCheckIn?.water ? state.todayCheckIn.water + 'L' : '-- / 2L'}</span>
                    </div>
                    <div style="height:6px; background:var(--bg-main); border-radius:3px; overflow:hidden;">
                        <div style="height:100%; width:${state.todayCheckIn?.water ? Math.min(100, (state.todayCheckIn.water/2)*100) : 0}%; background:#0ea5e9; border-radius:3px;"></div>
                    </div>
                    
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-top:10px;">
                        <div style="display:flex; align-items:center; gap:10px;">
                            <i class="bi bi-moon-stars-fill" style="color:#8b5cf6; font-size:20px;"></i>
                            <span style="font-size:14px; font-weight:bold;">Sommeil</span>
                        </div>
                        <span style="font-size:14px; font-weight:bold; color:var(--accent-primary);">${state.todayCheckIn?.sleep ? state.todayCheckIn.sleep + 'h' : '--'}</span>
                    </div>
                    <div style="height:6px; background:var(--bg-main); border-radius:3px; overflow:hidden;">
                        <div style="height:100%; width:${state.todayCheckIn?.sleep ? Math.min(100, (state.todayCheckIn.sleep/8)*100) : 0}%; background:#8b5cf6; border-radius:3px;"></div>
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
                    "${state.coachInsights?.dailyMessage || 'Salut ! Je suis là si tu as besoin d\'aide pour t\'organiser.'}"
                </div>
                <div style="display:flex; gap:10px;">
                    <input type="text" placeholder="Demander conseil..." style="flex:1; padding:10px 15px; border-radius:8px; border:1px solid var(--border-color); background:var(--bg-main); color:var(--text-main);">
                    <button class="bureau-nav-item" data-view="chat" style="background:var(--accent-primary); color:white; border:none; padding:0 20px; border-radius:8px; cursor:pointer;">➔</button>
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

        const btnCourse = this.container.querySelector('#btn-desktop-course');
        if (btnCourse) {
            btnCourse.addEventListener('click', () => {
                // Pour la maquette : La session est "Anglais", on redirige vers l'espace Langues
                if (this.app.router) {
                    this.app.renderView('languages');
                }
            });
        }
    }
}
