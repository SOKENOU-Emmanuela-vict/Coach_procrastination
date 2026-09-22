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

        document.body.className = 'theme-light';

        const svgSearch = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>`;

        let html = `
<div class="bureau">
    <!-- SIDEBAR LIGHT -->
    <div class="bureau-sidebar">
        <div class="bureau-brand">
            <div style="display:flex; gap: 8px; align-items:center;">
                <div style="width: 24px; height: 24px; background: var(--text-main); border-radius: 6px; display:flex; align-items:center; justify-content:center;">
                    <span style="color:#fff; font-weight:bold; font-size:14px;">L</span>
                </div>
                <strong>Learning OS</strong>
            </div>
        </div>
        
        <div class="bureau-nav">
            <button class="bureau-nav-item" data-route="desktop">
                <svg viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg> 
                <span>Bureau</span>
            </button>
            <button class="bureau-nav-item" data-route="planning">
                <svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                <span>Planning</span>
            </button>
            <button class="bureau-nav-item active" data-route="academic">
                <svg viewBox="0 0 24 24"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg> 
                <span>School</span>
            </button>
            <button class="bureau-nav-item" data-route="languages">
                <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg> 
                <span>Langues</span>
            </button>
            <button class="bureau-nav-item" data-route="life">
                <svg viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
                <span>Life/Projets</span>
            </button>
            <button class="bureau-nav-item" data-route="chat">
                <svg viewBox="0 0 24 24"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
                <span>Coach</span>
            </button>
        </div>
    </div>

    <!-- MAIN CONTENT -->
    <div class="bureau-content">
        <!-- TOPBAR -->
        <div class="bureau-topbar">
            <div>
                <h1 style="font-size: 20px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase;">ÉTUDES</h1>
                <span class="bureau-eyebrow" style="text-transform:none;">Semestre 3 - Semaine 4</span>
            </div>
            <div class="bureau-topbar-actions" style="display:flex; gap:15px; align-items:center;">
                <div style="display:flex; align-items:center; background:#f1f5f9; padding:8px 15px; border-radius:20px; color:var(--text-muted); gap:8px;">
                    <div style="width:16px; height:16px;">${svgSearch}</div>
                    <span style="font-size:14px;">Rechercher un cours...</span>
                </div>
                <div style="text-align:right;">
                    <strong style="display:block; font-size:18px;">14°C</strong>
                    <span style="color:var(--text-muted); font-size:12px;">Paris</span>
                </div>
                <div class="bureau-profile-avatar" style="width:40px; height:40px; border-radius:50%; background:#e2e8f0; display:flex; align-items:center; justify-content:center; font-weight:bold; color:var(--text-main);">
                    ${(state.userProfile?.name || 'M').charAt(0).toUpperCase()}
                </div>
            </div>
        </div>

        <!-- ACADEMIC GRID -->
        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px;">
            
            <!-- VUE D'ENSEMBLE -->
            <div class="bureau-card" style="grid-column: 1 / 3; display:flex; flex-direction:column;">
                <h3 style="margin:0 0 20px; font-size:16px;">Vue d'ensemble</h3>
                <div style="display:flex; justify-content:space-between; align-items:center; flex-grow:1;">
                    <div style="position:relative; width:120px; height:120px; border-radius:50%; border: 8px solid #f1f5f9; border-top-color: var(--accent-primary); border-right-color: var(--accent-primary); transform: rotate(-45deg);">
                        <div style="position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; transform: rotate(45deg);">
                            <strong style="font-size:24px; color:var(--text-main);">${averageVal}</strong>
                            <span style="font-size:12px; color:var(--text-muted);">/ 20</span>
                        </div>
                    </div>
                    <div style="display:flex; flex-direction:column; gap:15px; min-width: 150px;">
                        <div style="display:flex; justify-content:space-between;">
                            <span style="color:var(--text-muted); font-size:14px;">Validées</span>
                            <strong>${completedAssessments}</strong>
                        </div>
                        <div style="display:flex; justify-content:space-between;">
                            <span style="color:var(--text-muted); font-size:14px;">Prochaines</span>
                            <strong>${upcomingAssessments}</strong>
                        </div>
                        <div style="display:flex; justify-content:space-between;">
                            <span style="color:var(--text-muted); font-size:14px;">Absences</span>
                            <strong>${absences}</strong>
                        </div>
                    </div>
                </div>
            </div>

            <!-- EXAMS ALERT -->
            <div class="bureau-card" style="grid-column: 3 / 4; background: #fff1f2; border: 1px solid #ffe4e6;">
                <div style="color: #e11d48; font-weight:bold; font-size:14px; display:flex; align-items:center; gap:8px;">
                    <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                    2 examens
                </div>
                <div style="margin-top:20px; display:flex; flex-direction:column; gap:15px;">
                    <div style="font-size:14px; background:white; padding:10px; border-radius:8px; border:1px solid #ffe4e6;">
                        <strong>Mathématiques</strong><br>
                        <span style="color:var(--text-muted); font-size:12px;">15 Juin 2026</span>
                    </div>
                    <div style="font-size:14px; background:white; padding:10px; border-radius:8px; border:1px solid #ffe4e6;">
                        <strong>Physique</strong><br>
                        <span style="color:var(--text-muted); font-size:12px;">18 Juin 2026</span>
                    </div>
                </div>
            </div>

            <!-- MATIERES -->
            <div class="bureau-card" style="grid-column: 1 / 4;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
                    <h3 style="margin:0; font-size:16px;">Matières (${subjects.length})</h3>
                    <a href="#" style="color:var(--accent-primary); font-size:14px; text-decoration:none; font-weight:500;">Voir tout</a>
                </div>
                
                <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:20px;">
                    ${subjects.map(sub => `
                        <div style="background:#f8fafc; padding:15px; border-radius:12px; border:1px solid var(--border-color);">
                            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                                <div style="display:flex; align-items:center; gap:8px;">
                                    <span style="font-size:18px;">${sub.icon}</span>
                                    <strong style="font-size:14px;">${sub.name}</strong>
                                </div>
                                <span style="font-size:12px; color:var(--text-muted);">${sub.grade}</span>
                            </div>
                            <div style="height:6px; background:#e2e8f0; border-radius:3px; overflow:hidden;">
                                <div style="height:100%; width:${sub.progress}%; background:${sub.color}; border-radius:3px;"></div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>

        </div>

        <!-- LE COACH FLOATING BOTTOM -->
        <div style="position:fixed; bottom:30px; right:40px; background:white; padding:15px 20px; border-radius:20px; box-shadow: 0 10px 25px rgba(0,0,0,0.1); border:1px solid var(--border-color); display:flex; align-items:center; gap:15px; max-width:400px; z-index:100;">
            <div style="width:40px; height:40px; background: #e0f2fe; border-radius:50%; display:flex; align-items:center; justify-content:center; color:#0284c7; font-size:20px;">
                🤖
            </div>
            <div style="flex-grow:1;">
                <strong style="font-size:14px;">Le Coach</strong>
                <p style="margin:2px 0 0; font-size:12px; color:var(--text-muted); line-height:1.4;">
                    Tes résultats en Mathématiques sont excellents. Je te conseille de te concentrer sur la Physique ce week-end.
                </p>
            </div>
            <a href="#" style="color:var(--accent-primary); font-size:12px; text-decoration:none; white-space:nowrap; font-weight:600;">Voir plus →</a>
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
