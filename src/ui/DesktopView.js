import { escapeHtml } from '../utils/html.js';

export class DesktopView {
    constructor(containerId, app) {
        this.container = typeof containerId === 'string' && typeof document !== 'undefined'
            ? document.getElementById(containerId)
            : (containerId || (typeof document !== 'undefined' ? document.getElementById('app-root') : null));
        this.app = app;
    }

    render(state) {
        if (!this.container) return;
        if (typeof document !== 'undefined' && document.body && typeof document.body.setAttribute === 'function') {
            document.body.setAttribute('data-univers', 'bureau');
        }
        const userName = state.userProfile?.name ? escapeHtml(state.userProfile.name) : 'Toi';

        // Message du coach : première recommandation utile (hors simples créneaux libres)
        const insightsList = Array.isArray(state.coachInsights) ? state.coachInsights : [];
        const mainInsight = insightsList.find(r => r && r.message && r.title !== 'Créneau de disponibilité') || null;
        const coachMessage = escapeHtml(mainInsight ? mainInsight.message : 'Salut ! Je suis là si tu as besoin d\'aide pour t\'organiser.').replace(/\n/g, '<br>');

        // Sommeil du bilan : { durationMinutes, quality }
        const sleepMinutes = state.todayCheckIn?.sleep?.durationMinutes || 0;
        const sleepHours = sleepMinutes > 0 ? Math.round((sleepMinutes / 60) * 10) / 10 : null;
        const average = state.academicSummary?.average?.value;
        const targetCredits = state.academicSummary?.cectStatus?.officialTotal;
        
        // Date pédagogique en format long (ex: Lundi 23 Juin 2026)
        const dateOptions = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
        const pedaDate = this.app.getPedagogicalDateObject ? this.app.getPedagogicalDateObject() : new Date();
        let dateStr = pedaDate.toLocaleDateString('fr-FR', dateOptions);
        dateStr = dateStr.charAt(0).toUpperCase() + dateStr.slice(1);
        const currentTimeDisplay = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

        // Langues réelles enregistrées
        const userLanguages = (this.app.languageEngine && typeof this.app.languageEngine.getAllLanguagesSync === 'function')
            ? this.app.languageEngine.getAllLanguagesSync()
            : (state.userLanguages || []);

        const xpPercent = Math.min(100, ((state.userProfile?.gamification?.xp || 0) / (state.userProfile?.gamification?.nextLevelXp || 1000)) * 100);

        let html = `
<div class="bureau" data-univers="bureau">
    <!-- SIDEBAR -->
    <aside class="bureau-sidebar">
        <div class="bureau-brand">
            <div class="bureau-brand-icon">⚡</div>
            <span>Learning OS</span>
        </div>
        
        <!-- ONGLETS NAVIGATION -->
        <nav class="bureau-nav">
            <div class="bureau-nav-item active" data-view="desktop">
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
            <div class="bureau-nav-item" data-view="chat">
                <i class="bi bi-robot"></i> Coach
            </div>
            <div class="bureau-nav-item" data-view="dashboard">
                <i class="bi bi-speedometer2"></i> Tableau de bord
            </div>
            <div class="bureau-nav-item" data-view="weekly">
                <i class="bi bi-journal-check"></i> Hebdo
            </div>
        </nav>

        <!-- WIDGET XP / NIVEAU -->
        <div class="bureau-xp-box">
            <div class="bureau-xp-header">
                <span>Niveau ${state.userProfile?.gamification?.level || 1}</span>
                <span class="bureau-xp-count">${state.userProfile?.gamification?.xp || 0} / ${state.userProfile?.gamification?.nextLevelXp || 1000} XP</span>
            </div>
            <div class="bureau-progress-bar">
                <div class="bureau-progress-fill" data-progress="${xpPercent}"></div>
            </div>
        </div>
    </aside>

    <!-- CONTENU PRINCIPAL -->
    <main class="bureau-content">
        <!-- TOPBAR -->
        <header class="bureau-topbar-wrapper">
            <div>
                <span class="bureau-date-display">${dateStr}</span>
                <h1 class="bureau-greeting-title">Bonjour, ${userName}</h1>
            </div>
            <div class="bureau-topbar-actions">
                <div class="bureau-clock-pill">
                    <i class="bi bi-clock"></i>
                    <span>${currentTimeDisplay}</span>
                </div>
                <button type="button" id="btn-backup-modal" class="btn btn-secondary btn-sm" title="Sauvegarde et restauration des données">
                    <i class="bi bi-shield-check"></i> <span>Sauvegarde</span>
                </button>
                <div id="btn-profile" class="bureau-profile-btn" title="Mon profil & Sauvegarde">
                    ${(state.userProfile?.name || 'T').charAt(0).toUpperCase()}
                </div>
            </div>
        </header>

        <!-- GRILLE PRINCIPALE (NOTION STYLE) -->
        <div class="bureau-grid">
            
            <!-- 1. SESSION EN COURS -->
            <div class="bureau-session-card">
                ${(() => {
                    const now = new Date();
                    const currentDateStr = this.app.getPedagogicalDate ? this.app.getPedagogicalDate(now) : '';
                    const currentTimeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
                    const todayEvents = (state.calendarData?.events || []).filter(e => e.date === currentDateStr);
                    let currentEvent = null;
                    todayEvents.forEach(e => {
                        if (!e.startTime) return;
                        const startH = parseInt(e.startTime.split(':')[0]);
                        const startM = parseInt(e.startTime.split(':')[1] || 0);
                        let endH = startH + 1, endM = startM;
                        if (e.endTime) {
                            endH = parseInt(e.endTime.split(':')[0]);
                            endM = parseInt(e.endTime.split(':')[1] || 0);
                        } else if (e.targetDuration) {
                            const totalM = startM + e.targetDuration;
                            endH = startH + Math.floor(totalM / 60);
                            endM = totalM % 60;
                        }
                        const endTimeStr = `${endH.toString().padStart(2, '0')}:${endM.toString().padStart(2, '0')}`;
                        if (e.startTime <= currentTimeStr && endTimeStr > currentTimeStr) {
                            currentEvent = { ...e, endTimeStr };
                        }
                    });

                    this.currentDesktopEvent = currentEvent;

                    if (currentEvent) {
                        return `
                        <div>
                            <span class="bureau-eyebrow">Session en cours</span>
                            <h3 class="bureau-session-title">${escapeHtml(currentEvent.title || currentEvent.type)}</h3>
                            <span class="bureau-session-time">${currentEvent.startTime} — ${currentEvent.endTimeStr}</span>
                        </div>
                        <div class="bureau-session-btn-wrap">
                            <button type="button" id="btn-desktop-course" class="btn btn-secondary bureau-btn-full">
                                Démarrer la session
                            </button>
                        </div>`;
                    }
                    return `
                        <div>
                            <span class="bureau-eyebrow">Repos</span>
                            <h3 class="bureau-session-empty-title">Aucune session en cours</h3>
                        </div>
                        <div class="bureau-session-btn-wrap">
                            <button type="button" id="btn-desktop-course" class="btn btn-secondary bureau-btn-full">
                                Démarrer une session
                            </button>
                        </div>
                    `;
                })()}
            </div>

            <!-- 2. PROCHAINS ÉVÉNEMENTS -->
            <div class="card">
                <div class="card-header">
                    <h3 class="card-title">Prochains événements</h3>
                </div>
                <div class="card-body">
                    <div class="bureau-event-list">
                        ${(() => {
                            const now = new Date();
                            const currentDateStr = this.app.getPedagogicalDate ? this.app.getPedagogicalDate(now) : '';
                            const currentTimeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
                            const todayEvents = (state.calendarData?.events || []).filter(e => e.date === currentDateStr && e.startTime > currentTimeStr);
                            todayEvents.sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));
                            
                            if (todayEvents.length === 0) return '<div class="bureau-empty">Aucun événement prévu.</div>';
                            
                            return todayEvents.slice(0, 3).map((e) => `
                                <div class="bureau-event-item">
                                    <div class="bureau-event-time">${e.startTime}</div>
                                    <div class="bureau-event-details">
                                        <strong>${escapeHtml(e.title || e.type)}</strong>
                                    </div>
                                </div>
                            `).join('');
                        })()}
                    </div>
                </div>
            </div>

            <!-- 3. RÉSUMÉ ACADÉMIQUE -->
            <div class="card">
                <div class="card-header">
                    <h3 class="card-title bureau-card-title-icon">
                        <i class="bi bi-mortarboard"></i> Résumé Académique
                    </h3>
                </div>
                <div class="card-body">
                    <div class="bureau-stat-list">
                        <div class="bureau-stat-row">
                            <span class="bureau-stat-row-label">Moyenne Générale</span>
                            <strong class="bureau-stat-row-val">${typeof average === 'number' ? average.toFixed(1) : '--'} / 20</strong>
                        </div>
                        <div class="bureau-stat-row">
                            <span class="bureau-stat-row-label">Crédits Validés</span>
                            <strong class="bureau-stat-row-val">${state.academicSummary?.earnedCredits ?? '--'} / ${targetCredits || '--'}</strong>
                        </div>
                    </div>
                </div>
            </div>

            <!-- 4. RACCOURCIS (SPAN 2) -->
            <div class="card bureau-grid-span-2">
                <div class="card-header">
                    <h3 class="card-title">Raccourcis</h3>
                </div>
                <div class="card-body">
                    <div class="bureau-shortcut-grid">
                        <a href="https://github.com" target="_blank" rel="noopener noreferrer" class="bureau-shortcut-item">
                            <i class="bi bi-github bureau-shortcut-icon"></i>
                            <span class="bureau-shortcut-label">GitHub</span>
                        </a>
                        <a href="https://youtube.com" target="_blank" rel="noopener noreferrer" class="bureau-shortcut-item">
                            <i class="bi bi-youtube bureau-shortcut-icon youtube"></i>
                            <span class="bureau-shortcut-label">YouTube</span>
                        </a>
                        <a href="https://google.com" target="_blank" rel="noopener noreferrer" class="bureau-shortcut-item">
                            <i class="bi bi-browser-chrome bureau-shortcut-icon chrome"></i>
                            <span class="bureau-shortcut-label">Chrome</span>
                        </a>
                        <a href="https://open.spotify.com" target="_blank" rel="noopener noreferrer" class="bureau-shortcut-item">
                            <i class="bi bi-spotify bureau-shortcut-icon spotify"></i>
                            <span class="bureau-shortcut-label">Spotify</span>
                        </a>
                    </div>
                </div>
            </div>

            <!-- 5. PROGRÈS LANGUES -->
            <div class="card">
                <div class="card-header">
                    <h3 class="card-title">Progrès langues</h3>
                </div>
                <div class="card-body">
                    <div class="bureau-lang-list">
                        ${(() => {
                            if (!userLanguages || userLanguages.length === 0) {
                                return '<div class="bureau-empty">Aucune langue enregistrée.</div>';
                            }
                            return userLanguages.slice(0, 3).map((l) => {
                                const completed = l.tracking?.sessionsCompleted || 0;
                                const target = (l.studyPlan?.sessionsPerWeek || 3) * 4;
                                const prog = target > 0 ? Math.min(100, Math.round((completed / target) * 100)) : 0;
                                return `
                                <div class="bureau-lang-item">
                                    <div class="bureau-lang-circle">
                                        ${prog}%
                                    </div>
                                    <div>
                                        <strong class="bureau-lang-title">${escapeHtml(l.title || l.name)}</strong>
                                        <span class="bureau-lang-sub">${escapeHtml(l.level || 'Non défini')} · ${completed} séance${completed > 1 ? 's' : ''}</span>
                                    </div>
                                </div>`;
                            }).join('');
                        })()}
                    </div>
                </div>
            </div>

            <!-- 6. AUJOURD'HUI -->
            <div class="card">
                <div class="card-header">
                    <h3 class="card-title">Aujourd'hui</h3>
                </div>
                <div class="card-body">
                    <div class="bureau-stat-pair">
                        <div class="bureau-stat-box">
                            <div class="bureau-stat-num">${state.dailyPlan?.sessions?.length || 0}</div>
                            <div class="bureau-stat-label">Sessions</div>
                        </div>
                        <div class="bureau-stat-box">
                            <div class="bureau-stat-num bureau-stat-num-success">${(state.dailyPlan?.sessions || []).filter(s => s.completed).length}</div>
                            <div class="bureau-stat-label">Complétées</div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- 7. LIFE & BIEN-ÊTRE -->
            <div class="card">
                <div class="card-header">
                    <h3 class="card-title">Vie & Bien-être</h3>
                </div>
                <div class="card-body">
                    <div class="bureau-life-list">
                        <div>
                            <div class="bureau-life-row">
                                <span class="bureau-life-label"><i class="bi bi-droplet"></i> Hydratation</span>
                                <strong class="bureau-life-val">${state.todayCheckIn?.water ? state.todayCheckIn.water + 'L' : 'Non renseigné'}</strong>
                            </div>
                            <div class="bureau-progress-bar">
                                <div class="bureau-progress-fill" data-progress="${state.todayCheckIn?.water ? Math.min(100, (state.todayCheckIn.water/2)*100) : 0}"></div>
                            </div>
                        </div>
                        <div>
                            <div class="bureau-life-row">
                                <span class="bureau-life-label"><i class="bi bi-moon"></i> Sommeil</span>
                                <strong class="bureau-life-val">${sleepHours !== null ? sleepHours + 'h' : 'Non renseigné'}</strong>
                            </div>
                            <div class="bureau-progress-bar">
                                <div class="bureau-progress-fill" data-progress="${sleepHours !== null ? Math.min(100, (sleepHours/8)*100) : 0}"></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- 8. LE COACH -->
            <div class="bureau-coach-card">
                <div class="bureau-coach-header">
                    <h3 class="card-title"><i class="bi bi-chat-quote"></i> Le Coach</h3>
                </div>
                <div class="bureau-coach-bubble">
                    "${coachMessage}"
                </div>
                <div class="bureau-coach-input-group">
                    <input type="text" id="desktop-ask-coach" class="form-input" placeholder="Demander conseil...">
                    <button type="button" class="btn btn-primary bureau-nav-item bureau-btn-send" data-view="chat" title="Envoyer au coach">
                        <i class="bi bi-arrow-right"></i>
                    </button>
                </div>
            </div>

        </div>
    </main>
</div>

<!-- MODALE SAUVEGARDE & RESTAURATION (ex-Portfolio) -->
<div id="backup-modal" class="academic-modal-overlay hidden">
    <div class="academic-modal-window" style="max-width: 500px;">
        <div class="academic-modal-header">
            <h3 class="academic-modal-title"><i class="bi bi-shield-check"></i> <span>Sauvegarde & Données</span></h3>
            <button id="backup-modal-close" class="academic-modal-close-btn" aria-label="Fermer">&times;</button>
        </div>
        <div class="academic-modal-body" style="padding: 20px;">
            <p style="color: var(--text-secondary); margin-bottom: 20px; font-size: 14px; line-height: 1.5;">
                Toutes tes données (planning, cours, notes, examens, projets, sessions, habitudes, langues, chat) sont conservées en local sur cet appareil.
            </p>
            <div style="display: flex; flex-direction: column; gap: 12px;">
                <button type="button" id="btn-export-data" class="btn btn-primary" style="justify-content: center; padding: 12px; font-weight: 600;">
                    <i class="bi bi-download"></i> Exporter mes données (.json)
                </button>
                <div style="text-align: center; font-size: 12px; color: var(--text-tertiary); text-transform: uppercase;">ou</div>
                <label for="input-import-data" class="btn btn-outline" style="justify-content: center; padding: 12px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 8px;">
                    <i class="bi bi-upload"></i> Importer une sauvegarde (.json)
                </label>
                <input type="file" id="input-import-data" accept=".json" style="display: none;">
            </div>
        </div>
    </div>
</div>
        `;
        
        this.container.innerHTML = html;
        this.attachEvents();
    }

    attachEvents() {
        if (!this.container) return;

        // Dynamic progress fills
        this.container.querySelectorAll('[data-progress]').forEach(el => {
            const val = parseFloat(el.getAttribute('data-progress')) || 0;
            if (el.style) {
                el.style.width = `${Math.min(100, Math.max(0, val))}%`;
            }
        });

        // "Demander conseil..." : le texte saisi est envoyé au coach (sinon le bouton ouvre simplement le chat)
        const askInput = this.container.querySelector('#desktop-ask-coach');
        const askBtn = askInput && askInput.parentElement ? askInput.parentElement.querySelector('button[data-view="chat"]') : null;
        const askText = () => (askInput && typeof askInput.value === 'string' ? askInput.value.trim() : '');
        if (askBtn && typeof askBtn.addEventListener === 'function') {
            askBtn.addEventListener('click', (e) => {
                const text = askText();
                if (text && typeof this.app.sendChatMessage === 'function') {
                    e.stopImmediatePropagation();
                    this.app.sendChatMessage(text);
                }
            });
        }
        if (askInput && typeof askInput.addEventListener === 'function') {
            askInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && askText() && typeof this.app.sendChatMessage === 'function') {
                    e.preventDefault();
                    this.app.sendChatMessage(askText());
                }
            });
        }

        // Navigation locale
        this.container.querySelectorAll('.bureau-nav-item').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const viewName = e.currentTarget.getAttribute('data-view');
                if (viewName && this.app.renderView) {
                    this.app.renderView(viewName);
                }
            });
        });

        const btnCourse = this.container.querySelector('#btn-desktop-course');
        if (btnCourse) {
            btnCourse.addEventListener('click', () => {
                if (this.app.startFocusSession) {
                    this.app.startFocusSession(this.currentDesktopEvent);
                } else if (this.app.renderView) {
                    this.app.renderView('focus');
                }
            });
        }

        // MODALE SAUVEGARDE & RESTAURATION
        const backupModal = this.container.querySelector('#backup-modal');
        const btnOpenBackup = this.container.querySelector('#btn-backup-modal');
        const btnCloseBackup = this.container.querySelector('#backup-modal-close');
        const btnProfile = this.container.querySelector('#btn-profile');

        const openBackup = () => {
            if (backupModal) backupModal.classList.remove('hidden');
        };
        const closeBackup = () => {
            if (backupModal) backupModal.classList.add('hidden');
        };

        if (btnOpenBackup) btnOpenBackup.addEventListener('click', openBackup);
        if (btnCloseBackup) btnCloseBackup.addEventListener('click', closeBackup);
        if (btnProfile) btnProfile.addEventListener('click', openBackup);
        if (backupModal) {
            backupModal.addEventListener('click', (e) => {
                if (e.target === backupModal) closeBackup();
            });
        }

        // EXPORT DONNÉES
        const btnExport = this.container.querySelector('#btn-export-data');
        if (btnExport) {
            btnExport.addEventListener('click', async () => {
                try {
                    const exportData = await this.app.exportAllData();
                    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `backup_coach_procrastination_${new Date().toISOString().slice(0, 10)}.json`;
                    document.body.appendChild(a);
                    a.click();
                    a.remove();
                    setTimeout(() => URL.revokeObjectURL(url), 1000);
                } catch (e) {
                    alert("Erreur lors de l'exportation: " + e.message);
                }
            });
        }

        // IMPORT DONNÉES
        const inputImport = this.container.querySelector('#input-import-data');
        if (inputImport) {
            inputImport.addEventListener('change', (e) => {
                const file = e.target.files && e.target.files[0];
                if (!file) return;

                if (confirm("⚠️ Attention : l'importation va remplacer vos données actuelles par celles de la sauvegarde. Voulez-vous continuer ?")) {
                    const reader = new FileReader();
                    reader.onload = async (event) => {
                        try {
                            const importedData = JSON.parse(event.target.result);
                            await this.app.importAllData(importedData);
                            alert("Données importées avec succès ! L'application va redémarrer.");
                            if (typeof window !== 'undefined' && window.location && typeof window.location.reload === 'function') {
                                window.location.reload();
                            } else if (this.app.renderView) {
                                await this.app.renderView('desktop');
                            }
                        } catch (err) {
                            alert("Fichier de sauvegarde invalide ou corrompu.");
                        }
                    };
                    reader.readAsText(file);
                } else {
                    inputImport.value = '';
                }
            });
        }
    }
}
