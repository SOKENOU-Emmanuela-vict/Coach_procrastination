import { escapeHtml } from '../utils/html.js';
import { PlanningIntent } from '../models/PlanningIntent.js';
import { Motion } from './motion.js';

export class CoachChatView {
    constructor(containerId, app) {
        this.container = typeof containerId === 'string' && typeof document !== 'undefined' ? document.getElementById(containerId) : (containerId || (typeof document !== 'undefined' ? document.getElementById('view-container') : null));
        this.app = app;
    }

    render(messages) {
        if (typeof document !== 'undefined' && document.body) {
            document.body.className = 'theme-light';
            if (typeof document.body.setAttribute === 'function') {
                document.body.setAttribute('data-univers', 'coach');
            }
        }
        messages = Array.isArray(messages) ? messages : (messages && Array.isArray(messages.messages) ? messages.messages : []);
        this._lastMessages = messages;
        const maskedApiKey = (this.app && typeof this.app.getMaskedGeminiApiKey === 'function')
            ? this.app.getMaskedGeminiApiKey()
            : null;

        // Contexte réel lu dans l'état de l'App (mêmes libellés que la maquette)
        const st = (this.app && this.app.state) || {};
        const exec = (st.dailySummary && st.dailySummary.execution) || {};
        const plannedCount = (st.dailySummary && st.dailySummary.planned)
            ? (st.dailySummary.planned.totalSessions || 0)
            : ((st.dailyPlan && st.dailyPlan.sessions) ? st.dailyPlan.sessions.length : 0);
        const energyLabels = { low: 'Basse', medium: 'Moyenne', high: 'Haute' };
        const energyLabel = (st.todayCheckIn && st.todayCheckIn.energy)
            ? (energyLabels[st.todayCheckIn.energy] || String(st.todayCheckIn.energy))
            : '—';
        const upcomingWeek = ((st.academicSummary && st.academicSummary.upcomingAssessments) || [])
            .filter(a => typeof a.daysRemaining === 'number' && a.daysRemaining >= 0 && a.daysRemaining <= 7).length;
        const todayLabel = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
        const suggestions = (Array.isArray(st.coachInsights) ? st.coachInsights : [])
            .filter(i => i && i.title !== 'Créneau de disponibilité')
            .slice(0, 2);
        
        let html = `
<div class="bureau coach-layout">
    <!-- SIDEBAR -->
    <div class="bureau-sidebar coach-sidebar">
        <div class="bureau-brand coach-brand">
            <div class="bureau-brand-icon coach-brand-icon">
                <i class="bi bi-robot"></i>
            </div>
            Learning OS
        </div>
        
        <!-- ONGLETS -->
        <div class="bureau-nav coach-nav">
            <div class="bureau-nav-item" data-view="desktop">
                <i class="bi bi-house-door"></i> Bureau
            </div>
            <div class="bureau-nav-item" data-view="planning">
                <i class="bi bi-calendar3"></i> Planning
            </div>
            <div class="bureau-nav-item" data-view="academic">
                <i class="bi bi-mortarboard"></i> École
            </div>
            <div class="bureau-nav-item" data-view="languages">
                <i class="bi bi-globe"></i> Langues
            </div>
            <div class="bureau-nav-item" data-view="life">
                <i class="bi bi-heart"></i> Vie
            </div>
            <div class="bureau-nav-item active" data-view="chat">
                <i class="bi bi-robot"></i> Coach
            </div>
        </div>
    </div>

    <!-- MAIN CONTENT -->
    <div class="bureau-content coach-content">
        <!-- TOPBAR -->
        <div class="bureau-topbar coach-topbar">
            <div>
                <h1 class="coach-header-title">Ton Coach Personnel</h1>
                <p class="coach-header-subtitle">Il est temps de faire le point.</p>
            </div>
            <div class="coach-topbar-actions">
                <button type="button" id="btn-coach-api-key" class="btn btn-sm ${maskedApiKey ? 'btn-secondary' : 'btn-primary'}">
                    <i class="bi ${maskedApiKey ? 'bi-key-fill' : 'bi-key'}"></i>
                    ${maskedApiKey ? `Clé IA active (${escapeHtml(maskedApiKey)})` : 'Configurer ma clé IA'}
                </button>
                <div id="btn-profile" class="coach-avatar-topbar bureau-profile-btn" role="button" tabindex="0" title="Mon profil">
                    ${st.userProfile?.avatarPhoto ? `<img src="${escapeHtml(st.userProfile.avatarPhoto)}" class="coach-avatar-img" alt="Avatar">` : escapeHtml((st.userProfile?.name || 'É').charAt(0).toUpperCase())}
                </div>
            </div>
        </div>

        <div class="coach-grid">
            
            <!-- CHAT INTERFACE (Left) -->
            <div class="coach-chat-card">
                <!-- Header Chat -->
                <div class="coach-chat-header">
                    <div class="coach-avatar">
                        <i class="bi bi-robot"></i>
                    </div>
                    <div class="coach-chat-header-info">
                        <strong>Chat avec ton coach</strong>
                        <span class="coach-status-badge">
                            <span class="coach-status-dot"></span> Toujours là pour t'aider
                        </span>
                    </div>
                </div>

                <!-- Messages -->
                <div id="chat-messages-container" class="coach-messages-container">
        `;

        if (messages.length === 0) {
            html += `
                    <div class="coach-empty-state">
                        <div class="coach-empty-icon">
                            <i class="bi bi-chat-dots"></i>
                        </div>
                        <div class="coach-empty-title">Bonjour ! Je suis ton Coach.</div>
                        <p class="coach-empty-subtitle">Comment s'est passée ta journée ? Pose-moi une question ou demande un conseil.</p>
                    </div>
            `;
        } else {
            messages.forEach(msg => {
                const isUser = msg.role === 'user';
                const roleClass = isUser ? 'coach-message-user' : 'coach-message-assistant';
                
                html += `
                    <div class="coach-message ${roleClass}">
                        <div class="coach-message-content">
                            ${escapeHtml(msg.content).replace(/\n/g, '<br>')}
                        </div>
                `;

                if (!isUser && msg.metadata && msg.metadata.intent) {
                    const intentJson = encodeURIComponent(JSON.stringify(msg.metadata.intent));
                    const isCheckIn = msg.metadata.intent.action === 'save_checkin';
                    const acceptLabel = isCheckIn ? 'Enregistrer le Bilan' : 'Accepter';
                    html += `
                        <div class="coach-intent-actions intent-actions">
                            <button type="button" class="btn-accept-intent" data-intent="${intentJson}">
                                <i class="bi bi-check2"></i> ${acceptLabel}
                            </button>
                            <button type="button" class="btn-refuse-intent">
                                <i class="bi bi-x"></i> Ignorer
                            </button>
                        </div>
                    `;
                }

                if (!isUser && msg.metadata && (msg.metadata.pendingCheckInStep || msg.metadata.proactive === 'checkin' || msg.metadata.proactive === 'checkin_reminder')) {
                    html += `
                        <div class="coach-checkin-actions checkin-actions">
                            <button type="button" class="btn-checkin-snooze">
                                <i class="bi bi-clock-history"></i> Plus tard
                            </button>
                        </div>
                    `;
                }

                html += `
                    </div>
                `;
            });
        }

        html += `
                </div>

                <!-- Input Area -->
                <div class="coach-input-area">
                    <button type="button" class="coach-btn-attach" title="Joindre un fichier" aria-label="Joindre un fichier">
                        <i class="bi bi-paperclip"></i>
                    </button>
                    <textarea id="chat-input-text" class="coach-input-textarea" placeholder="Écris ton message ici..." rows="1"></textarea>
                    <button type="button" id="btn-chat-send" class="coach-btn-send" aria-label="Envoyer">
                        <i class="bi bi-send-fill"></i>
                    </button>
                </div>
            </div>

            <!-- CONTEXTE & OBJECTIFS (Right) -->
            <div class="coach-sidebar-col">
                
                <!-- Contexte Actuel -->
                <div class="coach-panel-card">
                    <div class="coach-panel-title">Contexte Actuel</div>
                    <strong class="coach-context-heading">Ta journée (${escapeHtml(todayLabel)})</strong>
                    
                    <div class="coach-context-list">
                        <div class="coach-context-item">
                            <i class="bi bi-check2-circle coach-icon-success"></i>
                            <span><strong>${exec.completed || 0}/${plannedCount}</strong> sessions complétées</span>
                        </div>
                        <div class="coach-context-item">
                            <i class="bi bi-battery-charging coach-icon-info"></i>
                            <span>Énergie : <strong>${escapeHtml(energyLabel)}</strong></span>
                        </div>
                        <div class="coach-context-item">
                            <i class="bi bi-exclamation-triangle coach-icon-warning"></i>
                            <span>${upcomingWeek} CC à venir cette semaine</span>
                        </div>
                    </div>
                </div>

                <!-- Tes Objectifs -->
                <div class="coach-panel-card">
                    <div class="coach-panel-title">Tes Objectifs</div>
                    
                    <div class="coach-goals-list">
                        ${(st.academicSubjects && st.academicSubjects.length > 0) 
                            ? st.academicSubjects.slice(0, 3).map(sub => `
                                <div class="coach-goal-item">
                                    <div class="coach-goal-header">
                                        <strong>${escapeHtml(sub.name.substring(0, 20))}${sub.name.length > 20 ? '...' : ''}</strong>
                                        <span>${sub.cect} CECT</span>
                                    </div>
                                    <div class="coach-goal-track">
                                        <div class="coach-goal-bar"></div>
                                    </div>
                                </div>
                            `).join('')
                            : `
                                <div class="coach-empty-goals">Aucun objectif défini</div>
                            `
                        }
                    </div>
                </div>

                <!-- Suggestions -->
                <div class="coach-panel-card coach-panel-card-accent">
                    <div class="coach-panel-title coach-panel-title-accent">Aujourd'hui, tu pourrais aussi...</div>
                    <div class="coach-suggestions-list">
                        <div class="coach-suggestion-chip">
                            <i class="bi bi-laptop coach-icon-accent"></i>
                            <span>${suggestions[0] ? escapeHtml(suggestions[0].message || suggestions[0].title) : "Avancer ton projet d'informatique"}</span>
                        </div>
                        <div class="coach-suggestion-chip">
                            <i class="bi bi-activity coach-icon-success"></i>
                            <span>${suggestions[1] ? escapeHtml(suggestions[1].message || suggestions[1].title) : 'Faire une séance de sport (30min)'}</span>
                        </div>
                    </div>
                </div>

            </div>

        </div>
    </div>
</div>

<div id="coach-api-key-modal" class="modal-backdrop" hidden>
    <div class="modal-box" role="dialog" aria-modal="true" aria-labelledby="coach-api-key-modal-title">
        <div class="modal-header">
            <h3 id="coach-api-key-modal-title" class="modal-title">Clé IA du Coach</h3>
            <button type="button" id="btn-coach-key-close" class="btn btn-ghost btn-sm" aria-label="Fermer">✕</button>
        </div>
        <div class="modal-body">
            <p class="modal-hint">
                Colle ta clé Google AI Studio (<code>AQ.…</code> ou <code>AIza…</code>).
                Tu peux aussi la coller directement dans le fichier <code>api_key.txt</code> à la racine du projet.
            </p>
            ${maskedApiKey ? `<div class="badge badge-success"><i class="bi bi-check-circle-fill"></i> Clé enregistrée (${escapeHtml(maskedApiKey)})</div>` : ''}
            <div>
                <label class="form-label" for="coach-api-key-input">Clé API Google</label>
                <input type="password" id="coach-api-key-input" class="form-input" placeholder="commence par AQ. ou AIza" autocomplete="off" spellcheck="false">
            </div>
            <div id="coach-api-key-warning" class="alert alert-warning" hidden></div>
            <div id="coach-api-key-status" class="alert" hidden></div>
        </div>
        <div class="modal-actions">
            <button type="button" id="btn-coach-key-test" class="btn btn-outline btn-sm">Tester ma clé</button>
            ${maskedApiKey ? `<button type="button" id="btn-coach-key-clear" class="btn btn-danger btn-sm modal-actions-left">Supprimer la clé</button>` : ''}
            <button type="button" id="btn-coach-key-cancel" class="btn btn-ghost">Annuler</button>
            <button type="button" id="btn-coach-key-save" class="btn btn-primary">Enregistrer</button>
        </div>
    </div>
</div>
        `;

        this.container.innerHTML = html;

        // Auto-scroll to bottom
        const msgContainer = typeof document !== 'undefined' ? document.getElementById('chat-messages-container') : null;
        if (msgContainer) {
            msgContainer.scrollTop = msgContainer.scrollHeight;
        }

        // BINDINGS SIDEBAR
        this.container.querySelectorAll('.bureau-nav-item').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const viewName = e.currentTarget.getAttribute('data-view');
                if (viewName) {
                    this.app.renderView(viewName);
                }
            });
        });

        this.attachEvents();

        // Animations d'entrée GSAP
        if (typeof document !== 'undefined') {
            Motion.fadeIn('.coach-chat-card', { duration: 0.25 });
            Motion.staggerIn('.coach-panel-card', { duration: 0.25, stagger: 0.05 });
        }
    }

    attachEvents() {
        const btnSend = document.getElementById('btn-chat-send');
        const inputField = document.getElementById('chat-input-text');

        const sendMessage = () => {
            const text = inputField.value.trim();
            if (text) {
                // Disable input during request
                inputField.disabled = true;
                if (btnSend) btnSend.disabled = true;
                Motion.buttonTap(btnSend);
                this.app.sendChatMessage(text);
            }
        };

        if (btnSend && typeof btnSend.addEventListener === 'function') {
            btnSend.addEventListener('click', sendMessage);
        }

        if (inputField && typeof inputField.addEventListener === 'function') {
            inputField.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                }
            });
            
            // Auto-resize textarea logic
            inputField.addEventListener('input', function() {
                this.style.height = 'auto';
                this.style.height = (this.scrollHeight < 120 ? this.scrollHeight : 120) + 'px';
            });
        }

        // Delegation for Accept Intent buttons
        const acceptButtons = this.container.querySelectorAll('.btn-accept-intent');
        acceptButtons.forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const targetBtn = e.target.closest('.btn-accept-intent') || e.target;
                const intentStr = targetBtn.getAttribute('data-intent');
                if (intentStr) {
                    Motion.buttonTap(targetBtn);
                    try {
                        const intentData = JSON.parse(decodeURIComponent(intentStr));
                        const isCheckIn = intentData.action === 'save_checkin';
                        
                        // Ne pas utiliser PlanningIntent pour les checkins
                        const intentToPass = isCheckIn ? intentData : new PlanningIntent(intentData);
                        
                        await this.app.acceptCoachSuggestion(intentToPass);
                        
                        // Modifier les boutons visuellement
                        const actionsDiv = targetBtn.closest('.coach-intent-actions') || targetBtn.closest('.intent-actions');
                        const confirmMsg = isCheckIn ? 'Bilan enregistré !' : 'Planifié !';
                        if (actionsDiv) {
                            actionsDiv.innerHTML = `<div class="intent-feedback intent-feedback-success"><i class="bi bi-check2-circle"></i> ${confirmMsg}</div>`;
                        }
                    } catch(err) {
                        // Si le PlanningEngine refuse à cause d'un conflit (acceptCoachSuggestion lève désormais l'erreur)
                        const actionsDiv = targetBtn.closest('.coach-intent-actions') || targetBtn.closest('.intent-actions');
                        if (err.message && err.message.includes('CONFLICT')) {
                            if (actionsDiv) {
                                actionsDiv.innerHTML = `<div class="intent-feedback intent-feedback-error"><i class="bi bi-exclamation-triangle"></i> Conflit détecté. Demande un autre créneau au Coach.</div>`;
                            }
                        } else {
                            alert("Erreur lors de la planification : " + err.message);
                        }
                    }
                }
            });
        });

        // Delegation for Refuse Intent buttons
        const refuseButtons = this.container.querySelectorAll('.btn-refuse-intent');
        refuseButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const targetBtn = e.target.closest('.btn-refuse-intent') || e.target;
                Motion.buttonTap(targetBtn);
                const actionsDiv = targetBtn.closest('.coach-intent-actions') || targetBtn.closest('.intent-actions');
                if (actionsDiv) {
                    actionsDiv.innerHTML = `<div class="intent-feedback intent-feedback-refused"><i class="bi bi-x-circle"></i> Proposition ignorée</div>`;
                }
            });
        });

        // Delegation for Check-in Snooze ("Plus tard") buttons
        const snoozeButtons = this.container.querySelectorAll('.btn-checkin-snooze');
        snoozeButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const targetBtn = e.target.closest('.btn-checkin-snooze') || e.target;
                Motion.buttonTap(targetBtn);
                if (this.app && typeof this.app.sendChatMessage === 'function') {
                    this.app.sendChatMessage('plus tard');
                }
            });
        });

        const btnOpenKey = this.container.querySelector('#btn-coach-api-key');
        const keyModal = this.container.querySelector('#coach-api-key-modal');
        const keyInput = this.container.querySelector('#coach-api-key-input');
        const keyWarning = this.container.querySelector('#coach-api-key-warning');
        const keyStatus = this.container.querySelector('#coach-api-key-status');
        const btnTestKey = this.container.querySelector('#btn-coach-key-test');
        const btnCloseKey = this.container.querySelector('#btn-coach-key-close');
        const btnCancelKey = this.container.querySelector('#btn-coach-key-cancel');
        const btnSaveKey = this.container.querySelector('#btn-coach-key-save');
        const btnClearKey = this.container.querySelector('#btn-coach-key-clear');

        const closeKeyModal = () => {
            if (!keyModal) return;
            keyModal.hidden = true;
            if (keyInput) keyInput.value = '';
            if (keyWarning) {
                keyWarning.hidden = true;
                keyWarning.textContent = '';
            }
            if (keyStatus) {
                keyStatus.hidden = true;
                keyStatus.textContent = '';
            }
        };

        if (btnOpenKey && keyModal) {
            btnOpenKey.addEventListener('click', () => {
                keyModal.hidden = false;
                Motion.modalOpen(keyModal);
                if (keyWarning) {
                    keyWarning.hidden = true;
                    keyWarning.textContent = '';
                }
                if (keyStatus) {
                keyStatus.hidden = true;
                keyStatus.textContent = '';
            }
                if (keyInput && typeof keyInput.focus === 'function') keyInput.focus();
            });
        }
        if (btnCloseKey) btnCloseKey.addEventListener('click', closeKeyModal);
        if (btnCancelKey) btnCancelKey.addEventListener('click', closeKeyModal);
        if (keyModal) {
            keyModal.addEventListener('click', (e) => {
                if (e.target === keyModal) closeKeyModal();
            });
        }

        const saveApiKey = () => {
            if (!keyInput) return;
            const val = String(keyInput.value || '').trim();
            if (!val) {
                if (keyWarning) {
                    keyWarning.textContent = "Colle ta clé API avant d'enregistrer.";
                    keyWarning.hidden = false;
                }
                return;
            }
            if (/^sk-/i.test(val)) {
                if (keyWarning) {
                    keyWarning.textContent = "Cette clé commence par « sk- » (clé OpenAI/ChatGPT). Colle plutôt ta clé Google (AI Studio ou Vertex AI « AQ.… »).";
                    keyWarning.hidden = false;
                }
                return;
            }
            if (this.app && typeof this.app.setGeminiApiKey === 'function') {
                this.app.setGeminiApiKey(val);
            } else if (typeof window !== 'undefined' && window.localStorage) {
                window.localStorage.setItem('gemini_api_key', val);
            }
            keyInput.value = '';
            this.render(this._lastMessages || []);
        };


        if (btnTestKey) {
            btnTestKey.addEventListener('click', async () => {
                Motion.buttonTap(btnTestKey);
                if (keyWarning) { keyWarning.hidden = true; keyWarning.textContent = ''; }
                if (!keyStatus) return;

                const candidate = keyInput ? keyInput.value.trim() : '';
                keyStatus.hidden = false;
                keyStatus.className = 'alert alert-info';
                keyStatus.innerHTML = '<i class="bi bi-arrow-repeat"></i> Test de la clé en cours...';
                btnTestKey.disabled = true;

                try {
                    let result;
                    if (this.app && typeof this.app.testGeminiApiKey === 'function') {
                        result = await this.app.testGeminiApiKey(candidate || undefined);
                    } else {
                        const { GeminiProvider } = await import('../ai/GeminiProvider.js');
                        const activeKey = candidate || (typeof window !== 'undefined' && window.localStorage ? window.localStorage.getItem('gemini_api_key') : '');
                        const p = new GeminiProvider(activeKey);
                        result = await p.testKey();
                    }

                    if (result && result.ok) {
                        keyStatus.className = 'alert alert-success';
                        keyStatus.innerHTML = '<i class="bi bi-check-circle-fill"></i> ' + escapeHtml(result.message);
                    } else {
                        keyStatus.className = 'alert alert-danger';
                        keyStatus.innerHTML = '<i class="bi bi-exclamation-triangle-fill"></i> ' + escapeHtml((result && result.message) || 'Erreur lors du test de la clé.');
                    }
                } catch (e) {
                    keyStatus.className = 'alert alert-danger';
                    keyStatus.innerHTML = '<i class="bi bi-exclamation-triangle-fill"></i> Erreur : ' + escapeHtml(e.message || 'Échec du test');
                } finally {
                    btnTestKey.disabled = false;
                }
            });
        }

        if (btnSaveKey) {
            btnSaveKey.addEventListener('click', () => {
                Motion.buttonTap(btnSaveKey);
                saveApiKey();
            });
        }
        if (keyInput) {
            keyInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    saveApiKey();
                } else if (e.key === 'Escape') {
                    closeKeyModal();
                }
            });
        }
        if (btnClearKey) {
            btnClearKey.addEventListener('click', () => {
                Motion.buttonTap(btnClearKey);
                if (this.app && typeof this.app.setGeminiApiKey === 'function') {
                    this.app.setGeminiApiKey('');
                } else if (typeof window !== 'undefined' && window.localStorage) {
                    window.localStorage.removeItem('gemini_api_key');
                }
                this.render(this._lastMessages || []);
            });
        }
    }
}
