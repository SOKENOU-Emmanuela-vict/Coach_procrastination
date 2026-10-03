export class LanguageView {
    constructor(containerId, app) {
        this.container = document.getElementById(containerId);
        this.app = app;
    }
    
    render(state) {
        if (typeof document !== 'undefined' && document.body) {
            document.body.className = 'theme-cyber';
        }

        const langNodes = (state.learningGraph?.nodes || []).filter(n => n.type === 'language' || n.category === 'language');
        
        let cardsHtml = '<div style="color:var(--text-muted); font-size:14px;">Aucune langue suivie.</div>';
        if (langNodes.length > 0) {
            cardsHtml = langNodes.map(l => {
                return '<div class="bureau-card" style="background: var(--bg-card); border-radius: 12px; border: 1px solid var(--border-color); padding:20px;">' +
                    '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">' +
                        '<h3 style="margin:0; font-size:16px;">' + (l.title || l.name) + '</h3>' +
                        '<span style="font-size:14px; color:var(--text-muted);">Niveau ' + (l.level || 'Non défini') + '</span>' +
                    '</div>' +
                    '<div style="display:flex; align-items:center; gap:15px;">' +
                        '<div style="flex-grow:1; height:8px; background:var(--bg-main); border-radius:4px; overflow:hidden;">' +
                            '<div style="height:100%; width:' + (l.progress || 0) + '%; background:var(--accent-primary); border-radius:4px;"></div>' +
                        '</div>' +
                        '<span style="font-size:14px; font-weight:bold;">' + (l.progress || 0) + '%</span>' +
                    '</div>' +
                '</div>';
            }).join('');
        }
        
        let html = `
<div class="bureau" style="display:flex; height:100vh;">
    <!-- SIDEBAR -->
    <div class="bureau-sidebar" style="width: 250px; background: var(--bg-sidebar); border-right: 1px solid var(--border-color); padding: 20px; display: flex; flex-direction: column;">
        <div style="font-size:24px; font-weight:bold; margin-bottom:40px; display:flex; align-items:center; gap:10px;">
            <div style="width:30px; height:30px; border-radius:8px; background:var(--accent-primary); display:flex; align-items:center; justify-content:center; color:#fff;">⚡</div>
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
    }
}
