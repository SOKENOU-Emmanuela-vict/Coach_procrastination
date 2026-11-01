import { Motion } from './motion.js';

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
                    
                    <div class="life-kpi-row">
                        <span class="life-kpi-label"><i class="bi bi-droplet"></i> Hydratation</span>
                        <strong class="life-kpi-val">${state?.todayCheckIn?.water ? state.todayCheckIn.water + ' L' : 'Non renseigné'}</strong>
                    </div>
                    <div class="life-kpi-row">
                        <span class="life-kpi-label"><i class="bi bi-moon-stars"></i> Sommeil</span>
                        <strong class="life-kpi-val">${state?.todayCheckIn?.sleep?.durationMinutes ? (Math.round((state.todayCheckIn.sleep.durationMinutes / 60) * 10) / 10) + ' h' : 'Non renseigné'}</strong>
                    </div>
                    <div class="life-kpi-row">
                        <span class="life-kpi-label"><i class="bi bi-lightning-charge"></i> Énergie</span>
                        <strong class="life-kpi-val">${energyLabel}</strong>
                    </div>
                    <div class="life-kpi-row">
                        <span class="life-kpi-label"><i class="bi bi-graph-up"></i> Bilan du jour</span>
                        <strong class="life-kpi-val">${state?.todayCheckIn?.dayAssessment ? state.todayCheckIn.dayAssessment : 'Non renseigné'}</strong>
                    </div>
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

        // Event listeners pour les boutons Edit/Delete (Habitudes & Objectifs)
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
