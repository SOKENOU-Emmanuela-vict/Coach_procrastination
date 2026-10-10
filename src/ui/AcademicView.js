import { escapeHtml } from '../utils/html.js';
export class AcademicView {
    constructor(containerId, app) {
        this.container = document.getElementById(containerId);
        this.app = app;
        this.selectedBlock = 0;
    }
    
    render(state) {
        if (typeof document !== 'undefined' && document.body) {
            document.body.className = 'theme-light';
        }

        const blocks = [
            { id: 0, title: "L2 IA 2026-2027", icon: '<i class="bi bi-mortarboard"></i>', img: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=400&q=80" },
            { id: 1, title: "Projets & Stages", icon: '<i class="bi bi-briefcase"></i>', img: "https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=400&q=80" }
        ];

        // Fetch subjects from state
        const allSubjects = state.academicSubjects || [];
        
        // Group by Semester
        const s3Subjects = allSubjects.filter(s => s.semesterId === 'sem_s3_26');
        const s4Subjects = allSubjects.filter(s => s.semesterId === 'sem_s4_27');

        const renderSubjectCard = (sub) => `
            <div class="bureau-card" style="background:var(--bg-card); border-radius:12px; border:1px solid var(--border-color); padding:20px; position:relative; margin-bottom:15px; display:flex; flex-direction:column; gap:15px;">
                <!-- Edit button -->
                <button class="btn-action-subject" data-action="edit" data-id="${sub.id}" style="position:absolute; top:15px; right:15px; background:transparent; border:none; color:var(--text-muted); cursor:pointer;">
                    <i class="bi bi-pencil-square" style="font-size:16px;"></i>
                </button>
                
                <h4 style="margin:0; font-size:16px; color:var(--text-main); padding-right:30px;">
                    <span style="font-size:12px; color:var(--text-muted); display:block; margin-bottom:4px;">${sub.code || ''} • ${sub.cect} CECT</span>
                    ${sub.name}
                </h4>
                
                <!-- Central Grade / ADD -->
                <div style="display:flex; justify-content:center; align-items:center; padding:15px 0;">
                    ${sub.grade ? 
                        `<div style="font-size:24px; font-weight:bold; color:var(--accent-primary);">${sub.grade} <span style="font-size:14px; color:var(--text-muted);">/ 20</span></div>` :
                        `<button class="btn-add-grade" data-id="${sub.id}" style="background:var(--accent-primary); color:white; border:none; padding:10px 20px; border-radius:8px; font-weight:bold; cursor:pointer; display:flex; align-items:center; gap:8px;">
                            <i class="bi bi-plus-circle"></i> ADD NOTE
                        </button>`
                    }
                </div>
                
                <!-- Action Buttons Grid -->
                <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:10px;">
                    <button class="btn-action-subject" data-action="ressources" data-id="${sub.id}" style="background:var(--bg-main); border:1px solid var(--border-color); padding:10px; border-radius:8px; cursor:pointer; display:flex; flex-direction:column; align-items:center; gap:5px; color:var(--text-main);">
                        <i class="bi bi-folder2-open" style="font-size:18px; color:#eab308;"></i>
                        <span style="font-size:11px; font-weight:bold;">Ressources</span>
                    </button>
                    <button class="btn-action-subject" data-action="notebook" data-id="${sub.id}" style="background:var(--bg-main); border:1px solid var(--border-color); padding:10px; border-radius:8px; cursor:pointer; display:flex; flex-direction:column; align-items:center; gap:5px; color:var(--text-main);">
                        <i class="bi bi-robot" style="font-size:18px; color:#0ea5e9;"></i>
                        <span style="font-size:11px; font-weight:bold;">Notebook LM</span>
                    </button>
                    <button class="btn-action-subject" data-action="epreuves" data-id="${sub.id}" style="background:var(--bg-main); border:1px solid var(--border-color); padding:10px; border-radius:8px; cursor:pointer; display:flex; flex-direction:column; align-items:center; gap:5px; color:var(--text-main);">
                        <i class="bi bi-ui-checks" style="font-size:18px; color:#10b981;"></i>
                        <span style="font-size:11px; font-weight:bold;">Épreuves</span>
                    </button>
                </div>
            </div>
        `;

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
            <div class="bureau-nav-item" data-view="portfolio" style="display:flex; align-items:center; gap:12px; cursor:pointer; padding:12px 15px; color:var(--text-muted); font-weight:500;">
                <i class="bi bi-kanban" style="font-size:18px;"></i> Projets
            </div>
            <div class="bureau-nav-item" data-view="chat" style="display:flex; align-items:center; gap:12px; cursor:pointer; padding:12px 15px; color:var(--text-muted); font-weight:500;">
                <i class="bi bi-robot" style="font-size:18px;"></i> Coach
            </div>
        </div>
    </div>

    <!-- MAIN CONTENT -->
    <div class="bureau-content" style="flex: 1; padding: 30px 40px; overflow-y: auto; background: var(--bg-main);">
        <div style="margin-bottom:30px;">
            <h1 style="font-size: 24px; font-weight: 700; color:var(--text-main); letter-spacing:1px; margin:0 0 20px 0;">CURSUS ACADÉMIQUE</h1>
            <div style="display:flex; gap:20px; overflow-x:auto; padding-bottom:10px;">
                ${blocks.map(b => `
                    <div class="block-tab ${this.selectedBlock === b.id ? 'active' : ''}" data-id="${b.id}" style="min-width:280px; height:120px; border-radius:12px; overflow:hidden; position:relative; cursor:pointer; border: ${this.selectedBlock === b.id ? '3px solid var(--accent-primary)' : '1px solid var(--border-color)'}; box-shadow: ${this.selectedBlock === b.id ? '0 8px 20px rgba(14,165,233,0.3)' : 'none'}; transition: all 0.2s;">
                        <img src="${b.img}" style="width:100%; height:100%; object-fit:cover; opacity: ${this.selectedBlock === b.id ? '0.8' : '0.5'};">
                        <div style="position:absolute; bottom:0; left:0; right:0; padding:15px; background:linear-gradient(to top, rgba(0,0,0,0.9), transparent);">
                            <strong style="color:white; font-size:16px;">${b.icon} ${b.title}</strong>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>

        <div>
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
                <h2 style="font-size:20px; margin:0; display:flex; align-items:center; gap:10px;">
                    <i class="bi bi-journal-bookmark" style="color:var(--accent-primary);"></i>
                    Détails du ${blocks[this.selectedBlock].title}
                </h2>
                <div style="width:40px; height:40px; border-radius:50%; background:var(--accent-primary); display:flex; align-items:center; justify-content:center; color:white; font-weight:bold; font-size:18px; cursor:pointer;" id="btn-profile">
                    ${(state.userProfile?.name || 'E').charAt(0).toUpperCase()}
                </div>
            </div>

            <!-- Grille Semestre 3 -->
            <div style="display:grid; grid-template-columns: 1fr; gap:30px;">
                <!-- SEMESTRE 3 -->
                <div>
                    <h3 style="font-size:16px; margin:0 0 15px 0; padding-bottom:10px; border-bottom:2px solid var(--accent-primary); color:var(--text-main);">
                        Semestre 3 (S3) — ${s3Subjects.length > 0 ? s3Subjects.reduce((acc, sub) => acc + (sub.cect||0), 0) : 30} CECT
                    </h3>
                    <div>
                        ${s3Subjects.length > 0 ? s3Subjects.map(renderSubjectCard).join('') : '<p>Aucune matière officielle S3 trouvée.</p>'}
                    </div>
                </div>

            </div>
        </div>
    </div>
</div>
        <!-- MODAL OVERLAY -->
        <div id="academic-modal" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.6); z-index:9999; align-items:center; justify-content:center;">
            <div style="background:var(--bg-main); width:90%; max-width:600px; max-height:80vh; border-radius:12px; border:1px solid var(--border-color); display:flex; flex-direction:column; overflow:hidden; box-shadow:0 10px 30px rgba(0,0,0,0.5);">
                <div style="padding:15px 20px; border-bottom:1px solid var(--border-color); display:flex; justify-content:space-between; align-items:center; background:var(--bg-card);">
                    <h3 id="academic-modal-title" style="margin:0; font-size:18px; color:var(--text-main);">Titre</h3>
                    <button id="academic-modal-close" style="background:transparent; border:none; color:var(--text-muted); font-size:20px; cursor:pointer;">&times;</button>
                </div>
                <div id="academic-modal-content" style="padding:20px; overflow-y:auto; flex-grow:1; color:var(--text-main);">
                    <!-- Contenu dynamique -->
                </div>
            </div>
        </div>
        `;
        
        this.container.innerHTML = html;
        this.attachEvents();
    }

    attachEvents() {
        this.container.querySelectorAll('.bureau-nav-item').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const viewName = e.currentTarget.getAttribute('data-view');
                if (viewName) {
                    this.app.renderView(viewName);
                }
            });
        });

        this.container.querySelectorAll('.block-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                const id = parseInt(e.currentTarget.getAttribute('data-id'));
                this.selectedBlock = id;
                this.render(this.app.state);
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

        // Modal elements
        const modal = this.container.querySelector('#academic-modal');
        const modalTitle = this.container.querySelector('#academic-modal-title');
        const modalContent = this.container.querySelector('#academic-modal-content');
        const btnClose = this.container.querySelector('#academic-modal-close');

        if (btnClose) {
            btnClose.addEventListener('click', () => {
                modal.style.display = 'none';
            });
        }
        
        if (modal) {
            modal.addEventListener('click', (e) => {
                if(e.target === modal) modal.style.display = 'none';
            });
        }

        // Action Buttons
        this.container.querySelectorAll('.btn-action-subject, .btn-add-grade').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                let actionName = e.currentTarget.getAttribute('data-action') || 'add_grade';
                let subjectId = e.currentTarget.getAttribute('data-id');
                const allSubjects = this.app.state.academicSubjects || [];
                const found = allSubjects.find(s => s.id === subjectId) || { name: 'Matière inconnue' };
                // Valeurs échappées avant insertion dans innerHTML
                const sub = { ...found, name: escapeHtml(found.name), code: escapeHtml(found.code || ''), cect: Number(found.cect) || 0 };
                
                modal.style.display = 'flex';
                
                if (actionName === 'edit') {
                    modalTitle.innerHTML = `<i class="bi bi-pencil-square"></i> Éditer : ${sub.name}`;
                    modalContent.innerHTML = `
                        <div style="display:flex; flex-direction:column; gap:15px;">
                            <label>Nom de la matière : <input type="text" value="${sub.name}" class="form-input" style="width:100%; padding:10px; background:var(--bg-card); color:var(--text-main); border:1px solid var(--border-color); border-radius:8px; margin-top:5px;"></label>
                            <label>Code (ex: IA202) : <input type="text" value="${sub.code || ''}" class="form-input" style="width:100%; padding:10px; background:var(--bg-card); color:var(--text-main); border:1px solid var(--border-color); border-radius:8px; margin-top:5px;"></label>
                            <label>Crédits ECTS : <input type="number" value="${sub.cect || 0}" class="form-input" style="width:100%; padding:10px; background:var(--bg-card); color:var(--text-main); border:1px solid var(--border-color); border-radius:8px; margin-top:5px;"></label>
                            <button style="background:var(--accent-primary); color:white; border:none; padding:10px; border-radius:8px; font-weight:bold; cursor:pointer; margin-top:10px;">Sauvegarder</button>
                        </div>
                    `;
                    // Bouton « Sauvegarder » existant branché sur App.updateSubject (nom, code, crédits)
                    const saveBtn = modalContent.querySelector('button');
                    const [nameInput, codeInput, cectInput] = modalContent.querySelectorAll('input');
                    if (saveBtn && nameInput && found.id) {
                        saveBtn.addEventListener('click', async () => {
                            const name = nameInput.value.trim();
                            const cect = Number(cectInput ? cectInput.value : found.cect);
                            if (!name || !Number.isFinite(cect) || cect < 0) {
                                alert('Nom obligatoire et crédits positifs.');
                                return;
                            }
                            try {
                                modal.style.display = 'none';
                                await this.app.updateSubject(found.id, { name, code: codeInput ? codeInput.value.trim() : found.code, cect });
                            } catch (err) {
                                alert('Erreur lors de la sauvegarde : ' + err.message);
                            }
                        });
                    }
                } else if (actionName === 'ressources') {
                    modalTitle.innerHTML = `<i class="bi bi-folder2-open" style="color:#eab308;"></i> Ressources pour ${sub.name}`;
                    modalContent.innerHTML = `
                        <div style="text-align:center; padding:20px; color:var(--text-muted);">
                            <i class="bi bi-cloud-arrow-up" style="font-size:40px; color:var(--accent-primary); margin-bottom:10px; display:block;"></i>
                            <p>Aucune ressource disponible pour l'instant.</p>
                            <button style="background:var(--bg-card); color:var(--text-main); border:1px dashed var(--border-color); padding:10px 20px; border-radius:8px; cursor:pointer; margin-top:10px;">
                                <i class="bi bi-plus-lg"></i> Ajouter un fichier ou lien
                            </button>
                        </div>
                    `;
                } else if (actionName === 'notebook') {
                    modalTitle.innerHTML = `<i class="bi bi-robot" style="color:#0ea5e9;"></i> Notebook LM : ${sub.name}`;
                    modalContent.innerHTML = `
                        <div style="display:flex; flex-direction:column; height:300px;">
                            <div style="flex-grow:1; background:var(--bg-card); border-radius:8px; padding:15px; overflow-y:auto; margin-bottom:10px; border:1px solid var(--border-color);">
                                <div style="color:var(--text-muted); font-size:12px; text-align:center;">L'IA est prête à répondre à vos questions sur <strong>${sub.name}</strong> en se basant sur vos ressources.</div>
                            </div>
                            <div style="display:flex; gap:10px;">
                                <input type="text" placeholder="Posez une question sur le cours..." style="flex-grow:1; padding:10px; background:var(--bg-card); color:var(--text-main); border:1px solid var(--border-color); border-radius:8px;">
                                <button style="background:#0ea5e9; color:white; border:none; padding:10px 20px; border-radius:8px; cursor:pointer;"><i class="bi bi-send"></i></button>
                            </div>
                        </div>
                    `;
                } else if (actionName === 'epreuves') {
                    modalTitle.innerHTML = `<i class="bi bi-ui-checks" style="color:#10b981;"></i> Épreuves de ${sub.name}`;
                    modalContent.innerHTML = `
                        <div style="display:flex; flex-direction:column; gap:10px;">
                            <div style="background:var(--bg-card); padding:15px; border-radius:8px; border:1px solid var(--border-color); display:flex; justify-content:space-between; align-items:center;">
                                <div>
                                    <h4 style="margin:0 0 5px 0;">Partiel Mi-Semestre</h4>
                                    <span style="font-size:12px; color:var(--text-muted);">Coeff 1.0</span>
                                </div>
                                <span style="font-weight:bold; color:var(--accent-primary);">À venir</span>
                            </div>
                            <button style="background:transparent; color:var(--accent-primary); border:1px dashed var(--accent-primary); padding:10px; border-radius:8px; font-weight:bold; cursor:pointer; margin-top:10px;">
                                + Nouvelle épreuve
                            </button>
                        </div>
                    `;
                } else if (actionName === 'add_grade') {
                    modalTitle.innerHTML = `<i class="bi bi-award" style="color:var(--accent-primary);"></i> Ajouter une note`;
                    modalContent.innerHTML = `
                        <div style="display:flex; flex-direction:column; gap:15px; align-items:center;">
                            <p style="text-align:center; color:var(--text-muted); margin:0;">Note globale pour ${sub.name}</p>
                            <div style="display:flex; align-items:center; gap:10px; font-size:24px;">
                                <input type="number" step="0.5" min="0" max="20" placeholder="15" style="width:80px; padding:10px; font-size:20px; text-align:center; background:var(--bg-card); color:var(--text-main); border:1px solid var(--border-color); border-radius:8px;">
                                <span style="color:var(--text-muted);">/ 20</span>
                            </div>
                            <button style="background:var(--accent-primary); color:white; border:none; padding:10px 30px; border-radius:8px; font-weight:bold; cursor:pointer;">Valider</button>
                        </div>
                    `;
                }
            });
        });
    }
}
