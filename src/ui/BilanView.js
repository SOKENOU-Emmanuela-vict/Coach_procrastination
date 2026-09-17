export class BilanView {
    constructor(containerId, app) {
        this.container = document.getElementById(containerId);
        this.app = app;
    }
    
    render(data) {
        const { summary, checkIn, stats } = data || {};
        
        const completedTasksCount = (stats && stats.completedTasksCount) ? stats.completedTasksCount : 0;
        const focusTime = (stats && !isNaN(stats.focusTime)) ? stats.focusTime : 0;
        
        const completionRate = summary ? summary.completionRate : 0;
        
        const isReadonly = checkIn !== null && checkIn !== undefined;

        let html = `
            <h2>🏆 Bilan de la Journée</h2>
            <div class="stats" style="text-align: center; background: #0e1e26; border-left: 5px solid #00f2fe; padding: 20px; border-radius: 10px; margin-top: 15px; box-shadow: 0 4px 15px rgba(0,0,0,0.4);">
                <p style="font-size: 14px; color: #88a7b7; margin-top: 0;">Étape 1/2 - Le résumé automatique de tes efforts</p>
                
                <h3 style="color: #00f2fe; margin-bottom: 15px;">Résumé Chiffré</h3>
                <p style="font-size: 16px;">✔ <strong style="color: #fff;">${summary ? summary.completedSessions : completedTasksCount}</strong> sessions terminées</p>
                <div class="timer" style="font-size: 42px; font-weight: bold; color: #4caf50; margin: 15px 0; text-shadow: 0 0 10px rgba(76,175,80,0.3);">${completionRate}% Complétion</div>
                <p style="font-size: 16px;">⏱ Temps d'étude actif : <strong style="color: #fff;">${summary ? summary.totalActualMinutes : focusTime} min</strong></p>
            </div>
        `;

        if (isReadonly) {
            html += `
                <div style="background: #11222c; border: 1px solid #4caf50; padding: 20px; border-radius: 10px; margin-top: 20px; text-align: center;">
                    <h3 style="color: #4caf50;">✅ Check-in déjà validé !</h3>
                    <p style="color: #e0e0e0;">Énergie: ${checkIn.energy}, Sommeil: ${checkIn.sleep.durationMinutes}min</p>
                    <button id="btn-go-journal" style="width: 100%; margin-top: 15px; background: #00f2fe; color: #0f2027; font-weight: bold; border: none; padding: 14px; border-radius: 20px; cursor: pointer; font-size: 15px;">
                        Passer au Journal Libre ➡️
                    </button>
                </div>
            `;
        } else {
            // Formulaire interactif Daily Check-in
            let followupOptions = "";
            if (summary && summary.plannedItems) {
                const missedItems = summary.plannedItems.filter(i => i.status === 'missed' || i.status === 'partial');
                if (missedItems.length > 0) {
                    followupOptions = `<div style="margin-top:15px;">
                        <label style="display:block; color:#00f2fe; font-weight:bold; margin-bottom:8px;">🔄 Sessions à reprendre demain (needsFollowUp) :</label>
                        ${missedItems.map(i => `
                            <label style="display:block; color:#e0e0e0; margin-bottom:5px;">
                                <input type="checkbox" name="needsFollowUp" value="${i.id}"> ${i.title} (${i.status})
                            </label>
                        `).join('')}
                    </div>`;
                }
            }

            html += `
                <div style="background: #11222c; padding: 20px; border-radius: 10px; margin-top: 20px; box-shadow: 0 4px 15px rgba(0,0,0,0.4);">
                    <h3 style="color: #00f2fe; margin-top:0; border-bottom:1px solid #2a5268; padding-bottom:10px;">📊 Mon état du jour</h3>
                    
                    <div style="margin-bottom: 15px;">
                        <label style="display:block; color:#e0e0e0; font-weight:bold; margin-bottom:8px;">⚡ Énergie :</label>
                        <div style="display:flex; gap:10px;">
                            <label><input type="radio" name="energy" value="low"> 🔴 Basse</label>
                            <label><input type="radio" name="energy" value="medium" checked> 🟡 Moyenne</label>
                            <label><input type="radio" name="energy" value="high"> 🟢 Haute</label>
                        </div>
                    </div>

                    <div style="margin-bottom: 15px;">
                        <label style="display:block; color:#e0e0e0; font-weight:bold; margin-bottom:8px;">💤 Sommeil :</label>
                        <div style="display:flex; gap:10px; align-items:center;">
                            <input type="number" id="chk-sleep-duration" placeholder="Heures" style="width:70px; background:#0f2027; color:white; border:1px solid #2a5268; padding:8px; border-radius:5px;" min="0" step="0.5">
                            <select id="chk-sleep-quality" style="background:#0f2027; color:white; border:1px solid #2a5268; padding:8px; border-radius:5px;">
                                <option value="poor">Mauvaise</option>
                                <option value="fair" selected>Moyenne</option>
                                <option value="good">Bonne</option>
                            </select>
                        </div>
                    </div>

                    <div style="margin-bottom: 15px;">
                        <label style="display:block; color:#e0e0e0; font-weight:bold; margin-bottom:8px;">📈 Évaluation de la journée :</label>
                        <select id="chk-assessment" style="width:100%; background:#0f2027; color:white; border:1px solid #2a5268; padding:8px; border-radius:5px;">
                            <option value="completed" selected>✅ Complétée comme prévu</option>
                            <option value="partial">⚠️ Partielle</option>
                            <option value="difficult">🥵 Difficile</option>
                            <option value="blocked">🚫 Bloquée</option>
                        </select>
                    </div>

                    <div style="margin-bottom: 15px;">
                        <label style="display:block; color:#e0e0e0; font-weight:bold; margin-bottom:8px;">🚧 Qu'est-ce qui m'a bloqué ou ralenti ? (Optionnel)</label>
                        <textarea id="chk-blockers" rows="2" style="width:100%; background:#0f2027; color:white; border:1px solid #2a5268; padding:8px; border-radius:5px; box-sizing:border-box;"></textarea>
                    </div>

                    ${followupOptions}

                    <button id="btn-submit-checkin" style="width: 100%; margin-top: 25px; background: #00f2fe; color: #0f2027; font-weight: bold; border: none; padding: 14px; border-radius: 20px; cursor: pointer; font-size: 15px;">
                        💾 Valider le Check-in (Étape 1)
                    </button>
                </div>
            `;
        }

        html += `
            <button id="btn-bilan-back" style="width: 100%; margin-top: 15px; background: transparent; color: #88a7b7; border: 1px solid #2a5268; padding: 10px; border-radius: 20px; cursor: pointer; font-size: 14px;">
                ⬅️ Retour au Plan
            </button>
        `;

        this.container.innerHTML = html;

        const btnSubmit = document.getElementById('btn-submit-checkin');
        if (btnSubmit) {
            btnSubmit.addEventListener('click', () => {
                const energy = document.querySelector('input[name="energy"]:checked').value;
                const sleepHours = parseFloat(document.getElementById('chk-sleep-duration').value) || 0;
                const sleepQuality = document.getElementById('chk-sleep-quality').value;
                const assessment = document.getElementById('chk-assessment').value;
                const blockersTxt = document.getElementById('chk-blockers').value.trim();
                
                const needsFollowUp = [];
                document.querySelectorAll('input[name="needsFollowUp"]:checked').forEach(cb => {
                    needsFollowUp.push(cb.value);
                });

                const payload = {
                    date: summary ? summary.date : new Date().toLocaleDateString('fr-CA'),
                    energy: energy,
                    sleep: {
                        durationMinutes: sleepHours * 60,
                        quality: sleepQuality
                    },
                    dayAssessment: assessment,
                    blockers: blockersTxt ? [blockersTxt] : [],
                    needsFollowUp: needsFollowUp
                };

                this.app.submitCheckIn(payload);
            });
        }

        const btnNext = document.getElementById('btn-go-journal');
        if (btnNext) {
            btnNext.addEventListener('click', () => {
                this.app.renderView('journal');
            });
        }

        const btnBack = document.getElementById('btn-bilan-back');
        if (btnBack) {
            btnBack.addEventListener('click', () => {
                this.app.renderView('planning');
            });
        }
    }
}
