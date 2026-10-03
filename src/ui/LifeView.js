export class LifeView {
    constructor(containerId, app) {
        this.container = document.getElementById(containerId);
        this.app = app;
    }
    
    render(state) {
        const habits = state.dailyPlan?.habits || [];

        const projects = state.lifeProjects || [];

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
            <div class="bureau-nav-item" data-view="chat" style="display:flex; align-items:center; gap:12px; cursor:pointer; padding:12px 15px; color:var(--text-muted); font-weight:500;">
                <i class="bi bi-robot" style="font-size:18px;"></i> Coach
            </div>
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
                    ${habits.length > 0 ? habits.map(h => `
                        <div style="display:flex; align-items:center; gap:15px;">
                            <div style="width:24px; height:24px; border-radius:6px; border: 2px solid ${h.completed ? 'var(--accent-secondary)' : 'var(--border-color)'}; background: ${h.completed ? 'var(--accent-secondary)' : 'transparent'}; display:flex; align-items:center; justify-content:center; color:white;">
                                ${h.completed ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>' : ''}
                            </div>
                            <div style="display:flex; flex-direction:column;">
                                <strong style="font-size:14px; color:var(--text-main);">${h.title}</strong>
                                <span style="font-size:12px; color:var(--text-muted);">${h.time}</span>
                            </div>
                        </div>
                    `).join('') : '<div style="color:var(--text-muted); font-size:14px;">Aucune habitude définie.</div>'}
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
                    ${projects.length > 0 ? projects.map(p => `
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
                    `).join('') : '<div style="color:var(--text-muted); font-size:14px;">Aucun projet en cours.</div>'}
                </div>
            </div>

            <!-- LANGUES -->
            <div class="bureau-card" style="grid-column: 1 / 2;">
                <div style="display:flex; align-items:center; gap:8px; margin-bottom:20px;">
                    <span style="color:var(--accent-secondary);">🌐</span>
                    <h3 style="margin:0; font-size:16px;">Langues</h3>
                </div>
                ${(() => {
                        const langNodes = (state.learningGraph?.nodes || []).filter(n => n.type === 'language' || n.category === 'language');
                        if (langNodes.length === 0) {
                            return '<div style="color:var(--text-muted); font-size:14px; padding-bottom:20px;">Aucune langue suivie.</div>';
                        }
                        return '<div style="display:flex; justify-content:space-between; align-items:flex-end;">' + langNodes.slice(0, 3).map((l, i) => {
                            const colors = ['var(--accent-primary)', '#84a98c', '#f43f5e'];
                            const color = colors[i % colors.length];
                            const prog = l.progress || 0;
                            return `
                            <div style="display:flex; flex-direction:column; align-items:center; gap:5px;">
                                <div style="width:40px; height:40px; border-radius:50%; border:3px solid ${color}; border-top-color:${prog < 50 ? 'transparent' : color}; display:flex; align-items:center; justify-content:center; font-weight:bold; font-size:12px;">${prog}%</div>
                                <span style="font-size:12px;">${l.title || l.name}</span>
                            </div>`;
                        }).join('') + '</div>';
                    })()}
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
                    ${state.coachInsights?.dailyMessage || 'Pense à prendre du temps pour toi aujourd\'hui.'}
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
                const viewName = e.currentTarget.getAttribute('data-view');
                if (viewName && this.app.router) {
                    this.app.router.render(viewName, this.app.state);
                }
            });
        });
    }
}
