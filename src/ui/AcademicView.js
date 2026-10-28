import { escapeHtml } from '../utils/html.js';
import { DocumentsModal } from './DocumentsModal.js';

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
        if (typeof document !== 'undefined' && document.body && typeof document.body.setAttribute === 'function') {
            document.body.setAttribute('data-univers', 'ecole');
        }

        const blocks = [
            { id: 0, title: "L2 IA 2026-2027", icon: '<i class="bi bi-mortarboard"></i>' },
            { id: 1, title: "Projets & Stages", icon: '<i class="bi bi-briefcase"></i>' }
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
            <article class="academic-subject-card">
                <!-- Edit & Delete buttons -->
                <div class="academic-card-tools">
                    <button class="academic-btn-icon btn-edit-item" data-id="${sub.id}" data-type="subject" title="Modifier la matière">
                        <i class="bi bi-pencil-square"></i>
                    </button>
                    <button class="academic-btn-icon danger btn-delete-item" data-id="${sub.id}" data-type="subject" title="Supprimer la matière">
                        <i class="bi bi-trash"></i>
                    </button>
                </div>
                
                <div>
                    <span class="academic-subject-meta">${escapeHtml(sub.code || '')} • ${sub.cect || 0} CECT</span>
                    <h4 class="academic-subject-title">${escapeHtml(sub.name || '')}</h4>
                </div>
                
                <!-- Central Grade / ADD / EDIT / DELETE NOTE -->
                <div class="academic-grade-area">
                    ${hasGrade ? `
                        <div class="academic-grade-display">
                            <span class="academic-grade-value">${sub.grade} <span class="academic-semester-cect">/ 20</span></span>
                            <button class="academic-btn-icon btn-edit-grade" data-subject-id="${sub.id}" data-grade="${sub.grade}" title="Modifier la note">
                                <i class="bi bi-pencil"></i>
                            </button>
                            <button class="academic-btn-icon danger btn-delete-grade" data-subject-id="${sub.id}" title="Supprimer la note">
                                <i class="bi bi-trash"></i>
                            </button>
                        </div>
                    ` : `
                        <button class="btn btn-primary btn-sm btn-add-grade" data-id="${sub.id}">
                            <i class="bi bi-plus-circle"></i> + NOTE
                        </button>
                    `}
                </div>
                
                <!-- Action Buttons Grid -->
                <div class="academic-subject-actions">
                    <button class="academic-action-btn btn-action-subject" data-action="documents" data-id="${sub.id}" title="Documents de cette matière">
                        <i class="bi bi-file-earmark-text"></i>
                        <span>Documents</span>
                    </button>
                    <button class="academic-action-btn btn-action-subject" data-action="notebook" data-id="${sub.id}">
                        <i class="bi bi-robot"></i>
                        <span>Notebook LM</span>
                    </button>
                    <button class="academic-action-btn btn-action-subject" data-action="epreuves" data-id="${sub.id}">
                        <i class="bi bi-ui-checks"></i>
                        <span>Épreuves (${subAssessments.length})</span>
                    </button>
                </div>
            </article>
            `;
        };

        const renderEmptyState = () => `
            <div id="academic-empty-state" class="academic-empty-container">
                <div class="academic-empty-icon">🎓</div>
                <h3 class="academic-empty-title">Ton cursus est vide</h3>
                <p class="academic-empty-desc">
                    Commence par ajouter tes matières et semestres, ou charge le programme officiel à titre d'exemple.
                </p>
                <div class="academic-empty-actions">
                    <button id="btn-empty-add-subject" class="btn btn-primary btn-open-modal" data-type="subject">
                        <i class="bi bi-plus-circle"></i> Ajouter ta première matière
                    </button>
                    <button id="btn-empty-import-example" class="btn btn-outline">
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
                <section class="academic-semester-section">
                    <header class="academic-semester-header">
                        <h3 class="academic-semester-title">
                            <span>${escapeHtml(sem.name)}</span>
                            <span class="academic-semester-cect">— ${totalCect} CECT</span>
                        </h3>
                        <div class="academic-header-actions">
                            <button class="btn btn-sm btn-outline btn-add-subject-to-sem" data-semester-id="${sem.id}" title="Ajouter une matière dans ce semestre">
                                + Matière
                            </button>
                            <button class="academic-btn-icon btn-edit-semester" data-id="${sem.id}" data-name="${escapeHtml(sem.name)}" title="Modifier le semestre">
                                <i class="bi bi-pencil"></i>
                            </button>
                            <button class="academic-btn-icon danger btn-delete-semester" data-id="${sem.id}" title="Supprimer le semestre">
                                <i class="bi bi-trash"></i>
                            </button>
                        </div>
                    </header>
                    <div class="academic-subjects-grid">
                        ${sem.subjects.length > 0 ? sem.subjects.map(renderSubjectCard).join('') : '<p class="academic-empty-desc">Aucune matière dans ce semestre.</p>'}
                    </div>
                </section>
                `;
            }).join('');
        };

        let html = `
<div class="bureau" data-univers="ecole">
    <!-- SIDEBAR -->
    <aside class="bureau-sidebar">
        <div class="bureau-brand">
            <div class="bureau-brand-icon">
                <i class="bi bi-book"></i>
            </div>
            <span>Learning OS</span>
        </div>
        
        <nav class="bureau-nav">
            <div class="bureau-nav-item" data-view="desktop">
                <i class="bi bi-house-door"></i> <span>Bureau</span>
            </div>
            <div class="bureau-nav-item" data-view="planning">
                <i class="bi bi-calendar3"></i> <span>Planning</span>
            </div>
            <div class="bureau-nav-item" data-view="calendar">
                <i class="bi bi-calendar-month"></i> <span>Calendrier</span>
            </div>
            <div class="bureau-nav-item active" data-view="academic">
                <i class="bi bi-mortarboard"></i> <span>École</span>
            </div>
            <div class="bureau-nav-item" data-view="languages">
                <i class="bi bi-globe"></i> <span>Langues</span>
            </div>
            <div class="bureau-nav-item" data-view="life">
                <i class="bi bi-heart"></i> <span>Vie</span>
            </div>
            <div class="bureau-nav-item" data-view="chat">
                <i class="bi bi-robot"></i> <span>Coach</span>
            </div>
            <div class="bureau-nav-item" data-view="dashboard">
                <i class="bi bi-speedometer2"></i> <span>Tableau de bord</span>
            </div>
            <div class="bureau-nav-item" data-view="weekly">
                <i class="bi bi-journal-check"></i> <span>Hebdo</span>
            </div>
            <div class="bureau-nav-item" data-view="portfolio">
                <i class="bi bi-award"></i> <span>Portfolio</span>
            </div>
        </nav>
    </aside>

    <!-- MAIN CONTENT -->
    <main class="bureau-content">
        <div>
            <header class="academic-topbar">
                <h1 class="academic-title">CURSUS ACADÉMIQUE</h1>
                <div class="academic-header-actions">
                    <button type="button" id="btn-open-documents" class="btn btn-secondary btn-sm" title="Gérer mes documents et cours">
                        <i class="bi bi-file-earmark-text"></i> Documents
                    </button>
                    <button type="button" id="btn-clear-example" class="btn btn-outline btn-sm" title="Effacer les données d'exemple du cursus">
                        <i class="bi bi-trash"></i> Effacer les données d'exemple
                    </button>
                    <button type="button" id="btn-import-example" class="btn btn-secondary btn-sm" title="Importer le programme type (Exemple)">
                        <i class="bi bi-download"></i> Exemple
                    </button>
                    <button type="button" id="btn-add-semester" class="btn btn-secondary btn-sm">
                        <i class="bi bi-folder-plus"></i> + Semestre
                    </button>
                    <button type="button" id="btn-add-subject-top" class="btn btn-primary btn-sm">
                        <i class="bi bi-plus-circle"></i> + Matière
                    </button>
                </div>
            </header>
            
            <div class="academic-blocks-row">
                ${blocks.map(b => `
                    <div class="academic-block-tab ${this.selectedBlock === b.id ? 'active' : ''}" data-id="${b.id}">
                        <div class="academic-block-icon">${b.icon}</div>
                        <div>
                            <h3 class="academic-block-title">${b.title}</h3>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>

        <div>
            <div class="academic-section-subhead">
                <h2 class="academic-semester-title">
                    <i class="bi bi-journal-bookmark"></i>
                    <span>Détails du ${escapeHtml(blocks[this.selectedBlock].title)}</span>
                </h2>
                <div id="btn-profile" class="bureau-profile-btn" title="Voir mon portfolio">
                    ${(state.userProfile?.name || 'E').charAt(0).toUpperCase()}
                </div>
            </div>

            <!-- Liste dynamique des semestres et matières -->
            <div>
                ${renderSemestersList()}
            </div>
        </div>
    </main>
</div>

<!-- MODAL ACADEMIQUE (Semestres, Épreuves, Notes) -->
<div id="academic-modal" class="academic-modal-overlay hidden">
    <div class="academic-modal-window">
        <div class="academic-modal-header">
            <h3 id="academic-modal-title" class="academic-modal-title">Titre</h3>
            <button id="academic-modal-close" class="academic-modal-close-btn" aria-label="Fermer">&times;</button>
        </div>
        <div id="academic-modal-content" class="academic-modal-body">
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

        this.container.querySelectorAll('.academic-block-tab').forEach(tab => {
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

        const closeModal = () => { if (modal) modal.classList.add('hidden'); };
        if (btnClose) btnClose.addEventListener('click', closeModal);
        if (modal) modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

        const openModal = (title, contentHtml) => {
            if (!modal) return;
            modalTitle.innerHTML = title;
            modalContent.innerHTML = contentHtml;
            modal.classList.remove('hidden');
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

        // --- OUVRIR LA MODALE DES DOCUMENTS ---
        const btnOpenDocuments = this.container.querySelector('#btn-open-documents');
        if (btnOpenDocuments) {
            btnOpenDocuments.addEventListener('click', () => {
                if (!this.documentsModal) this.documentsModal = new DocumentsModal(this.app);
                this.documentsModal.open(null);
            });
        }

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
                `<i class="bi bi-folder-plus"></i> <span>${isEdit ? 'Modifier le semestre' : 'Nouveau semestre'}</span>`,
                `
                <form id="form-semester" class="academic-form">
                    <div class="form-group">
                        <label class="form-label">Nom du semestre</label>
                        <input type="text" id="sem-name-input" required value="${escapeHtml(sem ? sem.name : '')}" placeholder="Ex: Semestre 1 (S1)" class="form-input">
                    </div>
                    <div class="academic-form-actions">
                        <button type="button" id="btn-cancel-sem" class="btn btn-secondary btn-sm">Annuler</button>
                        <button type="submit" class="btn btn-primary btn-sm">Sauvegarder</button>
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
                `<i class="bi bi-book"></i> <span>${isEdit ? 'Modifier la matière' : 'Nouvelle matière'}</span>`,
                `
                <form id="form-subject" class="academic-form">
                    <div class="form-group">
                        <label class="form-label">Intitulé de la matière</label>
                        <input type="text" id="sub-name-input" required value="${escapeHtml(sub?.name || '')}" placeholder="Ex: Algèbre Linéaire" class="form-input">
                    </div>
                    <div class="academic-form-grid">
                        <div class="form-group">
                            <label class="form-label">Code matière</label>
                            <input type="text" id="sub-code-input" value="${escapeHtml(sub?.code || '')}" placeholder="Ex: MATH101" class="form-input">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Crédits (CECT)</label>
                            <input type="number" step="1" min="0" id="sub-cect-input" value="${sub?.cect ?? 6}" class="form-input">
                        </div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Semestre</label>
                        <select id="sub-sem-input" class="form-select">
                            ${semOptions || '<option value="sem_default">Semestre par défaut</option>'}
                        </select>
                    </div>
                    <div class="academic-form-actions">
                        <button type="button" id="btn-cancel-sub" class="btn btn-secondary btn-sm">Annuler</button>
                        <button type="submit" class="btn btn-primary btn-sm">Sauvegarder</button>
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
                    return `<p class="academic-empty-desc">Aucune évaluation ou examen configuré pour cette matière.</p>`;
                }
                return assessments.map(ass => {
                    const grade = grades.find(g => g.assessmentId === ass.id && g.isFinal !== false) || grades.find(g => g.assessmentId === ass.id);
                    return `
                    <div class="academic-assessment-card">
                        <div>
                            <div class="academic-assessment-title">${escapeHtml(ass.title)}</div>
                            <div class="academic-assessment-meta">
                                <span class="academic-assessment-badge">${escapeHtml(ass.type || 'Examen')}</span>
                                <span>Coeff : <strong>${ass.weight || 1}</strong></span>
                                <span>Max : <strong>${ass.maxScore || 20}</strong></span>
                                ${ass.targetDate ? `<span>📅 ${escapeHtml(ass.targetDate)}</span>` : ''}
                            </div>
                        </div>
                        <div class="academic-grade-display">
                            ${grade ? `
                                <div class="academic-grade-display">
                                    <span class="academic-assessment-title">${grade.score}/${ass.maxScore || 20}</span>
                                    <button class="academic-btn-icon btn-edit-ass-grade" data-ass-id="${ass.id}" data-grade-id="${grade.id}" data-score="${grade.score}" title="Modifier la note">
                                        <i class="bi bi-pencil"></i>
                                    </button>
                                    <button class="academic-btn-icon danger btn-delete-ass-grade" data-grade-id="${grade.id}" title="Supprimer la note">
                                        <i class="bi bi-trash"></i>
                                    </button>
                                </div>
                            ` : `
                                <button class="btn btn-outline btn-sm btn-add-ass-grade" data-ass-id="${ass.id}">
                                    + Note
                                </button>
                            `}
                            <div class="academic-divider-v"></div>
                            <button class="academic-btn-icon btn-edit-assessment" data-ass-id="${ass.id}" title="Modifier l'épreuve">
                                <i class="bi bi-pencil"></i>
                            </button>
                            <button class="academic-btn-icon danger btn-delete-assessment" data-ass-id="${ass.id}" title="Supprimer l'épreuve">
                                <i class="bi bi-trash"></i>
                            </button>
                        </div>
                    </div>
                    `;
                }).join('');
            };

            const fullContent = `
                <div class="academic-section-subhead">
                    <span class="academic-semester-cect">${assessments.length} épreuve(s)</span>
                    <button id="btn-add-assessment-in-modal" class="btn btn-primary btn-sm">
                        <i class="bi bi-plus-circle"></i> + Ajouter une épreuve
                    </button>
                </div>
                <div id="assessments-list-container">
                    ${renderAssessmentsListHtml()}
                </div>
            `;

            openModal(`<i class="bi bi-ui-checks"></i> <span>Épreuves : ${escapeHtml(sub.name)}</span>`, fullContent);

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
                `<i class="bi bi-ui-checks"></i> <span>${isEdit ? 'Modifier l\'épreuve' : 'Nouvelle épreuve / examen'}</span>`,
                `
                <form id="form-assessment" class="academic-form">
                    <div class="form-group">
                        <label class="form-label">Intitulé de l'épreuve</label>
                        <input type="text" id="ass-title-input" required value="${escapeHtml(existing?.title || '')}" placeholder="Ex: Examen Final, Partiel, CC1..." class="form-input">
                    </div>
                    <div class="academic-form-grid">
                        <div class="form-group">
                            <label class="form-label">Type</label>
                            <select id="ass-type-input" class="form-select">
                                <option value="Examen" ${existing?.type === 'Examen' ? 'selected' : ''}>Examen</option>
                                <option value="Partiel" ${existing?.type === 'Partiel' ? 'selected' : ''}>Partiel</option>
                                <option value="CC" ${existing?.type === 'CC' ? 'selected' : ''}>Contrôle Continu (CC)</option>
                                <option value="Devoir" ${existing?.type === 'Devoir' ? 'selected' : ''}>Devoir maison</option>
                                <option value="Projet" ${existing?.type === 'Projet' ? 'selected' : ''}>Projet / Soutenance</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Date prévue</label>
                            <input type="date" id="ass-date-input" value="${escapeHtml(existing?.targetDate || '')}" class="form-input">
                        </div>
                    </div>
                    <div class="academic-form-grid">
                        <div class="form-group">
                            <label class="form-label">Coefficient (Poids)</label>
                            <input type="number" step="0.1" min="0.1" id="ass-weight-input" value="${existing?.weight ?? 1.0}" class="form-input">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Note maximale</label>
                            <input type="number" step="1" min="1" id="ass-max-input" value="${existing?.maxScore ?? 20}" class="form-input">
                        </div>
                    </div>
                    <div class="academic-form-actions">
                        <button type="button" id="btn-back-epreuves" class="btn btn-secondary btn-sm">Retour</button>
                        <button type="submit" class="btn btn-primary btn-sm">Sauvegarder</button>
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
                } else if (actionName === 'ressources' || actionName === 'documents') {
                    if (!this.documentsModal) this.documentsModal = new DocumentsModal(this.app);
                    this.documentsModal.open(subjectId);
                } else if (actionName === 'notebook') {
                    openModal(
                        `<i class="bi bi-robot"></i> <span>Notebook LM : ${escapeHtml(sub.name)}</span>`,
                        `
                        <div class="academic-notebook-chat-box">
                            <div class="academic-notebook-messages">
                                L'IA est prête à répondre à vos questions sur <strong>${escapeHtml(sub.name)}</strong> en se basant sur vos ressources.
                            </div>
                            <div class="academic-notebook-input-row">
                                <input type="text" placeholder="Posez une question sur le cours..." class="form-input">
                                <button class="btn btn-primary btn-sm"><i class="bi bi-send"></i></button>
                            </div>
                        </div>
                        `
                    );
                }
            });
        });
    }
}
