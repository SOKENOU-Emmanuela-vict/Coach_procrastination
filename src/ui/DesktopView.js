import { escapeHtml } from '../utils/html.js';
import { Motion } from './motion.js';
import { DEFAULT_PROGRAM_ENGLISH } from '../engines/LanguageEngine.js';

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
        const rawReminder = state.lastCoachReminder || (mainInsight ? mainInsight.message : "Aucun rappel en attente. Tout est calme !");
        const coachReminderText = escapeHtml(rawReminder).replace(/\n/g, '<br>');

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

        // Langues réelles enregistrées (Anglais garanti par défaut)
        const userLanguages = (this.app.languageEngine && typeof this.app.languageEngine.getAllLanguagesSync === 'function')
            ? this.app.languageEngine.getAllLanguagesSync()
            : ((state.userLanguages && state.userLanguages.length > 0) ? state.userLanguages : [DEFAULT_PROGRAM_ENGLISH]);

        // Programme Intensif (18 nov - 25 déc 2026, 111h, 3h/j)
        const targetEnd = new Date('2026-12-25T23:59:59');
        const targetStart = new Date('2026-11-18T00:00:00');
        const msPerDay = 1000 * 60 * 60 * 24;
        const totalProgramDays = 37;
        const totalProgramHours = 111;
        const daysRemaining = Math.max(0, Math.ceil((targetEnd - pedaDate) / msPerDay));
        const daysElapsed = Math.max(1, Math.min(37, Math.floor((pedaDate - targetStart) / msPerDay) + 1));
        const progressDaysPercent = Math.min(100, Math.round((daysElapsed / totalProgramDays) * 100));

        // Axe A : Certifications & Formations
        const certList = Array.isArray(state.certifications) ? state.certifications : [];
        const certDoneCount = certList.filter(c => c && c.status === 'completed').length;
        const certTotalCount = certList.length || 4;

        // Axe B : Grand Projet Innovant
        const projectList = Array.isArray(state.projects) ? state.projects : [];
        const grandProj = projectList.find(p => p.id === 'proj_grand_programme_2026') || null;
        const grandProjPhase = "Phase 1 : Diagnostic & Choix (3 problèmes réels)";

        // Axe C : Anglais A1 vers A2
        const englishLang = userLanguages.find(l => l.id === 'lang_english' || /anglais|english/i.test(l.name)) || DEFAULT_PROGRAM_ENGLISH;
        const englishPillars = englishLang.pillars || {
            vocab: { title: "Vocabulaire", duration: 10, doneToday: false },
            listening: { title: "Écoute", duration: 10, doneToday: false },
            pronunciation: { title: "Prononciation", duration: 10, doneToday: false },
            conversation: { title: "Conversation", duration: 15, doneToday: false }
        };
        const pilDoneCount = Object.values(englishPillars).filter(p => p && p.doneToday).length;

        // Axe D : 6 Livres
        const bookList = Array.isArray(state.books) ? state.books : [];
        const booksReadCount = bookList.filter(b => b.status === 'completed').length;
        const totalBooksCount = bookList.length || 6;

        // Axe E : Deux Pas Quotidiens
        const checkIn = state.todayCheckIn || {};
        const personalStep = checkIn.personalStep || { action: '', expectedResult: '', done: false };
        const professionalStep = checkIn.professionalStep || { action: '', expectedResult: '', done: false };

        const xpPercent = Math.min(100, ((state.userProfile?.gamification?.xp || 0) / (state.userProfile?.gamification?.nextLevelXp || 1000)) * 100);

        let html = `
<div class="bureau" data-univers="bureau">
    <!-- SIDEBAR -->
    <aside class="bureau-sidebar">
        <div class="bureau-brand">
            <div class="bureau-brand-icon"><i class="bi bi-lightning-charge-fill"></i></div>
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
                <div id="btn-profile" class="bureau-profile-btn" role="button" tabindex="0" title="Mon profil">
                    ${state.userProfile?.avatarPhoto ? `<img src="${escapeHtml(state.userProfile.avatarPhoto)}" class="bureau-avatar-img" alt="Avatar">` : escapeHtml((state.userProfile?.name || 'É').charAt(0).toUpperCase())}
                </div>
            </div>
        </header>

        <!-- GRILLE PRINCIPALE (NOTION STYLE) -->
        <div class="bureau-grid">
            
            <!-- BANDEAU DU PROGRAMME INTENSIF (18 NOV - 25 DÉC 2026) -->
            <div class="bureau-program-banner card bureau-grid-span-3">
                <div class="bureau-program-header">
                    <div class="bureau-program-title-wrap">
                        <div class="bureau-program-badge">
                            <i class="bi bi-fire"></i> Programme Intensif · 111h Total
                        </div>
                        <h2 class="bureau-program-title">Programme du 18 Novembre au 25 Décembre 2026</h2>
                        <span class="bureau-program-meta">
                            <strong>3h / jour strict (180 min)</strong> • J-${daysRemaining} (${daysElapsed} / ${totalProgramDays} jours) • Objectifs concrets & vérifiables
                        </span>
                    </div>
                    <div class="bureau-program-action-wrap">
                        <button type="button" id="btn-desktop-plan-program" class="btn btn-primary bureau-btn-plan-prog" title="Placer automatiquement les 5 blocs (180 min) dans mes créneaux libres d'aujourd'hui">
                            <i class="bi bi-lightning-charge-fill"></i> Planifier mes 3h aujourd'hui
                        </button>
                    </div>
                </div>

                <div class="bureau-program-progress-bar" title="Progression du programme : Jour ${daysElapsed} sur ${totalProgramDays}">
                    <div class="bureau-program-progress-fill" style="width: ${progressDaysPercent}%;"></div>
                </div>

                <!-- 5 AXES EN GRILLE COMPACTE -->
                <div class="bureau-program-axes-grid">
                    
                    <!-- AXE A : Formations & Certifications -->
                    <div class="bureau-program-axis-card">
                        <div class="bureau-program-axis-top">
                            <span class="bureau-program-axis-tag"><i class="bi bi-mortarboard"></i> Axe A · 50 min/j</span>
                            <span class="bureau-program-axis-count">${certDoneCount}/${certTotalCount}</span>
                        </div>
                        <h4 class="bureau-program-axis-name">Certifications & Formations</h4>
                        <p class="bureau-program-axis-desc">Cisco IoT, Kaggle ML, NVIDIA DL PyTorch</p>
                        <button type="button" class="bureau-program-axis-btn bureau-nav-item" data-view="academic">
                            Voir dans École &rarr;
                        </button>
                    </div>

                    <!-- AXE B : Grand Projet Innovant -->
                    <div class="bureau-program-axis-card">
                        <div class="bureau-program-axis-top">
                            <span class="bureau-program-axis-tag"><i class="bi bi-cpu"></i> Axe B · 45 min/j</span>
                            <span class="bureau-program-axis-count">6 Modules</span>
                        </div>
                        <h4 class="bureau-program-axis-name">Grand Projet Innovant</h4>
                        <p class="bureau-program-axis-desc">${escapeHtml(grandProjPhase)}</p>
                        <button type="button" class="bureau-program-axis-btn bureau-nav-item" data-view="academic">
                            Accéder au Projet &rarr;
                        </button>
                    </div>

                    <!-- AXE C : Anglais A1 vers A2 -->
                    <div class="bureau-program-axis-card">
                        <div class="bureau-program-axis-top">
                            <span class="bureau-program-axis-tag"><i class="bi bi-globe"></i> Axe C · 45 min/j</span>
                            <span class="bureau-program-axis-count">${pilDoneCount}/4 piliers</span>
                        </div>
                        <h4 class="bureau-program-axis-name">Anglais : A1 &rarr; A2</h4>
                        <p class="bureau-program-axis-desc">Vocabulaire, Écoute, Répétition, Conversation</p>
                        <button type="button" class="bureau-program-axis-btn bureau-nav-item" data-view="languages">
                            Pratiquer l'Anglais &rarr;
                        </button>
                    </div>

                    <!-- AXE D : 6 Livres Dév Perso -->
                    <div class="bureau-program-axis-card">
                        <div class="bureau-program-axis-top">
                            <span class="bureau-program-axis-tag"><i class="bi bi-book"></i> Axe D · 25 min/j</span>
                            <span class="bureau-program-axis-count">${booksReadCount}/${totalBooksCount} lus</span>
                        </div>
                        <h4 class="bureau-program-axis-name">6 Livres Dév. Perso</h4>
                        <p class="bureau-program-axis-desc">Covey, Clear, Carnegie x2, McKeown, Newport</p>
                        <button type="button" class="bureau-program-axis-btn bureau-nav-item" data-view="life">
                            Ouvrir mes Lectures &rarr;
                        </button>
                    </div>

                    <!-- AXE E : Deux Pas Quotidiens -->
                    <div class="bureau-program-axis-card">
                        <div class="bureau-program-axis-top">
                            <span class="bureau-program-axis-tag"><i class="bi bi-check2-circle"></i> Axe E · 15 min/j</span>
                            <span class="bureau-program-axis-count">${(personalStep.done ? 1 : 0) + (professionalStep.done ? 1 : 0)}/2 pas</span>
                        </div>
                        <h4 class="bureau-program-axis-name">Deux Pas Quotidiens</h4>
                        <p class="bureau-program-axis-desc">
                            👤 Perso: ${personalStep.done ? '✅ Fait' : '⏳ À faire'} · 💼 Pro: ${professionalStep.done ? '✅ Fait' : '⏳ À faire'}
                        </p>
                        <button type="button" class="bureau-program-axis-btn bureau-nav-item" data-view="bilan">
                            Faire mon Bilan &rarr;
                        </button>
                    </div>

                </div>
            </div>

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
                    <h3 class="card-title bureau-card-title-icon">
                        <i class="bi bi-globe"></i> Progrès langues
                    </h3>
                </div>
                <div class="card-body">
                    <div class="bureau-lang-list">
                        ${(() => {
                            const listToRender = (userLanguages && userLanguages.length > 0) ? userLanguages : [DEFAULT_PROGRAM_ENGLISH];
                            return listToRender.slice(0, 3).map((l) => {
                                const completed = l.tracking?.sessionsCompleted || 0;
                                const target = (l.plan?.sessionsPerWeek || 7) * 4;
                                const prog = target > 0 ? Math.min(100, Math.round((completed / target) * 100)) : 0;
                                const pil = l.pillars || {};
                                const pilCount = Object.keys(pil).length;
                                const pilDone = Object.values(pil).filter(p => p && p.doneToday).length;
                                return `
                                <div class="bureau-lang-item">
                                    <div class="bureau-lang-circle">
                                        ${prog}%
                                    </div>
                                    <div>
                                        <strong class="bureau-lang-title">${escapeHtml(l.icon || '🌐')} ${escapeHtml(l.title || l.name)}</strong>
                                        <span class="bureau-lang-sub">${escapeHtml(l.level || 'A1')} · ${completed} séance${completed > 1 ? 's' : ''} ${pilCount > 0 ? `· ${pilDone}/${pilCount} piliers faits` : ''}</span>
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

            <!-- 8. RAPPELS DU COACH -->
            <div class="card bureau-coach-reminders-card" id="desktop-coach-reminders" data-view="chat" title="Ouvrir le coach">
                <div class="card-header bureau-coach-reminders-header">
                    <h3 class="card-title bureau-card-title-icon">
                        <i class="bi bi-bell"></i> Rappels du coach
                    </h3>
                    <span class="badge bureau-coach-chat-badge">Chat &rarr;</span>
                </div>
                <div class="card-body">
                    <p class="bureau-coach-reminder-text">
                        ${coachReminderText}
                    </p>
                </div>
            </div>

            <!-- 9. LE COACH -->
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
    <div class="academic-modal-window bureau-backup-modal-window">
        <div class="academic-modal-header">
            <h3 class="academic-modal-title"><i class="bi bi-shield-check"></i> <span>Sauvegarde & Données</span></h3>
            <button id="backup-modal-close" class="academic-modal-close-btn" aria-label="Fermer">&times;</button>
        </div>
        <div class="academic-modal-body bureau-backup-modal-body">
            <p class="bureau-backup-modal-text">
                Toutes tes données (planning, cours, notes, examens, projets, sessions, habitudes, langues, chat) sont conservées en local sur cet appareil.
            </p>
            <div class="bureau-backup-actions-col">
                <button type="button" id="btn-export-data" class="btn btn-primary bureau-btn-export">
                    <i class="bi bi-download"></i> Exporter mes données (.json)
                </button>
                <div class="bureau-backup-divider">ou</div>
                <label for="input-import-data" class="btn btn-outline bureau-btn-import-label">
                    <i class="bi bi-upload"></i> Importer une sauvegarde (.json)
                </label>
                <input type="file" id="input-import-data" accept=".json" hidden>
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

        // Planification automatique du Programme 3h (180 min)
        const btnPlanProg = this.container.querySelector('#btn-desktop-plan-program');
        if (btnPlanProg) {
            btnPlanProg.addEventListener('click', async () => {
                Motion.buttonTap(btnPlanProg);
                try {
                    if (typeof this.app.scheduleDailyProgram180 === 'function') {
                        const res = await this.app.scheduleDailyProgram180();
                        if (res && res.success) {
                            alert(`🎯 Programme Intensif (180 min) :\n\n${res.message}`);
                            if (this.app.renderView) await this.app.renderView('planning');
                        } else {
                            alert(res?.reason || "Créneaux libres insuffisants pour placer les 180 min aujourd'hui.");
                        }
                    }
                } catch (e) {
                    alert("Erreur lors de la planification : " + e.message);
                }
            });
        }

        const coachRemindersCard = this.container.querySelector('#desktop-coach-reminders');
        if (coachRemindersCard) {
            coachRemindersCard.addEventListener('click', () => {
                if (this.app.renderView) this.app.renderView('chat');
            });
        }

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
            if (backupModal) {
                backupModal.classList.remove('hidden');
                Motion.modalOpen(backupModal);
            }
        };
        const closeBackup = () => {
            if (backupModal) backupModal.classList.add('hidden');
        };

        if (btnOpenBackup) btnOpenBackup.addEventListener('click', openBackup);
        if (btnCloseBackup) btnCloseBackup.addEventListener('click', closeBackup);
        if (btnProfile) btnProfile.addEventListener('click', () => { if (this.app.openProfileModal) this.app.openProfileModal(); });
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
