import { escapeHtml } from '../utils/html.js';

/**
 * DocumentsModal
 * Gestionnaire d'import et de consultation des cours et documents (Word, PDF, TXT, MD, texte collé).
 * Conforme au système de design : zéro style inline, messages d'erreurs en français selon Règle 6,
 * persistance dans IndexedDB via KnowledgeEngine.
 */
export class DocumentsModal {
    constructor(app) {
        this.app = app;
        this.modalId = 'academic-documents-modal';
        this.currentSubjectId = null;
        this.pendingSource = null;
        this.pendingMetadata = null;
        this.pendingLinkedTo = null;
    }

    ensureModal() {
        if (typeof document === 'undefined') return null;
        let modal = document.getElementById(this.modalId);
        if (modal) return modal;

        modal = document.createElement('div');
        modal.id = this.modalId;
        modal.className = 'modal-backdrop hidden';
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        modal.setAttribute('aria-labelledby', 'doc-modal-title');

        modal.innerHTML = `
            <div class="modal-box modal-lg">
                <header class="modal-header">
                    <h3 id="doc-modal-title" class="modal-title">
                        <i class="bi bi-file-earmark-text"></i> Documents & Cours
                    </h3>
                    <button type="button" id="btn-doc-modal-close" class="btn btn-ghost btn-sm" aria-label="Fermer">✕</button>
                </header>
                <div class="modal-body" id="doc-modal-body">
                    <!-- Contenu dynamique injecté par renderContent() -->
                </div>
            </div>
        `;

        this.modal = modal;
        this.body = modal.querySelector('#doc-modal-body');
        document.body.appendChild(modal);

        modal.addEventListener('click', (e) => {
            if (e.target === modal) this.close();
        });

        const btnClose = modal.querySelector('#btn-doc-modal-close');
        if (btnClose) {
            btnClose.addEventListener('click', () => this.close());
        }

        return modal;
    }

    /**
     * Ouvre la modale des documents, éventuellement pré-filtrée sur une matière.
     * @param {string|null} subjectId
     */
    async open(subjectId = null) {
        this.currentSubjectId = subjectId || null;
        const modal = this.ensureModal();
        if (!modal) return;

        await this.renderContent();
        modal.classList.remove('hidden');
    }

    close() {
        if (typeof document === 'undefined') return;
        const modal = document.getElementById(this.modalId);
        if (modal) {
            modal.classList.add('hidden');
        }
        this.pendingSource = null;
        this.pendingMetadata = null;
        this.pendingLinkedTo = null;
    }

    formatSize(bytes) {
        if (!bytes || typeof bytes !== 'number') return '-';
        if (bytes < 1024) return `${bytes} o`;
        if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
    }

    async renderContent() {
        const modal = this.ensureModal();
        if (!modal) return;
        const body = (modal && modal.querySelector('#doc-modal-body')) || this.body;
        if (!body) return;

        const subjects = (this.app && this.app.state && this.app.state.academicSubjects) || [];
        const knowledgeEngine = this.app && this.app.knowledgeEngine;
        let documents = [];
        if (knowledgeEngine && typeof knowledgeEngine.getDocuments === 'function') {
            documents = await knowledgeEngine.getDocuments();
        }

        // Si filtré sur une matière spécifique
        const filteredDocs = this.currentSubjectId
            ? documents.filter(d => d.linkedTo && d.linkedTo.subjectId === this.currentSubjectId)
            : documents;

        const subjectOptions = subjects.map(s => `
            <option value="${escapeHtml(s.id)}" ${s.id === this.currentSubjectId ? 'selected' : ''}>
                ${escapeHtml(s.code ? `${s.code} - ${s.name}` : s.name)}
            </option>
        `).join('');

        const docsHtml = filteredDocs.length === 0 ? `
            <div class="academic-empty-container">
                <i class="bi bi-folder2-open academic-resource-icon"></i>
                <p class="academic-empty-desc">Aucun document importé pour le moment.</p>
            </div>
        ` : `
            <div class="table-container">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Titre</th>
                            <th>Matière</th>
                            <th>Date</th>
                            <th>Pages / Extraits</th>
                            <th>Taille</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filteredDocs.map(doc => {
                            const sub = subjects.find(s => s.id === (doc.linkedTo && doc.linkedTo.subjectId));
                            const subName = sub ? (sub.code || sub.name) : 'Général';
                            const dateStr = doc.createdAt ? new Date(doc.createdAt).toLocaleDateString('fr-FR') : '-';
                            const pages = doc.metadata && doc.metadata.pageCount ? `${doc.metadata.pageCount} p. • ` : '';
                            const chunkCount = doc.metadata && doc.metadata.chunkCount ? doc.metadata.chunkCount : 0;
                            const chunks = `${chunkCount} ${chunkCount > 1 ? 'extraits' : 'extrait'}`;
                            return `
                                <tr data-doc-id="${escapeHtml(doc.id)}">
                                    <td><strong>${escapeHtml(doc.title)}</strong></td>
                                    <td><span class="badge ${sub ? 'badge-primary' : 'badge-secondary'}">${escapeHtml(subName)}</span></td>
                                    <td>${escapeHtml(dateStr)}</td>
                                    <td>${escapeHtml(pages + chunks)}</td>
                                    <td>${escapeHtml(this.formatSize(doc.metadata && doc.metadata.size))}</td>
                                    <td>
                                        <div class="btn-group">
                                            <button type="button" class="btn btn-outline btn-sm btn-doc-chunks" data-id="${escapeHtml(doc.id)}" title="Voir les extraits">Extraits</button>
                                            <button type="button" class="btn btn-outline btn-sm btn-doc-change-sub" data-id="${escapeHtml(doc.id)}" title="Changer de matière">Matière</button>
                                            <button type="button" class="btn btn-danger btn-sm btn-doc-del" data-id="${escapeHtml(doc.id)}" title="Supprimer ce document">✕</button>
                                        </div>
                                    </td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        `;

        body.innerHTML = `
            <p class="modal-hint">
                Tes documents restent sur cet appareil ; seuls quelques extraits sont envoyés à Gemini quand une clé est configurée.
            </p>

            <!-- Alertes & Messages -->
            <div id="doc-modal-alert" class="alert alert-warning" hidden></div>
            <div id="doc-modal-loading" class="alert alert-info" hidden>
                <i class="bi bi-arrow-repeat spin"></i> Extraction et indexation en cours...
            </div>
            <div id="doc-modal-success" class="alert alert-success" hidden>
                <span id="doc-modal-success-text"></span>
                <button type="button" id="btn-doc-ask-coach" class="btn btn-primary btn-sm">Poser une question au coach sur ce document</button>
            </div>
            <div id="doc-modal-duplicate" class="alert alert-warning" hidden>
                <p id="doc-modal-duplicate-text"></p>
                <div class="modal-actions">
                    <button type="button" id="btn-doc-confirm-replace" class="btn btn-primary btn-sm">Remplacer</button>
                    <button type="button" id="btn-doc-cancel-replace" class="btn btn-ghost btn-sm">Annuler</button>
                </div>
            </div>

            <!-- Sous-panneau d'extraits (initialement masqué) -->
            <div id="doc-chunks-drawer" class="card" hidden>
                <header class="card-header">
                    <h4 id="doc-chunks-title" class="card-title">Extraits indexés</h4>
                    <button type="button" id="btn-close-chunks" class="btn btn-ghost btn-sm">✕ Fermer</button>
                </header>
                <div class="card-body" id="doc-chunks-body"></div>
            </div>

            <!-- Formulaire d'ajout -->
            <div class="card">
                <div class="card-body">
                    <div class="form-group">
                        <label class="form-label" for="doc-subject-select">Matière liée</label>
                        <select id="doc-subject-select" class="form-input">
                            <option value="">Aucune matière (Général)</option>
                            ${subjectOptions}
                        </select>
                    </div>

                    <!-- Onglets d'ajout -->
                    <div class="tabs">
                        <button type="button" id="tab-add-file" class="tab-item active">Déposer un fichier</button>
                        <button type="button" id="tab-add-paste" class="tab-item">Coller un texte</button>
                    </div>

                    <!-- Zone 1 : Fichier -->
                    <div id="panel-add-file">
                        <div id="doc-dropzone" class="file-dropzone" tabindex="0">
                            <i class="bi bi-cloud-arrow-up academic-resource-icon"></i>
                            <p><strong>Dépose un fichier ou clique pour choisir</strong></p>
                            <p class="modal-hint">Word (.docx), PDF, texte (.txt, .md) • Max 15 Mo</p>
                            <input type="file" id="doc-file-input" class="visually-hidden" accept=".docx,.pdf,.txt,.md,.doc">
                        </div>
                    </div>

                    <!-- Zone 2 : Coller un texte -->
                    <div id="panel-add-paste" hidden>
                        <div class="form-group">
                            <label class="form-label" for="doc-paste-title">Titre du document *</label>
                            <input type="text" id="doc-paste-title" class="form-input" placeholder="Ex. Résumé d'algèbre linéaire">
                        </div>
                        <div class="form-group">
                            <label class="form-label" for="doc-paste-content">Contenu du texte *</label>
                            <textarea id="doc-paste-content" class="form-input" rows="5" placeholder="Colle ici le texte de ton cours..."></textarea>
                        </div>
                        <button type="button" id="btn-doc-paste-save" class="btn btn-primary btn-sm">
                            <i class="bi bi-plus-circle"></i> Enregistrer et indexer
                        </button>
                    </div>
                </div>
            </div>

            <!-- Liste des documents -->
            <div class="card">
                <header class="card-header">
                    <h4 class="card-title">
                        Documents indexés ${this.currentSubjectId ? '(matière sélectionnée)' : ''} (${filteredDocs.length})
                    </h4>
                    ${this.currentSubjectId ? `
                        <button type="button" id="btn-doc-show-all" class="btn btn-ghost btn-sm">Voir tous les documents</button>
                    ` : ''}
                </header>
                <div class="card-body">
                    ${docsHtml}
                </div>
            </div>
        `;

        this.bindEvents(body);
    }

    bindEvents(body) {
        const alertBox = body.querySelector('#doc-modal-alert');
        const loadingBox = body.querySelector('#doc-modal-loading');
        const successBox = body.querySelector('#doc-modal-success');
        const successText = body.querySelector('#doc-modal-success-text');
        const duplicateBox = body.querySelector('#doc-modal-duplicate');
        const duplicateText = body.querySelector('#doc-modal-duplicate-text');
        const btnConfirmReplace = body.querySelector('#btn-doc-confirm-replace');
        const btnCancelReplace = body.querySelector('#btn-doc-cancel-replace');
        const btnAskCoach = body.querySelector('#btn-doc-ask-coach');

        const showAlert = (msg, isDanger = false) => {
            if (!alertBox) return;
            alertBox.textContent = msg;
            alertBox.className = isDanger ? 'alert alert-danger' : 'alert alert-warning';
            alertBox.hidden = false;
        };

        const hideAlert = () => {
            if (alertBox) {
                alertBox.hidden = true;
                alertBox.textContent = '';
            }
        };

        const showLoading = (show) => {
            if (loadingBox) loadingBox.hidden = !show;
        };

        const showSuccess = (msg) => {
            if (!successBox) return;
            if (successText) successText.textContent = msg;
            successBox.hidden = false;
        };

        // Tabs switch
        const tabFile = body.querySelector('#tab-add-file');
        const tabPaste = body.querySelector('#tab-add-paste');
        const panelFile = body.querySelector('#panel-add-file');
        const panelPaste = body.querySelector('#panel-add-paste');

        if (tabFile && tabPaste && panelFile && panelPaste) {
            tabFile.addEventListener('click', () => {
                tabFile.classList.add('active');
                tabPaste.classList.remove('active');
                panelFile.hidden = false;
                panelPaste.hidden = true;
            });
            tabPaste.addEventListener('click', () => {
                tabPaste.classList.add('active');
                tabFile.classList.remove('active');
                panelFile.hidden = true;
                panelPaste.hidden = false;
            });
        }

        // Subject selector change
        const subSelect = body.querySelector('#doc-subject-select');
        if (subSelect) {
            subSelect.addEventListener('change', (e) => {
                this.currentSubjectId = e.target.value || null;
            });
        }

        // Show all documents button
        const btnShowAll = body.querySelector('#btn-doc-show-all');
        if (btnShowAll) {
            btnShowAll.addEventListener('click', async () => {
                this.currentSubjectId = null;
                await this.renderContent();
            });
        }

        // Action : Poser une question au coach
        if (btnAskCoach) {
            btnAskCoach.addEventListener('click', () => {
                this.close();
                if (this.app && typeof this.app.renderView === 'function') {
                    this.app.renderView('chat');
                }
            });
        }

        // Remplacement de doublon
        if (btnConfirmReplace) {
            btnConfirmReplace.addEventListener('click', async () => {
                if (this.pendingSource) {
                    await this.processIngest(this.pendingSource, this.pendingMetadata, this.pendingLinkedTo, { replace: true });
                }
                if (duplicateBox) duplicateBox.hidden = true;
            });
        }
        if (btnCancelReplace) {
            btnCancelReplace.addEventListener('click', () => {
                if (duplicateBox) duplicateBox.hidden = true;
                this.pendingSource = null;
                this.pendingMetadata = null;
                this.pendingLinkedTo = null;
            });
        }

        // Fichier : Dropzone & Input file
        const dropzone = body.querySelector('#doc-dropzone');
        const fileInput = body.querySelector('#doc-file-input');

        if (dropzone && fileInput) {
            dropzone.addEventListener('click', () => fileInput.click());
            dropzone.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    fileInput.click();
                }
            });

            dropzone.addEventListener('dragover', (e) => {
                e.preventDefault();
                dropzone.classList.add('dragover');
            });
            dropzone.addEventListener('dragleave', () => {
                dropzone.classList.remove('dragover');
            });
            dropzone.addEventListener('drop', async (e) => {
                e.preventDefault();
                dropzone.classList.remove('dragover');
                if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) {
                    await this.handleIncomingFile(e.dataTransfer.files[0]);
                }
            });

            fileInput.addEventListener('change', async (e) => {
                if (e.target.files && e.target.files[0]) {
                    await this.handleIncomingFile(e.target.files[0]);
                    e.target.value = '';
                }
            });
        }

        // Texte collé : enregistrement
        const btnSavePaste = body.querySelector('#btn-doc-paste-save');
        const pasteTitle = body.querySelector('#doc-paste-title');
        const pasteContent = body.querySelector('#doc-paste-content');

        if (btnSavePaste && pasteTitle && pasteContent) {
            btnSavePaste.addEventListener('click', async () => {
                hideAlert();
                const title = pasteTitle.value.trim();
                const content = pasteContent.value.trim();
                if (!title) {
                    showAlert("Veuillez indiquer un titre pour ce document.");
                    return;
                }
                if (!content) {
                    showAlert("Le contenu du texte est vide.");
                    return;
                }

                const subjectId = (subSelect && subSelect.value) || this.currentSubjectId || null;
                await this.processIngest(
                    content,
                    { title },
                    { subjectId },
                    { replace: false }
                );
            });
        }

        // Liste actions : Voir extraits, changer de matière, supprimer
        body.querySelectorAll('.btn-doc-chunks').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const docId = e.currentTarget.getAttribute('data-id');
                await this.showChunks(docId, body);
            });
        });

        body.querySelectorAll('.btn-doc-change-sub').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const docId = e.currentTarget.getAttribute('data-id');
                await this.promptChangeSubject(docId);
            });
        });

        body.querySelectorAll('.btn-doc-del').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const docId = e.currentTarget.getAttribute('data-id');
                const ok = typeof window !== 'undefined' && typeof window.confirm === 'function'
                    ? window.confirm("Supprimer ce document et tous ses extraits ?")
                    : true;
                if (ok) {
                    if (this.app && this.app.knowledgeEngine) {
                        await this.app.knowledgeEngine.deleteDocument(docId);
                    }
                    await this.renderContent();
                }
            });
        });

        // Fermer le tiroir d'extraits
        const btnCloseChunks = body.querySelector('#btn-close-chunks');
        const chunksDrawer = body.querySelector('#doc-chunks-drawer');
        if (btnCloseChunks && chunksDrawer) {
            btnCloseChunks.addEventListener('click', () => {
                chunksDrawer.hidden = true;
            });
        }
    }

    async handleIncomingFile(file) {
        const subSelect = document.getElementById('doc-subject-select');
        const subjectId = (subSelect && subSelect.value) || this.currentSubjectId || null;

        await this.processIngest(
            file,
            { title: file.name },
            { subjectId },
            { replace: false }
        );
    }

    async processIngest(source, metadata = {}, linkedTo = {}, options = {}) {
        const body = document.getElementById('doc-modal-body');
        const alertBox = body ? body.querySelector('#doc-modal-alert') : null;
        const loadingBox = body ? body.querySelector('#doc-modal-loading') : null;
        const successBox = body ? body.querySelector('#doc-modal-success') : null;
        const successText = body ? body.querySelector('#doc-modal-success-text') : null;
        const duplicateBox = body ? body.querySelector('#doc-modal-duplicate') : null;
        const duplicateText = body ? body.querySelector('#doc-modal-duplicate-text') : null;

        if (alertBox) alertBox.hidden = true;
        if (successBox) successBox.hidden = true;
        if (duplicateBox) duplicateBox.hidden = true;
        if (loadingBox) loadingBox.hidden = false;

        const knowledgeEngine = this.app && this.app.knowledgeEngine;
        if (!knowledgeEngine) {
            if (loadingBox) loadingBox.hidden = true;
            if (alertBox) {
                alertBox.textContent = "Moteur de connaissances indisponible.";
                alertBox.hidden = false;
            }
            return;
        }

        try {
            const llmProvider = this.app.coachEngine && this.app.coachEngine.llmProvider;
            const res = await knowledgeEngine.ingestDocument(
                source,
                { ...metadata, llmProvider },
                linkedTo,
                options
            );

            if (loadingBox) loadingBox.hidden = true;

            const chunkCount = res.chunks ? res.chunks.length : 0;
            const docTitle = res.document ? res.document.title : (metadata.title || "Document");

            await this.renderContent();

            // Affichage du message de succès dans la vue rafraîchie
            const newBody = document.getElementById('doc-modal-body');
            if (newBody) {
                const newSuccessBox = newBody.querySelector('#doc-modal-success');
                const newSuccessText = newBody.querySelector('#doc-modal-success-text');
                if (newSuccessBox && newSuccessText) {
                    const extraitsLabel = chunkCount > 1 ? 'extraits indexés' : 'extrait indexé';
                    newSuccessText.textContent = `${chunkCount} ${extraitsLabel} depuis ${docTitle}.`;
                    newSuccessBox.hidden = false;
                }
            }
        } catch (err) {
            if (loadingBox) loadingBox.hidden = true;

            if (err && err.isDuplicate && err.existingDocument) {
                this.pendingSource = source;
                this.pendingMetadata = metadata;
                this.pendingLinkedTo = linkedTo;
                if (duplicateBox && duplicateText) {
                    duplicateText.textContent = `Ce document a déjà été importé ("${err.existingDocument.title}"). Veux-tu le remplacer ?`;
                    duplicateBox.hidden = false;
                }
                return;
            }

            if (alertBox) {
                alertBox.textContent = err.message || "Erreur lors de la lecture du document.";
                alertBox.hidden = false;
            }
        }
    }

    async showChunks(docId, body) {
        const drawer = body.querySelector('#doc-chunks-drawer');
        const titleEl = body.querySelector('#doc-chunks-title');
        const bodyEl = body.querySelector('#doc-chunks-body');
        if (!drawer || !bodyEl) return;

        const knowledgeEngine = this.app && this.app.knowledgeEngine;
        if (!knowledgeEngine) return;

        const doc = await knowledgeEngine.getDocumentById(docId);
        const allChunks = await knowledgeEngine.getChunks();
        const docChunks = allChunks.filter(c => c.documentId === docId);

        if (titleEl) {
            titleEl.textContent = `Extraits indexés : ${doc ? doc.title : ''} (${docChunks.length})`;
        }

        if (docChunks.length === 0) {
            bodyEl.innerHTML = '<p class="academic-empty-desc">Aucun extrait trouvé pour ce document.</p>';
        } else {
            bodyEl.innerHTML = `
                <div class="academic-chunks-list">
                    ${docChunks.map((c, idx) => `
                        <div class="card">
                            <div class="card-header">
                                <span class="badge badge-secondary">Extrait #${idx + 1}</span>
                                <span class="modal-hint">Page ${c.pageStart || 1}${c.pageEnd && c.pageEnd !== c.pageStart ? `-${c.pageEnd}` : ''}</span>
                            </div>
                            <div class="card-body">
                                <p>${escapeHtml(c.content)}</p>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
        }

        drawer.hidden = false;
        drawer.scrollIntoView({ behavior: 'smooth' });
    }

    async promptChangeSubject(docId) {
        const subjects = (this.app && this.app.state && this.app.state.academicSubjects) || [];
        const optionsStr = ['0: Aucune matière (Général)', ...subjects.map((s, i) => `${i + 1}: ${s.code ? `${s.code} - ${s.name}` : s.name}`)].join('\n');
        
        let choice = null;
        if (typeof window !== 'undefined' && typeof window.prompt === 'function') {
            choice = window.prompt(`Sélectionne le numéro de la nouvelle matière :\n${optionsStr}`);
        }

        if (choice !== null && choice !== undefined) {
            const idx = parseInt(choice, 10);
            let newSubjectId = null;
            if (idx > 0 && subjects[idx - 1]) {
                newSubjectId = subjects[idx - 1].id;
            }
            if (this.app && this.app.knowledgeEngine) {
                await this.app.knowledgeEngine.updateDocumentSubject(docId, newSubjectId);
            }
            await this.renderContent();
        }
    }
}
