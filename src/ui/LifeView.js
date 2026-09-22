export class LifeView {
    constructor(containerId, app) {
        this.container = document.getElementById(containerId);
        this.app = app;
    }
    
    render(state) {
        const habits = state.dailyPlan?.habits || [
            { title: "Sport", completed: true, time: "07:00 - 08:00" },
            { title: "Lecture", completed: false, time: "21:00 - 21:30" },
            { title: "Méditation", completed: false, time: "22:00 - 22:15" }
        ];

        const projects = state.lifeProjects || [
            { title: "Portfolio dev", progress: 65, status: "En cours" },
            { title: "Voyage Japon", progress: 20, status: "Planification" }
        ];

        document.body.className = 'theme-warm';

        let html = `
<div class="bureau">
    <!-- SIDEBAR WARM -->
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
            <button class="bureau-nav-item" data-route="academic">
                <svg viewBox="0 0 24 24"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg> 
                <span>School</span>
            </button>
            <button class="bureau-nav-item" data-route="languages">
                <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg> 
                <span>Langues</span>
            </button>
            <button class="bureau-nav-item active" data-route="life">
                <svg viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
                <span>Life/Projets</span>
            </button>
            <button class="bureau-nav-item" data-route="chat">
                <svg viewBox="0 0 24 24"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
                <span>Coach</span>
            </button>
        </div>
        
        <!-- DECORATIVE LEAF -->
        <div style="margin-top:auto; padding:20px; text-align:center; opacity:0.5; pointer-events:none;">
            <svg width="100" height="100" viewBox="0 0 24 24" fill="var(--accent-primary)"><path d="M17 8C8 10 5.9 16 5.9 16S7.9 11 12 9c3.1-1.5 5-1 5-1z"></path></svg>
        </div>
    </div>

    <!-- MAIN CONTENT -->
    <div class="bureau-content" style="background: url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22100%25%22%20height%3D%22100%25%22%20opacity%3D%220.05%22%3E%3Cpath%20d%3D%22M0%2C100%20Q150%2C0%20300%2C100%20T600%2C100%22%20fill%3D%22none%22%20stroke%3D%22%23e6a77d%22%20stroke-width%3D%2210%22%2F%3E%3C%2Fsvg%3E') no-repeat bottom left; background-size: cover;">
        <!-- TOPBAR -->
        <div class="bureau-topbar">
            <div>
                <h1 style="font-size: 24px; font-weight: 700; color:var(--text-main);">VIE</h1>
                <p style="color: var(--text-muted); font-size:14px; margin-top:5px;">Tes projets, tes habitudes, ton équilibre.</p>
            </div>
            <div class="bureau-topbar-actions" style="display:flex; gap:15px; align-items:center;">
                <div style="text-align:right;">
                    <strong style="display:block; font-size:20px; color:var(--accent-primary);">10:24</strong>
                    <span style="color:var(--text-muted); font-size:12px;">⛅ 16°C Paris</span>
                </div>
                <div class="bureau-profile-avatar" style="width:40px; height:40px; border-radius:50%; background:var(--accent-primary); display:flex; align-items:center; justify-content:center; font-weight:bold; color:#fff;">
                    ${(state.userProfile?.name || 'M').charAt(0).toUpperCase()}
                </div>
            </div>
        </div>

        <!-- WARM GRID -->
        <div style="display: grid; grid-template-columns: 1fr 1.5fr 1fr; gap: 20px;">
            
            <!-- HABITUDES -->
            <div class="bureau-card" style="grid-column: 1 / 2; display:flex; flex-direction:column;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
                    <div style="display:flex; align-items:center; gap:8px;">
                        <span style="color:var(--accent-secondary);">🌿</span>
                        <h3 style="margin:0; font-size:16px;">Habitudes</h3>
                    </div>
                </div>
                
                <div style="display:flex; flex-direction:column; gap:15px;">
                    ${habits.map(h => `
                        <div style="display:flex; align-items:center; gap:15px;">
                            <div style="width:24px; height:24px; border-radius:6px; border: 2px solid ${h.completed ? 'var(--accent-secondary)' : 'var(--border-color)'}; background: ${h.completed ? 'var(--accent-secondary)' : 'transparent'}; display:flex; align-items:center; justify-content:center; color:white;">
                                ${h.completed ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>' : ''}
                            </div>
                            <div style="display:flex; flex-direction:column;">
                                <strong style="font-size:14px; color:var(--text-main);">${h.title}</strong>
                                <span style="font-size:12px; color:var(--text-muted);">${h.time}</span>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>

            <!-- INSPIRATION IMAGE (Center) -->
            <div class="bureau-card" style="grid-column: 2 / 3; padding:0; overflow:hidden; position:relative; min-height:200px;">
                <img src="https://images.unsplash.com/photo-1506744626753-140294b01e3b?q=80&w=600&auto=format&fit=crop" style="width:100%; height:100%; object-fit:cover; position:absolute; inset:0;" alt="Paysage">
                <div style="position:absolute; inset:0; background: rgba(0,0,0,0.3); display:flex; align-items:center; justify-content:center; flex-direction:column; color:white; padding:20px; text-align:center;">
                    <h2 style="margin:0; font-size:24px; font-weight:600; text-shadow: 0 2px 4px rgba(0,0,0,0.5);">Testez de propres<br>"grands résultats"</h2>
                </div>
            </div>

            <!-- PROJETS PERSONNELS -->
            <div class="bureau-card" style="grid-column: 3 / 4;">
                <span class="bureau-eyebrow">Projets personnels</span>
                <div style="margin-top:20px; display:flex; flex-direction:column; gap:20px;">
                    ${projects.map(p => `
                        <div>
                            <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
                                <div style="display:flex; align-items:center; gap:8px;">
                                    <div style="width:10px; height:10px; border-radius:50%; background:var(--accent-primary);"></div>
                                    <strong style="font-size:14px;">${p.title}</strong>
                                </div>
                                <span style="font-size:12px; color:var(--text-muted);">${p.progress}%</span>
                            </div>
                            <div style="height:6px; background:var(--border-color); border-radius:3px; overflow:hidden;">
                                <div style="height:100%; width:${p.progress}%; background:var(--accent-primary); border-radius:3px;"></div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>

            <!-- LANGUES -->
            <div class="bureau-card" style="grid-column: 1 / 2;">
                <div style="display:flex; align-items:center; gap:8px; margin-bottom:20px;">
                    <span style="color:var(--accent-secondary);">🌐</span>
                    <h3 style="margin:0; font-size:16px;">Langues</h3>
                </div>
                <div style="display:flex; justify-content:space-between; align-items:flex-end;">
                    <div style="display:flex; flex-direction:column; align-items:center; gap:5px;">
                        <div style="width:40px; height:40px; border-radius:50%; border:3px solid var(--accent-primary); display:flex; align-items:center; justify-content:center; font-weight:bold; font-size:12px;">68%</div>
                        <span style="font-size:12px;">Anglais</span>
                    </div>
                    <div style="display:flex; flex-direction:column; align-items:center; gap:5px;">
                        <div style="width:40px; height:40px; border-radius:50%; border:3px solid #84a98c; border-top-color:transparent; display:flex; align-items:center; justify-content:center; font-weight:bold; font-size:12px;">42%</div>
                        <span style="font-size:12px;">Russe</span>
                    </div>
                    <div style="display:flex; flex-direction:column; align-items:center; gap:5px;">
                        <div style="width:40px; height:40px; border-radius:50%; border:3px solid #f43f5e; border-top-color:transparent; border-right-color:transparent; display:flex; align-items:center; justify-content:center; font-weight:bold; font-size:12px;">12%</div>
                        <span style="font-size:12px;">Mandarin</span>
                    </div>
                </div>
            </div>

            <!-- RACCOURCIS -->
            <div class="bureau-card" style="grid-column: 2 / 4;">
                <span class="bureau-eyebrow">Raccourcis</span>
                <div style="display:grid; grid-template-columns: repeat(4, 1fr); gap:15px; margin-top:20px; text-align:center;">
                    <div style="background:var(--bg-main); padding:15px; border-radius:12px; border:1px solid var(--border-color);">
                        <div style="font-size:24px; margin-bottom:5px; color:#1db954;">🎧</div>
                        <span style="font-size:12px; color:var(--text-muted);">Spotify</span>
                    </div>
                    <div style="background:var(--bg-main); padding:15px; border-radius:12px; border:1px solid var(--border-color);">
                        <div style="font-size:24px; margin-bottom:5px;">▶️</div>
                        <span style="font-size:12px; color:var(--text-muted);">YouTube</span>
                    </div>
                    <div style="background:var(--bg-main); padding:15px; border-radius:12px; border:1px solid var(--border-color);">
                        <div style="font-size:24px; margin-bottom:5px; color:#003087;">🅿️</div>
                        <span style="font-size:12px; color:var(--text-muted);">PayPal</span>
                    </div>
                    <div style="background:var(--bg-main); padding:15px; border-radius:12px; border:1px solid var(--border-color);">
                        <div style="font-size:24px; margin-bottom:5px; color:#0ea5e9;">📱</div>
                        <span style="font-size:12px; color:var(--text-muted);">App Store</span>
                    </div>
                </div>
            </div>

        </div>

        <!-- LE COACH FLOATING BOTTOM LEFT (as shown in Option C) -->
        <div class="bureau-card" style="margin-top:20px; display:flex; align-items:center; gap:15px; border-left:4px solid var(--accent-primary);">
            <div style="width:40px; height:40px; background: rgba(230,167,125,0.2); border-radius:50%; display:flex; align-items:center; justify-content:center; color:var(--accent-primary);">
                🤖
            </div>
            <div>
                <strong style="font-size:14px;">Le Coach</strong>
                <p style="margin:2px 0 0; font-size:12px; color:var(--text-muted);">
                    Tout est en ordre pour tes projets. Un peu de méditation ce soir ?
                </p>
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
