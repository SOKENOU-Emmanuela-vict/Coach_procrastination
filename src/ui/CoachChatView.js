import { PlanningIntent } from '../models/PlanningIntent.js';

export class CoachChatView {
    constructor(containerId, app) {
        this.container = document.getElementById(containerId);
        this.app = app;
    }

    render(messages) {
        messages = messages || [];
        
        let html = `
            <div style="max-width: 600px; margin: 0 auto; display: flex; flex-direction: column; height: 80vh; background: linear-gradient(135deg, #152b36 0%, #0c1921 100%); border: 1px solid #2a5268; border-radius: 12px; overflow: hidden; box-shadow: 0 8px 25px rgba(0,0,0,0.5);">
                
                <!-- Header -->
                <div style="background: rgba(0, 242, 254, 0.1); padding: 15px 20px; border-bottom: 1px solid #2a5268; display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <h2 style="color: #00f2fe; margin: 0; font-size: 20px;">🤖 Coach IA</h2>
                        <div style="font-size: 12px; color: #4caf50;">En ligne</div>
                    </div>
                    <button id="btn-chat-close" style="background: transparent; color: #88a7b7; border: none; cursor: pointer; font-size: 20px;">✖</button>
                </div>

                <!-- Messages -->
                <div id="chat-messages-container" style="flex: 1; padding: 20px; overflow-y: auto; display: flex; flex-direction: column; gap: 15px;">
        `;

        if (messages.length === 0) {
            html += `
                <div style="text-align: center; color: #88a7b7; margin-top: 50px;">
                    <div style="font-size: 40px; margin-bottom: 15px;">💬</div>
                    Bonjour ! Je suis ton Coach. Pose-moi une question ou demande-moi un conseil sur ton emploi du temps.
                </div>
            `;
        } else {
            messages.forEach(msg => {
                const isUser = msg.role === 'user';
                const align = isUser ? 'align-self: flex-end;' : 'align-self: flex-start;';
                const bg = isUser ? 'background: #00f2fe; color: #0f2027;' : 'background: #1e3f52; color: #e0e0e0;';
                const radius = isUser ? 'border-radius: 15px 15px 0 15px;' : 'border-radius: 15px 15px 15px 0;';
                
                html += `
                    <div style="max-width: 80%; ${align} ${bg} ${radius} padding: 12px 16px; font-size: 14px; line-height: 1.4; box-shadow: 0 2px 5px rgba(0,0,0,0.2);">
                        ${msg.content.replace(/\n/g, '<br>')}
                `;

                // If intent exists, show the actionable buttons
                if (!isUser && msg.metadata && msg.metadata.intent) {
                    const intentJson = encodeURIComponent(JSON.stringify(msg.metadata.intent));
                    html += `
                        <div class="intent-actions" style="display: flex; gap: 10px; margin-top: 10px; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 10px;">
                            <button class="btn-accept-intent" data-intent="${intentJson}" style="flex: 1; background: #4caf50; color: white; border: none; padding: 8px 12px; border-radius: 8px; cursor: pointer; font-weight: bold; font-size: 13px;">
                                ✅ Accepter
                            </button>
                            <button class="btn-refuse-intent" style="flex: 1; background: transparent; border: 1px solid #f44336; color: #f44336; padding: 8px 12px; border-radius: 8px; cursor: pointer; font-weight: bold; font-size: 13px;">
                                ❌ Refuser
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
                <div style="padding: 15px; border-top: 1px solid #2a5268; background: #0f2027; display: flex; gap: 10px;">
                    <textarea id="chat-input-text" placeholder="Écris ton message ici..." rows="1" style="flex: 1; background: #162c38; color: white; border: 1px solid #2a5268; padding: 12px; border-radius: 20px; resize: none; font-family: inherit; font-size: 14px;"></textarea>
                    <button id="btn-chat-send" style="background: #00f2fe; color: #0f2027; border: none; width: 45px; height: 45px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 18px;">
                        ➤
                    </button>
                </div>
            </div>
        `;

        this.container.innerHTML = html;

        // Auto-scroll to bottom
        const msgContainer = document.getElementById('chat-messages-container');
        if (msgContainer) {
            msgContainer.scrollTop = msgContainer.scrollHeight;
        }

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
                btnSend.disabled = true;
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

        const btnClose = document.getElementById('btn-chat-close');
        if (btnClose) {
            btnClose.addEventListener('click', () => {
                this.app.renderView('desktop');
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
                        const intent = new PlanningIntent(intentData);
                        await this.app.acceptCoachSuggestion(intent);
                        
                        // Modifier les boutons visuellement
                        const actionsDiv = e.target.closest('.intent-actions');
                        actionsDiv.innerHTML = `<div style="text-align: center; color: #4caf50; font-weight: bold; width: 100%;">✅ Planifié !</div>`;
                        
                    } catch(err) {
                        // Si le PlanningEngine refuse à cause d'un conflit
                        if (err.message && err.message.includes('CONFLICT')) {
                            const actionsDiv = e.target.closest('.intent-actions');
                            actionsDiv.innerHTML = `<div style="text-align: center; color: #f44336; font-size: 13px; width: 100%;">⚠️ Conflit détecté. Demande un autre créneau au Coach.</div>`;
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
                actionsDiv.innerHTML = `<div style="text-align: center; color: #88a7b7; font-size: 13px; width: 100%;">❌ Proposition refusée</div>`;
            });
        });
    }
}
