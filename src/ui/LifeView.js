import { Motion } from './motion.js';
import { escapeHtml } from '../utils/html.js';

export class LifeView {
    constructor(containerId, app) {
        this.container = typeof containerId === 'string' && typeof document !== 'undefined' ? document.getElementById(containerId) : (containerId || (typeof document !== 'undefined' ? document.getElementById('view-container') : null));
        this.app = app;
    }
    
    async render(state) {
        if (!this.container) return;
        if (typeof document !== 'undefined' && document.body) {
            document.body.className = 'theme-light';
            if (typeof document.body.setAttribute === 'function') {
                document.body.setAttribute('data-univers', 'vie');
            }
        }

        const habits = (this.app.scheduler && typeof this.app.scheduler.getHabits === 'function') 
            ? (await this.app.scheduler.getHabits() || []) : [];
        const goals = (this.app.projectEngine && typeof this.app.projectEngine.getGoals === 'function') 
            ? await this.app.projectEngine.getGoals() : [];

        let energyLabel = 'Non renseigné';
        if (state?.todayCheckIn?.energy) {
            if (state.todayCheckIn.energy === 'high') energyLabel = '<i class="bi bi-circle-fill text-success"></i> Haute';
            else if (state.todayCheckIn.energy === 'medium') energyLabel = '<i class="bi bi-circle-fill text-warning"></i> Moyenne';
            else energyLabel = '<i class="bi bi-circle-fill text-danger"></i> Basse';
        }

        let html = `
<div class="bureau life-layout">
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
            <div class="bureau-nav-item" data-view="languages">
                <i class="bi bi-globe"></i> Langues
            </div>
            <div class="bureau-nav-item active" data-view="life">
                <i class="bi bi-heart"></i> Vie
            </div>
            <div class="bureau-nav-item" data-view="chat">
                <i class="bi bi-robot"></i> Coach
            </div>
        </div>
    </div>

    <!-- MAIN CONTENT -->
    <div class="bureau-content life-content">
        <!-- TOPBAR HERO BIEN-ÊTRE & CITATION -->
        <div class="life-hero-card">
            <div class="life-hero-left">
                <span class="life-hero-tag">Équilibre & Clarté</span>
                <h2 class="life-hero-headline">VIE & BIEN-ÊTRE</h2>
            </div>
            <div class="life-hero-right">
                <div id="btn-profile" class="bureau-profile-btn" role="button" tabindex="0" title="Mon profil">
                    ${state.userProfile?.avatarPhoto ? `<img src="${escapeHtml(state.userProfile.avatarPhoto)}" class="bureau-avatar-img" alt="Avatar">` : escapeHtml((state.userProfile?.name || 'É').charAt(0).toUpperCase())}
                </div>
                <i class="bi bi-quote life-hero-quote-icon"></i>
                <p class="life-hero-quote-text">
                    "Tu ne peux pas changer ton passé, mais tu peux détruire ton futur si tu restes bloqué dessus."
                </p>
                <div class="life-hero-author">— Miyamoto Musashi</div>
            </div>
        </div>

        <!-- WIDGETS GRID (3 COLONNES) -->
        <div class="life-grid">
            
            <!-- HABITUDES (COL 1) -->
            <div class="life-col">
                <div class="life-card">
                    <div class="life-card-header">
                        <div class="life-card-title-wrap">
                            <i class="bi bi-check2-square life-card-icon"></i>
                            <h3 class="life-card-title">Habitudes (Toutes)</h3>
                        </div>
                        <button type="button" class="btn-open-modal life-card-btn-add" data-type="habit" title="Ajouter une habitude">
                            <i class="bi bi-plus-circle"></i>
                        </button>
                    </div>
                    <div class="life-card-list">
                        ${habits.length > 0 ? habits.map(h => `
                            <div class="life-item-row">
                                <span class="life-item-title">${h.title}</span>
                                <div class="life-item-actions">
                                    <button class="btn-edit-item life-icon-btn" data-id="${h.id}" data-type="habit" title="Modifier"><i class="bi bi-pencil"></i></button>
                                    <button class="btn-delete-item life-icon-btn danger" data-id="${h.id}" data-type="habit" title="Supprimer"><i class="bi bi-trash"></i></button>
                                </div>
                            </div>
                        `).join('') : '<p class="life-empty-text">Aucune habitude enregistrée.</p>'}
                    </div>
                </div>
            </div>

            <!-- FITNESS & BIEN-ÊTRE (COL 2) -->
            <div class="life-col">
                <div class="life-card">
                    <div class="life-card-header">
                        <div class="life-card-title-wrap">
                            <i class="bi bi-heart-pulse-fill life-card-icon rose"></i>
                            <h3 class="life-card-title">Fitness & Bien-être</h3>
                        </div>
                    </div>
                    
                    ${(() => {
                        const checkIn = state?.todayCheckIn || {};
                        const waterVal = checkIn.water;
                        let waterDisplay = 'Non renseigné';
                        let hasWater = false;
                        if (waterVal !== undefined && waterVal !== null && waterVal > 0) {
                            hasWater = true;
                            waterDisplay = (typeof waterVal === 'number' && waterVal <= 5)
                                ? `${waterVal} L (${Math.round(waterVal / 0.25)} verres)`
                                : `${waterVal} verres (${(waterVal * 0.25).toFixed(1)} L)`;
                        }

                        const sleepMinutes = checkIn.sleep?.durationMinutes || 0;
                        const sleepHours = sleepMinutes > 0 ? (Math.round((sleepMinutes / 60) * 10) / 10) : 0;
                        const sleepQuality = checkIn.sleep?.quality || 'Moyenne';
                        
                        let curEnergyNum = checkIn.energyLevel || (checkIn.energy === 'high' ? 5 : (checkIn.energy === 'low' ? 1 : (checkIn.energy ? 3 : 0)));
                        let energyDisplay = 'Non renseigné';
                        if (curEnergyNum > 0 || checkIn.energy) {
                            const eWord = checkIn.energy === 'high' ? 'Haute' : (checkIn.energy === 'low' ? 'Basse' : 'Moyenne');
                            energyDisplay = `${eWord} (${curEnergyNum > 0 ? curEnergyNum : 3}/5)`;
                        }

                        const activity = checkIn.activity || null;
                        const dayAssessment = checkIn.dayAssessment || '';

                        return `
                        <!-- Hydratation -->
                        <div class="life-kpi-row">
                            <div class="life-kpi-info">
                                <span class="life-kpi-label"><i class="bi bi-droplet"></i> Hydratation</span>
                                <strong class="life-kpi-val">${waterDisplay}</strong>
                            </div>
                            <div class="life-kpi-controls">
                                <button type="button" class="btn-water-plus life-pill-btn" title="Ajouter 1 verre (+250 ml)">+1 verre</button>
                                <button type="button" class="btn-water-edit life-kpi-action-btn" title="Modifier le nombre de verres"><i class="bi bi-pencil"></i></button>
                                ${hasWater ? `<button type="button" class="btn-water-clear life-kpi-action-btn danger" title="Effacer l'hydratation"><i class="bi bi-trash"></i></button>` : ''}
                            </div>
                        </div>

                        <!-- Sommeil -->
                        <div class="life-kpi-row">
                            <div class="life-kpi-info">
                                <span class="life-kpi-label"><i class="bi bi-moon-stars"></i> Sommeil</span>
                                <strong class="life-kpi-val">${sleepHours > 0 ? `${sleepHours} h (${sleepQuality})` : 'Non renseigné'}</strong>
                            </div>
                            <div class="life-kpi-controls">
                                <button type="button" class="btn-sleep-edit life-kpi-action-btn" title="Renseigner / modifier le sommeil"><i class="bi bi-pencil"></i></button>
                                ${sleepHours > 0 ? `<button type="button" class="btn-sleep-clear life-kpi-action-btn danger" title="Effacer le sommeil"><i class="bi bi-trash"></i></button>` : ''}
                            </div>
                        </div>

                        <!-- Énergie -->
                        <div class="life-kpi-row">
                            <div class="life-kpi-info">
                                <span class="life-kpi-label"><i class="bi bi-lightning-charge"></i> Énergie</span>
                                <strong class="life-kpi-val">${energyDisplay}</strong>
                            </div>
                            <div class="life-kpi-controls">
                                ${[1, 2, 3, 4, 5].map(n => `
                                    <button type="button" class="btn-energy-pill life-pill-btn ${curEnergyNum === n ? 'active' : ''}" data-val="${n}">${n}</button>
                                `).join('')}
                                ${curEnergyNum > 0 ? `<button type="button" class="btn-energy-clear life-kpi-action-btn danger" title="Effacer l'énergie"><i class="bi bi-trash"></i></button>` : ''}
                            </div>
                        </div>

                        <!-- Activité physique du jour -->
                        <div class="life-kpi-row">
                            <div class="life-kpi-info">
                                <span class="life-kpi-label"><i class="bi bi-activity"></i> Sport / Activité</span>
                                <strong class="life-kpi-val">${activity ? `${escapeHtml(activity.title)} (${activity.durationMinutes} min)` : 'Non renseigné'}</strong>
                            </div>
                            <div class="life-kpi-controls">
                                <button type="button" class="btn-activity-edit life-kpi-action-btn" title="Renseigner / modifier l'activité du jour"><i class="bi bi-pencil"></i></button>
                                ${activity ? `<button type="button" class="btn-activity-clear life-kpi-action-btn danger" title="Effacer l'activité"><i class="bi bi-trash"></i></button>` : ''}
                            </div>
                        </div>

                        <!-- Bilan du jour -->
                        <div class="life-kpi-row">
                            <div class="life-kpi-info">
                                <span class="life-kpi-label"><i class="bi bi-graph-up"></i> Bilan du jour</span>
                                <strong class="life-kpi-val">${dayAssessment ? escapeHtml(dayAssessment) : 'Non renseigné'}</strong>
                            </div>
                            <div class="life-kpi-controls">
                                <button type="button" class="btn-bilan-goto life-pill-btn" title="Ouvrir le bilan complet">Faire mon bilan</button>
                                ${dayAssessment ? `<button type="button" class="btn-bilan-clear life-kpi-action-btn danger" title="Effacer le bilan"><i class="bi bi-trash"></i></button>` : ''}
                            </div>
                        </div>
                        `;
                    })()}
                </div>
            </div>

            <!-- SPOTIFY & PASSIONS (COL 3) -->
            <div class="life-col">
                <!-- Spotify -->
                <div class="life-spotify-card">
                    <div class="life-spotify-header">
                        <i class="bi bi-spotify life-spotify-icon"></i>
                        <h3 class="life-card-title life-spotify-title">Ambiance Musicale</h3>
                    </div>
                    <p class="life-spotify-desc">
                        Lance ta musique ou playlist de concentration pour accompagner tes sessions de focus.
                    </p>
                    <a href="https://open.spotify.com" target="_blank" rel="noopener noreferrer" class="life-spotify-btn">
                        <i class="bi bi-box-arrow-up-right"></i> Ouvrir Spotify
                    </a>
                </div>

                <!-- Objectifs -->
                <div class="life-card">
                    <div class="life-card-header">
                        <div class="life-card-title-wrap">
                            <i class="bi bi-bullseye life-card-icon purple"></i>
                            <h3 class="life-card-title">Objectifs & Jalons</h3>
                        </div>
                        <button type="button" class="btn-open-modal life-card-btn-add" data-type="goal" title="Ajouter un objectif">
                            <i class="bi bi-plus-circle"></i>
                        </button>
                    </div>
                    <div class="life-card-list">
                        ${goals.length > 0 ? goals.map(g => `
                            <div class="life-goal-row">
                                <div class="life-goal-info">
                                    <div class="life-goal-title">${g.title}</div>
                                    <div class="life-goal-sub">Deadline: ${g.deadline || 'Aucune'}</div>
                                </div>
                                <div class="life-goal-meta">
                                    <span class="life-goal-progress">${g.progress || 0}%</span>
                                    <button class="btn-edit-item life-icon-btn" data-id="${g.id}" data-type="goal" title="Modifier"><i class="bi bi-pencil"></i></button>
                                </div>
                            </div>
                        `).join('') : '<p class="life-empty-text">Aucun objectif défini.</p>'}
                    </div>
                </div>
            </div>

        </div>
    </div>
</div>
        `;

        this.container.innerHTML = html;

        // Micro-animations GSAP sobres
        Motion.fadeIn(this.container.querySelector('.life-content') || this.container);
        const cards = this.container.querySelectorAll('.life-card, .life-spotify-card');
        if (cards.length > 0) {
            Motion.staggerIn(cards, { stagger: 0.04, duration: 0.22 });
        }

        // BINDINGS
        this.container.querySelectorAll('.bureau-nav-item').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const viewName = e.currentTarget.getAttribute('data-view');
                if (viewName && this.app.renderView) {
                    this.app.renderView(viewName);
                }
            });
        });

        // --- GESTION RAPIDE FITNESS & BIEN-ÊTRE ---
        const checkIn = state?.todayCheckIn || {};

        // Hydratation : +1 verre
        const btnWaterPlus = this.container.querySelector('.btn-water-plus');
        if (btnWaterPlus) {
            btnWaterPlus.addEventListener('click', async () => {
                Motion.buttonTap(btnWaterPlus);
                const cur = (checkIn.water || 0) + 1;
                if (this.app.saveQuickCheckInField) {
                    await this.app.saveQuickCheckInField('water', cur);
                    this.render(this.app.state);
                }
            });
        }

        // Hydratation : modifier
        const btnWaterEdit = this.container.querySelector('.btn-water-edit');
        if (btnWaterEdit) {
            btnWaterEdit.addEventListener('click', async () => {
                Motion.buttonTap(btnWaterEdit);
                const cur = checkIn.water || 0;
                const val = prompt("Nombre de verres d'eau bus aujourd'hui (1 verre ≈ 250 ml) :", cur);
                if (val !== null) {
                    const parsed = Math.max(0, parseInt(val, 10) || 0);
                    if (this.app.saveQuickCheckInField) {
                        await this.app.saveQuickCheckInField('water', parsed);
                        this.render(this.app.state);
                    }
                }
            });
        }

        // Hydratation : effacer
        const btnWaterClear = this.container.querySelector('.btn-water-clear');
        if (btnWaterClear) {
            btnWaterClear.addEventListener('click', async () => {
                Motion.buttonTap(btnWaterClear);
                if (confirm("Effacer l'hydratation du jour ?")) {
                    if (this.app.saveQuickCheckInField) {
                        await this.app.saveQuickCheckInField('water', null);
                        this.render(this.app.state);
                    }
                }
            });
        }

        // Sommeil : modifier
        const btnSleepEdit = this.container.querySelector('.btn-sleep-edit');
        if (btnSleepEdit) {
            btnSleepEdit.addEventListener('click', async () => {
                Motion.buttonTap(btnSleepEdit);
                const curM = checkIn.sleep?.durationMinutes || 0;
                const curH = curM > 0 ? (Math.round((curM / 60) * 10) / 10) : 7.5;
                const valH = prompt("Durée de sommeil de la nuit dernière (en heures, ex: 7.5) :", curH);
                if (valH !== null) {
                    const hours = Math.max(0, parseFloat(valH) || 0);
                    const curQ = checkIn.sleep?.quality || 'fair';
                    const valQ = prompt("Qualité du sommeil (poor = Mauvaise, fair = Moyenne, good = Bonne) :", curQ);
                    const quality = (valQ && ['poor', 'fair', 'good'].includes(valQ.trim().toLowerCase())) ? valQ.trim().toLowerCase() : 'fair';
                    if (this.app.saveQuickCheckInField) {
                        await this.app.saveQuickCheckInField('sleep', { durationMinutes: Math.round(hours * 60), quality });
                        this.render(this.app.state);
                    }
                }
            });
        }

        // Sommeil : effacer
        const btnSleepClear = this.container.querySelector('.btn-sleep-clear');
        if (btnSleepClear) {
            btnSleepClear.addEventListener('click', async () => {
                Motion.buttonTap(btnSleepClear);
                if (confirm("Effacer le sommeil du jour ?")) {
                    if (this.app.saveQuickCheckInField) {
                        await this.app.saveQuickCheckInField('sleep', null);
                        this.render(this.app.state);
                    }
                }
            });
        }

        // Énergie : 1 à 5 en un clic
        this.container.querySelectorAll('.btn-energy-pill').forEach(btn => {
            btn.addEventListener('click', async () => {
                Motion.buttonTap(btn);
                const n = parseInt(btn.getAttribute('data-val'), 10) || 3;
                const mapEnum = { 1: 'low', 2: 'low', 3: 'medium', 4: 'high', 5: 'high' };
                if (this.app.saveQuickCheckInField) {
                    await this.app.saveQuickCheckInField('energyLevel', n);
                    await this.app.saveQuickCheckInField('energy', mapEnum[n] || 'medium');
                    this.render(this.app.state);
                }
            });
        });

        // Énergie : effacer
        const btnEnergyClear = this.container.querySelector('.btn-energy-clear');
        if (btnEnergyClear) {
            btnEnergyClear.addEventListener('click', async () => {
                Motion.buttonTap(btnEnergyClear);
                if (confirm("Effacer l'énergie du jour ?")) {
                    if (this.app.saveQuickCheckInField) {
                        await this.app.saveQuickCheckInField('energyLevel', null);
                        await this.app.saveQuickCheckInField('energy', null);
                        this.render(this.app.state);
                    }
                }
            });
        }

        // Activité physique du jour : modifier
        const btnActivityEdit = this.container.querySelector('.btn-activity-edit');
        if (btnActivityEdit) {
            btnActivityEdit.addEventListener('click', async () => {
                Motion.buttonTap(btnActivityEdit);
                const curTitle = checkIn.activity?.title || 'Course à pied';
                const curDur = checkIn.activity?.durationMinutes || 30;
                const title = prompt("Activité physique du jour (ex: Course à pied, Yoga, Musculation...) :", curTitle);
                if (title && title.trim()) {
                    const durVal = prompt("Durée de l'activité (en minutes) :", curDur);
                    const dur = Math.max(1, parseInt(durVal, 10) || 30);
                    if (this.app.saveQuickCheckInField) {
                        await this.app.saveQuickCheckInField('activity', { title: title.trim(), durationMinutes: dur });
                        this.render(this.app.state);
                    }
                }
            });
        }

        // Activité physique du jour : effacer
        const btnActivityClear = this.container.querySelector('.btn-activity-clear');
        if (btnActivityClear) {
            btnActivityClear.addEventListener('click', async () => {
                Motion.buttonTap(btnActivityClear);
                if (confirm("Effacer l'activité physique du jour ?")) {
                    if (this.app.saveQuickCheckInField) {
                        await this.app.saveQuickCheckInField('activity', null);
                        this.render(this.app.state);
                    }
                }
            });
        }

        // Bilan du jour : aller au bilan
        const btnBilanGoto = this.container.querySelector('.btn-bilan-goto');
        if (btnBilanGoto) {
            btnBilanGoto.addEventListener('click', () => {
                Motion.buttonTap(btnBilanGoto);
                if (this.app.renderView) this.app.renderView('bilan');
            });
        }

        // Bilan du jour : effacer
        const btnBilanClear = this.container.querySelector('.btn-bilan-clear');
        if (btnBilanClear) {
            btnBilanClear.addEventListener('click', async () => {
                Motion.buttonTap(btnBilanClear);
                if (confirm("Supprimer définitivement le bilan du jour ?")) {
                    if (this.app.deleteCheckIn) {
                        await this.app.deleteCheckIn();
                        this.render(this.app.state);
                    }
                }
            });
        }
        this.container.querySelectorAll('.btn-open-modal').forEach(btn => {
            btn.addEventListener('click', () => {
                Motion.buttonTap(btn);
                const type = btn.getAttribute('data-type') || 'habit';
                if (this.app.openGlobalItemEditor) {
                    this.app.openGlobalItemEditor({ type });
                }
            });
        });

        this.container.querySelectorAll('.btn-edit-item').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.currentTarget.getAttribute('data-id');
                const type = e.currentTarget.getAttribute('data-type');
                let item = null;
                if (type === 'habit' && this.app.scheduler) {
                    item = (await this.app.scheduler.getHabits()).find(i => i.id === id);
                }
                if (type === 'goal' && this.app.projectEngine) {
                    item = (await this.app.projectEngine.getGoals()).find(i => i.id === id);
                }
                if (item && this.app.openGlobalItemEditor) {
                    this.app.openGlobalItemEditor({ ...item, type });
                }
            });
        });

        this.container.querySelectorAll('.btn-delete-item').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.currentTarget.getAttribute('data-id');
                const type = e.currentTarget.getAttribute('data-type');
                if (confirm('Êtes-vous sûr de vouloir supprimer cet élément ?')) {
                    if (type === 'habit' && this.app.scheduler) await this.app.scheduler.deleteHabit(id);
                    if (type === 'goal' && this.app.projectEngine) await this.app.projectEngine.deleteGoal(id);
                    if (this.app.renderView) this.app.renderView('life');
                }
            });
        });
    }
}
