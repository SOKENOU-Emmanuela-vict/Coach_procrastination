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

        const isReadonly = Boolean(checkIn) && !this.isEditing;

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

        <!-- PROGRAMME INTENSIF 18 NOV - 25 DEC 2026 -->
        <div class="bilan-program-card" style="margin-top:1.25rem; padding:1.25rem; background:var(--bg-surface, #ffffff); border-radius:12px; border:1px solid var(--border-color, #e5e7eb); box-shadow:0 2px 8px rgba(0,0,0,0.04);">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:0.75rem;">
                <div>
                    <span class="badge badge-primary" style="font-size:0.75rem; text-transform:uppercase; letter-spacing:0.5px;">Programme Intensif 18 Nov – 25 Déc 2026</span>
                    <h3 style="font-size:1.05rem; font-weight:700; margin:0.25rem 0 0 0; color:var(--text-primary);"><i class="bi bi-lightning-charge-fill" style="color:var(--accent-primary, #6366f1);"></i> Progression Globale (111h • 3h/jour)</h3>
                </div>
                <div style="text-align:right;">
                    <span style="font-size:0.85rem; font-weight:600; color:var(--text-secondary);">37 jours • Objectif 25 déc</span>
                </div>
            </div>
            
            <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap:0.75rem; margin-top:0.75rem;">
                <div style="background:var(--bg-surface-alt, #f8f9fa); padding:0.6rem 0.8rem; border-radius:8px; border-left:3px solid #3b82f6;">
                    <div style="font-size:0.75rem; color:var(--text-secondary); text-transform:uppercase; font-weight:600;">1. Formations (50m/j)</div>
                    <strong style="font-size:0.85rem; color:var(--text-primary);">IoT, ML & Deep Learning</strong>
                </div>
                <div style="background:var(--bg-surface-alt, #f8f9fa); padding:0.6rem 0.8rem; border-radius:8px; border-left:3px solid #10b981;">
                    <div style="font-size:0.75rem; color:var(--text-secondary); text-transform:uppercase; font-weight:600;">2. Grand Projet (45m/j)</div>
                    <strong style="font-size:0.85rem; color:var(--text-primary);">6 Modules • Contexte Bénin</strong>
                </div>
                <div style="background:var(--bg-surface-alt, #f8f9fa); padding:0.6rem 0.8rem; border-radius:8px; border-left:3px solid #f59e0b;">
                    <div style="font-size:0.75rem; color:var(--text-secondary); text-transform:uppercase; font-weight:600;">3. Anglais (45m/j)</div>
                    <strong style="font-size:0.85rem; color:var(--text-primary);">A1 → A2 (Routine 4 Piliers)</strong>
                </div>
                <div style="background:var(--bg-surface-alt, #f8f9fa); padding:0.6rem 0.8rem; border-radius:8px; border-left:3px solid #8b5cf6;">
                    <div style="font-size:0.75rem; color:var(--text-secondary); text-transform:uppercase; font-weight:600;">4. Lectures (25m/j)</div>
                    <strong style="font-size:0.85rem; color:var(--text-primary);">6 Livres de Fond</strong>
                </div>
                <div style="background:var(--bg-surface-alt, #f8f9fa); padding:0.6rem 0.8rem; border-radius:8px; border-left:3px solid #ec4899;">
                    <div style="font-size:0.75rem; color:var(--text-secondary); text-transform:uppercase; font-weight:600;">5. Deux Pas (15m/j)</div>
                    <strong style="font-size:0.85rem; color:var(--text-primary);">1 Perso + 1 Pro quotidien</strong>
                </div>
            </div>
        </div>
        `;

        if (isReadonly) {
            const sleepDisplay = (checkIn.sleep && checkIn.sleep.durationMinutes)
                ? `${Math.round((checkIn.sleep.durationMinutes / 60) * 10) / 10}h`
                : 'Non renseigné';
            html += `
        <div class="bilan-success-card">
            <h3 class="bilan-success-title"><i class="bi bi-check2-circle"></i> Bilan du jour validé</h3>
            <p class="bilan-success-details">Énergie : <strong>${escapeHtml(checkIn.energy || 'Moyenne')}</strong> | Sommeil : <strong>${sleepDisplay}</strong> | Évaluation : <strong>${escapeHtml(checkIn.dayAssessment || 'Complétée')}</strong></p>
            ${checkIn.blockers && checkIn.blockers.length > 0 ? `<p class="bilan-success-blockers"><em>Blocages :</em> ${escapeHtml(checkIn.blockers.join(', '))}</p>` : ''}
            
            ${(checkIn.personalStep || checkIn.professionalStep) ? `
            <div class="bilan-steps-display-card" style="margin-top:1rem; padding:1rem; background:var(--bg-surface-alt, #f8f9fa); border-radius:8px; border:1px solid var(--border-color, #e5e7eb);">
                <h4 style="font-size:0.95rem; font-weight:700; margin-bottom:0.75rem; color:var(--text-primary);"><i class="bi bi-compass"></i> Mes Deux Pas du Jour</h4>
                
                ${checkIn.personalStep ? `
                <div class="bilan-step-row" style="margin-bottom:0.5rem;">
                    <span class="badge ${checkIn.personalStep.status === 'completed' ? 'badge-success' : (checkIn.personalStep.status === 'partial' ? 'badge-warning' : 'badge-secondary')}">
                        ${checkIn.personalStep.status === 'completed' ? '✓ Réalisé' : (checkIn.personalStep.status === 'partial' ? 'Partiel' : 'À faire')}
                    </span>
                    <div style="display:inline-block; margin-left:0.5rem;">
                        <strong>Pas Personnel :</strong> ${escapeHtml(checkIn.personalStep.action || 'Non défini')}
                        ${checkIn.personalStep.expectedResult ? `<div style="font-size:0.85rem; color:var(--text-secondary);"><em>Attendu :</em> ${escapeHtml(checkIn.personalStep.expectedResult)}</div>` : ''}
                        ${checkIn.personalStep.reflection ? `<div style="font-size:0.85rem; color:var(--text-secondary);"><em>Réflexion :</em> ${escapeHtml(checkIn.personalStep.reflection)}</div>` : ''}
                    </div>
                </div>
                ` : ''}

                ${checkIn.professionalStep ? `
                <div class="bilan-step-row" style="margin-top:0.5rem;">
                    <span class="badge ${checkIn.professionalStep.status === 'completed' ? 'badge-success' : (checkIn.professionalStep.status === 'partial' ? 'badge-warning' : 'badge-secondary')}">
                        ${checkIn.professionalStep.status === 'completed' ? '✓ Réalisé' : (checkIn.professionalStep.status === 'partial' ? 'Partiel' : 'À faire')}
                    </span>
                    <div style="display:inline-block; margin-left:0.5rem;">
                        <strong>Pas Professionnel :</strong> ${escapeHtml(checkIn.professionalStep.action || 'Non défini')}
                        ${checkIn.professionalStep.expectedResult ? `<div style="font-size:0.85rem; color:var(--text-secondary);"><em>Attendu :</em> ${escapeHtml(checkIn.professionalStep.expectedResult)}</div>` : ''}
                        ${checkIn.professionalStep.reflection ? `<div style="font-size:0.85rem; color:var(--text-secondary);"><em>Réflexion :</em> ${escapeHtml(checkIn.professionalStep.reflection)}</div>` : ''}
                    </div>
                </div>
                ` : ''}
            </div>
            ` : ''}

            <div class="bilan-actions-row">
                <button type="button" id="btn-edit-checkin" class="btn btn-secondary btn-sm"><i class="bi bi-pencil"></i> Modifier le bilan</button>
                <button type="button" id="btn-delete-checkin" class="btn btn-secondary btn-sm text-danger"><i class="bi bi-trash"></i> Supprimer le bilan</button>
            </div>
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

            const curEnergy = checkIn?.energy || 'medium';
            const curSleepHours = (checkIn?.sleep?.durationMinutes) ? (Math.round((checkIn.sleep.durationMinutes / 60) * 10) / 10) : '';
            const curSleepQuality = checkIn?.sleep?.quality || 'fair';
            const curAssessment = checkIn?.dayAssessment || 'completed';
            const curBlockers = Array.isArray(checkIn?.blockers) ? checkIn.blockers.join('\n') : (checkIn?.blockers || '');

            const curPersonalAction = checkIn?.personalStep?.action || '';
            const curPersonalExpected = checkIn?.personalStep?.expectedResult || '';
            const curPersonalStatus = checkIn?.personalStep?.status || 'pending';
            const curPersonalReflection = checkIn?.personalStep?.reflection || '';

            const curProAction = checkIn?.professionalStep?.action || '';
            const curProExpected = checkIn?.professionalStep?.expectedResult || '';
            const curProStatus = checkIn?.professionalStep?.status || 'pending';
            const curProReflection = checkIn?.professionalStep?.reflection || '';

            html += `
        <div class="bilan-form-card">
            <h3 class="bilan-form-title"><i class="bi bi-bar-chart"></i> ${checkIn ? 'Modifier mon bilan du jour' : 'Mon état du jour'}</h3>
            
            <div class="bilan-form-group">
                <label class="bilan-form-label"><i class="bi bi-lightning-charge"></i> Énergie :</label>
                <div class="bilan-radio-group">
                    <label class="bilan-radio-label"><input type="radio" name="energy" value="low" ${curEnergy === 'low' ? 'checked' : ''}> <span class="badge badge-low">Basse</span></label>
                    <label class="bilan-radio-label"><input type="radio" name="energy" value="medium" ${curEnergy === 'medium' ? 'checked' : ''}> <span class="badge badge-medium">Moyenne</span></label>
                    <label class="bilan-radio-label"><input type="radio" name="energy" value="high" ${curEnergy === 'high' ? 'checked' : ''}> <span class="badge badge-high">Haute</span></label>
                </div>
            </div>

            <div class="bilan-form-group">
                <label class="bilan-form-label"><i class="bi bi-moon-stars"></i> Sommeil :</label>
                <div class="bilan-sleep-inputs">
                    <input type="number" id="chk-sleep-duration" class="form-input bilan-input-sleep" placeholder="Heures" min="0" step="0.5" value="${curSleepHours}">
                    <select id="chk-sleep-quality" class="form-select bilan-select-sleep">
                        <option value="poor" ${curSleepQuality === 'poor' ? 'selected' : ''}>Mauvaise</option>
                        <option value="fair" ${curSleepQuality === 'fair' ? 'selected' : ''}>Moyenne</option>
                        <option value="good" ${curSleepQuality === 'good' ? 'selected' : ''}>Bonne</option>
                    </select>
                </div>
            </div>

            <div class="bilan-form-group">
                <label class="bilan-form-label"><i class="bi bi-graph-up-arrow"></i> Évaluation de la journée :</label>
                <select id="chk-assessment" class="form-select bilan-select-full">
                    <option value="completed" ${curAssessment === 'completed' ? 'selected' : ''}>Complétée comme prévu</option>
                    <option value="partial" ${curAssessment === 'partial' ? 'selected' : ''}>Partielle</option>
                    <option value="difficult" ${curAssessment === 'difficult' ? 'selected' : ''}>Difficile</option>
                    <option value="blocked" ${curAssessment === 'blocked' ? 'selected' : ''}>Bloquée</option>
                </select>
            </div>

            <div class="bilan-form-group">
                <label class="bilan-form-label"><i class="bi bi-cone-striped"></i> Qu'est-ce qui m'a bloqué ou ralenti ? (Optionnel)</label>
                <textarea id="chk-blockers" class="form-textarea bilan-textarea-full" rows="2">${escapeHtml(curBlockers)}</textarea>
            </div>

            <!-- DEUX PAS DU JOUR (AXE E - PROGRAMME INTENSIF) -->
            <div class="bilan-form-section mt-4 pt-3" style="border-top:1px solid var(--border-color, #e5e7eb);">
                <h4 style="font-size:1rem; font-weight:700; margin-bottom:0.25rem; color:var(--text-primary);"><i class="bi bi-compass"></i> Mes Deux Pas du Jour (Programme Intensif)</h4>
                <p style="font-size:0.85rem; color:var(--text-secondary); margin-bottom:1rem;">
                    Deux actions concrètes, mesurables et vérifiables intégrées à ta journée.
                </p>

                <!-- 1. Pas personnel -->
                <div style="background:var(--bg-surface-alt, #f9fafb); border-radius:8px; border:1px solid var(--border-color, #e5e7eb); padding:0.85rem; margin-bottom:0.85rem;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem;">
                        <strong style="font-size:0.9rem;"><i class="bi bi-person-heart"></i> 1. Pas Personnel</strong>
                        <select id="chk-personal-status" class="form-select form-select-sm" style="width:auto; padding:0.2rem 0.5rem; font-size:0.8rem;">
                            <option value="pending" ${curPersonalStatus === 'pending' ? 'selected' : ''}>À faire</option>
                            <option value="completed" ${curPersonalStatus === 'completed' ? 'selected' : ''}>Réalisé</option>
                            <option value="partial" ${curPersonalStatus === 'partial' ? 'selected' : ''}>Partiel</option>
                            <option value="missed" ${curPersonalStatus === 'missed' ? 'selected' : ''}>Reporté</option>
                        </select>
                    </div>
                    <input type="text" id="chk-personal-action" class="form-input form-input-sm mb-2" placeholder="Action concrète (ex: Engager une conversation avec une personne peu connue...)" value="${escapeHtml(curPersonalAction)}">
                    <input type="text" id="chk-personal-expected" class="form-input form-input-sm mb-2" placeholder="Résultat attendu mesurable (ex: Échanger 5 min positivement)" value="${escapeHtml(curPersonalExpected)}">
                    <textarea id="chk-personal-reflection" class="form-textarea form-textarea-sm" rows="1" placeholder="Courte réflexion sur ce que j'ai appris ou ressenti...">${escapeHtml(curPersonalReflection)}</textarea>
                </div>

                <!-- 2. Pas professionnel -->
                <div style="background:var(--bg-surface-alt, #f9fafb); border-radius:8px; border:1px solid var(--border-color, #e5e7eb); padding:0.85rem; margin-bottom:0.85rem;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem;">
                        <strong style="font-size:0.9rem;"><i class="bi bi-briefcase"></i> 2. Pas Professionnel</strong>
                        <select id="chk-pro-status" class="form-select form-select-sm" style="width:auto; padding:0.2rem 0.5rem; font-size:0.8rem;">
                            <option value="pending" ${curProStatus === 'pending' ? 'selected' : ''}>À faire</option>
                            <option value="completed" ${curProStatus === 'completed' ? 'selected' : ''}>Réalisé</option>
                            <option value="partial" ${curProStatus === 'partial' ? 'selected' : ''}>Partiel</option>
                            <option value="missed" ${curProStatus === 'missed' ? 'selected' : ''}>Reporté</option>
                        </select>
                    </div>
                    <input type="text" id="chk-pro-action" class="form-input form-input-sm mb-2" placeholder="Action concrète (ex: Développer le module 1 IoT, publier un commit, tester PyTorch...)" value="${escapeHtml(curProAction)}">
                    <input type="text" id="chk-pro-expected" class="form-input form-input-sm mb-2" placeholder="Résultat attendu mesurable (ex: Code testé et versionné sur GitHub)" value="${escapeHtml(curProExpected)}">
                    <textarea id="chk-pro-reflection" class="form-textarea form-textarea-sm" rows="1" placeholder="Courte réflexion sur le résultat technique obtenu...">${escapeHtml(curProReflection)}</textarea>
                </div>
            </div>

            ${followupOptions}

            <div class="d-flex gap-2">
                <button id="btn-submit-checkin" class="btn btn-primary bilan-btn-submit flex-1" type="button">
                    <i class="bi bi-check2"></i> ${checkIn ? 'Enregistrer les modifications' : 'Valider le Check-in (Étape 1)'}
                </button>
                ${this.isEditing ? `
                <button id="btn-cancel-edit-checkin" class="btn btn-secondary" type="button">
                    Annuler
                </button>
                ` : ''}
            </div>
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

        const btnEditCheckin = document.getElementById('btn-edit-checkin');
        if (btnEditCheckin && typeof btnEditCheckin.addEventListener === 'function') {
            btnEditCheckin.addEventListener('click', () => {
                Motion.buttonTap(btnEditCheckin);
                this.isEditing = true;
                this.render(data);
            });
        }

        const btnDeleteCheckin = document.getElementById('btn-delete-checkin');
        if (btnDeleteCheckin && typeof btnDeleteCheckin.addEventListener === 'function') {
            btnDeleteCheckin.addEventListener('click', async () => {
                Motion.buttonTap(btnDeleteCheckin);
                const targetDate = summary ? summary.date : (checkIn?.date || this.app.getPedagogicalDate());
                if (confirm(`Supprimer définitivement le bilan du jour (${targetDate}) ?`)) {
                    await this.app.deleteCheckIn(targetDate);
                    this.isEditing = false;
                    if (this.app.renderView) {
                        this.app.renderView('bilan');
                    }
                }
            });
        }

        const btnCancelEdit = document.getElementById('btn-cancel-edit-checkin');
        if (btnCancelEdit && typeof btnCancelEdit.addEventListener === 'function') {
            btnCancelEdit.addEventListener('click', () => {
                Motion.buttonTap(btnCancelEdit);
                this.isEditing = false;
                this.render(data);
            });
        }

        const btnSubmit = document.getElementById('btn-submit-checkin');
        if (btnSubmit && typeof btnSubmit.addEventListener === 'function') {
            btnSubmit.addEventListener('click', () => {
                Motion.buttonTap(btnSubmit);
                this.isEditing = false;
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

                const personalAction = (document.getElementById('chk-personal-action')?.value || '').trim();
                const personalExpected = (document.getElementById('chk-personal-expected')?.value || '').trim();
                const personalStatus = document.getElementById('chk-personal-status')?.value || 'pending';
                const personalReflection = (document.getElementById('chk-personal-reflection')?.value || '').trim();

                const proAction = (document.getElementById('chk-pro-action')?.value || '').trim();
                const proExpected = (document.getElementById('chk-pro-expected')?.value || '').trim();
                const proStatus = document.getElementById('chk-pro-status')?.value || 'pending';
                const proReflection = (document.getElementById('chk-pro-reflection')?.value || '').trim();

                const payload = {
                    date: summary ? summary.date : this.app.getPedagogicalDate(),
                    energy: energy,
                    sleep: {
                        durationMinutes: sleepHours * 60,
                        quality: sleepQuality
                    },
                    dayAssessment: assessment,
                    blockers: blockersTxt ? [blockersTxt] : [],
                    needsFollowUp: needsFollowUp,
                    personalStep: personalAction ? {
                        action: personalAction,
                        expectedResult: personalExpected,
                        status: personalStatus,
                        reflection: personalReflection
                    } : null,
                    professionalStep: proAction ? {
                        action: proAction,
                        expectedResult: proExpected,
                        status: proStatus,
                        reflection: proReflection
                    } : null
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
