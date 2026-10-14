import { escapeHtml } from '../utils/html.js';

export class AcademicView {
    constructor(containerId, app) {
        this.container = typeof containerId === 'string' && typeof document !== 'undefined'
            ? document.getElementById(containerId)
            : (containerId || (typeof document !== 'undefined' ? document.getElementById('view-container') : null));
        this.app = app;
        this.selectedBlock = 0;
    }
    
    render(state) {
        if (!this.container) return;
        if (typeof document !== 'undefined' && document.body) {
            document.body.className = 'theme-light';
        }

        const blocks = [
            { id: 0, title: "L2 IA 2026-2027", icon: '<i class="bi bi-mortarboard"></i>', img: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=400&q=80" },
            { id: 1, title: "Projets & Stages", icon: '<i class="bi bi-briefcase"></i>', img: "https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=400&q=80" }
        ];

        const allSubjects = state.academicSubjects || [];
        const allSemesters = state.academicSemesters || [];
        const allAssessments = state.academicAssessments || [];
        const allGrades = state.academicGrades || [];

        // Build list of semesters to display
        let semestersToDisplay = [];
        if (allSemesters.length > 0) {
            semestersToDisplay = allSemesters.map(s => ({
                id: s.id,
                name: s.name || s.id,
                subjects: allSubjects.filter(sub => sub.semesterId === s.id)
            }));
            // Catch any subject not in defined semesters
            const knownSemIds = new Set(allSemesters.map(s => s.id));
            const orphanSubjects = allSubjects.filter(sub => !knownSemIds.has(sub.semesterId));
            if (orphanSubjects.length > 0) {
                semestersToDisplay.push({
                    id: 'sem_other',
                    name: 'Autres Matières',
                    subjects: orphanSubjects
                });
            }
        } else if (allSubjects.length > 0) {
            // Group by distinct semesterId
            const uniqueSemIds = [...new Set(allSubjects.map(s => s.semesterId || 'sem_default'))];
            semestersToDisplay = uniqueSemIds.map(semId => {
                let semName = semId;
                if (semId === 'sem_s3_26') semName = 'Semestre 3 (S3)';
                else if (semId === 'sem_s4_27') semName = 'Semestre 4 (S4)';
                else if (semId === 'sem_default') semName = 'Matières générales';
                return {
                    id: semId,
                    name: semName,
                    subjects: allSubjects.filter(s => (s.semesterId || 'sem_default') === semId)
                };
            });
        }

        const renderSubjectCard = (sub) => {
            const subAssessments = allAssessments.filter(a => a.subjectId === sub.id);
            const hasGrade = sub.grade !== null && sub.grade !== undefined;
            return `
            <div class="bureau-card" style="background:var(--bg-card); border-radius:12px; border:1px solid var(--border-color); padding:20px; position:relative; margin-bottom:15px; display:flex; flex-direction:column; gap:15px;">
                <!-- Edit & Delete buttons -->
                <div style="position:absolute; top:15px; right:15px; display:flex; gap:8px;">
                    <button class="btn-edit-item" data-id="${sub.id}" data-type="subject" style="background:transparent; border:none; color:var(--text-muted); cursor:pointer;" title="Modifier la matière">
                        <i class="bi bi-pencil-square" style="font-size:16px;"></i>
                    </button>
                    <button class="btn-delete-item" data-id="${sub.id}" data-type="subject" style="background:transparent; border:none; color:#f44336; cursor:pointer;" title="Supprimer la matière">
                        <i class="bi bi-trash" style="font-size:16px;"></i>
                    </button>
                </div>
                
                <h4 style="margin:0; font-size:16px; color:var(--text-main); padding-right:60px;">
                    <span style="font-size:12px; color:var(--text-muted); display:block; margin-bottom:4px;">${escapeHtml(sub.code || '')} • ${sub.cect || 0} CECT</span>
                    ${escapeHtml(sub.name || '')}
                </h4>
                
                <!-- Central Grade / ADD / EDIT / DELETE NOTE -->
                <div style="display:flex; justify-content:center; align-items:center; gap:10px; padding:15px 0;">
                    ${hasGrade ? `
                        <div style="display:flex; align-items:center; gap:10px;">
                            <span style="font-size:24px; font-weight:bold; color:var(--accent-primary);">${sub.grade} <span style="font-size:14px; color:var(--text-muted);">/ 20</span></span>
                            <button class="btn-edit-grade" data-subject-id="${sub.id}" data-grade="${sub.grade}" style="background:transparent; border:none; color:var(--text-muted); cursor:pointer; font-size:15px;" title="Modifier la note">✏️</button>
                            <button class="btn-delete-grade" data-subject-id="${sub.id}" style="background:transparent; border:none; color:#f44336; cursor:pointer; font-size:15px;" title="Supprimer la note">🗑️</button>
                        </div>
                    ` : `
                        <button class="btn-add-grade" data-id="${sub.id}" style="background:var(--accent-primary); color:white; border:none; padding:10px 20px; border-radius:8px; font-weight:bold; cursor:pointer; display:flex; align-items:center; gap:8px;">
                            <i class="bi bi-plus-circle"></i> + NOTE
                        </button>
                    `}
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
                        <span style="font-size:11px; font-weight:bold;">Épreuves (${subAssessments.length})</span>
                    </button>
                </div>
            </div>
            `;
        };

        const renderEmptyState = () => `
            <div id="academic-empty-state" style="text-align:center; padding:60px 20px; background:var(--bg-card); border-radius:16px; border:2px dashed var(--border-color); margin-top:20px;">
                <div style="font-size:48px; margin-bottom:15px;">🎓</div>
                <h3 style="font-size:20px; color:var(--text-main); margin-bottom:10px;">Ton cursus est vide</h3>
                <p style="color:var(--text-muted); font-size:14px; max-width:500px; margin:0 auto 25px auto;">
                    Commence par ajouter tes matières et semestres, ou charge le programme officiel à titre d'exemple.
                </p>
                <div style="display:flex; justify-content:center; gap:15px; flex-wrap:wrap;">
                    <button id="btn-empty-add-subject" class="btn-open-modal" data-type="subject" style="background:var(--accent-primary); color:white; border:none; padding:12px 24px; border-radius:10px; font-weight:bold; cursor:pointer; font-size:14px; display:inline-flex; align-items:center; gap:8px;">
                        <i class="bi bi-plus-circle"></i> Ajouter ta première matière
                    </button>
                    <button id="btn-empty-import-example" style="background:transparent; color:var(--accent-primary); border:2px solid var(--accent-primary); padding:12px 24px; border-radius:10px; font-weight:bold; cursor:pointer; font-size:14px; display:inline-flex; align-items:center; gap:8px;">
                        <i class="bi bi-download"></i> Exemple
                    </button>
                </div>
            </div>
        `;

        const renderSemestersList = () => {
            if (semestersToDisplay.length === 0) {
                return renderEmptyState();
            }
            return semestersToDisplay.map(sem => {
                const totalCect = sem.subjects.reduce((acc, sub) => acc + (sub.cect || 0), 0);
                return `
                <div class="semester-section" style="margin-bottom:35px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; padding-bottom:10px; border-bottom:2px solid var(--accent-primary); margin-bottom:15px;">
                        <h3 style="font-size:16px; margin:0; color:var(--text-main); display:flex; align-items:center; gap:10px;">
                            <span>${escapeHtml(sem.name)}</span>
                            <span style="font-size:12px; color:var(--text-muted); font-weight:normal;">— ${totalCect} CECT</span>
                        </h3>
                        <div style="display:flex; gap:8px; align-items:center;">
                            <button class="btn-add-subject-to-sem" data-semester-id="${sem.id}" style="background:rgba(14, 165, 233, 0.1); border:1px solid var(--accent-primary); color:var(--accent-primary); padding:4px 10px; border-radius:6px; cursor:pointer; font-size:12px; font-weight:600;" title="Ajouter une matière dans ce semestre">
                                + Matière
                            </button>
                            <button class="btn-edit-semester" data-id="${sem.id}" data-name="${escapeHtml(sem.name)}" style="background:transparent; border:none; color:var(--text-muted); cursor:pointer; font-size:15px;" title="Modifier le semestre">
                                ✏️
                            </button>
                            <button class="btn-delete-semester" data-id="${sem.id}" style="background:transparent; border:none; color:#f44336; cursor:pointer; font-size:15px;" title="Supprimer le semestre">
                                🗑️
                            </button>
                        </div>
                    </div>
                    <div>
                        ${sem.subjects.length > 0 ? sem.subjects.map(renderSubjectCard).join('') : '<p style="color:var(--text-muted); font-size:13px; font-style:italic;">Aucune matière dans ce semestre.</p>'}
                    </div>
                </div>
                `;
            }).join('');
        };

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
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; flex-wrap:wrap; gap:10px;">
                <h1 style="font-size: 24px; font-weight: 700; color:var(--text-main); letter-spacing:1px; margin:0;">CURSUS ACADÉMIQUE</h1>
                <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
                    <button type="button" id="btn-clear-example" style="background:transparent; color:#ef4444; border:1px solid #ef4444; padding:8px 15px; border-radius:20px; font-weight:bold; cursor:pointer; display:flex; align-items:center; gap:6px; font-size:13px;" title="Effacer les données d'exemple du cursus">
                        <i class="bi bi-trash"></i> Effacer les données d'exemple
                    </button>
                    <button type="button" id="btn-import-example" style="background:transparent; color:var(--accent-primary); border:1px solid var(--accent-primary); padding:8px 15px; border-radius:20px; font-weight:bold; cursor:pointer; display:flex; align-items:center; gap:6px; font-size:13px;" title="Importer le programme type (Exemple)">
                        <i class="bi bi-download"></i> Exemple
                    </button>
                    <button type="button" id="btn-add-semester" style="background:var(--bg-card); color:var(--text-main); border:1px solid var(--border-color); padding:8px 15px; border-radius:20px; font-weight:bold; cursor:pointer; display:flex; align-items:center; gap:6px; font-size:13px;">
                        <i class="bi bi-folder-plus"></i> + Semestre
                    </button>
                    <button type="button" id="btn-add-subject-top" style="background:var(--accent-primary); color:white; border:none; padding:8px 15px; border-radius:20px; font-weight:bold; cursor:pointer; display:flex; align-items:center; gap:6px; font-size:13px;">
                        <i class="bi bi-plus-circle"></i> + Matière
                    </button>
                </div>
            </div>
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

            <!-- Liste dynamique des semestres et matières -->
            <div style="display:grid; grid-template-columns: 1fr; gap:20px;">
                ${renderSemestersList()}
            </div>
        </div>
    </div>
</div>

<!-- MODAL ACADEMIQUE (Semestres, Épreuves, Notes) -->
<div id="academic-modal" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.7); z-index:9999; align-items:center; justify-content:center;">
    <div style="background:var(--bg-main); width:90%; max-width:600px; max-height:85vh; border-radius:12px; border:1px solid var(--border-color); display:flex; flex-direction:column; overflow:hidden; box-shadow:0 10px 30px rgba(0,0,0,0.5);">
        <div style="padding:15px 20px; border-bottom:1px solid var(--border-color); display:flex; justify-content:space-between; align-items:center; background:var(--bg-card);">
            <h3 id="academic-modal-title" style="margin:0; font-size:18px; color:var(--text-main);">Titre</h3>
            <button id="academic-modal-close" style="background:transparent; border:none; color:var(--text-muted); font-size:22px; cursor:pointer; line-height:1;">&times;</button>
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
        if (!this.container) return;

        // Navigation
        this.container.querySelectorAll('.bureau-nav-item').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const viewName = e.currentTarget.getAttribute('data-view');
                if (viewName && this.app.renderView) {
                    this.app.renderView(viewName);
                }
            });
        });

        this.container.querySelectorAll('.block-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                const id = parseInt(e.currentTarget.getAttribute('data-id'), 10);
                this.selectedBlock = id;
                this.render(this.app.state);
            });
        });

        const btnProfile = this.container.querySelector('#btn-profile');
        if (btnProfile) {
            btnProfile.addEventListener('click', () => {
                if (this.app.renderView) this.app.renderView('portfolio');
            });
        }

        const modal = this.container.querySelector('#academic-modal');
        const modalTitle = this.container.querySelector('#academic-modal-title');
        const modalContent = this.container.querySelector('#academic-modal-content');
        const btnClose = this.container.querySelector('#academic-modal-close');

        const closeModal = () => { if (modal) modal.style.display = 'none'; };
        if (btnClose) btnClose.addEventListener('click', closeModal);
        if (modal) modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

        const openModal = (title, contentHtml) => {
            if (!modal) return;
            modalTitle.innerHTML = title;
            modalContent.innerHTML = contentHtml;
            modal.style.display = 'flex';
        };

        // --- IMPORT PROGRAMME TYPE (EXEMPLE) ---
        const handleImportExample = async () => {
            if (confirm("Importer le programme type officiel (L2 IA) comme exemple ?")) {
                if (typeof this.app.importAcademicExample === 'function') {
                    await this.app.importAcademicExample();
                } else if (this.app.refreshAcademicSubjects) {
                    await this.app.refreshAcademicSubjects();
                    this.render(this.app.state);
                }
            }
        };
        const btnImport = this.container.querySelector('#btn-import-example');
        if (btnImport) btnImport.addEventListener('click', handleImportExample);
        const btnEmptyImport = this.container.querySelector('#btn-empty-import-example');
        if (btnEmptyImport) btnEmptyImport.addEventListener('click', handleImportExample);

        // --- EFFACER LES DONNEES D'EXEMPLE ---
        const handleClearExample = async () => {
            if (confirm("Effacer toutes les données d'exemple du cursus (semestres, matières, évaluations et notes) ?")) {
                if (typeof this.app.clearAcademicExample === 'function') {
                    await this.app.clearAcademicExample();
                } else if (this.app.academicEngine) {
                    await this.app.academicEngine.clearAllData();
                    await this.app.refreshAcademicSubjects();
                }
                this.render(this.app.state);
            }
        };
        const btnClearExample = this.container.querySelector('#btn-clear-example');
        if (btnClearExample) btnClearExample.addEventListener('click', handleClearExample);

        // --- SEMESTRES : AJOUTER / MODIFIER / SUPPRIMER ---
        const openSemesterForm = (sem = null) => {
            const isEdit = sem && sem.id;
            openModal(
                `<i class="bi bi-folder-plus"></i> ${isEdit ? 'Modifier le semestre' : 'Nouveau semestre'}`,
                `
                <form id="form-semester" style="display:flex; flex-direction:column; gap:15px;">
                    <div>
                        <label style="display:block; margin-bottom:5px; font-size:12px; color:var(--text-muted);">Nom du semestre</label>
                        <input type="text" id="sem-name-input" required value="${escapeHtml(sem ? sem.name : '')}" placeholder="Ex: Semestre 1 (S1)" style="width:100%; padding:10px; border-radius:8px; background:var(--bg-card); color:var(--text-main); border:1px solid var(--border-color); box-sizing:border-box;">
                    </div>
                    <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:10px;">
                        <button type="button" id="btn-cancel-sem" style="background:transparent; color:var(--text-muted); border:1px solid var(--border-color); padding:8px 16px; border-radius:6px; cursor:pointer;">Annuler</button>
                        <button type="submit" style="background:var(--accent-primary); color:white; border:none; padding:8px 20px; border-radius:6px; font-weight:bold; cursor:pointer;">Sauvegarder</button>
                    </div>
                </form>
                `
            );
            modalContent.querySelector('#btn-cancel-sem')?.addEventListener('click', closeModal);
            modalContent.querySelector('#form-semester')?.addEventListener('submit', async (e) => {
                e.preventDefault();
                const name = modalContent.querySelector('#sem-name-input').value.trim();
                if (!name) return;
                if (typeof this.app.saveSemester === 'function') {
                    await this.app.saveSemester({ id: sem?.id, name });
                }
                closeModal();
                this.render(this.app.state);
            });
        };

        const btnAddSemester = this.container.querySelector('#btn-add-semester');
        if (btnAddSemester) btnAddSemester.addEventListener('click', () => openSemesterForm());

        this.container.querySelectorAll('.btn-edit-semester').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.getAttribute('data-id');
                const name = btn.getAttribute('data-name');
                openSemesterForm({ id, name });
            });
        });

        this.container.querySelectorAll('.btn-delete-semester').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.getAttribute('data-id');
                if (confirm("Supprimer ce semestre et ses matières associées ?")) {
                    if (typeof this.app.deleteSemester === 'function') {
                        await this.app.deleteSemester(id);
                    }
                    this.render(this.app.state);
                }
            });
        });

        // --- MATIERES : FORMULAIRE DEDIE (AJOUTER / MODIFIER) ---
        const openSubjectForm = (sub = null, defaultSemesterId = null) => {
            const isEdit = sub && sub.id;
            const currentSemId = sub ? sub.semesterId : (defaultSemesterId || '');
            const semesters = this.app.state.academicSemesters || [];
            const semOptions = semesters.map(s => 
                `<option value="${s.id}" ${s.id === currentSemId ? 'selected' : ''}>${escapeHtml(s.name || s.id)}</option>`
            ).join('');

            openModal(
                `<i class="bi bi-book"></i> ${isEdit ? 'Modifier la matière' : 'Nouvelle matière'}`,
                `
                <form id="form-subject" style="display:flex; flex-direction:column; gap:12px;">
                    <div>
                        <label style="display:block; margin-bottom:4px; font-size:12px; color:var(--text-muted);">Intitulé de la matière</label>
                        <input type="text" id="sub-name-input" required value="${escapeHtml(sub?.name || '')}" placeholder="Ex: Algèbre Linéaire" style="width:100%; padding:10px; border-radius:8px; background:var(--bg-card); color:var(--text-main); border:1px solid var(--border-color); box-sizing:border-box;">
                    </div>
                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
                        <div>
                            <label style="display:block; margin-bottom:4px; font-size:12px; color:var(--text-muted);">Code matière</label>
                            <input type="text" id="sub-code-input" value="${escapeHtml(sub?.code || '')}" placeholder="Ex: MATH101" style="width:100%; padding:10px; border-radius:8px; background:var(--bg-card); color:var(--text-main); border:1px solid var(--border-color); box-sizing:border-box;">
                        </div>
                        <div>
                            <label style="display:block; margin-bottom:4px; font-size:12px; color:var(--text-muted);">Crédits (CECT)</label>
                            <input type="number" step="1" min="0" id="sub-cect-input" value="${sub?.cect ?? 6}" style="width:100%; padding:10px; border-radius:8px; background:var(--bg-card); color:var(--text-main); border:1px solid var(--border-color); box-sizing:border-box;">
                        </div>
                    </div>
                    <div>
                        <label style="display:block; margin-bottom:4px; font-size:12px; color:var(--text-muted);">Semestre</label>
                        <select id="sub-sem-input" style="width:100%; padding:10px; border-radius:8px; background:var(--bg-card); color:var(--text-main); border:1px solid var(--border-color); box-sizing:border-box;">
                            ${semOptions || '<option value="sem_default">Semestre par défaut</option>'}
                        </select>
                    </div>
                    <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:10px;">
                        <button type="button" id="btn-cancel-sub" style="background:transparent; color:var(--text-muted); border:1px solid var(--border-color); padding:8px 16px; border-radius:6px; cursor:pointer;">Annuler</button>
                        <button type="submit" style="background:var(--accent-primary); color:white; border:none; padding:8px 20px; border-radius:6px; font-weight:bold; cursor:pointer;">Sauvegarder</button>
                    </div>
                </form>
                `
            );

            modalContent.querySelector('#btn-cancel-sub')?.addEventListener('click', closeModal);
            modalContent.querySelector('#form-subject')?.addEventListener('submit', async (e) => {
                e.preventDefault();
                const name = modalContent.querySelector('#sub-name-input').value.trim();
                const code = modalContent.querySelector('#sub-code-input').value.trim();
                const cect = parseInt(modalContent.querySelector('#sub-cect-input').value, 10) || 0;
                const semesterId = modalContent.querySelector('#sub-sem-input').value;
                if (!name) return;

                const subjectPayload = {
                    ...(sub || {}),
                    id: sub?.id || `sub_${Date.now()}`,
                    name,
                    code,
                    cect,
                    semesterId: semesterId || (sub ? sub.semesterId : 'sem_s3_26')
                };

                await this.app.academicEngine.saveSubject(subjectPayload);
                await this.app.refreshAcademicSubjects();
                closeModal();
                this.render(this.app.state);
            });
        };

        const btnAddSubjectTop = this.container.querySelector('#btn-add-subject-top');
        if (btnAddSubjectTop) btnAddSubjectTop.addEventListener('click', () => openSubjectForm());

        const btnEmptyAddSubject = this.container.querySelector('#btn-empty-add-subject');
        if (btnEmptyAddSubject) btnEmptyAddSubject.addEventListener('click', () => openSubjectForm());

        this.container.querySelectorAll('.btn-add-subject-to-sem').forEach(btn => {
            btn.addEventListener('click', () => {
                const semesterId = btn.getAttribute('data-semester-id');
                openSubjectForm(null, semesterId);
            });
        });

        // --- MATIERES : MODIFIER / SUPPRIMER ---
        this.container.querySelectorAll('.btn-open-modal').forEach(btn => {
            btn.addEventListener('click', () => {
                const type = btn.getAttribute('data-type') || 'subject';
                if (type === 'subject') {
                    openSubjectForm();
                } else if (this.app.openGlobalItemEditor) {
                    this.app.openGlobalItemEditor({ type });
                }
            });
        });

        this.container.querySelectorAll('.btn-edit-item').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.currentTarget.getAttribute('data-id');
                const type = e.currentTarget.getAttribute('data-type');
                if (type === 'subject') {
                    const item = (this.app.state.academicSubjects || []).find(i => i.id === id);
                    if (item) {
                        openSubjectForm(item);
                    }
                }
            });
        });

        this.container.querySelectorAll('.btn-delete-item').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.currentTarget.getAttribute('data-id');
                const type = e.currentTarget.getAttribute('data-type');
                if (confirm('Êtes-vous sûr de vouloir supprimer cet élément ?')) {
                    if (type === 'subject') {
                        await this.app.academicEngine.deleteSubject(id);
                        await this.app.refreshAcademicSubjects();
                    }
                    this.render(this.app.state);
                }
            });
        });

        // --- NOTES DIRECTES MATIERE : AJOUTER / MODIFIER / SUPPRIMER ---
        const handleGradePrompt = async (subjectId, existingGrade = '') => {
            const val = prompt("Entrez la note (/20) :", existingGrade);
            if (val !== null) {
                const n = parseFloat(val);
                if (!isNaN(n) && n >= 0 && n <= 20) {
                    if (typeof this.app.saveSubjectGrade === 'function') {
                        await this.app.saveSubjectGrade(subjectId, n);
                    } else {
                        const sub = (this.app.state.academicSubjects || []).find(s => s.id === subjectId);
                        if (sub) {
                            sub.grade = n;
                            await this.app.academicEngine.saveSubject(sub);
                            await this.app.refreshAcademicSubjects();
                        }
                    }
                    this.render(this.app.state);
                } else {
                    alert("Note invalide (doit être un nombre entre 0 et 20).");
                }
            }
        };

        this.container.querySelectorAll('.btn-add-grade').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const subjectId = e.currentTarget.getAttribute('data-id');
                handleGradePrompt(subjectId);
            });
        });

        this.container.querySelectorAll('.btn-edit-grade').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const subjectId = e.currentTarget.getAttribute('data-subject-id');
                const currentGrade = e.currentTarget.getAttribute('data-grade') || '';
                handleGradePrompt(subjectId, currentGrade);
            });
        });

        this.container.querySelectorAll('.btn-delete-grade').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const subjectId = e.currentTarget.getAttribute('data-subject-id');
                if (confirm("Supprimer la note de cette matière ?")) {
                    if (typeof this.app.deleteSubjectGrade === 'function') {
                        await this.app.deleteSubjectGrade(subjectId);
                    }
                    this.render(this.app.state);
                }
            });
        });

        // --- GESTION DES EVALUATIONS & EXAMENS (MODAL EPREUVES) ---
        const openEpreuvesModal = (subjectId) => {
            const allSubs = this.app.state.academicSubjects || [];
            const sub = allSubs.find(s => s.id === subjectId) || { name: 'Matière' };
            const assessments = (this.app.state.academicAssessments || []).filter(a => a.subjectId === subjectId);
            const grades = this.app.state.academicGrades || [];

            const renderAssessmentsListHtml = () => {
                if (assessments.length === 0) {
                    return `<p style="text-align:center; color:var(--text-muted); padding:20px 0;">Aucune évaluation ou examen configuré pour cette matière.</p>`;
                }
                return assessments.map(ass => {
                    const grade = grades.find(g => g.assessmentId === ass.id && g.isFinal !== false) || grades.find(g => g.assessmentId === ass.id);
                    return `
                    <div style="background:var(--bg-card); border:1px solid var(--border-color); border-radius:10px; padding:15px; margin-bottom:12px; display:flex; justify-content:space-between; align-items:center; gap:10px;">
                        <div>
                            <div style="font-weight:bold; font-size:15px; color:var(--text-main); margin-bottom:4px;">${escapeHtml(ass.title)}</div>
                            <div style="font-size:12px; color:var(--text-muted); display:flex; gap:10px; flex-wrap:wrap;">
                                <span style="background:rgba(14,165,233,0.15); color:var(--accent-primary); padding:2px 6px; border-radius:4px;">${escapeHtml(ass.type || 'Examen')}</span>
                                <span>Coeff : <strong>${ass.weight || 1}</strong></span>
                                <span>Max : <strong>${ass.maxScore || 20}</strong></span>
                                ${ass.targetDate ? `<span>📅 ${escapeHtml(ass.targetDate)}</span>` : ''}
                            </div>
                        </div>
                        <div style="display:flex; align-items:center; gap:10px;">
                            ${grade ? `
                                <div style="display:flex; align-items:center; gap:6px;">
                                    <span style="font-weight:bold; color:var(--accent-primary); font-size:15px;">${grade.score}/${ass.maxScore || 20}</span>
                                    <button class="btn-edit-ass-grade" data-ass-id="${ass.id}" data-grade-id="${grade.id}" data-score="${grade.score}" style="background:transparent; border:none; color:var(--text-muted); cursor:pointer;" title="Modifier la note">✏️</button>
                                    <button class="btn-delete-ass-grade" data-grade-id="${grade.id}" style="background:transparent; border:none; color:#f44336; cursor:pointer;" title="Supprimer la note">🗑️</button>
                                </div>
                            ` : `
                                <button class="btn-add-ass-grade" data-ass-id="${ass.id}" style="background:transparent; color:var(--accent-primary); border:1px solid var(--accent-primary); padding:4px 10px; border-radius:6px; font-size:12px; font-weight:bold; cursor:pointer;">
                                    + Note
                                </button>
                            `}
                            <div style="border-left:1px solid var(--border-color); height:24px; margin:0 4px;"></div>
                            <button class="btn-edit-assessment" data-ass-id="${ass.id}" style="background:transparent; border:none; color:var(--text-muted); cursor:pointer;" title="Modifier l'épreuve">✏️</button>
                            <button class="btn-delete-assessment" data-ass-id="${ass.id}" style="background:transparent; border:none; color:#f44336; cursor:pointer;" title="Supprimer l'épreuve">🗑️</button>
                        </div>
                    </div>
                    `;
                }).join('');
            };

            const fullContent = `
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
                    <span style="font-size:13px; color:var(--text-muted);">${assessments.length} épreuve(s)</span>
                    <button id="btn-add-assessment-in-modal" style="background:var(--accent-primary); color:white; border:none; padding:8px 15px; border-radius:6px; font-weight:bold; cursor:pointer; font-size:13px; display:inline-flex; align-items:center; gap:6px;">
                        <i class="bi bi-plus-circle"></i> + Ajouter une épreuve
                    </button>
                </div>
                <div id="assessments-list-container">
                    ${renderAssessmentsListHtml()}
                </div>
            `;

            openModal(`<i class="bi bi-ui-checks" style="color:#10b981;"></i> Épreuves : ${escapeHtml(sub.name)}`, fullContent);

            // Add Assessment Form Handler
            modalContent.querySelector('#btn-add-assessment-in-modal')?.addEventListener('click', () => {
                openAssessmentForm(subjectId);
            });

            // Edit Assessment
            modalContent.querySelectorAll('.btn-edit-assessment').forEach(btn => {
                btn.addEventListener('click', () => {
                    const assId = btn.getAttribute('data-ass-id');
                    const ass = assessments.find(a => a.id === assId);
                    openAssessmentForm(subjectId, ass);
                });
            });

            // Delete Assessment
            modalContent.querySelectorAll('.btn-delete-assessment').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const assId = btn.getAttribute('data-ass-id');
                    if (confirm("Supprimer cette épreuve et ses notes associées ?")) {
                        if (typeof this.app.deleteAssessment === 'function') {
                            await this.app.deleteAssessment(assId);
                        }
                        openEpreuvesModal(subjectId);
                    }
                });
            });

            // Add / Edit Assessment Grade
            modalContent.querySelectorAll('.btn-add-ass-grade, .btn-edit-ass-grade').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const assId = btn.getAttribute('data-ass-id');
                    const curScore = btn.getAttribute('data-score') || '';
                    const val = prompt("Entrez la note de cette épreuve :", curScore);
                    if (val !== null) {
                        const n = parseFloat(val);
                        if (!isNaN(n)) {
                            if (typeof this.app.saveAssessmentGrade === 'function') {
                                await this.app.saveAssessmentGrade({ assessmentId: assId, score: n, isFinal: true });
                            }
                            openEpreuvesModal(subjectId);
                        } else {
                            alert("Note invalide.");
                        }
                    }
                });
            });

            // Delete Assessment Grade
            modalContent.querySelectorAll('.btn-delete-ass-grade').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const gradeId = btn.getAttribute('data-grade-id');
                    if (confirm("Supprimer cette note ?")) {
                        if (typeof this.app.deleteGrade === 'function') {
                            await this.app.deleteGrade(gradeId);
                        }
                        openEpreuvesModal(subjectId);
                    }
                });
            });
        };

        const openAssessmentForm = (subjectId, existing = null) => {
            const isEdit = existing && existing.id;
            openModal(
                `<i class="bi bi-ui-checks"></i> ${isEdit ? 'Modifier l\'épreuve' : 'Nouvelle épreuve / examen'}`,
                `
                <form id="form-assessment" style="display:flex; flex-direction:column; gap:12px;">
                    <div>
                        <label style="display:block; margin-bottom:4px; font-size:12px; color:var(--text-muted);">Intitulé de l'épreuve</label>
                        <input type="text" id="ass-title-input" required value="${escapeHtml(existing?.title || '')}" placeholder="Ex: Examen Final, Partiel, CC1..." style="width:100%; padding:10px; border-radius:8px; background:var(--bg-card); color:var(--text-main); border:1px solid var(--border-color); box-sizing:border-box;">
                    </div>
                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
                        <div>
                            <label style="display:block; margin-bottom:4px; font-size:12px; color:var(--text-muted);">Type</label>
                            <select id="ass-type-input" style="width:100%; padding:10px; border-radius:8px; background:var(--bg-card); color:var(--text-main); border:1px solid var(--border-color); box-sizing:border-box;">
                                <option value="Examen" ${existing?.type === 'Examen' ? 'selected' : ''}>Examen</option>
                                <option value="Partiel" ${existing?.type === 'Partiel' ? 'selected' : ''}>Partiel</option>
                                <option value="CC" ${existing?.type === 'CC' ? 'selected' : ''}>Contrôle Continu (CC)</option>
                                <option value="Devoir" ${existing?.type === 'Devoir' ? 'selected' : ''}>Devoir maison</option>
                                <option value="Projet" ${existing?.type === 'Projet' ? 'selected' : ''}>Projet / Soutenance</option>
                            </select>
                        </div>
                        <div>
                            <label style="display:block; margin-bottom:4px; font-size:12px; color:var(--text-muted);">Date prévue</label>
                            <input type="date" id="ass-date-input" value="${escapeHtml(existing?.targetDate || '')}" style="width:100%; padding:10px; border-radius:8px; background:var(--bg-card); color:var(--text-main); border:1px solid var(--border-color); box-sizing:border-box;">
                        </div>
                    </div>
                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
                        <div>
                            <label style="display:block; margin-bottom:4px; font-size:12px; color:var(--text-muted);">Coefficient (Poids)</label>
                            <input type="number" step="0.1" min="0.1" id="ass-weight-input" value="${existing?.weight ?? 1.0}" style="width:100%; padding:10px; border-radius:8px; background:var(--bg-card); color:var(--text-main); border:1px solid var(--border-color); box-sizing:border-box;">
                        </div>
                        <div>
                            <label style="display:block; margin-bottom:4px; font-size:12px; color:var(--text-muted);">Note maximale</label>
                            <input type="number" step="1" min="1" id="ass-max-input" value="${existing?.maxScore ?? 20}" style="width:100%; padding:10px; border-radius:8px; background:var(--bg-card); color:var(--text-main); border:1px solid var(--border-color); box-sizing:border-box;">
                        </div>
                    </div>
                    <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:10px;">
                        <button type="button" id="btn-back-epreuves" style="background:transparent; color:var(--text-muted); border:1px solid var(--border-color); padding:8px 16px; border-radius:6px; cursor:pointer;">Retour</button>
                        <button type="submit" style="background:var(--accent-primary); color:white; border:none; padding:8px 20px; border-radius:6px; font-weight:bold; cursor:pointer;">Sauvegarder</button>
                    </div>
                </form>
                `
            );
            modalContent.querySelector('#btn-back-epreuves')?.addEventListener('click', () => openEpreuvesModal(subjectId));
            modalContent.querySelector('#form-assessment')?.addEventListener('submit', async (e) => {
                e.preventDefault();
                const title = modalContent.querySelector('#ass-title-input').value.trim();
                const type = modalContent.querySelector('#ass-type-input').value;
                const targetDate = modalContent.querySelector('#ass-date-input').value || null;
                const weight = parseFloat(modalContent.querySelector('#ass-weight-input').value) || 1.0;
                const maxScore = parseFloat(modalContent.querySelector('#ass-max-input').value) || 20;
                if (!title) return;

                if (typeof this.app.saveAssessment === 'function') {
                    await this.app.saveAssessment({
                        id: existing?.id,
                        subjectId,
                        title,
                        type,
                        targetDate,
                        weight,
                        maxScore
                    });
                }
                openEpreuvesModal(subjectId);
            });
        };

        // Action Buttons on Subject Cards
        this.container.querySelectorAll('.btn-action-subject').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const actionName = e.currentTarget.getAttribute('data-action');
                const subjectId = e.currentTarget.getAttribute('data-id');
                const allSubjects = this.app.state.academicSubjects || [];
                const sub = allSubjects.find(s => s.id === subjectId) || { name: 'Matière inconnue' };

                if (actionName === 'epreuves') {
                    openEpreuvesModal(subjectId);
                } else if (actionName === 'ressources') {
                    openModal(
                        `<i class="bi bi-folder2-open" style="color:#eab308;"></i> Ressources pour ${escapeHtml(sub.name)}`,
                        `
                        <div style="text-align:center; padding:20px; color:var(--text-muted);">
                            <i class="bi bi-cloud-arrow-up" style="font-size:40px; color:var(--accent-primary); margin-bottom:10px; display:block;"></i>
                            <p>Aucune ressource disponible pour l'instant.</p>
                            <button style="background:var(--bg-card); color:var(--text-main); border:1px dashed var(--border-color); padding:10px 20px; border-radius:8px; cursor:pointer; margin-top:10px;">
                                <i class="bi bi-plus-lg"></i> Ajouter un fichier ou lien
                            </button>
                        </div>
                        `
                    );
                } else if (actionName === 'notebook') {
                    openModal(
                        `<i class="bi bi-robot" style="color:#0ea5e9;"></i> Notebook LM : ${escapeHtml(sub.name)}`,
                        `
                        <div style="display:flex; flex-direction:column; height:300px;">
                            <div style="flex-grow:1; background:var(--bg-card); border-radius:8px; padding:15px; overflow-y:auto; margin-bottom:10px; border:1px solid var(--border-color);">
                                <div style="color:var(--text-muted); font-size:12px; text-align:center;">L'IA est prête à répondre à vos questions sur <strong>${escapeHtml(sub.name)}</strong> en se basant sur vos ressources.</div>
                            </div>
                            <div style="display:flex; gap:10px;">
                                <input type="text" placeholder="Posez une question sur le cours..." style="flex-grow:1; padding:10px; background:var(--bg-card); color:var(--text-main); border:1px solid var(--border-color); border-radius:8px;">
                                <button style="background:#0ea5e9; color:white; border:none; padding:10px 20px; border-radius:8px; cursor:pointer;"><i class="bi bi-send"></i></button>
                            </div>
                        </div>
                        `
                    );
                }
            });
        });
    }
}
