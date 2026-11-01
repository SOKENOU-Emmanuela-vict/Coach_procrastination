import { escapeHtml, sanitizeUrl } from '../utils/security.js';
import { Motion } from './motion.js';

export class LanguageView {
    constructor(containerId, app) {
        this.container = typeof containerId === 'string' && typeof document !== 'undefined'
            ? document.getElementById(containerId)
            : (containerId || (typeof document !== 'undefined' ? document.getElementById('view-container') : null));
        this.app = app;
    }
    
    async render(state) {
        if (!this.container) return;
        if (typeof document !== 'undefined' && document.body) {
            document.body.className = 'theme-light';
            if (typeof document.body.setAttribute === 'function') {
                document.body.setAttribute('data-univers', 'langues');
            }
        }

        const languages = this.app.languageEngine 
            ? await this.app.languageEngine.getLanguages() 
            : (state.userLanguages || []);

        const renderEmptyState = () => `
            <div id="languages-empty-state" class="languages-empty-state">
                <div class="languages-empty-icon"><i class="bi bi-globe"></i></div>
                <h3 class="languages-empty-title">Ajoute ta première langue</h3>
                <p class="languages-empty-desc">
                    Choisis une langue pour définir ton niveau actuel, ton objectif personnalisé, tes ressources d'apprentissage (liens, livres, applis, vidéos) et ton rythme d'entraînement hebdomadaire.
                </p>
                <button type="button" id="btn-add-first-lang" class="languages-btn-add">
                    <i class="bi bi-plus-circle"></i> + Ajouter ma première langue
                </button>
            </div>
        `;

        const renderResourceBadge = (type) => {
            const types = {
                link: { label: 'Lien', icon: 'bi-link-45deg', cls: 'link' },
                book: { label: 'Livre', icon: 'bi-book', cls: 'book' },
                app: { label: 'Appli', icon: 'bi-phone', cls: 'app' },
                video: { label: 'Vidéo', icon: 'bi-play-circle', cls: 'video' }
            };
            const meta = types[type] || types.link;
            return `<span class="language-resource-badge ${meta.cls}"><i class="bi ${meta.icon}"></i> ${meta.label}</span>`;
        };

        const renderLanguageCard = (lang) => {
            const tracking = lang.tracking || { sessionsCompleted: 0, minutesStudied: 0, vocabularyWords: 0 };
            const plan = lang.plan || { sessionsPerWeek: 3, duration: 30, preferredDays: ['monday', 'wednesday', 'friday'] };
            const resources = Array.isArray(lang.resources) ? lang.resources : [];

            const dayLabels = {
                monday: 'Lun', tuesday: 'Mar', wednesday: 'Mer',
                thursday: 'Jeu', friday: 'Ven', saturday: 'Sam', sunday: 'Dim'
            };

            const langInitial = (lang.name || 'L').charAt(0).toUpperCase();

            return `
            <div class="language-card" data-id="${lang.id}">
                <!-- Actions En-tête -->
                <div class="language-card-actions">
                    <button class="btn-edit-lang language-action-btn" data-id="${lang.id}" title="Modifier la langue">
                        <i class="bi bi-pencil"></i>
                    </button>
                    <button class="btn-delete-lang language-action-btn danger" data-id="${lang.id}" title="Supprimer la langue">
                        <i class="bi bi-trash"></i>
                    </button>
                </div>

                <!-- Identité Langue -->
                <div class="language-card-identity">
                    <div class="language-icon-avatar">${escapeHtml(lang.icon || langInitial)}</div>
                    <div>
                        <h3 class="language-card-title">${escapeHtml(lang.name)}</h3>
                        <div>
                            <span class="btn-edit-level language-level-chip" data-id="${lang.id}" title="Cliquer pour modifier le niveau">
                                Niveau : ${escapeHtml(lang.level || 'A1')} <i class="bi bi-pencil"></i>
                            </span>
                        </div>
                    </div>
                </div>

                <!-- Objectif -->
                <div class="language-goal-box">
                    <div>
                        <div class="language-goal-label">Objectif visé</div>
                        <div class="language-goal-text">${escapeHtml(lang.goal || 'Aucun objectif défini')}</div>
                    </div>
                    <button class="btn-edit-goal language-action-btn" data-id="${lang.id}" title="Modifier l'objectif"><i class="bi bi-pencil"></i></button>
                </div>

                <!-- Suivi (KPI réels) -->
                <div>
                    <div class="language-section-header">
                        <span class="language-section-title">Suivi de pratique</span>
                        <button class="btn-custom-tracking language-section-link" data-id="${lang.id}">Ajuster</button>
                    </div>
                    <div class="language-tracking-grid">
                        <div class="language-tracking-cell">
                            <div class="language-tracking-num">${tracking.sessionsCompleted || 0}</div>
                            <div class="language-tracking-label">Séances</div>
                            <button class="btn-quick-add-session language-tracking-btn" data-id="${lang.id}" title="Ajouter une séance faite">+1</button>
                        </div>
                        <div class="language-tracking-cell">
                            <div class="language-tracking-num success">${tracking.minutesStudied || 0}</div>
                            <div class="language-tracking-label">Minutes</div>
                            <button class="btn-quick-add-minutes language-tracking-btn" data-id="${lang.id}" title="Ajouter 30 minutes">+30m</button>
                        </div>
                        <div class="language-tracking-cell">
                            <div class="language-tracking-num purple">${tracking.vocabularyWords || 0}</div>
                            <div class="language-tracking-label">Vocabulaire</div>
                            <button class="btn-quick-add-vocab language-tracking-btn" data-id="${lang.id}" title="Ajouter 10 mots">+10</button>
                        </div>
                    </div>
                </div>

                <!-- Plan d'apprentissage -->
                <div class="language-plan-box">
                    <div class="language-plan-header">
                        <span class="language-plan-title">
                            <i class="bi bi-calendar-check text-accent"></i> Plan d'apprentissage
                        </span>
                        <button class="btn-edit-plan language-action-btn" data-id="${lang.id}" title="Modifier le plan"><i class="bi bi-pencil"></i></button>
                    </div>
                    <div class="language-plan-meta">
                        <strong>${plan.sessionsPerWeek || 3}</strong> séances / sem. (${plan.duration || 30} min)
                    </div>
                    <div class="language-plan-days">
                        ${(plan.preferredDays || []).map(d => `<span class="language-day-badge">${dayLabels[d] || d}</span>`).join('')}
                    </div>
                    <button class="btn-apply-plan-planning language-btn-apply-plan" data-id="${lang.id}">
                        <i class="bi bi-calendar-plus"></i> Créer les séances dans mon planning (4 sem.)
                    </button>
                </div>

                <!-- Ressources (Liens, Livres, Applis, Vidéos) -->
                <div>
                    <div class="language-section-header">
                        <span class="language-section-title">Ressources (${resources.length})</span>
                        <button class="btn-add-resource btn btn-sm btn-ghost" data-id="${lang.id}">
                            + Ressource
                        </button>
                    </div>
                    <div class="language-resources-list">
                        ${resources.length > 0 ? resources.map(res => `
                            <div class="language-resource-row">
                                <div class="language-resource-info">
                                    <div class="language-resource-meta">
                                        ${renderResourceBadge(res.type)}
                                        <strong class="language-resource-name">${escapeHtml(res.title)}</strong>
                                    </div>
                                    ${res.value ? (sanitizeUrl(res.value) !== '#' ? `<a href="${escapeHtml(sanitizeUrl(res.value))}" target="_blank" rel="noopener noreferrer" class="language-resource-link">${escapeHtml(res.value)}</a>` : `<span class="language-resource-link">${escapeHtml(res.value)}</span>`) : ''}
                                </div>
                                <div class="d-flex align-center gap-1">
                                    <button class="btn-edit-resource language-action-btn" data-lang-id="${lang.id}" data-res-id="${res.id}" title="Modifier"><i class="bi bi-pencil"></i></button>
                                    <button class="btn-delete-resource language-action-btn danger" data-lang-id="${lang.id}" data-res-id="${res.id}" title="Supprimer"><i class="bi bi-trash"></i></button>
                                </div>
                            </div>
                        `).join('') : '<div class="language-empty-resources">Aucune ressource enregistrée (liens, livres, applis, vidéos).</div>'}
                    </div>
                </div>

                <!-- Bouton Coach Dédié -->
                <button class="btn-open-lang-coach language-btn-coach" data-lang-name="${escapeHtml(lang.name)}">
                    <i class="bi bi-robot text-accent"></i> Conseiller avec le Coach
                </button>
            </div>
            `;
        };

        const html = `
<div class="bureau languages-layout">
    <!-- SIDEBAR -->
    <div class="bureau-sidebar">
        <div class="bureau-brand">
            <div class="bureau-brand-icon">
                <i class="bi bi-book"></i>
            </div>
            Learning OS
        </div>
        
        <!-- ONGLETS -->
        <div class="bureau-nav">
            <div class="bureau-nav-item" data-view="desktop">
                <i class="bi bi-house-door"></i> Bureau
            </div>
            <div class="bureau-nav-item" data-view="planning">
                <i class="bi bi-calendar3"></i> Planning
            </div>
            <div class="bureau-nav-item" data-view="academic">
                <i class="bi bi-mortarboard"></i> École
            </div>
            <div class="bureau-nav-item active" data-view="languages">
                <i class="bi bi-globe"></i> Langues
            </div>
            <div class="bureau-nav-item" data-view="life">
                <i class="bi bi-heart"></i> Vie
            </div>
            <div class="bureau-nav-item" data-view="chat">
                <i class="bi bi-robot"></i> Coach
            </div>
        </div>
    </div>

    <!-- MAIN CONTENT -->
    <div class="bureau-content languages-content">
        <!-- TOPBAR -->
        <div class="languages-topbar">
            <div>
                <h1 class="languages-header-title">LANGUES</h1>
                <p class="languages-header-subtitle">Tes langues, ressources, plans d'apprentissage et progression.</p>
            </div>
            <div class="d-flex align-center gap-3">
                <button type="button" id="btn-add-language" class="languages-btn-add">
                    <i class="bi bi-plus-circle"></i> + Ajouter une langue
                </button>
                <div class="bureau-profile-avatar" id="btn-profile">
                    ${(state.userProfile?.name || 'E').charAt(0).toUpperCase()}
                </div>
            </div>
        </div>

        <!-- GRILLE DE CARTES OU ÉTAT VIDE -->
        ${languages.length > 0 
            ? `<div class="languages-grid">
                ${languages.map(renderLanguageCard).join('')}
               </div>` 
            : renderEmptyState()
        }
    </div>
</div>

<!-- MODAL LANGUE -->
<div id="language-modal" class="language-modal-backdrop" hidden>
    <div class="language-modal-card">
        <div class="language-modal-header">
            <h3 id="language-modal-title" class="language-modal-title">Titre</h3>
            <button id="language-modal-close" class="language-modal-close" aria-label="Fermer">&times;</button>
        </div>
        <div id="language-modal-content" class="language-modal-body">
            <!-- Contenu dynamique -->
        </div>
    </div>
</div>
        `;

        this.container.innerHTML = html;

        // Animations Motion
        Motion.fadeIn(this.container.querySelector('.languages-content') || this.container);
        const cards = this.container.querySelectorAll('.language-card');
        if (cards.length > 0) {
            Motion.staggerIn(cards, { stagger: 0.04, duration: 0.25 });
        }

        this.attachEvents(languages);
    }

    attachEvents(languages) {
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

        const btnProfile = this.container.querySelector('#btn-profile');
        if (btnProfile) {
            btnProfile.addEventListener('click', () => {
                if (this.app.renderView) this.app.renderView('portfolio');
            });
        }

        const modal = this.container.querySelector('#language-modal');
        const modalTitle = this.container.querySelector('#language-modal-title');
        const modalContent = this.container.querySelector('#language-modal-content');
        const btnClose = this.container.querySelector('#language-modal-close');

        const closeModal = () => { 
            if (modal) {
                modal.hidden = true;
                modal.style.display = 'none';
            }
        };
        if (btnClose) btnClose.addEventListener('click', closeModal);
        if (modal) modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

        const openModal = (title, contentHtml) => {
            if (!modal) return;
            modalTitle.innerHTML = title;
            modalContent.innerHTML = contentHtml;
            modal.hidden = false;
            modal.style.display = 'flex';
            Motion.modalOpen(modal);
        };

        // --- FORMULAIRE LANGUE (AJOUTER / MODIFIER) ---
        const openLanguageForm = (existing = null) => {
            const isEdit = existing && existing.id;
            openModal(
                `<i class="bi bi-globe"></i> ${isEdit ? 'Modifier la langue' : 'Ajouter une langue'}`,
                `
                <form id="form-lang" class="lang-form">
                    <div class="lang-form-group">
                        <label for="lang-name-input" class="lang-form-label">Nom de la langue</label>
                        <input type="text" id="lang-name-input" class="lang-form-input" required value="${escapeHtml(existing?.name || '')}" placeholder="Ex: Anglais, Espagnol, Allemand...">
                    </div>
                    <div class="lang-form-row">
                        <div class="lang-form-group">
                            <label for="lang-level-input" class="lang-form-label">Niveau actuel</label>
                            <select id="lang-level-input" class="lang-form-select">
                                <option value="A1" ${existing?.level === 'A1' ? 'selected' : ''}>A1 — Débutant</option>
                                <option value="A2" ${existing?.level === 'A2' ? 'selected' : ''}>A2 — Élémentaire</option>
                                <option value="B1" ${existing?.level === 'B1' ? 'selected' : ''}>B1 — Intermédiaire</option>
                                <option value="B2" ${existing?.level === 'B2' ? 'selected' : ''}>B2 — Avancé / Courant</option>
                                <option value="C1" ${existing?.level === 'C1' ? 'selected' : ''}>C1 — Autonome / Pro</option>
                                <option value="C2" ${existing?.level === 'C2' ? 'selected' : ''}>C2 — Bilingue / Maîtrise</option>
                            </select>
                        </div>
                        <div class="lang-form-group">
                            <label for="lang-icon-input" class="lang-form-label">Code / Symbole court</label>
                            <input type="text" id="lang-icon-input" class="lang-form-input" value="${escapeHtml(existing?.icon || '')}" placeholder="Ex: EN, ES, DE, JA">
                        </div>
                    </div>
                    <div class="lang-form-group">
                        <label for="lang-goal-input" class="lang-form-label">Objectif d'apprentissage</label>
                        <input type="text" id="lang-goal-input" class="lang-form-input" value="${escapeHtml(existing?.goal || '')}" placeholder="Ex: Réussir le TOEIC 850, stage à l'international...">
                    </div>
                    <div class="lang-form-actions">
                        <button type="button" id="btn-cancel-lang" class="btn btn-secondary">Annuler</button>
                        <button type="submit" class="btn btn-primary">Sauvegarder</button>
                    </div>
                </form>
                `
            );
            modalContent.querySelector('#btn-cancel-lang')?.addEventListener('click', closeModal);
            modalContent.querySelector('#form-lang')?.addEventListener('submit', async (e) => {
                e.preventDefault();
                const name = modalContent.querySelector('#lang-name-input').value.trim();
                const level = modalContent.querySelector('#lang-level-input').value;
                const icon = modalContent.querySelector('#lang-icon-input').value.trim();
                const goal = modalContent.querySelector('#lang-goal-input').value.trim();
                if (!name) return;

                if (this.app.languageEngine) {
                    await this.app.languageEngine.saveLanguage({
                        ...(existing || {}),
                        id: existing?.id,
                        name,
                        level,
                        icon: icon || undefined,
                        goal
                    });
                }
                closeModal();
                this.render(this.app.state);
            });
        };

        const btnAdd = this.container.querySelector('#btn-add-language');
        if (btnAdd) btnAdd.addEventListener('click', () => {
            Motion.buttonTap(btnAdd);
            openLanguageForm();
        });

        const btnAddFirst = this.container.querySelector('#btn-add-first-lang');
        if (btnAddFirst) btnAddFirst.addEventListener('click', () => {
            Motion.buttonTap(btnAddFirst);
            openLanguageForm();
        });

        this.container.querySelectorAll('.btn-edit-lang').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.getAttribute('data-id');
                const lang = languages.find(l => l.id === id);
                if (lang) openLanguageForm(lang);
            });
        });

        this.container.querySelectorAll('.btn-delete-lang').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.getAttribute('data-id');
                if (confirm("Supprimer cette langue et ses ressources associées ?")) {
                    if (this.app.languageEngine) {
                        await this.app.languageEngine.deleteLanguage(id);
                    }
                    this.render(this.app.state);
                }
            });
        });

        // Modification rapide de niveau
        this.container.querySelectorAll('.btn-edit-level').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.getAttribute('data-id');
                const lang = languages.find(l => l.id === id);
                if (!lang) return;
                const val = prompt("Modifier le niveau actuel (ex: A1, A2, B1, B2, C1, C2) :", lang.level || 'A1');
                if (val && val.trim()) {
                    await this.app.languageEngine.saveLanguage({ ...lang, level: val.trim().toUpperCase() });
                    this.render(this.app.state);
                }
            });
        });

        // Modification rapide de l'objectif
        this.container.querySelectorAll('.btn-edit-goal').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.getAttribute('data-id');
                const lang = languages.find(l => l.id === id);
                if (!lang) return;
                const val = prompt("Modifier l'objectif visé :", lang.goal || '');
                if (val !== null) {
                    await this.app.languageEngine.saveLanguage({ ...lang, goal: val.trim() });
                    this.render(this.app.state);
                }
            });
        });

        // --- RESSOURCES (AJOUTER / MODIFIER / SUPPRIMER) ---
        const openResourceForm = (langId, existing = null) => {
            const isEdit = existing && existing.id;
            openModal(
                `<i class="bi bi-folder-plus"></i> ${isEdit ? 'Modifier la ressource' : 'Ajouter une ressource'}`,
                `
                <form id="form-resource" class="lang-form">
                    <div class="lang-form-group">
                        <label for="res-title-input" class="lang-form-label">Titre de la ressource</label>
                        <input type="text" id="res-title-input" class="lang-form-input" required value="${escapeHtml(existing?.title || '')}" placeholder="Ex: Altissia FORCE-N, Grammaire anglaise, Duolingo, Chaîne BBC...">
                    </div>
                    <div class="lang-form-group">
                        <label for="res-type-input" class="lang-form-label">Type de support</label>
                        <select id="res-type-input" class="lang-form-select">
                            <option value="link" ${existing?.type === 'link' ? 'selected' : ''}>Lien web / plateforme</option>
                            <option value="book" ${existing?.type === 'book' ? 'selected' : ''}>Livre / Manuel</option>
                            <option value="app" ${existing?.type === 'app' ? 'selected' : ''}>Application mobile</option>
                            <option value="video" ${existing?.type === 'video' ? 'selected' : ''}>Vidéo / Podcast / Chaîne</option>
                        </select>
                    </div>
                    <div class="lang-form-group">
                        <label for="res-value-input" class="lang-form-label">Lien web ou description</label>
                        <input type="text" id="res-value-input" class="lang-form-input" value="${escapeHtml(existing?.value || existing?.url || '')}" placeholder="https://... ou Chapitre 1-5">
                    </div>
                    <div class="lang-form-actions">
                        <button type="button" id="btn-cancel-res" class="btn btn-secondary">Annuler</button>
                        <button type="submit" class="btn btn-primary">Enregistrer</button>
                    </div>
                </form>
                `
            );
            modalContent.querySelector('#btn-cancel-res')?.addEventListener('click', closeModal);
            modalContent.querySelector('#form-resource')?.addEventListener('submit', async (e) => {
                e.preventDefault();
                const title = modalContent.querySelector('#res-title-input').value.trim();
                const type = modalContent.querySelector('#res-type-input').value;
                const value = modalContent.querySelector('#res-value-input').value.trim();
                if (!title) return;

                if (isEdit) {
                    await this.app.languageEngine.updateResource(langId, existing.id, { title, type, value });
                } else {
                    await this.app.languageEngine.addResource(langId, { title, type, value });
                }
                closeModal();
                this.render(this.app.state);
            });
        };

        this.container.querySelectorAll('.btn-add-resource').forEach(btn => {
            btn.addEventListener('click', () => {
                const langId = btn.getAttribute('data-id');
                openResourceForm(langId);
            });
        });

        this.container.querySelectorAll('.btn-edit-resource').forEach(btn => {
            btn.addEventListener('click', () => {
                const langId = btn.getAttribute('data-lang-id');
                const resId = btn.getAttribute('data-res-id');
                const lang = languages.find(l => l.id === langId);
                const res = (lang?.resources || []).find(r => r.id === resId);
                if (lang && res) openResourceForm(langId, res);
            });
        });

        this.container.querySelectorAll('.btn-delete-resource').forEach(btn => {
            btn.addEventListener('click', async () => {
                const langId = btn.getAttribute('data-lang-id');
                const resId = btn.getAttribute('data-res-id');
                if (confirm("Supprimer cette ressource ?")) {
                    await this.app.languageEngine.deleteResource(langId, resId);
                    this.render(this.app.state);
                }
            });
        });

        // --- PLAN D'APPRENTISSAGE ---
        const openPlanForm = (lang) => {
            const plan = lang.plan || { sessionsPerWeek: 3, duration: 30, preferredDays: ['monday', 'wednesday', 'friday'] };
            const days = plan.preferredDays || [];
            openModal(
                `<i class="bi bi-calendar-check"></i> Plan d'apprentissage : ${escapeHtml(lang.name)}`,
                `
                <form id="form-plan" class="lang-form">
                    <div class="lang-form-row">
                        <div class="lang-form-group">
                            <label for="plan-sessions-input" class="lang-form-label">Séances par semaine</label>
                            <input type="number" min="1" max="14" id="plan-sessions-input" class="lang-form-input" value="${plan.sessionsPerWeek || 3}">
                        </div>
                        <div class="lang-form-group">
                            <label for="plan-duration-input" class="lang-form-label">Durée (minutes / séance)</label>
                            <input type="number" min="10" max="180" step="5" id="plan-duration-input" class="lang-form-input" value="${plan.duration || 30}">
                        </div>
                    </div>
                    <div class="lang-form-group">
                        <label class="lang-form-label">Jours préférés</label>
                        <div class="lang-days-selection">
                            ${[
                                ['monday', 'Lundi'], ['tuesday', 'Mardi'], ['wednesday', 'Mercredi'],
                                ['thursday', 'Jeudi'], ['friday', 'Vendredi'], ['saturday', 'Samedi'], ['sunday', 'Dimanche']
                            ].map(([k, label]) => `
                                <label class="lang-day-check-label">
                                    <input type="checkbox" name="pref_day" value="${k}" ${days.includes(k) ? 'checked' : ''}>
                                    ${label}
                                </label>
                            `).join('')}
                        </div>
                    </div>
                    <div class="lang-form-actions">
                        <button type="button" id="btn-cancel-plan" class="btn btn-secondary">Annuler</button>
                        <button type="submit" class="btn btn-primary">Sauvegarder le plan</button>
                    </div>
                </form>
                `
            );
            modalContent.querySelector('#btn-cancel-plan')?.addEventListener('click', closeModal);
            modalContent.querySelector('#form-plan')?.addEventListener('submit', async (e) => {
                e.preventDefault();
                const sessionsPerWeek = parseInt(modalContent.querySelector('#plan-sessions-input').value, 10) || 3;
                const duration = parseInt(modalContent.querySelector('#plan-duration-input').value, 10) || 30;
                const selectedDays = Array.from(modalContent.querySelectorAll('input[name="pref_day"]:checked')).map(el => el.value);

                lang.plan = {
                    sessionsPerWeek,
                    duration,
                    preferredDays: selectedDays.length > 0 ? selectedDays : ['monday', 'wednesday', 'friday']
                };
                await this.app.languageEngine.saveLanguage(lang);
                closeModal();
                this.render(this.app.state);
            });
        };

        this.container.querySelectorAll('.btn-edit-plan').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.getAttribute('data-id');
                const lang = languages.find(l => l.id === id);
                if (lang) openPlanForm(lang);
            });
        });

        // Planifier dans l'agenda
        this.container.querySelectorAll('.btn-apply-plan-planning').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.getAttribute('data-id');
                const lang = languages.find(l => l.id === id);
                if (!lang || !this.app.languageEngine || !this.app.planningEngine) return;
                
                const res = await this.app.languageEngine.generatePlanningSessions(id, this.app.planningEngine);
                if (res.success) {
                    alert(`Super ! ${res.count} séances de ${lang.name} ont été générées dans ton planning sur les 4 prochaines semaines.`);
                    if (this.app.refreshCalendarData) await this.app.refreshCalendarData();
                } else {
                    alert(`Erreur : ${res.reason}`);
                }
            });
        });

        // --- SUIVI RAPIDE ---
        this.container.querySelectorAll('.btn-quick-add-session').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.getAttribute('data-id');
                await this.app.languageEngine.updateTracking(id, { sessionsDelta: 1, minutesDelta: 30 });
                this.render(this.app.state);
            });
        });

        this.container.querySelectorAll('.btn-quick-add-minutes').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.getAttribute('data-id');
                await this.app.languageEngine.updateTracking(id, { minutesDelta: 30 });
                this.render(this.app.state);
            });
        });

        this.container.querySelectorAll('.btn-quick-add-vocab').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.getAttribute('data-id');
                await this.app.languageEngine.updateTracking(id, { vocabDelta: 10 });
                this.render(this.app.state);
            });
        });

        this.container.querySelectorAll('.btn-custom-tracking').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.getAttribute('data-id');
                const lang = languages.find(l => l.id === id);
                if (!lang) return;
                const tracking = lang.tracking || { sessionsCompleted: 0, minutesStudied: 0, vocabularyWords: 0 };
                
                openModal(
                    `<i class="bi bi-graph-up"></i> Ajuster le suivi : ${escapeHtml(lang.name)}`,
                    `
                    <form id="form-tracking" class="lang-form">
                        <div class="lang-form-group">
                            <label for="track-sessions" class="lang-form-label">Séances effectuées</label>
                            <input type="number" min="0" id="track-sessions" class="lang-form-input" value="${tracking.sessionsCompleted || 0}">
                        </div>
                        <div class="lang-form-group">
                            <label for="track-minutes" class="lang-form-label">Minutes totales étudiées</label>
                            <input type="number" min="0" id="track-minutes" class="lang-form-input" value="${tracking.minutesStudied || 0}">
                        </div>
                        <div class="lang-form-group">
                            <label for="track-vocab" class="lang-form-label">Mots de vocabulaire mémorisés</label>
                            <input type="number" min="0" id="track-vocab" class="lang-form-input" value="${tracking.vocabularyWords || 0}">
                        </div>
                        <div class="lang-form-actions">
                            <button type="button" id="btn-cancel-track" class="btn btn-secondary">Annuler</button>
                            <button type="submit" class="btn btn-primary">Sauvegarder</button>
                        </div>
                    </form>
                    `
                );
                modalContent.querySelector('#btn-cancel-track')?.addEventListener('click', closeModal);
                modalContent.querySelector('#form-tracking')?.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    const sessions = parseInt(modalContent.querySelector('#track-sessions').value, 10) || 0;
                    const minutes = parseInt(modalContent.querySelector('#track-minutes').value, 10) || 0;
                    const vocab = parseInt(modalContent.querySelector('#track-vocab').value, 10) || 0;
                    await this.app.languageEngine.updateTracking(id, { sessions, minutes, vocab });
                    closeModal();
                    this.render(this.app.state);
                });
            });
        });

        // Bouton Coach
        this.container.querySelectorAll('.btn-open-lang-coach').forEach(btn => {
            btn.addEventListener('click', async () => {
                const langName = btn.getAttribute('data-lang-name');
                if (this.app.renderView) {
                    await this.app.renderView('chat');
                    if (typeof this.app.sendChatMessage === 'function') {
                        await this.app.sendChatMessage(`Je souhaite travailler mon ${langName}`);
                    }
                }
            });
        });
    }
}
