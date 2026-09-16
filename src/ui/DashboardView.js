export class DashboardView {
    constructor(containerId, app) {
        this.container = document.getElementById(containerId);
        this.app = app;
    }
    
    render(state) {
        const completedHabits = state.dailyPlan && state.dailyPlan.habits ? state.dailyPlan.habits.filter(h => h.completed).length : 0;
        const totalHabits = state.dailyPlan && state.dailyPlan.habits ? state.dailyPlan.habits.length : 0;
        
        let insightsHtml = "";
        if (state.coachInsights && state.coachInsights.length > 0) {
            insightsHtml += `<div class="stats" style="border-left: 5px solid #00f2fe; background: #0e1e26; margin-bottom: 20px;">
                <h3 style="color:#00f2fe; margin-bottom:12px; display:flex; justify-content:space-between; align-items:center;">
                    <span>🤖 RECOMMANDATIONS DU COACH</span>
                    <span style="font-size:12px; background:#00f2fe; color:#0f2027; padding:2px 8px; border-radius:12px;">${state.coachInsights.length}</span>
                </h3>`;
            state.coachInsights.forEach(insight => {
                let icon = '💡';
                let color = '#88a7b7';
                
                if (insight.type === 'CRITICAL') { icon = '🚨'; color = '#f44336'; }
                else if (insight.type === 'WARNING') { icon = '⚠️'; color = '#ff9800'; }
                else if (insight.type === 'SUCCESS') { icon = '✅'; color = '#4caf50'; }
                else if (insight.type === 'SUGGESTION') { icon = '✨'; color = '#00f2fe'; }
                else if (insight.type === 'INFO') { icon = 'ℹ️'; color = '#a8d8ea'; }

                insightsHtml += `
                    <div style="background:#0b1a20; border-left:4px solid ${color}; padding:12px; border-radius:6px; margin-bottom:10px;">
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                            <span style="font-size:14px; font-weight:bold; color:#fff;">${icon} ${insight.title || 'Recommandation'}</span>
                        </div>
                        <div style="font-size:13px; color:#e0e0e0; margin-top:6px;">${insight.message || insight.text}</div>
                        ${insight.actionable ? `
                            <div style="margin-top:10px; display:flex; gap:10px;">
                                <button data-action="accept-coach-event" data-intent='${insight.intent ? JSON.stringify(insight.intent) : "null"}' style="background:${color}; color:#0f2027; font-weight:bold; padding:8px 12px; border:none; border-radius:4px; cursor:pointer; font-size:12px;">
                                    Accepter la proposition
                                </button>
                                <button data-action="refuse-coach-event" style="background:transparent; color:${color}; border:1px solid ${color}; font-weight:bold; padding:8px 12px; border-radius:4px; cursor:pointer; font-size:12px;">
                                    Refuser
                                </button>
                            </div>
                            <div class="action-feedback" style="margin-top:8px; font-size:12px; font-weight:bold; display:none;"></div>
                        ` : ''}
                    </div>
                `;
            });
            insightsHtml += `</div>`;
        }
        
        let skillsHtml = "";
        let activeSkills = 0;
        let forgottenSkills = 0;
        
        if (state.learningGraph) {
            state.learningGraph.forEach(node => {
                if (node.level > 0) {
                    activeSkills++;
                    skillsHtml += `
                    <div style="margin-bottom: 10px;">
                        <span style="display:inline-block; width:140px;">${node.title}</span>
                        <span style="display:inline-block; width:80px; background:#0f2027; border-radius:3px;">
                            <span style="display:inline-block; width:${node.level}%; background:#00f2fe; height:10px; border-radius:3px;"></span>
                        </span>
                        <span style="margin-left:10px; font-weight:bold;">${node.level}%</span>
                    </div>`;
                } else {
                    forgottenSkills++;
                }
            });
        }

        let healthHtml = `
            <p>Habitudes : <strong>${completedHabits} / ${totalHabits}</strong></p>
            <p>Compétences actives : <strong>${activeSkills}</strong></p>
            <p>Compétences oubliées : <strong>${forgottenSkills}</strong></p>
            <p>Streak : <strong>${state.userProfile ? state.userProfile.streak || 0 : 0} jours</strong></p>
        `;

        let missionsHtml = "";
        let theme = "Semaine en cours";
        let objective = "";
        
        if (state.fullProgram && state.fullProgram.length > 0) {
            const currentWeekIndex = (state.dailyPlan && state.dailyPlan.weekIndex !== undefined) ? state.dailyPlan.weekIndex : 0;
            const currentWeek = state.fullProgram[currentWeekIndex] || state.fullProgram[state.fullProgram.length - 1];
            if (currentWeek) {
                theme = currentWeek.theme || theme;
                objective = currentWeek.objective || "";
                if (currentWeek.missions && currentWeek.missions.length > 0) {
                    currentWeek.missions.forEach(m => {
                        missionsHtml += `<p style="margin:5px 0; font-size:13px;"><input type="checkbox" style="margin-right:8px;"> ${m}</p>`;
                    });
                }
            }
        }
        if (!missionsHtml) missionsHtml = "<p style='color:#88a7b7;'>Aucune mission définie cette semaine.</p>";

        let todayJournalHtml = "";
        if (state.currentJournal) {
            const moodEmojis = ["", "😭", "😟", "😐", "🙂", "🤩"];
            const energyEmojis = ["", "🔋 (Vide)", "🔋 (Faible)", "🔋 (Moyenne)", "🔋 (Bonne)", "🔋 (Pleine)"];
            todayJournalHtml = `
                <hr style="border: 0; border-top: 1px solid #2a5268; margin: 10px 0;">
                <p>Humeur : ${moodEmojis[state.currentJournal.mood] || 'Non renseigné'}</p>
                <p>Énergie : ${energyEmojis[state.currentJournal.energy] || 'Non renseigné'}</p>
            `;
        }

        const sessions = state.dailyPlan && state.dailyPlan.sessions ? state.dailyPlan.sessions : [];

        this.container.innerHTML = `
            <h2>🏠 Poste de Pilotage</h2>
            
            <div class="stats" style="border-left: 5px solid #00f2fe; background: #0e1e26; margin-bottom: 20px; padding: 15px; border-radius: 6px;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <h3 style="color:#00f2fe; margin:0;">📋 Programme du Jour</h3>
                        <p style="font-size:12px; color:#88a7b7; margin:5px 0 0 0;">${sessions.length} séances assignées aujourd'hui.</p>
                    </div>
                    <button id="btn-dash-plan-top" style="background:#00f2fe; color:#0f2027; font-weight:bold; padding:10px 15px; border:none; border-radius:6px; cursor:pointer;">
                        Ouvrir le Planning détaillé
                    </button>
                </div>
            </div>
            
            <div class="stats" style="border-left: 5px solid #ff9800;">
                <h3>🎯 Mission de la Semaine : ${theme}</h3>
                <p style="font-style:italic; font-size:14px; margin-bottom:10px; color:#88a7b7;">${objective}</p>
                ${missionsHtml}
            </div>
                ${insightsHtml}

            <div style="margin-top: 25px; text-align: center;">
                <button id="btn-open-weekly" style="background: linear-gradient(90deg, #4caf50, #8bc34a); color: #0f2027; border: none; padding: 12px 20px; border-radius: 20px; font-weight: bold; cursor: pointer; box-shadow: 0 4px 15px rgba(76,175,80,0.4); width: 100%; margin-bottom: 15px;">
                    📊 Voir ma Weekly Review
                </button>
                <button id="btn-open-agent" style="background: linear-gradient(90deg, #ff9800, #ff5722); color: white; border: none; padding: 12px 20px; border-radius: 20px; font-weight: bold; cursor: pointer; box-shadow: 0 4px 15px rgba(255,152,0,0.4); width: 100%;">
                    🤖 Créer un nouveau Bootcamp via IA
                </button>
            </div>
        `;
        
        const btnWeekly = document.getElementById('btn-open-weekly');
        if (btnWeekly) btnWeekly.addEventListener('click', () => this.app.renderView('weekly'));
        
        const btnPlan = document.getElementById('btn-dash-plan');
        if (btnPlan) btnPlan.addEventListener('click', () => this.app.renderView('planning'));
        const btnPlanTop = document.getElementById('btn-dash-plan-top');
        if (btnPlanTop) btnPlanTop.addEventListener('click', () => this.app.renderView('planning'));
        
        const btnAgent = document.getElementById('btn-open-agent');
        if (btnAgent) {
            btnAgent.addEventListener('click', () => {
                if (confirm("Générer un nouveau Bootcamp écrasera votre programme actuel (mais pas votre historique). Continuer ?")) {
                    this.app.renderView('agent');
                }
            });
        }
        
        const acceptBtns = this.container.querySelectorAll('[data-action="accept-coach-event"]');
        acceptBtns.forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const btnElement = e.target;
                const feedbackEl = btnElement.closest('div').nextElementSibling;
                const containerEl = btnElement.closest('div').parentElement;
                
                // Double-click protection
                if (btnElement.disabled) return;
                btnElement.disabled = true;
                btnElement.textContent = "Planification en cours...";
                feedbackEl.style.display = "none";
                
                const intentRaw = btnElement.dataset.intent;
                if (!intentRaw || intentRaw === "undefined" || intentRaw === "null") {
                    feedbackEl.textContent = "❌ Impossible : aucune donnée de planification valide.";
                    feedbackEl.style.color = "#f44336";
                    feedbackEl.style.display = "block";
                    btnElement.disabled = false;
                    btnElement.textContent = "Accepter la proposition";
                    return;
                }

                const intentData = JSON.parse(intentRaw);
                if (this.app.acceptCoachSuggestion) {
                    try {
                        await this.app.acceptCoachSuggestion(intentData);
                        feedbackEl.textContent = "✅ Planification réussie !";
                        feedbackEl.style.color = "#4caf50";
                        feedbackEl.style.display = "block";
                        // Success -> remove the suggestion from the UI after a short delay
                        setTimeout(() => {
                            containerEl.remove();
                            if (this.app.renderView) this.app.renderView('dashboard');
                        }, 1500);
                    } catch (error) {
                        feedbackEl.textContent = "❌ Erreur : " + error.message;
                        feedbackEl.style.color = "#f44336";
                        feedbackEl.style.display = "block";
                        
                        // Re-enable button on error
                        btnElement.disabled = false;
                        btnElement.textContent = "Accepter la proposition";
                    }
                }
            });
        });

        const refuseBtns = this.container.querySelectorAll('[data-action="refuse-coach-event"]');
        refuseBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const containerEl = e.target.closest('div').parentElement;
                containerEl.remove();
            });
        });
    }
}
