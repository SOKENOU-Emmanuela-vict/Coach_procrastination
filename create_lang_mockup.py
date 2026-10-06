import os

new_content = """export class LanguageView {
    constructor(containerId, app) {
        this.container = document.getElementById(containerId);
        this.app = app;
    }
    
    render(state) {
        if (typeof document !== 'undefined' && document.body) {
            document.body.className = 'theme-cyber';
        }

        const langs = [
            { name: "Anglais", level: "B2", progress: 75, icon: "🇬🇧" },
            { name: "Français", level: "C2", progress: 95, icon: "🇫🇷" }
        ];

        let cardsHtml = langs.map(l => {
            return `
            <div class="bureau-card" style="background: var(--bg-card); border-radius: 12px; border: 1px solid var(--border-color); padding:20px; position:relative;">
                <!-- Bouton EDIT -->
                <button style="position:absolute; top:15px; right:15px; background:transparent; border:none; color:var(--text-muted); cursor:pointer;">
                    <i class="bi bi-pencil-square" style="font-size:16px;"></i>
                </button>

                <div style="display:flex; align-items:center; gap:15px; margin-bottom:20px;">
                    <div style="font-size:40px;">${l.icon}</div>
                    <div>
                        <h3 style="margin:0; font-size:20px; color:var(--text-main);">${l.name}</h3>
                        <span style="font-size:14px; color:var(--text-muted);">Niveau Actuel : <strong>${l.level}</strong></span>
                    </div>
                </div>

                <div style="display:flex; align-items:center; gap:15px; margin-bottom:25px;">
                    <div style="flex-grow:1; height:10px; background:var(--bg-main); border-radius:5px; overflow:hidden;">
                        <div style="height:100%; width:${l.progress}%; background:var(--accent-primary); border-radius:5px;"></div>
                    </div>
                    <span style="font-size:16px; font-weight:bold; color:var(--text-main);">${l.progress}%</span>
                </div>

                <!-- ADD BUTTON -->
                <button style="width:100%; background:var(--bg-main); color:var(--text-main); border:1px dashed var(--border-color); padding:12px; border-radius:8px; font-weight:bold; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:10px; transition:all 0.2s;" onmouseover="this.style.background='var(--accent-primary)'; this.style.color='white'; this.style.borderStyle='solid'" onmouseout="this.style.background='var(--bg-main)'; this.style.color='var(--text-main)'; this.style.borderStyle='dashed'">
                    <i class="bi bi-plus-circle"></i> ADD (Progression App)
                </button>
            </div>`;
        }).join('');
        
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
            <div class="bureau-nav-item active" data-view="languages" style="display:flex; align-items:center; gap:12px; cursor:pointer; background:rgba(14, 165, 233, 0.1); border-left:4px solid var(--accent-primary); border-radius:0 8px 8px 0; padding:12px 15px 12px 11px; color:var(--text-main); font-weight:600;">
                <i class="bi bi-globe" style="font-size:18px; color:var(--accent-primary);"></i> Langues
            </div>
            <div class="bureau-nav-item" data-view="life" style="display:flex; align-items:center; gap:12px; cursor:pointer; padding:12px 15px; color:var(--text-muted); font-weight:500;">
                <i class="bi bi-star" style="font-size:18px;"></i> Life
            </div>
            <div class="bureau-nav-item" data-view="chat" style="display:flex; align-items:center; gap:12px; cursor:pointer; padding:12px 15px; color:var(--text-muted); font-weight:500;">
                <i class="bi bi-robot" style="font-size:18px;"></i> Coach
            </div>
        </div>
    </div>

    <!-- MAIN CONTENT -->
    <div class="bureau-content" style="flex: 1; padding: 30px; overflow-y: auto; background: var(--bg-main);">
        <!-- TOPBAR -->
        <div class="bureau-topbar" style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 30px;">
            <div>
                <h1 style="font-size: 24px; font-weight: 700; color:var(--text-main); letter-spacing:1px; margin:0;">LANGUES</h1>
                <p style="color: var(--text-muted); font-size:14px; margin:5px 0 0 0;">Tes statistiques et ta progression.</p>
            </div>
            <div class="bureau-profile-avatar" style="width:40px; height:40px; border-radius:50%; background:var(--accent-primary); display:flex; align-items:center; justify-content:center; font-weight:bold; color:white; font-size:18px; cursor:pointer;" id="btn-profile">
                E
            </div>
        </div>

        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px;">
            ${cardsHtml}
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

        const btnProfile = this.container.querySelector('#btn-profile');
        if (btnProfile) {
            btnProfile.addEventListener('click', () => {
                if (this.app.renderView) {
                    this.app.renderView('portfolio');
                } else if (this.app.router) {
                    this.app.router.render('portfolio', this.app.state);
                }
            });
        }
    }
}
"""

with open('src/ui/LanguageView.js', 'w', encoding='utf-8') as f:
    f.write(new_content)

print("Updated LanguageView.js successfully.")
