import { escapeHtml } from '../utils/html.js';
import { PlanningIntent } from '../models/PlanningIntent.js';

export class CoachChatView {
    constructor(containerId, app) {
        this.container = document.getElementById(containerId);
        this.app = app;
    }

    render(messages) {
        if (typeof document !== 'undefined' && document.body) {
            document.body.className = 'theme-cyber';
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
<div class="bureau" style="display:flex; height:100vh; overflow:hidden;">
    <!-- SIDEBAR -->
    <div class="bureau-sidebar" style="width: 250px; background: var(--bg-sidebar); border-right: 1px solid var(--border-color); padding: 20px; display: flex; flex-direction: column;">
        <div style="font-size:24px; font-weight:bold; margin-bottom:40px; display:flex; align-items:center; gap:10px;">
            <div style="width:30px; height:30px; border-radius:8px; background:var(--bg-main); border:1px solid var(--border-color); display:flex; align-items:center; justify-content:center; color:var(--text-main);">
                <span style="font-weight:900;">L</span>
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
            <div class="bureau-nav-item" data-view="languages" style="display:flex; align-items:center; gap:12px; cursor:pointer; padding:12px 15px; color:var(--text-muted); font-weight:500;">
                <i class="bi bi-globe" style="font-size:18px;"></i> Langues
            </div>
            <div class="bureau-nav-item" data-view="life" style="display:flex; align-items:center; gap:12px; cursor:pointer; padding:12px 15px; color:var(--text-muted); font-weight:500;">
                <i class="bi bi-heart" style="font-size:18px;"></i> Vie
            </div>
            <div class="bureau-nav-item active" data-view="chat" style="display:flex; align-items:center; gap:12px; cursor:pointer; background:rgba(14, 165, 233, 0.1); border-left:4px solid var(--accent-primary); border-radius:0 8px 8px 0; padding:12px 15px 12px 11px; color:var(--text-main); font-weight:600;">
                <i class="bi bi-robot" style="font-size:18px; color:var(--accent-primary);"></i> Coach
            </div>
        </div>
    </div>

    <!-- MAIN CONTENT -->
    <div class="bureau-content" style="flex: 1; padding: 30px; display:flex; flex-direction:column; background: var(--bg-main);">
        <!-- TOPBAR -->
        <div class="bureau-topbar" style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 30px; flex-shrink:0;">
            <div>
                <h1 style="font-size: 24px; font-weight: 700; color:var(--text-main); letter-spacing:1px; margin:0;">Ton Coach Personnel</h1>
                <p style="color: var(--text-muted); font-size:14px; margin:5px 0 0 0;">Il est temps de faire le point.</p>
            </div>
            <div class="bureau-topbar-actions" style="display:flex; gap:15px; align-items:center;">
                <button type="button" id="btn-coach-api-key" class="btn btn-sm ${maskedApiKey ? 'btn-secondary' : 'btn-primary'}">
                    <i class="bi ${maskedApiKey ? 'bi-key-fill' : 'bi-key'}"></i>
                    ${maskedApiKey ? `Clé IA active (${escapeHtml(maskedApiKey)})` : 'Configurer ma clé IA'}
                </button>
                <div class="bureau-profile-avatar" style="width:40px; height:40px; border-radius:12px; background:var(--accent-primary); display:flex; align-items:center; justify-content:center; font-weight:bold; color:#000; font-size:18px;">
                    É
                </div>
            </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 350px; gap: 30px; flex:1; min-height:0;">
            
            <!-- CHAT INTERFACE (Left) -->
            <div style="display:flex; flex-direction:column; background: var(--bg-card); border-radius: 12px; border: 1px solid var(--border-color); overflow: hidden;">
                <!-- Header Chat -->
                <div style="padding:20px; border-bottom:1px solid var(--border-color); display:flex; align-items:center; gap:15px;">
                    <div style="width:40px; height:40px; border-radius:50%; background:rgba(14,165,233,0.1); display:flex; align-items:center; justify-content:center; color:var(--accent-primary); font-size:20px;">
                        🤖
                    </div>
                    <div>
                        <strong style="display:block; font-size:16px;">Chat avec ton coach</strong>
                        <span style="font-size:12px; color:var(--text-muted); display:flex; align-items:center; gap:5px;"><span style="display:inline-block; width:8px; height:8px; background:#10b981; border-radius:50%;"></span> Toujours là pour t'aider</span>
                    </div>
                </div>

                <!-- Messages -->
                <div id="chat-messages-container" style="flex:1; padding:20px; overflow-y:auto; display:flex; flex-direction:column; gap:20px;">
        `;

        if (messages.length === 0) {
            html += `
                    <div style="text-align: center; color: var(--text-muted); margin-top: 50px;">
                        <div style="font-size: 40px; margin-bottom: 15px;">👋</div>
                        Bonjour ! Je suis ton Coach. Comment s'est passée ta journée ?
                    </div>
            `;
        } else {
            messages.forEach(msg => {
                const isUser = msg.role === 'user';
                const align = isUser ? 'align-self: flex-end;' : 'align-self: flex-start;';
                const bg = isUser ? 'background: var(--accent-primary); color: #000;' : 'background: rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); color: var(--text-main);';
                const radius = isUser ? 'border-radius: 15px 15px 0 15px;' : 'border-radius: 15px 15px 15px 0;';
                
                html += `
                    <div style="max-width: 80%; ${align} ${bg} ${radius} padding: 15px 20px; font-size: 14px; line-height: 1.5; box-shadow: 0 4px 15px rgba(0,0,0,0.1);">
                        ${escapeHtml(msg.content).replace(/\n/g, '<br>')}
                `;

                if (!isUser && msg.metadata && msg.metadata.intent) {
                    const intentJson = encodeURIComponent(JSON.stringify(msg.metadata.intent));
                    const isCheckIn = msg.metadata.intent.action === 'save_checkin';
                    const acceptLabel = isCheckIn ? '✅ Enregistrer le Bilan' : '✅ Accepter';
                    html += `
                        <div class="intent-actions" style="display: flex; gap: 10px; margin-top: 15px; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 15px;">
                            <button class="btn-accept-intent" data-intent="${intentJson}" style="flex: 1; background: #10b981; color: white; border: none; padding: 10px; border-radius: 8px; cursor: pointer; font-weight: bold; font-size: 13px; transition:0.2s;">
                                ${acceptLabel}
                            </button>
                            <button class="btn-refuse-intent" style="flex: 1; background: transparent; border: 1px solid rgba(255,255,255,0.2); color: var(--text-muted); padding: 10px; border-radius: 8px; cursor: pointer; font-weight: bold; font-size: 13px; transition:0.2s;">
                                ❌ Ignorer
                            </button>
                        </div>
                    `;
                }

                if (!isUser && msg.metadata && (msg.metadata.pendingCheckInStep || msg.metadata.proactive === 'checkin' || msg.metadata.proactive === 'checkin_reminder')) {
                    html += `
                        <div class="checkin-actions" style="display: flex; gap: 8px; margin-top: 10px;">
                            <button type="button" class="btn-checkin-snooze" style="background: rgba(255,255,255,0.08); color: var(--text-muted); border: 1px solid rgba(255,255,255,0.2); padding: 5px 12px; border-radius: 15px; cursor: pointer; font-size: 12px; font-weight: 500;">
                                ⏳ Plus tard
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
                <div style="padding:20px; border-top:1px solid var(--border-color); background:rgba(0,0,0,0.2); display:flex; gap:15px; align-items:center;">
                    <button style="background:transparent; border:none; color:var(--text-muted); font-size:20px; cursor:pointer;"><i class="bi bi-paperclip"></i></button>
                    <textarea id="chat-input-text" placeholder="Écris ton message ici..." rows="1" style="flex:1; background:rgba(255,255,255,0.05); color:white; border:1px solid var(--border-color); padding:15px 20px; border-radius:25px; resize:none; font-family:inherit; font-size:14px; outline:none;"></textarea>
                    <button id="btn-chat-send" style="background:var(--accent-primary); color:#000; border:none; width:50px; height:50px; border-radius:50%; cursor:pointer; display:flex; align-items:center; justify-content:center; font-size:20px; transition:0.2s;">
                        <i class="bi bi-send-fill"></i>
                    </button>
                </div>
            </div>

            <!-- CONTEXTE & OBJECTIFS (Right) -->
            <div style="display:flex; flex-direction:column; gap:20px; overflow-y:auto; padding-right:10px;">
                
                <!-- Contexte Actuel -->
                <div class="bureau-card" style="background: var(--bg-card); border-radius: 12px; border: 1px solid var(--border-color); padding:20px;">
                    <div style="font-size:12px; font-weight:bold; color:var(--text-muted); text-transform:uppercase; letter-spacing:1px; margin-bottom:15px;">Contexte Actuel</div>
                    <strong style="display:block; font-size:16px; margin-bottom:15px;">Ta journée (${escapeHtml(todayLabel)})</strong>
                    
                    <div style="display:flex; flex-direction:column; gap:12px; font-size:14px;">
                        <div style="display:flex; align-items:center; gap:10px;">
                            <i class="bi bi-check2-circle" style="color:#10b981; font-size:18px;"></i>
                            <span><strong>${exec.completed || 0}/${plannedCount}</strong> sessions complétées</span>
                        </div>
                        <div style="display:flex; align-items:center; gap:10px;">
                            <i class="bi bi-battery-charging" style="color:#3b82f6; font-size:18px;"></i>
                            <span>Énergie : <strong>${escapeHtml(energyLabel)}</strong></span>
                        </div>
                        <div style="display:flex; align-items:center; gap:10px;">
                            <i class="bi bi-exclamation-triangle" style="color:#f59e0b; font-size:18px;"></i>
                            <span>${upcomingWeek} CC à venir cette semaine</span>
                        </div>
                    </div>
                </div>

                <!-- Tes Objectifs -->
                <div class="bureau-card" style="background: var(--bg-card); border-radius: 12px; border: 1px solid var(--border-color); padding:20px;">
                    <div style="font-size:12px; font-weight:bold; color:var(--text-muted); text-transform:uppercase; letter-spacing:1px; margin-bottom:15px;">Tes Objectifs</div>
                    
                    <div style="display:flex; flex-direction:column; gap:15px;">
                        ${(st.academicSubjects && st.academicSubjects.length > 0) 
                            ? st.academicSubjects.slice(0, 3).map(sub => `
                                <div>
                                    <div style="display:flex; justify-content:space-between; font-size:14px; margin-bottom:8px;">
                                        <strong>${escapeHtml(sub.name.substring(0, 20))}${sub.name.length > 20 ? '...' : ''}</strong>
                                        <span>${sub.cect} CECT</span>
                                    </div>
                                    <div style="height:6px; background:rgba(255,255,255,0.1); border-radius:3px;">
                                        <div style="height:100%; width:100%; background:var(--accent-primary); border-radius:3px;"></div>
                                    </div>
                                </div>
                            `).join('')
                            : `
                                <div style="font-size:13px; color:var(--text-muted);">Aucun objectif défini</div>
                            `
                        }
                    </div>
                </div>

                <!-- Suggestions -->
                <div class="bureau-card" style="background: rgba(14,165,233,0.05); border-radius: 12px; border: 1px solid rgba(14,165,233,0.2); padding:20px;">
                    <div style="font-size:12px; font-weight:bold; color:var(--accent-primary); text-transform:uppercase; letter-spacing:1px; margin-bottom:15px;">Aujourd'hui, tu pourrais aussi...</div>
                    <div style="display:flex; flex-direction:column; gap:10px; font-size:14px;">
                        <div style="display:flex; align-items:center; gap:10px; background:rgba(0,0,0,0.2); padding:10px 15px; border-radius:8px; cursor:pointer;">
                            <i class="bi bi-laptop" style="color:var(--accent-primary);"></i>
                            ${suggestions[0] ? escapeHtml(suggestions[0].message || suggestions[0].title) : "Avancer ton projet d'informatique"}
                        </div>
                        <div style="display:flex; align-items:center; gap:10px; background:rgba(0,0,0,0.2); padding:10px 15px; border-radius:8px; cursor:pointer;">
                            <i class="bi bi-activity" style="color:#10b981;"></i>
                            ${suggestions[1] ? escapeHtml(suggestions[1].message || suggestions[1].title) : 'Faire une séance de sport (30min)'}
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
                Colle ta clé Google (Google AI Studio <code>AIzaSy…</code> ou Vertex AI Express <code>AQ.…</code>).
                Tu peux aussi la coller directement dans le fichier <code>api_key.txt</code> à la racine du projet.
            </p>
            ${maskedApiKey ? `<div class="badge badge-success"><i class="bi bi-check-circle-fill"></i> Clé enregistrée (${escapeHtml(maskedApiKey)})</div>` : ''}
            <div>
                <label class="form-label" for="coach-api-key-input">Clé API Google</label>
                <input type="password" id="coach-api-key-input" class="form-input" placeholder="Colle ici ta clé Google (ex. AIzaSy... ou AQ....)" autocomplete="off" spellcheck="false">
            </div>
            <div id="coach-api-key-warning" class="alert alert-warning" hidden></div>
        </div>
        <div class="modal-actions">
            ${maskedApiKey ? `<button type="button" id="btn-coach-key-clear" class="btn btn-danger btn-sm modal-actions-left">Supprimer la clé</button>` : ''}
            <button type="button" id="btn-coach-key-cancel" class="btn btn-ghost">Annuler</button>
            <button type="button" id="btn-coach-key-save" class="btn btn-primary">Enregistrer</button>
        </div>
    </div>
</div>
        `;

        this.container.innerHTML = html;

        // Auto-scroll to bottom
        const msgContainer = document.getElementById('chat-messages-container');
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
    }

    attachEvents() {
        const btnSend = document.getElementById('btn-chat-send');
        const inputField = document.getElementById('chat-input-text');

        const sendMessage = () => {
            const text = inputField.value.trim();
            if (text) {
                // Disable input during request
                inputField.disabled = true;
                if(btnSend) btnSend.disabled = true;
                this.app.sendChatMessage(text);
            }
        };

        if (btnSend) {
            btnSend.addEventListener('click', sendMessage);
        }


        if (inputField) {
            inputField.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                }
            });
            
            // Auto-resize textarea logic
            inputField.addEventListener('input', function() {
                this.style.height = 'auto';
                this.style.height = (this.scrollHeight < 100 ? this.scrollHeight : 100) + 'px';
            });
        }

        // Delegation for Accept Intent buttons
        const acceptButtons = this.container.querySelectorAll('.btn-accept-intent');
        acceptButtons.forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const intentStr = e.target.getAttribute('data-intent');
                if (intentStr) {
                    try {
                        const intentData = JSON.parse(decodeURIComponent(intentStr));
                        const isCheckIn = intentData.action === 'save_checkin';
                        
                        // Ne pas utiliser PlanningIntent pour les checkins
                        const intentToPass = isCheckIn ? intentData : new PlanningIntent(intentData);
                        
                        await this.app.acceptCoachSuggestion(intentToPass);
                        
                        // Modifier les boutons visuellement
                        const actionsDiv = e.target.closest('.intent-actions');
                        const confirmMsg = isCheckIn ? '✅ Bilan enregistré !' : '✅ Planifié !';
                        actionsDiv.innerHTML = `<div style="text-align: center; color: #10b981; font-weight: bold; width: 100%;">${confirmMsg}</div>`;
                        
                    } catch(err) {
                        // Si le PlanningEngine refuse à cause d'un conflit (acceptCoachSuggestion lève désormais l'erreur)
                        if (err.message && err.message.includes('CONFLICT')) {
                            const actionsDiv = e.target.closest('.intent-actions');
                            actionsDiv.innerHTML = `<div style="text-align: center; color: #ef4444; font-size: 13px; width: 100%;">⚠️ Conflit détecté. Demande un autre créneau au Coach.</div>`;
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
                const actionsDiv = e.target.closest('.intent-actions');
                actionsDiv.innerHTML = `<div style="text-align: center; color: var(--text-muted); font-size: 13px; width: 100%;">❌ Proposition ignorée</div>`;
            });
        });

        // Delegation for Check-in Snooze ("Plus tard") buttons
        const snoozeButtons = this.container.querySelectorAll('.btn-checkin-snooze');
        snoozeButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                if (this.app && typeof this.app.sendChatMessage === 'function') {
                    this.app.sendChatMessage('plus tard');
                }
            });
        });
        const btnOpenKey = this.container.querySelector('#btn-coach-api-key');
        const keyModal = this.container.querySelector('#coach-api-key-modal');
        const keyInput = this.container.querySelector('#coach-api-key-input');
        const keyWarning = this.container.querySelector('#coach-api-key-warning');
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
        };

        if (btnOpenKey && keyModal) {
            btnOpenKey.addEventListener('click', () => {
                keyModal.hidden = false;
                if (keyWarning) {
                    keyWarning.hidden = true;
                    keyWarning.textContent = '';
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

        if (btnSaveKey) btnSaveKey.addEventListener('click', saveApiKey);
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
