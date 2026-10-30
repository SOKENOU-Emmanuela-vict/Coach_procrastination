import { escapeHtml, sanitizeUrl } from '../utils/security.js';

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
            document.body.className = 'theme-cyber';
        }

        const languages = this.app.languageEngine 
            ? await this.app.languageEngine.getLanguages() 
            : (state.userLanguages || []);

        const renderEmptyState = () => `
            <div id="languages-empty-state" style="text-align:center; padding:70px 20px; background:var(--bg-card); border-radius:16px; border:2px dashed var(--border-color); margin-top:20px; max-width:800px; margin-left:auto; margin-right:auto;">
                <div style="font-size:52px; margin-bottom:15px;">🌐</div>
                <h3 style="font-size:22px; color:var(--text-main); margin-bottom:10px; font-weight:700;">Ajoute ta première langue</h3>
                <p style="color:var(--text-muted); font-size:14px; max-width:520px; margin:0 auto 25px auto; line-height:1.6;">
                    Choisis une langue pour définir ton niveau actuel, ton objectif personnalisé, tes ressources d'apprentissage (liens, livres, applis, vidéos) et ton rythme d'entraînement hebdomadaire.
                </p>
                <button type="button" id="btn-add-first-lang" style="background:var(--accent-primary); color:white; border:none; padding:12px 28px; border-radius:10px; font-weight:bold; cursor:pointer; font-size:15px; display:inline-flex; align-items:center; gap:8px; box-shadow:0 4px 15px rgba(14,165,233,0.3);">
                    <i class="bi bi-plus-circle"></i> + Ajouter ma première langue
                </button>
            </div>
        `;

        const renderResourceBadge = (type) => {
            const types = {
                link: { label: 'Lien', icon: 'bi-link-45deg', color: '#0ea5e9', bg: 'rgba(14,165,233,0.1)' },
                book: { label: 'Livre', icon: 'bi-book', color: '#10b981', bg: 'rgba(16,185,129,0.1)' },
                app: { label: 'Appli', icon: 'bi-phone', color: '#8b5cf6', bg: 'rgba(139,92,246,0.1)' },
                video: { label: 'Vidéo', icon: 'bi-play-circle', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' }
            };
            const meta = types[type] || types.link;
            return `<span style="background:${meta.bg}; color:${meta.color}; border:1px solid ${meta.color}44; padding:2px 8px; border-radius:12px; font-size:11px; font-weight:600; display:inline-flex; align-items:center; gap:4px;"><i class="bi ${meta.icon}"></i> ${meta.label}</span>`;
        };

        const renderLanguageCard = (lang) => {
            const tracking = lang.tracking || { sessionsCompleted: 0, minutesStudied: 0, vocabularyWords: 0 };
            const plan = lang.plan || { sessionsPerWeek: 3, duration: 30, preferredDays: ['monday', 'wednesday', 'friday'] };
            const resources = Array.isArray(lang.resources) ? lang.resources : [];

            const dayLabels = {
                monday: 'Lun', tuesday: 'Mar', wednesday: 'Mer',
                thursday: 'Jeu', friday: 'Ven', saturday: 'Sam', sunday: 'Dim'
            };

            return `
            <div class="bureau-card language-card" data-id="${lang.id}" style="background:var(--bg-card); border-radius:16px; border:1px solid var(--border-color); padding:24px; position:relative; display:flex; flex-direction:column; gap:20px; box-shadow:0 8px 24px rgba(0,0,0,0.15);">
                <!-- Actions En-tête -->
                <div style="position:absolute; top:20px; right:20px; display:flex; gap:8px;">
                    <button class="btn-edit-lang" data-id="${lang.id}" style="background:transparent; border:none; color:var(--text-muted); cursor:pointer; font-size:16px;" title="Modifier la langue">
                        <i class="bi bi-pencil-square"></i>
                    </button>
                    <button class="btn-delete-lang" data-id="${lang.id}" style="background:transparent; border:none; color:#f44336; cursor:pointer; font-size:16px;" title="Supprimer la langue">
                        <i class="bi bi-trash"></i>
                    </button>
                </div>

                <!-- Identité Langue -->
                <div style="display:flex; align-items:center; gap:16px;">
                    <div style="font-size:44px; line-height:1; filter:drop-shadow(0 2px 4px rgba(0,0,0,0.2));">${lang.icon || '🌐'}</div>
                    <div>
                        <h3 style="margin:0 0 6px 0; font-size:22px; color:var(--text-main); font-weight:700;">${escapeHtml(lang.name)}</h3>
                        <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
                            <span style="background:rgba(14,165,233,0.15); color:var(--accent-primary); border:1px solid var(--accent-primary); padding:3px 10px; border-radius:20px; font-size:12px; font-weight:bold; cursor:pointer;" class="btn-edit-level" data-id="${lang.id}" title="Cliquer pour modifier le niveau">
                                Niveau : ${escapeHtml(lang.level || 'A1')} ✏️
                            </span>
                        </div>
                    </div>
                </div>

                <!-- Objectif -->
                <div style="background:var(--bg-main); border:1px solid var(--border-color); border-radius:10px; padding:12px 16px; display:flex; justify-content:space-between; align-items:center; gap:10px;">
                    <div>
                        <div style="font-size:11px; text-transform:uppercase; letter-spacing:0.5px; color:var(--text-muted); font-weight:600; margin-bottom:4px;">Objectif visé</div>
                        <div style="font-size:14px; color:var(--text-main); font-weight:500;">${escapeHtml(lang.goal || 'Aucun objectif défini')}</div>
                    </div>
                    <button class="btn-edit-goal" data-id="${lang.id}" style="background:transparent; border:none; color:var(--text-muted); cursor:pointer; font-size:14px;" title="Modifier l'objectif">✏️</button>
                </div>

                <!-- Suivi (KPI réels) -->
                <div>
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                        <span style="font-size:12px; font-weight:bold; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.5px;">Suivi de pratique</span>
                        <button class="btn-custom-tracking" data-id="${lang.id}" style="background:transparent; border:none; color:var(--accent-primary); font-size:12px; cursor:pointer; font-weight:600;">Ajuster</button>
                    </div>
                    <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:10px;">
                        <div style="background:var(--bg-main); border:1px solid var(--border-color); border-radius:10px; padding:12px 8px; text-align:center;">
                            <div style="font-size:20px; font-weight:bold; color:var(--accent-primary);">${tracking.sessionsCompleted || 0}</div>
                            <div style="font-size:11px; color:var(--text-muted); margin:4px 0 8px 0;">Séances</div>
                            <button class="btn-quick-add-session" data-id="${lang.id}" style="background:rgba(14,165,233,0.1); border:1px solid var(--accent-primary); color:var(--accent-primary); padding:3px 8px; border-radius:6px; font-size:11px; font-weight:bold; cursor:pointer;" title="Ajouter une séance faite">+1</button>
                        </div>
                        <div style="background:var(--bg-main); border:1px solid var(--border-color); border-radius:10px; padding:12px 8px; text-align:center;">
                            <div style="font-size:20px; font-weight:bold; color:#10b981;">${tracking.minutesStudied || 0}</div>
                            <div style="font-size:11px; color:var(--text-muted); margin:4px 0 8px 0;">Minutes</div>
                            <button class="btn-quick-add-minutes" data-id="${lang.id}" style="background:rgba(16,185,129,0.1); border:1px solid #10b981; color:#10b981; padding:3px 8px; border-radius:6px; font-size:11px; font-weight:bold; cursor:pointer;" title="Ajouter 30 minutes">+30m</button>
                        </div>
                        <div style="background:var(--bg-main); border:1px solid var(--border-color); border-radius:10px; padding:12px 8px; text-align:center;">
                            <div style="font-size:20px; font-weight:bold; color:#8b5cf6;">${tracking.vocabularyWords || 0}</div>
                            <div style="font-size:11px; color:var(--text-muted); margin:4px 0 8px 0;">Vocabulaire</div>
                            <button class="btn-quick-add-vocab" data-id="${lang.id}" style="background:rgba(139,92,246,0.1); border:1px solid #8b5cf6; color:#8b5cf6; padding:3px 8px; border-radius:6px; font-size:11px; font-weight:bold; cursor:pointer;" title="Ajouter 10 mots">+10</button>
                        </div>
                    </div>
                </div>

                <!-- Plan d'apprentissage -->
                <div style="background:var(--bg-main); border:1px solid var(--border-color); border-radius:12px; padding:14px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                        <span style="font-size:13px; font-weight:bold; color:var(--text-main); display:flex; align-items:center; gap:6px;">
                            <i class="bi bi-calendar-check" style="color:var(--accent-primary);"></i> Plan d'apprentissage
                        </span>
                        <button class="btn-edit-plan" data-id="${lang.id}" style="background:transparent; border:none; color:var(--text-muted); cursor:pointer; font-size:13px;" title="Modifier le plan">✏️</button>
                    </div>
                    <div style="font-size:13px; color:var(--text-muted); margin-bottom:8px;">
                        <strong>${plan.sessionsPerWeek || 3}</strong> séances / sem. (${plan.duration || 30} min)
                    </div>
                    <div style="display:flex; gap:6px; flex-wrap:wrap; margin-bottom:12px;">
                        ${(plan.preferredDays || []).map(d => `<span style="background:var(--bg-card); border:1px solid var(--border-color); padding:2px 8px; border-radius:6px; font-size:11px; color:var(--text-main);">${dayLabels[d] || d}</span>`).join('')}
                    </div>
                    <button class="btn-apply-plan-planning" data-id="${lang.id}" style="width:100%; background:transparent; color:var(--accent-primary); border:1px solid var(--accent-primary); padding:8px; border-radius:8px; font-weight:bold; cursor:pointer; font-size:12px; display:flex; align-items:center; justify-content:center; gap:6px;">
                        <i class="bi bi-calendar-plus"></i> Créer les séances dans mon planning (4 sem.)
                    </button>
                </div>

                <!-- Ressources (Liens, Livres, Applis, Vidéos) -->
                <div>
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                        <span style="font-size:12px; font-weight:bold; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.5px;">Ressources (${resources.length})</span>
                        <button class="btn-add-resource" data-id="${lang.id}" style="background:rgba(14,165,233,0.1); border:1px solid var(--accent-primary); color:var(--accent-primary); padding:3px 10px; border-radius:6px; font-size:12px; font-weight:bold; cursor:pointer;">
                            + Ressource
                        </button>
                    </div>
                    <div style="display:flex; flex-direction:column; gap:8px;">
                        ${resources.length > 0 ? resources.map(res => `
                            <div style="background:var(--bg-main); border:1px solid var(--border-color); border-radius:8px; padding:10px 12px; display:flex; justify-content:space-between; align-items:center; gap:8px;">
                                <div style="overflow:hidden; text-overflow:ellipsis;">
                                    <div style="display:flex; align-items:center; gap:8px; margin-bottom:2px;">
                                        ${renderResourceBadge(res.type)}
                                        <strong style="font-size:13px; color:var(--text-main); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(res.title)}</strong>
                                    </div>
                                    ${res.value ? (sanitizeUrl(res.value) !== '#' ? `<a href="${escapeHtml(sanitizeUrl(res.value))}" target="_blank" rel="noopener noreferrer" style="font-size:11px; color:var(--text-muted); text-decoration:none; display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(res.value)}</a>` : `<span style="font-size:11px; color:var(--text-muted); display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(res.value)}</span>`) : ''}
                                </div>
                                <div style="display:flex; gap:6px; align-items:center;">
                                    <button class="btn-edit-resource" data-lang-id="${lang.id}" data-res-id="${res.id}" style="background:transparent; border:none; color:var(--text-muted); cursor:pointer; font-size:14px;" title="Modifier">✏️</button>
                                    <button class="btn-delete-resource" data-lang-id="${lang.id}" data-res-id="${res.id}" style="background:transparent; border:none; color:#f44336; cursor:pointer; font-size:14px;" title="Supprimer">🗑️</button>
                                </div>
                            </div>
                        `).join('') : '<div style="color:var(--text-muted); font-size:12px; font-style:italic; padding:8px 0;">Aucune ressource enregistrée (liens, livres, applis, vidéos).</div>'}
                    </div>
                </div>

                <!-- Bouton Coach Dédié -->
                <button class="btn-open-lang-coach" data-lang-name="${escapeHtml(lang.name)}" style="background:var(--bg-main); border:1px solid var(--border-color); color:var(--text-main); padding:10px; border-radius:10px; font-weight:600; cursor:pointer; font-size:13px; display:flex; align-items:center; justify-content:center; gap:8px;">
                    <i class="bi bi-robot" style="color:var(--accent-primary);"></i> Conseiller avec le Coach
                </button>
            </div>
            `;
        };

        const html = `
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
            <div class="bureau-nav-item" data-view="academic" style="display:flex; align-items:center; gap:12px; cursor:pointer; padding:12px 15px; color:var(--text-muted); font-weight:500;">
                <i class="bi bi-mortarboard" style="font-size:18px;"></i> École
            </div>
            <div class="bureau-nav-item active" data-view="languages" style="display:flex; align-items:center; gap:12px; cursor:pointer; background:rgba(14, 165, 233, 0.1); border-left:4px solid var(--accent-primary); border-radius:0 8px 8px 0; padding:12px 15px 12px 11px; color:var(--text-main); font-weight:600;">
                <i class="bi bi-globe" style="font-size:18px; color:var(--accent-primary);"></i> Langues
            </div>
            <div class="bureau-nav-item" data-view="life" style="display:flex; align-items:center; gap:12px; cursor:pointer; padding:12px 15px; color:var(--text-muted); font-weight:500;">
                <i class="bi bi-heart" style="font-size:18px;"></i> Vie
            </div>
            <div class="bureau-nav-item" data-view="chat" style="display:flex; align-items:center; gap:12px; cursor:pointer; padding:12px 15px; color:var(--text-muted); font-weight:500;">
                <i class="bi bi-robot" style="font-size:18px;"></i> Coach
            </div>
        </div>
    </div>

    <!-- MAIN CONTENT -->
    <div class="bureau-content" style="flex: 1; padding: 30px 40px; overflow-y: auto; background: var(--bg-main);">
        <!-- TOPBAR -->
        <div class="bureau-topbar" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; flex-wrap:wrap; gap:15px;">
            <div>
                <h1 style="font-size: 24px; font-weight: 700; color:var(--text-main); letter-spacing:1px; margin:0;">LANGUES</h1>
                <p style="color: var(--text-muted); font-size:14px; margin:5px 0 0 0;">Tes langues, ressources, plans d'apprentissage et progression.</p>
            </div>
            <div style="display:flex; gap:12px; align-items:center;">
                <button type="button" id="btn-add-language" style="background:var(--accent-primary); color:white; border:none; padding:10px 20px; border-radius:20px; font-weight:bold; cursor:pointer; display:flex; align-items:center; gap:8px; font-size:14px;">
                    <i class="bi bi-plus-circle"></i> + Ajouter une langue
                </button>
                <div class="bureau-profile-avatar" style="width:40px; height:40px; border-radius:50%; background:var(--accent-primary); display:flex; align-items:center; justify-content:center; font-weight:bold; color:white; font-size:18px; cursor:pointer;" id="btn-profile">
                    ${(state.userProfile?.name || 'E').charAt(0).toUpperCase()}
                </div>
            </div>
        </div>

        <!-- GRILLE DE CARTES OU ÉTAT VIDE -->
        ${languages.length > 0 
            ? `<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(360px, 1fr)); gap: 24px;">
                ${languages.map(renderLanguageCard).join('')}
               </div>` 
            : renderEmptyState()
        }
    </div>
</div>

<!-- MODAL LANGUE -->
<div id="language-modal" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.7); z-index:9999; align-items:center; justify-content:center;">
    <div style="background:var(--bg-main); width:90%; max-width:550px; max-height:85vh; border-radius:14px; border:1px solid var(--border-color); display:flex; flex-direction:column; overflow:hidden; box-shadow:0 12px 35px rgba(0,0,0,0.5);">
        <div style="padding:16px 20px; border-bottom:1px solid var(--border-color); display:flex; justify-content:space-between; align-items:center; background:var(--bg-card);">
            <h3 id="language-modal-title" style="margin:0; font-size:18px; color:var(--text-main);">Titre</h3>
            <button id="language-modal-close" style="background:transparent; border:none; color:var(--text-muted); font-size:24px; cursor:pointer; line-height:1;">&times;</button>
        </div>
        <div id="language-modal-content" style="padding:22px; overflow-y:auto; flex-grow:1; color:var(--text-main);">
            <!-- Contenu dynamique -->
        </div>
    </div>
</div>
        `;

        this.container.innerHTML = html;
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

        const closeModal = () => { if (modal) modal.style.display = 'none'; };
        if (btnClose) btnClose.addEventListener('click', closeModal);
        if (modal) modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

        const openModal = (title, contentHtml) => {
            if (!modal) return;
            modalTitle.innerHTML = title;
            modalContent.innerHTML = contentHtml;
            modal.style.display = 'flex';
        };

        // --- FORMULAIRE LANGUE (AJOUTER / MODIFIER) ---
        const openLanguageForm = (existing = null) => {
            const isEdit = existing && existing.id;
            openModal(
                `<i class="bi bi-globe"></i> ${isEdit ? 'Modifier la langue' : 'Ajouter une langue'}`,
                `
                <form id="form-lang" style="display:flex; flex-direction:column; gap:14px;">
                    <div>
                        <label style="display:block; margin-bottom:4px; font-size:12px; color:var(--text-muted);">Nom de la langue</label>
                        <input type="text" id="lang-name-input" required value="${escapeHtml(existing?.name || '')}" placeholder="Ex: Anglais, Espagnol, Allemand..." style="width:100%; padding:10px; border-radius:8px; background:var(--bg-card); color:var(--text-main); border:1px solid var(--border-color); box-sizing:border-box;">
                    </div>
                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
                        <div>
                            <label style="display:block; margin-bottom:4px; font-size:12px; color:var(--text-muted);">Niveau actuel</label>
                            <select id="lang-level-input" style="width:100%; padding:10px; border-radius:8px; background:var(--bg-card); color:var(--text-main); border:1px solid var(--border-color); box-sizing:border-box;">
                                <option value="A1" ${existing?.level === 'A1' ? 'selected' : ''}>A1 — Débutant</option>
                                <option value="A2" ${existing?.level === 'A2' ? 'selected' : ''}>A2 — Élémentaire</option>
                                <option value="B1" ${existing?.level === 'B1' ? 'selected' : ''}>B1 — Intermédiaire</option>
                                <option value="B2" ${existing?.level === 'B2' ? 'selected' : ''}>B2 — Avancé / Courant</option>
                                <option value="C1" ${existing?.level === 'C1' ? 'selected' : ''}>C1 — Autonome / Pro</option>
                                <option value="C2" ${existing?.level === 'C2' ? 'selected' : ''}>C2 — Bilingue / Maîtrise</option>
                            </select>
                        </div>
                        <div>
                            <label style="display:block; margin-bottom:4px; font-size:12px; color:var(--text-muted);">Drapeau / Émoji</label>
                            <input type="text" id="lang-icon-input" value="${escapeHtml(existing?.icon || '')}" placeholder="Ex: 🇬🇧, 🇪🇸, 🇩🇪, 🌐" style="width:100%; padding:10px; border-radius:8px; background:var(--bg-card); color:var(--text-main); border:1px solid var(--border-color); box-sizing:border-box;">
                        </div>
                    </div>
                    <div>
                        <label style="display:block; margin-bottom:4px; font-size:12px; color:var(--text-muted);">Objectif d'apprentissage</label>
                        <input type="text" id="lang-goal-input" value="${escapeHtml(existing?.goal || '')}" placeholder="Ex: Réussir le TOEIC 850, stage à l'international..." style="width:100%; padding:10px; border-radius:8px; background:var(--bg-card); color:var(--text-main); border:1px solid var(--border-color); box-sizing:border-box;">
                    </div>
                    <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:10px;">
                        <button type="button" id="btn-cancel-lang" style="background:transparent; color:var(--text-muted); border:1px solid var(--border-color); padding:8px 16px; border-radius:6px; cursor:pointer;">Annuler</button>
                        <button type="submit" style="background:var(--accent-primary); color:white; border:none; padding:8px 20px; border-radius:6px; font-weight:bold; cursor:pointer;">Sauvegarder</button>
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
        if (btnAdd) btnAdd.addEventListener('click', () => openLanguageForm());

        const btnAddFirst = this.container.querySelector('#btn-add-first-lang');
        if (btnAddFirst) btnAddFirst.addEventListener('click', () => openLanguageForm());

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
                <form id="form-resource" style="display:flex; flex-direction:column; gap:12px;">
                    <div>
                        <label style="display:block; margin-bottom:4px; font-size:12px; color:var(--text-muted);">Titre de la ressource</label>
                        <input type="text" id="res-title-input" required value="${escapeHtml(existing?.title || '')}" placeholder="Ex: Altissia FORCE-N, Grammaire anglaise, Duolingo, Chaîne BBC..." style="width:100%; padding:10px; border-radius:8px; background:var(--bg-card); color:var(--text-main); border:1px solid var(--border-color); box-sizing:border-box;">
                    </div>
                    <div>
                        <label style="display:block; margin-bottom:4px; font-size:12px; color:var(--text-muted);">Type de support</label>
                        <select id="res-type-input" style="width:100%; padding:10px; border-radius:8px; background:var(--bg-card); color:var(--text-main); border:1px solid var(--border-color); box-sizing:border-box;">
                            <option value="link" ${existing?.type === 'link' ? 'selected' : ''}>🔗 Lien web / plateforme</option>
                            <option value="book" ${existing?.type === 'book' ? 'selected' : ''}>📖 Livre / Manuel</option>
                            <option value="app" ${existing?.type === 'app' ? 'selected' : ''}>📱 Application mobile</option>
                            <option value="video" ${existing?.type === 'video' ? 'selected' : ''}>🎬 Vidéo / Podcast / Chaîne</option>
                        </select>
                    </div>
                    <div>
                        <label style="display:block; margin-bottom:4px; font-size:12px; color:var(--text-muted);">Lien web ou description</label>
                        <input type="text" id="res-value-input" value="${escapeHtml(existing?.value || existing?.url || '')}" placeholder="https://... ou Chapitre 1-5" style="width:100%; padding:10px; border-radius:8px; background:var(--bg-card); color:var(--text-main); border:1px solid var(--border-color); box-sizing:border-box;">
                    </div>
                    <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:10px;">
                        <button type="button" id="btn-cancel-res" style="background:transparent; color:var(--text-muted); border:1px solid var(--border-color); padding:8px 16px; border-radius:6px; cursor:pointer;">Annuler</button>
                        <button type="submit" style="background:var(--accent-primary); color:white; border:none; padding:8px 20px; border-radius:6px; font-weight:bold; cursor:pointer;">Enregistrer</button>
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
                <form id="form-plan" style="display:flex; flex-direction:column; gap:14px;">
                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
                        <div>
                            <label style="display:block; margin-bottom:4px; font-size:12px; color:var(--text-muted);">Séances par semaine</label>
                            <input type="number" min="1" max="14" id="plan-sessions-input" value="${plan.sessionsPerWeek || 3}" style="width:100%; padding:10px; border-radius:8px; background:var(--bg-card); color:var(--text-main); border:1px solid var(--border-color); box-sizing:border-box;">
                        </div>
                        <div>
                            <label style="display:block; margin-bottom:4px; font-size:12px; color:var(--text-muted);">Durée (minutes / séance)</label>
                            <input type="number" min="10" max="180" step="5" id="plan-duration-input" value="${plan.duration || 30}" style="width:100%; padding:10px; border-radius:8px; background:var(--bg-card); color:var(--text-main); border:1px solid var(--border-color); box-sizing:border-box;">
                        </div>
                    </div>
                    <div>
                        <label style="display:block; margin-bottom:6px; font-size:12px; color:var(--text-muted);">Jours préférés</label>
                        <div style="display:flex; gap:10px; flex-wrap:wrap;">
                            ${[
                                ['monday', 'Lundi'], ['tuesday', 'Mardi'], ['wednesday', 'Mercredi'],
                                ['thursday', 'Jeudi'], ['friday', 'Vendredi'], ['saturday', 'Samedi'], ['sunday', 'Dimanche']
                            ].map(([k, label]) => `
                                <label style="display:inline-flex; align-items:center; gap:5px; font-size:13px; cursor:pointer;">
                                    <input type="checkbox" name="pref_day" value="${k}" ${days.includes(k) ? 'checked' : ''}>
                                    ${label}
                                </label>
                            `).join('')}
                        </div>
                    </div>
                    <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:10px;">
                        <button type="button" id="btn-cancel-plan" style="background:transparent; color:var(--text-muted); border:1px solid var(--border-color); padding:8px 16px; border-radius:6px; cursor:pointer;">Annuler</button>
                        <button type="submit" style="background:var(--accent-primary); color:white; border:none; padding:8px 20px; border-radius:6px; font-weight:bold; cursor:pointer;">Sauvegarder le plan</button>
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
                    alert(`✅ Super ! ${res.count} séances de ${lang.name} ont été générées dans ton planning sur les 4 prochaines semaines.`);
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
                    <form id="form-tracking" style="display:flex; flex-direction:column; gap:12px;">
                        <div>
                            <label style="display:block; margin-bottom:4px; font-size:12px; color:var(--text-muted);">Séances effectuées</label>
                            <input type="number" min="0" id="track-sessions" value="${tracking.sessionsCompleted || 0}" style="width:100%; padding:10px; border-radius:8px; background:var(--bg-card); color:var(--text-main); border:1px solid var(--border-color); box-sizing:border-box;">
                        </div>
                        <div>
                            <label style="display:block; margin-bottom:4px; font-size:12px; color:var(--text-muted);">Minutes totales étudiées</label>
                            <input type="number" min="0" id="track-minutes" value="${tracking.minutesStudied || 0}" style="width:100%; padding:10px; border-radius:8px; background:var(--bg-card); color:var(--text-main); border:1px solid var(--border-color); box-sizing:border-box;">
                        </div>
                        <div>
                            <label style="display:block; margin-bottom:4px; font-size:12px; color:var(--text-muted);">Mots de vocabulaire mémorisés</label>
                            <input type="number" min="0" id="track-vocab" value="${tracking.vocabularyWords || 0}" style="width:100%; padding:10px; border-radius:8px; background:var(--bg-card); color:var(--text-main); border:1px solid var(--border-color); box-sizing:border-box;">
                        </div>
                        <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:10px;">
                            <button type="button" id="btn-cancel-track" style="background:transparent; color:var(--text-muted); border:1px solid var(--border-color); padding:8px 16px; border-radius:6px; cursor:pointer;">Annuler</button>
                            <button type="submit" style="background:var(--accent-primary); color:white; border:none; padding:8px 20px; border-radius:6px; font-weight:bold; cursor:pointer;">Sauvegarder</button>
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
