import { escapeHtml } from '../utils/html.js';
import { Motion } from './motion.js';

export class BilanView {
    constructor(containerId, app) {
        this.container = typeof containerId === 'string' && typeof document !== 'undefined' ? document.getElementById(containerId) : (containerId || (typeof document !== 'undefined' ? document.getElementById('view-container') : null));
        this.app = app;
    }
    
    render(data) {
        if (typeof document !== 'undefined' && document.body) {
            document.body.className = 'theme-light';
            if (typeof document.body.setAttribute === 'function') {
                document.body.setAttribute('data-univers', 'coach');
            }
        }

        const { summary, checkIn, stats } = data || {};
        
        const completedTasksCount = (stats && stats.completedTasksCount) ? stats.completedTasksCount : 0;
        const focusTime = (stats && !isNaN(stats.focusTime)) ? stats.focusTime : 0;
        
        // Structure de CheckInEngine.buildDailySummary : { execution, planned, actual, ... }
        const execution = (summary && summary.execution) || {};
        const completionRate = execution.completionRate || 0;
        const completedSessions = summary ? (execution.completed || 0) : completedTasksCount;
        const actualMinutes = summary ? ((summary.actual && summary.actual.minutes) || 0) : focusTime;
        const plannedItems = (summary && summary.planned && summary.planned.items) || [];
        
        const isReadonly = checkIn !== null && checkIn !== undefined;

        const emptyDayNotice = (completedSessions === 0 && actualMinutes === 0 && plannedItems.length === 0)
            ? `<p class="bilan-empty-notice">Aucune session enregistrée pour cette journée.</p>`
            : '';

        let html = `
<div class="bilan-view-container">
    <div class="bilan-wrapper">
        <h2 class="bilan-header-title"><i class="bi bi-trophy"></i> Bilan de la Journée</h2>
        <div class="bilan-stats-card stats">
            <p class="bilan-step-label">Étape 1/2 — Le résumé automatique de tes efforts</p>
            
            <h3 class="bilan-card-title">Résumé Chiffré</h3>
            <p class="bilan-stat-row"><i class="bi bi-check-circle-fill coach-icon-success"></i> <strong>${completedSessions}</strong> sessions terminées</p>
            <div class="bilan-completion-rate timer">
                <span class="bilan-rate-val">${completionRate}%</span>
                <span class="bilan-rate-label">Complétion</span>
            </div>
            <p class="bilan-stat-row"><i class="bi bi-stopwatch coach-icon-info"></i> Temps d'étude actif : <strong>${actualMinutes} min</strong></p>
            ${emptyDayNotice}
        </div>
        `;

        if (isReadonly) {
            const sleepDisplay = (checkIn.sleep && checkIn.sleep.durationMinutes)
                ? `${Math.round((checkIn.sleep.durationMinutes / 60) * 10) / 10}h`
                : 'Non renseigné';
            html += `
        <div class="bilan-success-card">
            <h3 class="bilan-success-title"><i class="bi bi-check2-circle"></i> Check-in déjà validé !</h3>
            <p class="bilan-success-details">Énergie: ${escapeHtml(checkIn.energy || 'Non renseignée')}, Sommeil: ${sleepDisplay}</p>
        </div>
            `;
        } else {
            // Formulaire interactif Daily Check-in
            let followupOptions = "";
            if (plannedItems.length > 0) {
                const missedItems = plannedItems.filter(i => i.status === 'missed' || i.status === 'partial');
                if (missedItems.length > 0) {
                    followupOptions = `<div class="bilan-followup-box">
                        <label class="bilan-followup-label"><i class="bi bi-arrow-repeat"></i> Sessions à reprendre demain (needsFollowUp) :</label>
                        ${missedItems.map(i => `
                            <label class="bilan-followup-item">
                                <input type="checkbox" name="needsFollowUp" value="${escapeHtml(i.id)}"> ${escapeHtml(i.title)} (${escapeHtml(i.status)})
                            </label>
                        `).join('')}
                    </div>`;
                }
            }

            html += `
        <div class="bilan-form-card">
            <h3 class="bilan-form-title"><i class="bi bi-bar-chart"></i> Mon état du jour</h3>
            
            <div class="bilan-form-group">
                <label class="bilan-form-label"><i class="bi bi-lightning-charge"></i> Énergie :</label>
                <div class="bilan-radio-group">
                    <label class="bilan-radio-label"><input type="radio" name="energy" value="low"> <span class="badge badge-low">Basse</span></label>
                    <label class="bilan-radio-label"><input type="radio" name="energy" value="medium" checked> <span class="badge badge-medium">Moyenne</span></label>
                    <label class="bilan-radio-label"><input type="radio" name="energy" value="high"> <span class="badge badge-high">Haute</span></label>
                </div>
            </div>

            <div class="bilan-form-group">
                <label class="bilan-form-label"><i class="bi bi-moon-stars"></i> Sommeil :</label>
                <div class="bilan-sleep-inputs">
                    <input type="number" id="chk-sleep-duration" class="form-input bilan-input-sleep" placeholder="Heures" min="0" step="0.5">
                    <select id="chk-sleep-quality" class="form-select bilan-select-sleep">
                        <option value="poor">Mauvaise</option>
                        <option value="fair" selected>Moyenne</option>
                        <option value="good">Bonne</option>
                    </select>
                </div>
            </div>

            <div class="bilan-form-group">
                <label class="bilan-form-label"><i class="bi bi-graph-up-arrow"></i> Évaluation de la journée :</label>
                <select id="chk-assessment" class="form-select bilan-select-full">
                    <option value="completed" selected>Complétée comme prévu</option>
                    <option value="partial">Partielle</option>
                    <option value="difficult">Difficile</option>
                    <option value="blocked">Bloquée</option>
                </select>
            </div>

            <div class="bilan-form-group">
                <label class="bilan-form-label"><i class="bi bi-cone-striped"></i> Qu'est-ce qui m'a bloqué ou ralenti ? (Optionnel)</label>
                <textarea id="chk-blockers" class="form-textarea bilan-textarea-full" rows="2"></textarea>
            </div>

            ${followupOptions}

            <button id="btn-submit-checkin" class="btn btn-primary bilan-btn-submit" type="button">
                <i class="bi bi-check2"></i> Valider le Check-in (Étape 1)
            </button>
        </div>
            `;
        }

        html += `
        <button id="btn-bilan-back" class="btn btn-ghost bilan-btn-back" type="button">
            <i class="bi bi-arrow-left"></i> Retour au Plan
        </button>
    </div>
</div>
        `;

        this.container.innerHTML = html;

        const btnSubmit = document.getElementById('btn-submit-checkin');
        if (btnSubmit && typeof btnSubmit.addEventListener === 'function') {
            btnSubmit.addEventListener('click', () => {
                Motion.buttonTap(btnSubmit);
                const energyRadio = document.querySelector('input[name="energy"]:checked');
                const energy = energyRadio ? energyRadio.value : 'medium';
                const sleepHours = parseFloat(document.getElementById('chk-sleep-duration').value) || 0;
                const sleepQuality = document.getElementById('chk-sleep-quality').value;
                const assessment = document.getElementById('chk-assessment').value;
                const blockersTxt = document.getElementById('chk-blockers').value.trim();
                
                const needsFollowUp = [];
                document.querySelectorAll('input[name="needsFollowUp"]:checked').forEach(cb => {
                    needsFollowUp.push(cb.value);
                });

                const payload = {
                    date: summary ? summary.date : this.app.getPedagogicalDate(),
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

        const btnBack = document.getElementById('btn-bilan-back');
        if (btnBack && typeof btnBack.addEventListener === 'function') {
            btnBack.addEventListener('click', () => {
                Motion.buttonTap(btnBack);
                this.app.renderView('planning');
            });
        }

        if (typeof document !== 'undefined') {
            Motion.fadeIn('.bilan-wrapper', { duration: 0.25 });
            Motion.staggerIn('.bilan-stats-card, .bilan-form-card, .bilan-success-card', { duration: 0.22, stagger: 0.05 });
        }
    }
}
