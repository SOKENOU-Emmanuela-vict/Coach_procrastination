export class AcademicView {
    constructor(containerId, app) {
        this.container = document.getElementById(containerId);
        this.app = app;
    }
    
    render(state) {
        const rawSummary = state.academicSummary || {};
        const averageVal = rawSummary.average?.value ?? 14.2;
        const completedAssessments = rawSummary.completedAssessments ?? 9;
        const upcomingAssessments = (rawSummary.upcomingAssessments && Array.isArray(rawSummary.upcomingAssessments)) ? rawSummary.upcomingAssessments.length : 4;
        const absences = rawSummary.absences ?? 0;

        let subjects = state.academicSubjects;
        if (!subjects || subjects.length === 0) {
            subjects = [
                { name: "Mathématiques", grade: "15,5 / 20", progress: 75, icon: "📐", color: "#10b981" },
                { name: "Physique", grade: "12.0 / 20", progress: 60, icon: "⚛️", color: "#f43f5e" },
                { name: "Informatique", grade: "16.5 / 20", progress: 85, icon: "💻", color: "#3b82f6" },
                { name: "Anglais", grade: "14.0 / 20", progress: 70, icon: "🇬🇧", color: "#0ea5e9" },
                { name: "Français", grade: "13.5 / 20", progress: 65, icon: "🇫🇷", color: "#8b5cf6" },
                { name: "Sport", grade: "18.0 / 20", progress: 90, icon: "🏃", color: "#eab308" }
            ];
        }

        if (typeof document !== 'undefined' && document.body) {
            document.body.className = 'theme-light';
        }

        const svgSearch = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>`;

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
            <div class="bureau-nav-item active" data-view="academic" style="display:flex; align-items:center; gap:12px; cursor:pointer; background:rgba(14, 165, 233, 0.1); border-left:4px solid var(--accent-primary); border-radius:0 8px 8px 0; padding:12px 15px 12px 11px; color:var(--text-main); font-weight:600;">
                <i class="bi bi-mortarboard" style="font-size:18px; color:var(--accent-primary);"></i> School
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
        </div>
    </div>

    <!-- MAIN CONTENT -->
    <div class="bureau-content" style="flex: 1; padding: 30px; overflow-y: auto; background: var(--bg-main);">
        <!-- TOPBAR -->
        <div class="bureau-topbar" style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 30px;">
            <div>
                <h1 style="font-size: 24px; font-weight: 700; color:var(--text-main); letter-spacing:1px; margin:0;">ÉTUDES</h1>
                <p style="color: var(--text-muted); font-size:14px; margin:5px 0 0 0;">Année 2 • Semestre 4</p>
            </div>
            <div class="bureau-topbar-actions" style="display:flex; gap:15px; align-items:center;">
                <div style="display:flex; align-items:center; background:var(--bg-card); border: 1px solid var(--border-color); padding:10px 15px; border-radius:20px; color:var(--text-muted); gap:8px; width: 250px;">
                    <i class="bi bi-search"></i>
                    <input type="text" placeholder="Rechercher..." style="border:none; background:transparent; outline:none; font-size:14px; width:100%;">
                </div>
                <div style="display:flex; align-items:center; gap:10px; background:var(--bg-card); border: 1px solid var(--border-color); padding:10px 15px; border-radius:20px;">
                    <span>⛅</span>
                    <span style="font-weight:bold; font-size:14px;">18°C</span>
                    <span style="color:var(--text-muted); font-size:14px;">Paris</span>
                </div>
                <div class="bureau-profile-avatar" style="width:40px; height:40px; border-radius:12px; background:var(--border-color); display:flex; align-items:center; justify-content:center; font-weight:bold; color:var(--text-main); font-size:18px;">
                    É
                </div>
            </div>
        </div>

        <!-- TOP WIDGETS -->
        <div style="display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 20px; margin-bottom: 30px;">
            
            <!-- VUE D'ENSEMBLE -->
            <div class="bureau-card" style="background: var(--bg-card); border-radius: 12px; border: 1px solid var(--border-color); padding:20px; display:flex; gap:30px; align-items:center;">
                <div style="position:relative; width:120px; height:120px; border-radius:50%; border: 6px solid #f1f5f9; border-top-color: #10b981; border-right-color: #10b981; border-bottom-color: #10b981; transform: rotate(-45deg); display:flex; align-items:center; justify-content:center;">
                    <div style="transform: rotate(45deg); text-align:center;">
                        <strong style="font-size:28px; color:var(--text-main); display:block;">${averageVal ? Math.round((averageVal/20)*100) : '--'}%</strong>
                        <span style="font-size:12px; color:var(--text-muted);">${averageVal ? averageVal.toFixed(1) : '--'} / 20</span>
                    </div>
                </div>
                <div style="flex-grow:1;">
                    <h3 style="margin:0 0 15px 0; font-size:18px;">Vue d'ensemble</h3>
                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:15px; font-size:14px;">
                        <div style="display:flex; justify-content:space-between;">
                            <span style="color:var(--text-muted);">Moyenne générale</span>
                            <strong>${averageVal ? averageVal.toFixed(1) : '--'} / 20</strong>
                        </div>
                        <div style="display:flex; justify-content:space-between;">
                            <span style="color:var(--text-muted);">Matières</span>
                            <strong>6</strong>
                        </div>
                        <div style="display:flex; justify-content:space-between;">
                            <span style="color:var(--text-muted);">Crédits validés</span>
                            <strong>${rawSummary.earnedCredits || '--'} / ${rawSummary.targetCredits || '--'}</strong>
                        </div>
                        <div style="display:flex; justify-content:space-between;">
                            <span style="color:var(--text-muted);">Évaluations</span>
                            <strong>${upcomingAssessments} (à venir)</strong>
                        </div>
                        <div style="display:flex; justify-content:space-between; grid-column: 2;">
                            <span style="color:var(--text-muted);">Rang promo</span>
                            <strong>3e / 32</strong>
                        </div>
                    </div>
                </div>
            </div>

            <!-- ÉVÉNEMENTS -->
            <div class="bureau-card" style="background: #fff1f2; border-radius: 12px; border: 1px solid #ffe4e6; padding:20px; display:flex; flex-direction:column;">
                <div style="color: #e11d48; font-weight:bold; font-size:16px; display:flex; align-items:center; gap:8px; margin-bottom:15px;">
                    <i class="bi bi-exclamation-triangle-fill"></i> ${upcomingAssessments} Évaluation(s)
                </div>
                <div style="display:flex; flex-direction:column; gap:10px; flex-grow:1;">
                    ${(() => {
                        const upc = rawSummary.upcomingAssessments || [];
                        if (upc.length === 0) return '<div style="font-size:14px; color:var(--text-muted);">Aucune évaluation prévue.</div>';
                        return upc.slice(0, 2).map(a => `
                        <div style="background:white; padding:12px; border-radius:8px; border:1px solid #ffe4e6;">
                            <strong style="font-size:14px;">${a.subjectId} - ${a.title}</strong><br>
                            <span style="color:var(--text-muted); font-size:12px;">${a.date || 'À venir'}</span>
                        </div>`).join('');
                    })()}
                </div>
                <div style="text-align:right; margin-top:10px;">
                    <a href="#" style="color:#e11d48; font-size:13px; text-decoration:none; font-weight:600;">Voir tout ➔</a>
                </div>
            </div>

            <!-- SEMAINE -->
            <div class="bureau-card" style="background: var(--bg-card); border-radius: 12px; border: 1px solid var(--border-color); padding:20px; display:flex; flex-direction:column;">
                <div style="font-weight:bold; font-size:16px; display:flex; align-items:center; gap:8px; margin-bottom:15px;">
                    <i class="bi bi-calendar3"></i> Semaine
                </div>
                <div style="display:flex; flex-direction:column; gap:10px; flex-grow:1; font-size:14px;">
                    <div style="display:flex; gap:10px;">
                        <strong>Lun 26</strong> <span>Anglais (10:00)</span>
                    </div>
                    <div style="display:flex; gap:10px;">
                        <strong>Mar 27</strong> <span>Algo (14:00)</span>
                    </div>
                    <div style="display:flex; gap:10px;">
                        <strong>Mer 28</strong> <span>Physique (09:00)</span>
                    </div>
                </div>
                <div style="text-align:right; margin-top:10px;">
                    <a href="#" style="color:var(--accent-primary); font-size:13px; text-decoration:none; font-weight:600;">Planning complet ➔</a>
                </div>
            </div>

        </div>

        <!-- MATIÈRES -->
        <h2 style="font-size:18px; margin-bottom:20px;">Matières (6)</h2>
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-bottom: 30px;">
            
            <div class="bureau-card" style="background: var(--bg-card); border-radius: 12px; border: 1px solid var(--border-color); padding:20px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
                    <strong style="font-size:16px; display:flex; align-items:center; gap:8px;"><i class="bi bi-calculator" style="color:#10b981;"></i> Mathématiques</strong>
                    <strong style="font-size:16px;">17.5 <span style="font-size:12px; color:var(--text-muted); font-weight:normal;">/ 20</span></strong>
                </div>
                <div style="display:flex; justify-content:space-between; font-size:12px; margin-bottom:8px;">
                    <span style="color:var(--text-muted);">5/6 chapitres révisés</span>
                    <strong>83%</strong>
                </div>
                <div style="height:6px; background:#f1f5f9; border-radius:3px; overflow:hidden;">
                    <div style="height:100%; width:83%; background:#10b981;"></div>
                </div>
            </div>

            <div class="bureau-card" style="background: var(--bg-card); border-radius: 12px; border: 1px solid var(--border-color); padding:20px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
                    <strong style="font-size:16px; display:flex; align-items:center; gap:8px;"><i class="bi bi-magnet" style="color:#e11d48;"></i> Physique</strong>
                    <strong style="font-size:16px;">15.0 <span style="font-size:12px; color:var(--text-muted); font-weight:normal;">/ 20</span></strong>
                </div>
                <div style="display:flex; justify-content:space-between; font-size:12px; margin-bottom:8px;">
                    <span style="color:var(--text-muted);">4/6 chapitres</span>
                    <strong>66%</strong>
                </div>
                <div style="height:6px; background:#f1f5f9; border-radius:3px; overflow:hidden;">
                    <div style="height:100%; width:66%; background:#e11d48;"></div>
                </div>
            </div>

            <div class="bureau-card" style="background: var(--bg-card); border-radius: 12px; border: 1px solid var(--border-color); padding:20px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
                    <strong style="font-size:16px; display:flex; align-items:center; gap:8px;"><i class="bi bi-laptop" style="color:#3b82f6;"></i> Informatique</strong>
                    <strong style="font-size:16px;">18.0 <span style="font-size:12px; color:var(--text-muted); font-weight:normal;">/ 20</span></strong>
                </div>
                <div style="display:flex; justify-content:space-between; font-size:12px; margin-bottom:8px;">
                    <span style="color:var(--text-muted);">6/6 chapitres</span>
                    <strong>100%</strong>
                </div>
                <div style="height:6px; background:#f1f5f9; border-radius:3px; overflow:hidden;">
                    <div style="height:100%; width:100%; background:#3b82f6;"></div>
                </div>
            </div>

            <div class="bureau-card" style="background: var(--bg-card); border-radius: 12px; border: 1px solid var(--border-color); padding:20px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
                    <strong style="font-size:16px; display:flex; align-items:center; gap:8px;"><i class="bi bi-chat-dots" style="color:#0ea5e9;"></i> Anglais</strong>
                    <strong style="font-size:16px;">16.5 <span style="font-size:12px; color:var(--text-muted); font-weight:normal;">/ 20</span></strong>
                </div>
                <div style="display:flex; justify-content:space-between; font-size:12px; margin-bottom:8px;">
                    <span style="color:var(--text-muted);">3/4 modules</span>
                    <strong>75%</strong>
                </div>
                <div style="height:6px; background:#f1f5f9; border-radius:3px; overflow:hidden;">
                    <div style="height:100%; width:75%; background:#0ea5e9;"></div>
                </div>
            </div>

            <div class="bureau-card" style="background: var(--bg-card); border-radius: 12px; border: 1px solid var(--border-color); padding:20px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
                    <strong style="font-size:16px; display:flex; align-items:center; gap:8px;"><i class="bi bi-book" style="color:#8b5cf6;"></i> Français</strong>
                    <strong style="font-size:16px;">14.0 <span style="font-size:12px; color:var(--text-muted); font-weight:normal;">/ 20</span></strong>
                </div>
                <div style="display:flex; justify-content:space-between; font-size:12px; margin-bottom:8px;">
                    <span style="color:var(--text-muted);">2/3 modules</span>
                    <strong>66%</strong>
                </div>
                <div style="height:6px; background:#f1f5f9; border-radius:3px; overflow:hidden;">
                    <div style="height:100%; width:66%; background:#8b5cf6;"></div>
                </div>
            </div>

            <div class="bureau-card" style="background: var(--bg-card); border-radius: 12px; border: 1px solid var(--border-color); padding:20px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
                    <strong style="font-size:16px; display:flex; align-items:center; gap:8px;"><i class="bi bi-activity" style="color:#eab308;"></i> Sport</strong>
                    <strong style="font-size:16px;">19.0 <span style="font-size:12px; color:var(--text-muted); font-weight:normal;">/ 20</span></strong>
                </div>
                <div style="display:flex; justify-content:space-between; font-size:12px; margin-bottom:8px;">
                    <span style="color:var(--text-muted);">Présence 100%</span>
                    <strong>100%</strong>
                </div>
                <div style="height:6px; background:#f1f5f9; border-radius:3px; overflow:hidden;">
                    <div style="height:100%; width:100%; background:#eab308;"></div>
                </div>
            </div>

        </div>

        <!-- NOTES RÉCENTES & COACH -->
        <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 20px;">
            <div class="bureau-card" style="background: var(--bg-card); border-radius: 12px; border: 1px solid var(--border-color); padding:20px;">
                <h3 style="margin:0 0 15px 0; font-size:16px;">Notes récentes</h3>
                <div style="color:var(--text-muted); font-size:14px; padding:20px 0; text-align:center;">
                    Aucune note récente.
                </div>
            </div>
            <div class="bureau-card" style="background: rgba(14, 165, 233, 0.05); border-radius: 12px; border: 1px solid rgba(14, 165, 233, 0.2); padding:20px;">
                <div style="display:flex; align-items:center; gap:8px; margin-bottom:15px; color:var(--accent-primary); font-weight:bold;">
                    <i class="bi bi-robot"></i> Conseil du Coach
                </div>
                <div style="font-size:14px; line-height:1.5;">
                    Tes résultats en Mathématiques sont excellents. Continue sur cette lancée !
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
