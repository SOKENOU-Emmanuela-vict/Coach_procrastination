export class LanguageView {
    constructor(containerId, app) {
        this.container = document.getElementById(containerId);
        this.app = app;
    }
    
    async render(state) {
        if (typeof document !== 'undefined' && document.body) {
            document.body.className = 'theme-cyber';
        }

        const skills = await this.app.scheduler.getSkills() || [];

        let cardsHtml = skills.map(l => {
            return `
            <div class="bureau-card" style="background: var(--bg-card); border-radius: 12px; border: 1px solid var(--border-color); padding:20px; position:relative;">
                <div style="position:absolute; top:15px; right:15px; display:flex; gap:8px;">
                    <button class="btn-edit-item" data-id="${l.id}" data-type="skill" style="background:transparent; border:none; color:var(--text-muted); cursor:pointer;">
                        <i class="bi bi-pencil-square" style="font-size:16px;"></i>
                    </button>
                    <button class="btn-delete-item" data-id="${l.id}" data-type="skill" style="background:transparent; border:none; color:#f44336; cursor:pointer;">
                        <i class="bi bi-trash" style="font-size:16px;"></i>
                    </button>
                </div>

                <div style="display:flex; align-items:center; gap:15px; margin-bottom:20px;">
                    <div style="font-size:40px;">⭐</div>
                    <div>
                        <h3 style="margin:0; font-size:20px; color:var(--text-main);">${l.title || l.name || 'Langue'}</h3>
                        <span style="font-size:14px; color:var(--text-muted);">Domaine : <strong>${l.domain || 'langue'}</strong></span>
                    </div>
                </div>

                <div style="display:flex; align-items:center; gap:15px; margin-bottom:25px;">
                    <div style="flex-grow:1; height:10px; background:var(--bg-main); border-radius:5px; overflow:hidden;">
                        <div style="height:100%; width:${l.target ? Math.min(100, l.target) : 0}%; background:var(--accent-primary); border-radius:5px;"></div>
                    </div>
                    <span style="font-size:16px; font-weight:bold; color:var(--text-main);">${l.target ? l.target : 0}%</span>
                </div>
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
            <div style="display:flex; align-items:center; gap:20px;">
                <div>
                    <h1 style="font-size: 24px; font-weight: 700; color:var(--text-main); letter-spacing:1px; margin:0;">LANGUES & SKILLS</h1>
                    <p style="color: var(--text-muted); font-size:14px; margin:5px 0 0 0;">Tes statistiques et ta progression.</p>
                </div>
                <button type="button" class="btn-open-modal" data-type="skill" style="background:var(--accent-primary); color:white; border:none; padding:8px 15px; border-radius:20px; font-weight:bold; cursor:pointer; display:flex; align-items:center; gap:8px;">
                    <i class="bi bi-plus-circle"></i> Ajouter
                </button>
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
                if (viewName) {
                    this.app.renderView(viewName);
                }
            });
        });

        const btnProfile = this.container.querySelector('#btn-profile');
        if (btnProfile) {
            btnProfile.addEventListener('click', () => {
                if (this.app.renderView) {
                    this.app.renderView('portfolio');
                } else if (this.app.router) {
                    this.app.renderView('portfolio');
                }
            });
        }

        // Event listeners pour les boutons Edit/Delete
        this.container.querySelectorAll('.btn-open-modal').forEach(btn => {
            btn.addEventListener('click', () => {
                const type = btn.getAttribute('data-type') || 'skill';
                this.app.openGlobalItemEditor({ type });
            });
        });

        this.container.querySelectorAll('.btn-edit-item').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.currentTarget.getAttribute('data-id');
                const type = e.currentTarget.getAttribute('data-type');
                let item = null;
                if (type === 'skill') item = (await this.app.scheduler.getSkills()).find(i => i.id === id);
                if (item) this.app.openGlobalItemEditor({ ...item, type });
            });
        });

        this.container.querySelectorAll('.btn-delete-item').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.currentTarget.getAttribute('data-id');
                const type = e.currentTarget.getAttribute('data-type');
                if (confirm('Êtes-vous sûr de vouloir supprimer cet élément ?')) {
                    if (type === 'skill') await this.app.scheduler.deleteSkill(id);
                    this.app.renderView('languages');
                }
            });
        });
    }
}
