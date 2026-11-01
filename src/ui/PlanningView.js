import { escapeHtml } from '../utils/html.js';
import { parseLocalDate, timeToMinutes } from '../utils/dateUtils.js';
import { Motion } from './motion.js';

export class PlanningView {
    constructor(containerId, app) {
        this.container = typeof containerId === 'string' && typeof document !== 'undefined'
            ? document.getElementById(containerId)
            : (containerId || (typeof document !== 'undefined' ? document.getElementById('view-container') : null));
        this.app = app;

        // Mode d'affichage par défaut : 'week' ou 'month', avec persistance locale
        let savedMode = 'week';
        try {
            if (typeof localStorage !== 'undefined') {
                const stored = localStorage.getItem('planning_view_mode');
                if (stored === 'month' || stored === 'week') savedMode = stored;
            }
        } catch (_) {}
        this.viewMode = savedMode;

        const now = new Date();
        this.currentYear = now.getFullYear();
        this.currentMonth = now.getMonth();
        this.weekOffset = 0;
        this._userNavigatedMonth = false;

        // Filtres pour la vue mois
        this.filters = {
            school: true,
            life: true,
            lang: true
        };
    }

    render(state) {
        if (!this.container) return;
        if (typeof document !== 'undefined' && document.body) {
            document.body.className = 'theme-light';
            if (typeof document.body.setAttribute === 'function') {
                document.body.setAttribute('data-univers', 'planning');
            }
        }

        const now = state.selectedDate ? parseLocalDate(state.selectedDate) : (this.app.getPedagogicalDateObject ? this.app.getPedagogicalDateObject() : new Date());
        const currentDateStr = now.toLocaleDateString('fr-CA');
        const currentTimeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
        const rawEvents = state.calendarData?.events || [];
        const projects = state.calendarData?.projects || [];
        const assessments = state.calendarData?.assessments || [];

        // Synchronisation robuste du mois si l'utilisateur n'a pas navigué manuellement
        if (state.selectedDate && !this._userNavigatedMonth) {
            this.currentYear = now.getFullYear();
            this.currentMonth = now.getMonth();
        } else if (!this._userNavigatedMonth && rawEvents.length > 0) {
            const hasEventsThisMonth = rawEvents.some(e => {
                if (!e.date) return false;
                const d = parseLocalDate(e.date);
                return d.getFullYear() === this.currentYear && d.getMonth() === this.currentMonth;
            });
            if (!hasEventsThisMonth) {
                const firstEventDate = parseLocalDate(rawEvents[0].date);
                if (firstEventDate && !isNaN(firstEventDate.getTime())) {
                    this.currentYear = firstEventDate.getFullYear();
                    this.currentMonth = firstEventDate.getMonth();
                }
            }
        }

        // Fonctions de classification unifiées
        const isSchool = (e) => {
            if (!!e.subjectId) return true;
            if (!e.type) return false;
            const t = e.type.toLowerCase();
            return t === 'course' || t === 'cours' || t === 'td' || t === 'exam' || t === 'revision' || t === 'révision';
        };
        const isLang = (e) => (e.type && (e.type.toLowerCase() === 'langue' || e.type.toLowerCase() === 'language')) || (e.title && (e.title.toLowerCase().includes('anglais') || e.title.toLowerCase().includes('russe')));
        const isLife = (e) => !!e.projectId && !isSchool(e) && !isLang(e);

        // --- CALCUL SEMAINE ---
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay() + (now.getDay() === 0 ? -6 : 1) + (this.weekOffset * 7)); // Lundi
        const weekDays = [];
        for (let i = 0; i < 7; i++) {
            const d = new Date(startOfWeek);
            d.setDate(startOfWeek.getDate() + i);
            weekDays.push(d);
        }

        const formatter = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: '2-digit' });
        const monthFormatter = new Intl.DateTimeFormat('fr-FR', { month: '2-digit', year: 'numeric' });
        const semaineStr = `Semaine du ${startOfWeek.getDate().toString().padStart(2, '0')}/${monthFormatter.format(startOfWeek)}`;

        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        const weekStartStr = startOfWeek.toLocaleDateString('fr-CA');
        const weekEndStr = endOfWeek.toLocaleDateString('fr-CA');

        // --- CALCUL MOIS ---
        const monthNames = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
        const monthName = monthNames[this.currentMonth];
        const daysInMonth = new Date(this.currentYear, this.currentMonth + 1, 0).getDate();
        const firstDayIndex = new Date(this.currentYear, this.currentMonth, 1).getDay(); // 0 (DIM) à 6 (SAM)
        const todayStr = new Date().toLocaleDateString('fr-CA');

        // 1. Grille hebdomadaire (Timeline)
        const eventsHtml = rawEvents.filter(e => {
            if (!e.date || !e.startTime) return false;
            return e.date >= weekStartStr && e.date <= weekEndStr;
        }).map(e => {
            const dayIndex = weekDays.findIndex(d => d.toLocaleDateString('fr-CA') === e.date);
            if (dayIndex === -1) return '';

            const startParts = e.startTime.split(':');
            const startH = parseInt(startParts[0]);
            const startM = parseInt(startParts[1] || 0);
            if (startH < 7 || startH > 22) return '';

            let durationMinutes = e.targetDuration || 60;
            if (e.endTime) {
                const endParts = e.endTime.split(':');
                const endH = parseInt(endParts[0]);
                const endM = parseInt(endParts[1] || 0);
                durationMinutes = (endH * 60 + endM) - (startH * 60 + startM);
            }
            if (durationMinutes <= 0) durationMinutes = 60;

            const top = (startH - 7) * 51 + (startM / 60) * 51;
            const height = (durationMinutes / 60) * 51 - 2;

            const isSch = isSchool(e);
            const blockClass = isSch ? 'event-school' : (e.type === 'Force-N' ? 'event-force' : 'event-default');

            return `
            <div class="planning-event-block ${blockClass}" style="left: calc(60px + ${dayIndex} * ((100% - 60px) / 7) + 2px); width: calc(((100% - 60px) / 7) - 4px); top: ${top}px; height: ${height}px;">
                <div class="planning-event-block-header">
                    <strong class="planning-event-block-title">${escapeHtml(e.title || e.type)}</strong>
                    <div class="planning-event-block-actions">
                        ${isSch ? `<button type="button" class="btn-start-focus planning-icon-btn icon-focus" data-id="${escapeHtml(e.id)}" title="Démarrer une session">▶️</button>` : ''}
                        <button type="button" class="btn-edit-event planning-icon-btn" data-id="${escapeHtml(e.id)}" title="Modifier">✏️</button>
                        <button type="button" class="btn-delete-event planning-icon-btn icon-del" data-id="${escapeHtml(e.id)}" title="Supprimer">🗑️</button>
                    </div>
                </div>
                <span class="planning-event-block-time">${escapeHtml(e.startTime)} - ${escapeHtml(e.endTime || '')}</span>
            </div>
            `;
        }).join('');

        // Session en cours & Suite du programme
        const todayEvents = rawEvents.filter(e => e.date === currentDateStr);
        todayEvents.sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));

        let currentSessionHtml = '<div class="planning-side-empty">Aucune session en ce moment.</div>';
        let upcomingHtml = '<div class="planning-side-empty">Rien de prévu pour le reste de la journée.</div>';
        let aVenirHtml = '<div class="planning-side-empty">Aucun CC en vue.</div>';

        const upcomingList = [];
        let currentEvent = null;

        todayEvents.forEach(e => {
            if (!e.startTime) return;
            const startH = parseInt(e.startTime.split(':')[0]);
            const startM = parseInt(e.startTime.split(':')[1] || 0);

            let endH = startH + 1;
            let endM = startM;
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
            } else if (e.startTime > currentTimeStr) {
                upcomingList.push({ ...e, endTimeStr });
            }
        });

        if (currentEvent) {
            currentSessionHtml = `
            <div class="planning-current-box">
                <div class="planning-current-header">
                    <strong class="planning-current-title">${escapeHtml(currentEvent.title || currentEvent.type)}</strong>
                    <div class="planning-event-block-actions">
                        <button type="button" class="btn-edit-event planning-btn-icon-inline" data-id="${escapeHtml(currentEvent.id)}" title="Modifier">✏️</button>
                        <button type="button" class="btn-delete-event planning-btn-icon-inline danger" data-id="${escapeHtml(currentEvent.id)}" title="Supprimer">🗑️</button>
                    </div>
                </div>
                <div class="planning-current-time"><i class="bi bi-clock"></i> ${currentEvent.startTime} - ${currentEvent.endTimeStr}</div>
                <button type="button" class="btn-start-focus btn btn-primary" data-id="${escapeHtml(currentEvent.id)}">
                    <i class="bi bi-play-fill"></i> Démarrer une session
                </button>
            </div>`;
        }

        if (upcomingList.length > 0) {
            upcomingHtml = upcomingList.map(e => {
                let isSchoolEv = isSchool(e);
                const focusBtn = isSchoolEv ? `
                    <button type="button" class="btn-start-focus planning-btn-start-focus-inline" data-id="${escapeHtml(e.id)}" title="Démarrer une session">
                        <i class="bi bi-play-fill"></i> Démarrer une session
                    </button>
                ` : '';

                return `
                <div class="planning-upcoming-row">
                    <div class="planning-upcoming-title">${escapeHtml(e.title || e.type)}</div>
                    <div class="planning-upcoming-meta">
                        <span class="planning-upcoming-time">${e.startTime}</span>
                        ${focusBtn}
                        <button type="button" class="btn-edit-event planning-btn-icon-inline" data-id="${escapeHtml(e.id)}" title="Modifier">✏️</button>
                        <button type="button" class="btn-delete-event planning-btn-icon-inline danger" data-id="${escapeHtml(e.id)}" title="Supprimer">🗑️</button>
                    </div>
                </div>
                `;
            }).join('');
        }

        const next14Days = new Date(now);
        next14Days.setDate(now.getDate() + 14);
        const next14Str = next14Days.toLocaleDateString('fr-CA');
        const upcomingCCs = rawEvents.filter(e => {
            if (!e.date) return false;
            return e.date > currentDateStr && e.date <= next14Str && (e.type === 'Examen' || e.type === 'CC' || e.assessmentId != null || (e.title && e.title.toLowerCase().includes('cc')));
        });

        if (upcomingCCs.length > 0) {
            upcomingCCs.sort((a, b) => a.date.localeCompare(b.date));
            aVenirHtml = upcomingCCs.slice(0, 4).map(e => {
                const ed = parseLocalDate(e.date);
                const dateStr = ed.toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: 'short' });
                return `
                <div class="planning-cc-row">
                    <div class="planning-cc-title">${escapeHtml(e.title || e.type)}</div>
                    <div class="planning-cc-date">${dateStr}</div>
                </div>
                `;
            }).join('');
        }

        // --- CONTENU PRINCIPAL SELON LE MODE ---
        let mainViewContent = '';

        if (this.viewMode === 'month') {
            // Rendu Vue Mois
            const assessmentDate = (a) => a.targetDate || a.date || '';
            const futureAssessments = assessments.filter(a => assessmentDate(a) >= todayStr).sort((a,b) => assessmentDate(a).localeCompare(assessmentDate(b))).slice(0, 4);

            let lifeTasks = [];
            projects.forEach(p => {
                if (p.tasks) {
                    p.tasks.forEach(t => {
                        if (t.status !== 'completed' && t.status !== 'done') {
                            lifeTasks.push({ project: p.title, task: t.title, priority: p.priority || 'medium' });
                        }
                    });
                }
            });
            const topLifeTasks = lifeTasks.slice(0, 4);

            const futureLangEvents = rawEvents.filter(e => e.date >= todayStr && isLang(e)).sort((a,b) => {
                if(a.date === b.date) return (a.startTime || '').localeCompare(b.startTime || '');
                return a.date.localeCompare(b.date);
            }).slice(0, 4);

            mainViewContent = `
            <!-- FILTRES ET NAVIGATION MOIS -->
            <div class="planning-month-topbar">
                <div class="planning-filters">
                    <span class="planning-filter-label">Filtres :</span>
                    <button type="button" id="filter-school" class="btn btn-sm ${this.filters.school ? 'btn-primary' : 'btn-ghost'} planning-filter-pill">
                        <span class="planning-dot school"></span> École
                    </button>
                    <button type="button" id="filter-life" class="btn btn-sm ${this.filters.life ? 'btn-primary' : 'btn-ghost'} planning-filter-pill">
                        <span class="planning-dot life"></span> Vie
                    </button>
                    <button type="button" id="filter-lang" class="btn btn-sm ${this.filters.lang ? 'btn-primary' : 'btn-ghost'} planning-filter-pill">
                        <span class="planning-dot lang"></span> Langues
                    </button>
                </div>
                <div class="planning-topbar-actions">
                    <button type="button" id="btn-prev-month" class="btn btn-secondary btn-sm" title="Mois précédent"><i class="bi bi-chevron-left"></i></button>
                    <button type="button" id="btn-today-month" class="btn btn-ghost btn-sm" title="Ce mois-ci">Aujourd'hui</button>
                    <button type="button" id="btn-next-month" class="btn btn-secondary btn-sm" title="Mois suivant"><i class="bi bi-chevron-right"></i></button>
                </div>
            </div>

            <!-- GRILLE DU MOIS -->
            <div class="planning-card planning-month-card">
                <div class="planning-month-weekdays">
                    ${['DIM','LUN','MAR','MER','JEU','VEN','SAM'].map(d => `<div>${d}</div>`).join('')}
                </div>
                <div class="planning-month-grid">
                    ${[...Array(firstDayIndex)].map(() => `<div class="planning-empty-day-cell"></div>`).join('')}
                    ${[...Array(daysInMonth)].map((_, i) => {
                        const day = i + 1;
                        const dateIter = new Date(this.currentYear, this.currentMonth, day);
                        const dateStr = dateIter.toLocaleDateString('fr-CA');
                        const isCurrentDay = (dateStr === todayStr);

                        const dayEvents = rawEvents.filter(e => e.date === dateStr).filter(e => {
                            if (isLang(e) && !this.filters.lang) return false;
                            if (isLife(e) && !this.filters.life) return false;
                            if (isSchool(e) && !this.filters.school) return false;
                            return true;
                        }).sort((a,b) => (a.startTime || '').localeCompare(b.startTime || ''));

                        let pillsHtml = '';
                        dayEvents.slice(0, 4).forEach(e => {
                            let pillModifier = 'pill-school';
                            if (isLang(e)) pillModifier = 'pill-lang';
                            else if (isLife(e)) pillModifier = 'pill-life';

                            pillsHtml += `
                            <div class="calendar-event-pill ${pillModifier}" data-id="${escapeHtml(e.id)}" title="${escapeHtml(e.title || '')} (${escapeHtml(e.startTime || '')}-${escapeHtml(e.endTime || '')})">
                                <span class="calendar-event-pill-title">${escapeHtml(e.startTime || '')} ${escapeHtml(e.title || e.type || '')}</span>
                                <span class="calendar-event-pill-btns">
                                    <button type="button" class="btn-edit-event calendar-event-pill-btn" data-id="${escapeHtml(e.id)}" title="Modifier">✏️</button>
                                    <button type="button" class="btn-delete-event calendar-event-pill-btn" data-id="${escapeHtml(e.id)}" title="Supprimer">🗑️</button>
                                </span>
                            </div>`;
                        });
                        if (dayEvents.length > 4) {
                            pillsHtml += `<div class="planning-more-pills">+${dayEvents.length - 4} autres</div>`;
                        }

                        return `
                        <div class="planning-day-cell" data-date="${dateStr}" title="Cliquer pour ajouter un événement">
                            <div class="planning-day-cell-num ${isCurrentDay ? 'today' : ''}">${day}</div>
                            ${pillsHtml}
                        </div>`;
                    }).join('')}
                </div>
            </div>

            <!-- RECAPITULATIFS INFERIEURS -->
            <div class="planning-month-bottom-grid">
                <!-- COLONNE 1: Échéances École -->
                <div class="planning-card planning-summary-card">
                    <div class="planning-summary-header">
                        <strong class="planning-summary-label">Échéances École</strong>
                        <i class="bi bi-mortarboard planning-icon-school"></i>
                    </div>
                    <div class="planning-summary-list">
                        ${futureAssessments.length > 0 ? futureAssessments.map(a => {
                            const dParts = assessmentDate(a).split('-');
                            const day = dParts[2] || '';
                            return `
                            <div class="planning-summary-row">
                                <div class="planning-summary-badge school">${day}</div>
                                <div class="planning-summary-info">
                                    <strong class="planning-summary-item-title">${escapeHtml(a.title || a.name || '')}</strong>
                                    <span class="planning-summary-item-sub">Coef ${escapeHtml(a.coefficient || a.weight || 1)}</span>
                                </div>
                            </div>`;
                        }).join('') : '<div class="planning-side-empty">Aucune évaluation à venir.</div>'}
                    </div>
                </div>

                <!-- COLONNE 2: Échéances Vie -->
                <div class="planning-card planning-summary-card">
                    <div class="planning-summary-header">
                        <strong class="planning-summary-label">Échéances Vie</strong>
                        <i class="bi bi-heart planning-icon-life"></i>
                    </div>
                    <div class="planning-summary-list">
                        ${topLifeTasks.length > 0 ? topLifeTasks.map(t => `
                            <div class="planning-summary-row">
                                <div class="planning-summary-badge life"><i class="bi bi-star-fill"></i></div>
                                <div class="planning-summary-info">
                                    <strong class="planning-summary-item-title">${escapeHtml(t.task)}</strong>
                                    <span class="planning-summary-item-sub">${escapeHtml(t.project)}</span>
                                </div>
                            </div>
                        `).join('') : '<div class="planning-side-empty">Aucune tâche en cours.</div>'}
                    </div>
                </div>

                <!-- COLONNE 3: Sessions Langue -->
                <div class="planning-card planning-summary-card">
                    <div class="planning-summary-header">
                        <strong class="planning-summary-label">Sessions Langue</strong>
                        <i class="bi bi-globe planning-icon-lang"></i>
                    </div>
                    <div class="planning-summary-list">
                        ${futureLangEvents.length > 0 ? futureLangEvents.map(e => {
                            const dParts = (e.date || '').split('-');
                            const day = dParts[2] || '';
                            return `
                            <div class="planning-summary-row">
                                <div class="planning-summary-badge lang">${day}</div>
                                <div class="planning-summary-info">
                                    <strong class="planning-summary-item-title">${escapeHtml(e.title || '')}</strong>
                                    <span class="planning-summary-item-sub">${escapeHtml(e.startTime || '')} - ${escapeHtml(e.endTime || '')}</span>
                                </div>
                                <div class="planning-event-block-actions">
                                    <button type="button" class="btn-edit-event planning-btn-icon-inline" data-id="${escapeHtml(e.id)}" title="Modifier">✏️</button>
                                    <button type="button" class="btn-delete-event planning-btn-icon-inline danger" data-id="${escapeHtml(e.id)}" title="Supprimer">🗑️</button>
                                </div>
                            </div>`;
                        }).join('') : '<div class="planning-side-empty">Aucune session prévue.</div>'}
                    </div>
                </div>
            </div>
            `;
        } else {
            // Rendu Vue Semaine (par défaut)
            mainViewContent = `
            <div class="planning-nav-bar">
                <button type="button" id="btn-prev-week" class="btn btn-secondary btn-sm" title="Semaine précédente"><i class="bi bi-chevron-left"></i></button>
                <button type="button" id="btn-today-week" class="btn btn-ghost btn-sm" title="Cette semaine">Aujourd'hui</button>
                <button type="button" id="btn-next-week" class="btn btn-secondary btn-sm" title="Semaine suivante"><i class="bi bi-chevron-right"></i></button>
            </div>

            <div class="planning-week-layout">
                <!-- TIMELINE -->
                <div class="planning-card planning-timeline-wrapper">
                    <!-- HEADER DAYS -->
                    <div class="planning-timeline-header">
                        <div class="planning-timeline-corner"></div>
                        ${weekDays.map((d) => {
                            const isToday = d.toDateString() === now.toDateString();
                            const parts = formatter.formatToParts(d);
                            const weekdayName = parts.find(p => p.type === 'weekday').value;
                            const dayNum = parts.find(p => p.type === 'day').value;

                            return `
                            <div class="planning-day-col ${isToday ? 'is-today' : ''}">
                                <div class="planning-day-name">${weekdayName}</div>
                                <strong class="planning-day-num">${dayNum}</strong>
                            </div>
                            `;
                        }).join('')}
                    </div>

                    <!-- TIME BLOCKS GRID -->
                    <div class="planning-timeline-grid">
                        ${eventsHtml}
                        ${[7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22].map(hour => {
                            return `
                            <div class="planning-hour-row">
                                <div class="planning-hour-cell">
                                    ${hour.toString().padStart(2, '0')}:00
                                </div>
                                <div class="planning-slot-cell"></div>
                                <div class="planning-slot-cell"></div>
                                <div class="planning-slot-cell"></div>
                                <div class="planning-slot-cell"></div>
                                <div class="planning-slot-cell"></div>
                                <div class="planning-slot-cell"></div>
                                <div class="planning-slot-cell"></div>
                            </div>
                            `;
                        }).join('')}
                    </div>
                </div>

                <!-- RIGHT PANEL -->
                <div class="planning-side-panel">
                    <!-- SESSION ACTUELLE -->
                    <div class="planning-card planning-side-card">
                        <div class="planning-side-header">
                            <strong class="planning-side-label">Session Actuelle</strong>
                            <i class="bi bi-life-preserver text-tertiary"></i>
                        </div>
                        ${currentSessionHtml}
                    </div>

                    <!-- SUITE DU PROGRAMME -->
                    <div class="planning-card planning-side-card">
                        <div class="planning-side-header">
                            <strong class="planning-side-label">Suite du programme</strong>
                        </div>
                        ${upcomingHtml}
                    </div>

                    <!-- À VENIR -->
                    <div class="planning-card planning-side-card">
                        <div class="planning-side-header text-danger">
                            <div class="d-flex align-center gap-2">
                                <i class="bi bi-bell-fill"></i>
                                <strong class="planning-side-label text-danger">À Venir</strong>
                            </div>
                        </div>
                        ${aVenirHtml}
                    </div>
                </div>
            </div>
            `;
        }

        const subtitleText = this.viewMode === 'month' ? `${monthName} ${this.currentYear}` : semaineStr;

        let html = `
<div class="bureau planning-layout">
    <!-- SIDEBAR -->
    <div class="bureau-sidebar">
        <div class="bureau-brand">
            <div class="bureau-brand-icon">
                <i class="bi bi-check2-square"></i>
            </div>
            Learning OS
        </div>
        
        <!-- ONGLETS -->
        <div class="bureau-nav">
            <div class="bureau-nav-item" data-view="desktop">
                <i class="bi bi-house-door"></i> Bureau
            </div>
            <div class="bureau-nav-item active" data-view="planning">
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
        </div>
    </div>

    <!-- MAIN CONTENT -->
    <div class="bureau-content planning-content">
        <!-- TOPBAR -->
        <div class="planning-topbar">
            <div>
                <h1 class="planning-header-title">PLANNING</h1>
                <p class="planning-header-subtitle">${subtitleText}</p>
            </div>
            <div class="planning-topbar-actions">
                <!-- SELECTEUR DE VUE SEMAINE / MOIS -->
                <div class="planning-view-switcher">
                    <button type="button" class="planning-view-btn ${this.viewMode === 'week' ? 'active' : ''}" data-planning-mode="week">
                        <i class="bi bi-calendar3"></i> Semaine
                    </button>
                    <button type="button" class="planning-view-btn ${this.viewMode === 'month' ? 'active' : ''}" data-planning-mode="month">
                        <i class="bi bi-calendar-month"></i> Mois
                    </button>
                </div>

                <button id="btn-add-event-planning" class="planning-btn-add">
                    <i class="bi bi-plus-lg"></i> Ajouter un événement
                </button>
                <button id="btn-add-event-calendar" class="sr-only" hidden aria-hidden="true"></button>
                
                <button id="btn-import-timetable" class="planning-btn-import">
                    <i class="bi bi-file-earmark-arrow-up"></i> Importer l'emploi du temps
                </button>
                <input type="file" id="input-import-timetable" accept="application/pdf,image/*,.docx,.xlsx,.csv" class="sr-only" hidden>
                
                <div class="planning-user-profile">
                    <strong class="planning-user-name">${escapeHtml(state.userProfile?.name || 'Étudiant')}</strong>
                    <div class="planning-user-avatar">É</div>
                </div>
            </div>
        </div>

        ${mainViewContent}
    </div>
</div>

<!-- MODAL IMPORT EMPLOI DU TEMPS -->
<div id="timetable-modal" class="modal-backdrop" hidden>
    <div class="modal-box modal-lg">
        <div class="modal-header">
            <h3 id="timetable-modal-title" class="modal-title"><i class="bi bi-calendar-week"></i> Emploi du temps de la semaine</h3>
            <button type="button" id="timetable-modal-close" class="btn btn-ghost" aria-label="Fermer">&times;</button>
        </div>
        <div id="timetable-modal-content" class="modal-body"></div>
    </div>
</div>
`;

        this.container.innerHTML = html;

        // Animations Motion sobres
        Motion.fadeIn(this.container.querySelector('.planning-content') || this.container);
        if (this.viewMode === 'week') {
            const events = this.container.querySelectorAll('.planning-event-block');
            if (events.length > 0) Motion.staggerIn(events, { stagger: 0.02, duration: 0.2 });
        } else if (this.viewMode === 'month') {
            const pills = this.container.querySelectorAll('.calendar-event-pill');
            if (pills.length > 0) Motion.staggerIn(pills, { stagger: 0.015, duration: 0.2 });
        }

        // BINDINGS NAVIGATION SIDEBAR
        this.container.querySelectorAll('.bureau-nav-item').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const viewName = e.currentTarget.getAttribute('data-view');
                if (viewName) {
                    this.app.renderView(viewName);
                }
            });
        });

        // BINDINGS SELECTEUR DE VUE
        this.container.querySelectorAll('button[data-planning-mode]').forEach(btn => {
            btn.addEventListener('click', () => {
                const mode = btn.getAttribute('data-planning-mode');
                if (mode && mode !== this.viewMode) {
                    this.viewMode = mode;
                    try {
                        if (typeof localStorage !== 'undefined') {
                            localStorage.setItem('planning_view_mode', mode);
                        }
                    } catch (_) {}
                    this.render(state);
                }
            });
        });

        // BINDINGS NAVIGATION SEMAINE
        const btnPrevWeek = this.container.querySelector('#btn-prev-week');
        if (btnPrevWeek) {
            btnPrevWeek.addEventListener('click', () => {
                this.weekOffset--;
                this.render(state);
            });
        }
        const btnNextWeek = this.container.querySelector('#btn-next-week');
        if (btnNextWeek) {
            btnNextWeek.addEventListener('click', () => {
                this.weekOffset++;
                this.render(state);
            });
        }
        const btnTodayWeek = this.container.querySelector('#btn-today-week');
        if (btnTodayWeek) {
            btnTodayWeek.addEventListener('click', () => {
                this.weekOffset = 0;
                this.render(state);
            });
        }

        // BINDINGS NAVIGATION MOIS
        const btnPrevMonth = this.container.querySelector('#btn-prev-month');
        if (btnPrevMonth) {
            btnPrevMonth.addEventListener('click', () => {
                this._userNavigatedMonth = true;
                this.currentMonth--;
                if (this.currentMonth < 0) {
                    this.currentMonth = 11;
                    this.currentYear--;
                }
                this.render(state);
            });
        }
        const btnNextMonth = this.container.querySelector('#btn-next-month');
        if (btnNextMonth) {
            btnNextMonth.addEventListener('click', () => {
                this._userNavigatedMonth = true;
                this.currentMonth++;
                if (this.currentMonth > 11) {
                    this.currentMonth = 0;
                    this.currentYear++;
                }
                this.render(state);
            });
        }
        const btnTodayMonth = this.container.querySelector('#btn-today-month');
        if (btnTodayMonth) {
            btnTodayMonth.addEventListener('click', () => {
                this._userNavigatedMonth = false;
                const n = new Date();
                this.currentYear = n.getFullYear();
                this.currentMonth = n.getMonth();
                this.render(state);
            });
        }

        // BINDINGS FILTRES MOIS
        this.container.querySelector('#filter-school')?.addEventListener('click', () => {
            this.filters.school = !this.filters.school;
            this.render(state);
        });
        this.container.querySelector('#filter-life')?.addEventListener('click', () => {
            this.filters.life = !this.filters.life;
            this.render(state);
        });
        this.container.querySelector('#filter-lang')?.addEventListener('click', () => {
            this.filters.lang = !this.filters.lang;
            this.render(state);
        });

        // BINDING CLIC SUR CASE DU JOUR EN VUE MOIS
        this.container.querySelectorAll('.planning-day-cell').forEach(cell => {
            cell.addEventListener('click', (ev) => {
                if (ev.target.closest('button') || ev.target.closest('.calendar-event-pill')) return;
                const dStr = cell.getAttribute('data-date');
                if (dStr) {
                    this.app.openEventEditor({ date: dStr });
                }
            });
        });

        // BINDING IMPORT EMPLOI DU TEMPS
        this.attachTimetableImport();

        // CRUD Événements
        const btnAdd = this.container.querySelector('#btn-add-event-planning');
        if (btnAdd) {
            btnAdd.addEventListener('click', () => {
                Motion.buttonTap(btnAdd);
                this.app.openEventEditor({ date: currentDateStr });
            });
        }
        const btnAddCal = this.container.querySelector('#btn-add-event-calendar');
        if (btnAddCal) {
            btnAddCal.addEventListener('click', () => {
                this.app.openEventEditor({ date: currentDateStr });
            });
        }

        this.container.querySelectorAll('.btn-edit-event').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const eventId = e.currentTarget.getAttribute('data-id');
                const eventObj = rawEvents.find(ev => ev.id === eventId);
                if (eventObj) {
                    this.app.openEventEditor(eventObj);
                }
            });
        });

        this.container.querySelectorAll('.btn-delete-event').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const eventId = e.currentTarget.getAttribute('data-id');
                if (!eventId) return;
                if (typeof window !== 'undefined' && window.confirm && !window.confirm("Supprimer cet événement ?")) {
                    return;
                }
                await this.app.deleteCalendarEvent(eventId);
            });
        });

        this.container.querySelectorAll('.btn-start-focus').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                Motion.buttonTap(e.currentTarget);
                const eventId = e.currentTarget.getAttribute('data-id');
                const eventObj = rawEvents.find(ev => String(ev.id) === String(eventId));
                if (this.app.startFocusSession) {
                    this.app.startFocusSession(eventObj);
                } else if (this.app.renderView) {
                    this.app.renderView('focus', eventObj);
                }
            });
        });
    }

    /**
     * Import de l'emploi du temps : choix de méthode (fichier, texte, grille), aperçu à valider, enregistrement.
     */
    attachTimetableImport() {
        const btn = this.container.querySelector('#btn-import-timetable');
        const input = this.container.querySelector('#input-import-timetable');
        const modal = this.container.querySelector('#timetable-modal');
        const content = this.container.querySelector('#timetable-modal-content');
        const btnClose = this.container.querySelector('#timetable-modal-close');
        if (!btn || !input || !modal || !content) return;

        let saved = false;
        const close = () => {
            modal.hidden = true;
            modal.style.display = 'none';
            if (this.app) this.app.pendingTimetablePreview = null;
            if (saved) this.app.renderView('planning');
        };
        const open = () => {
            modal.hidden = false;
            modal.style.display = 'flex';
            Motion.modalOpen(modal);
        };

        if (btnClose) btnClose.addEventListener('click', close);
        modal.addEventListener('click', (e) => { if (e.target === modal) close(); });

        const ui = {
            close,
            open,
            onSaved: () => { saved = true; },
            switchTab: (tabKey) => this.renderTimetableTabs(modal, content, input, ui, tabKey)
        };

        btn.addEventListener('click', () => {
            Motion.buttonTap(btn);
            this.renderTimetableTabs(modal, content, input, ui, 'file');
        });

        input.addEventListener('change', async () => {
            const file = input.files && input.files[0];
            if (!file) return;
            await this.handleTimetableFile(file, modal, content, input, ui);
        });
    }

    renderTimetableTabs(modal, content, input, ui, activeTab = 'file') {
        ui.open();
        content.innerHTML = `
            <div class="tabs" role="tablist">
                <button type="button" class="tab-item ${activeTab === 'file' ? 'active' : ''}" data-tab="file"><i class="bi bi-file-earmark-arrow-up"></i> Fichier</button>
                <button type="button" class="tab-item ${activeTab === 'text' ? 'active' : ''}" data-tab="text"><i class="bi bi-clipboard"></i> Coller un texte</button>
                <button type="button" class="tab-item ${activeTab === 'grid' ? 'active' : ''}" data-tab="grid"><i class="bi bi-grid-3x3"></i> Saisie en grille</button>
            </div>
            <div id="tt-tab-container"></div>
        `;

        const tabContainer = content.querySelector('#tt-tab-container');
        content.querySelectorAll('.tab-item').forEach(btn => {
            btn.addEventListener('click', () => {
                const tab = btn.getAttribute('data-tab');
                this.renderTimetableTabs(modal, content, input, ui, tab);
            });
        });

        if (activeTab === 'file') {
            this.renderFileTab(tabContainer, modal, content, input, ui);
        } else if (activeTab === 'text') {
            this.renderTextTab(tabContainer, modal, content, input, ui);
        } else if (activeTab === 'grid') {
            this.renderGridTab(tabContainer, modal, content, input, ui);
        }
    }

    renderFileTab(container, modal, content, input, ui) {
        container.innerHTML = `
            <p class="modal-hint">Dépose ton emploi du temps (PDF, Image, Word .docx, Excel .xlsx, CSV). Les fichiers Word, Excel et CSV sont lus localement sans clé Gemini.</p>
            <div class="file-dropzone" id="tt-file-dropzone" tabindex="0">
                <i class="bi bi-cloud-arrow-up planning-modal-dropzone-icon"></i>
                <strong>Dépose un fichier ou clique pour choisir</strong>
                <p class="modal-hint">PDF, PNG, JPEG, WebP, DOCX, XLSX, CSV (max 15 Mo)</p>
            </div>
            <div id="tt-file-feedback" class="mt-2"></div>
            <div class="modal-actions">
                <button type="button" class="btn btn-ghost tt-cancel">Annuler</button>
            </div>
        `;

        const dropzone = container.querySelector('#tt-file-dropzone');
        const feedback = container.querySelector('#tt-file-feedback');
        container.querySelector('.tt-cancel').addEventListener('click', ui.close);

        dropzone.addEventListener('click', () => {
            input.value = '';
            input.click();
        });

        ['dragenter', 'dragover'].forEach(name => {
            dropzone.addEventListener(name, (e) => {
                e.preventDefault();
                dropzone.classList.add('dragover');
            });
        });

        ['dragleave', 'drop'].forEach(name => {
            dropzone.addEventListener(name, (e) => {
                e.preventDefault();
                dropzone.classList.remove('dragover');
            });
        });

        dropzone.addEventListener('drop', async (e) => {
            const files = e.dataTransfer && e.dataTransfer.files;
            if (files && files[0]) {
                await this.handleTimetableFile(files[0], modal, content, input, ui, feedback);
            }
        });
    }

    async handleTimetableFile(file, modal, content, input, ui, feedbackEl = null) {
        const feedback = feedbackEl || content.querySelector('#tt-file-feedback') || content;
        const name = file.name || '';
        const ext = name.split('.').pop().toLowerCase();
        const isPdfOrImage = ext === 'pdf' || ['png', 'jpg', 'jpeg', 'webp', 'heic', 'heif'].includes(ext) || (file.type && file.type.startsWith('image/'));
        const isCsv = ext === 'csv';
        const isSpreadsheet = ext === 'xlsx' || ext === 'xls';
        const isDocx = ext === 'docx';

        const canLlm = this.app && this.app.timetableImporter && this.app.timetableImporter.canExtract();

        if (isPdfOrImage && !canLlm) {
            feedback.innerHTML = `
                <div class="alert alert-warning">
                    <i class="bi bi-exclamation-triangle"></i>
                    <div>
                        <strong>Pour lire un PDF scanné ou une photo, configure une clé Gemini dans Réglages, ou colle le texte / utilise la grille.</strong>
                    </div>
                </div>
                <div class="btn-group mt-2">
                    <button type="button" class="btn btn-secondary tt-btn-go-text"><i class="bi bi-clipboard"></i> Coller le texte</button>
                    <button type="button" class="btn btn-secondary tt-btn-go-grid"><i class="bi bi-grid-3x3"></i> Utiliser la grille</button>
                    <button type="button" class="btn btn-secondary tt-btn-go-csv"><i class="bi bi-file-earmark-spreadsheet"></i> Fichier CSV / XLSX / DOCX</button>
                    <button type="button" class="btn btn-ghost tt-btn-go-settings"><i class="bi bi-gear"></i> Réglages</button>
                </div>
            `;
            const btnText = feedback.querySelector('.tt-btn-go-text');
            if (btnText) btnText.addEventListener('click', () => ui.switchTab('text'));
            const btnGrid = feedback.querySelector('.tt-btn-go-grid');
            if (btnGrid) btnGrid.addEventListener('click', () => ui.switchTab('grid'));
            const btnCsv = feedback.querySelector('.tt-btn-go-csv');
            if (btnCsv) btnCsv.addEventListener('click', () => { input.accept = '.csv,.xlsx,.xls,.docx'; input.value = ''; input.click(); });
            const btnSettings = feedback.querySelector('.tt-btn-go-settings');
            if (btnSettings) btnSettings.addEventListener('click', () => { ui.close(); if (this.app.renderView) this.app.renderView('chat'); });
            return;
        }

        feedback.innerHTML = `<div class="alert alert-info"><i class="bi bi-hourglass-split spin"></i> Lecture de « ${escapeHtml(file.name)} » en cours…</div>`;

        try {
            let preview;
            if (isCsv) {
                const text = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result);
                    reader.onerror = () => reject(new Error('Fichier CSV illisible.'));
                    reader.readAsText(file, 'utf-8');
                });
                preview = await this.app.extractTimetableFromSource({ type: 'csv', text, fileName: file.name, sizeBytes: file.size });
            } else if (isSpreadsheet) {
                const buffer = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result);
                    reader.onerror = () => reject(new Error('Fichier Excel illisible.'));
                    reader.readAsArrayBuffer(file);
                });
                preview = await this.app.extractTimetableFromSource({ type: 'xlsx', buffer, fileName: file.name, sizeBytes: file.size });
            } else if (isDocx) {
                const buffer = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result);
                    reader.onerror = () => reject(new Error('Fichier Word illisible.'));
                    reader.readAsArrayBuffer(file);
                });
                preview = await this.app.extractTimetableFromSource({ type: 'docx', buffer, fileName: file.name, sizeBytes: file.size });
            } else {
                const dataUrl = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result);
                    reader.onerror = () => reject(new Error('Fichier illisible.'));
                    reader.readAsDataURL(file);
                });
                const base64 = String(dataUrl).split(',')[1] || '';
                const mimeType = file.type || (/\.pdf$/i.test(file.name) ? 'application/pdf' : '');
                preview = await this.app.extractTimetable({ base64, mimeType, fileName: file.name, sizeBytes: file.size });
            }

            this.renderTimetablePreview(preview, content, ui);
        } catch (err) {
            feedback.innerHTML = `
                <div class="alert alert-warning">
                    <i class="bi bi-exclamation-triangle"></i>
                    <div>${escapeHtml(err.message)}</div>
                </div>
            `;
        }
    }

    renderTextTab(container, modal, content, input, ui) {
        container.innerHTML = `
            <p class="modal-hint">Colle ici le texte de ton emploi du temps pour l'analyser directement sans clé Gemini.</p>
            <div class="alert alert-info">
                <i class="bi bi-info-circle"></i>
                <div>
                    <strong>Exemple de format :</strong><br>
                    <code>Lundi 8h-10h : Structures algébriques et applications (Amphi A)</code><br>
                    <code>Mardi 10h-12h : Approche orientée objet (Salle TP 2)</code><br>
                    <code>Jeudi 14h-16h : Analyse numérique</code>
                </div>
            </div>
            <div class="form-group mt-2">
                <textarea id="tt-text-input" class="form-input" rows="7" placeholder="Colle ton emploi du temps ici..."></textarea>
            </div>
            <div id="tt-text-feedback" class="mt-1"></div>
            <div class="modal-actions">
                <button type="button" class="btn btn-ghost tt-cancel">Annuler</button>
                <button type="button" class="btn btn-primary tt-parse-text-btn"><i class="bi bi-search"></i> Voir l'aperçu</button>
            </div>
        `;

        const textarea = container.querySelector('#tt-text-input');
        const feedback = container.querySelector('#tt-text-feedback');
        container.querySelector('.tt-cancel').addEventListener('click', ui.close);

        container.querySelector('.tt-parse-text-btn').addEventListener('click', async () => {
            const raw = textarea.value.trim();
            if (!raw) {
                feedback.innerHTML = `<div class="alert alert-warning"><i class="bi bi-exclamation-triangle"></i> Colle d'abord le texte de ton emploi du temps.</div>`;
                return;
            }
            try {
                feedback.innerHTML = `<div class="alert alert-info"><i class="bi bi-hourglass-split spin"></i> Analyse du texte…</div>`;
                const preview = await this.app.extractTimetableFromSource({ type: 'text', text: raw });
                this.renderTimetablePreview(preview, content, ui);
            } catch (err) {
                const unread = err.unreadLines && err.unreadLines.length > 0 ? `<br><small>${err.unreadLines.length} ligne(s) non lue(s) : ${escapeHtml(err.unreadLines.join(' ; '))}</small>` : '';
                feedback.innerHTML = `<div class="alert alert-warning"><i class="bi bi-exclamation-triangle"></i> <div>${escapeHtml(err.message)}${unread}</div></div>`;
            }
        });
    }

    renderGridTab(container, modal, content, input, ui) {
        container.innerHTML = `
            <p class="modal-hint">Saisis directement tes séances de la semaine dans la grille ci-dessous.</p>
            <div class="table-container planning-modal-grid-container">
                <table class="tt-grid-table">
                    <thead>
                        <tr>
                            <th>Jour</th>
                            <th>Début</th>
                            <th>Fin</th>
                            <th>Matière</th>
                            <th>Salle</th>
                            <th>Type</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody id="tt-grid-tbody"></tbody>
                </table>
            </div>
            <div class="mt-2">
                <button type="button" class="btn btn-secondary btn-sm" id="tt-grid-add-row"><i class="bi bi-plus-lg"></i> Ajouter une ligne</button>
            </div>
            <div id="tt-grid-feedback" class="mt-2"></div>
            <div class="modal-actions">
                <button type="button" class="btn btn-ghost tt-cancel">Annuler</button>
                <button type="button" class="btn btn-primary" id="tt-grid-preview-btn"><i class="bi bi-check2"></i> Voir l'aperçu</button>
            </div>
        `;

        const tbody = container.querySelector('#tt-grid-tbody');
        const feedback = container.querySelector('#tt-grid-feedback');
        container.querySelector('.tt-cancel').addEventListener('click', ui.close);

        const days = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
        const types = [
            { id: 'course', label: 'Cours' },
            { id: 'td', label: 'TD' },
            { id: 'tp', label: 'TP' },
            { id: 'exam', label: 'Examen' }
        ];

        const addRow = (data = {}) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>
                    <select class="tt-row-day form-input tt-grid-input">
                        ${days.map(d => `<option value="${d}" ${data.day === d ? 'selected' : ''}>${d}</option>`).join('')}
                    </select>
                </td>
                <td><input type="time" class="tt-row-start form-input tt-grid-input" value="${data.startTime || '08:00'}"></td>
                <td><input type="time" class="tt-row-end form-input tt-grid-input" value="${data.endTime || '10:00'}"></td>
                <td><input type="text" class="tt-row-title form-input tt-grid-input" placeholder="ex. Algèbre" value="${escapeHtml(data.title || '')}"></td>
                <td><input type="text" class="tt-row-room form-input tt-grid-input" placeholder="ex. Amphi A" value="${escapeHtml(data.room || '')}"></td>
                <td>
                    <select class="tt-row-type form-input tt-grid-input">
                        ${types.map(t => `<option value="${t.id}" ${(data.type || 'course') === t.id ? 'selected' : ''}>${t.label}</option>`).join('')}
                    </select>
                </td>
                <td class="text-center">
                    <button type="button" class="btn btn-danger btn-sm tt-row-del" title="Supprimer la ligne">🗑️</button>
                </td>
            `;
            tr.querySelector('.tt-row-del').addEventListener('click', () => {
                tr.remove();
                if (tbody.children.length === 0) addRow();
            });
            tbody.appendChild(tr);
        };

        addRow({ day: 'Lundi', startTime: '08:00', endTime: '10:00', title: '' });
        addRow({ day: 'Mardi', startTime: '10:00', endTime: '12:00', title: '' });

        container.querySelector('#tt-grid-add-row').addEventListener('click', () => addRow());

        container.querySelector('#tt-grid-preview-btn').addEventListener('click', async () => {
            feedback.innerHTML = '';
            const trs = [...tbody.querySelectorAll('tr')];
            const rows = trs.map(tr => ({
                day: tr.querySelector('.tt-row-day').value,
                startTime: tr.querySelector('.tt-row-start').value,
                endTime: tr.querySelector('.tt-row-end').value,
                title: tr.querySelector('.tt-row-title').value.trim(),
                room: tr.querySelector('.tt-row-room').value.trim(),
                type: tr.querySelector('.tt-row-type').value
            })).filter(r => r.title || r.room);

            if (rows.length === 0) {
                feedback.innerHTML = `<div class="alert alert-warning"><i class="bi bi-exclamation-triangle"></i> Saisis au moins une séance avec un intitulé.</div>`;
                return;
            }

            for (let i = 0; i < rows.length; i++) {
                const r = rows[i];
                if (!r.title) {
                    feedback.innerHTML = `<div class="alert alert-warning"><i class="bi bi-exclamation-triangle"></i> Renseigne la matière pour la séance du ${r.day}.</div>`;
                    return;
                }
                const startMin = timeToMinutes(r.startTime);
                const endMin = timeToMinutes(r.endTime);
                if (endMin <= startMin) {
                    feedback.innerHTML = `<div class="alert alert-warning"><i class="bi bi-exclamation-triangle"></i> Ligne ${i + 1} (${r.day}) : l'heure de fin (${r.endTime}) doit être après l'heure de début (${r.startTime}).</div>`;
                    return;
                }
            }

            try {
                feedback.innerHTML = `<div class="alert alert-info"><i class="bi bi-hourglass-split spin"></i> Génération de l'aperçu…</div>`;
                const preview = await this.app.extractTimetableFromSource({ type: 'grid', gridRows: rows });
                this.renderTimetablePreview(preview, content, ui);
            } catch (err) {
                feedback.innerHTML = `<div class="alert alert-warning"><i class="bi bi-exclamation-triangle"></i> ${escapeHtml(err.message)}</div>`;
            }
        });
    }

    renderTimetablePreview(preview, content, ui) {
        const subjects = (this.app.state.academicSubjects || []).slice()
            .sort((a, b) => (a.semesterId === preview.semesterId ? 0 : 1) - (b.semesterId === preview.semesterId ? 0 : 1) || String(a.name).localeCompare(String(b.name)));
        const fmt = (d) => { if (!d) return '?'; const x = parseLocalDate(d); return x.toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: '2-digit' }); };

        const hasHourlyVolume = (preview.rows || []).some(r =>
            (r.hoursDone !== null && r.hoursDone !== undefined) ||
            (r.hoursTotal !== null && r.hoursTotal !== undefined)
        );

        const flagLabels = {
            unmapped: 'matière non reconnue',
            to_check: 'matière à vérifier',
            missing_hours: hasHourlyVolume ? 'volume horaire manquant' : 'horaires de séance manquants',
            hours_inconsistent: 'heures incohérentes',
            date_mismatch: 'date incohérente',
            out_of_week: 'hors semaine',
            overlap_in_timetable: 'chevauchement',
            times_inverted: 'horaire invalide'
        };
        const groups = [...new Set(['Groupe 1', 'Groupe 2'].concat(preview.groupsFound || []))];
        const rowsHtml = preview.rows.map(r => {
            const flags = (r.flags || []).filter(f => {
                if (f === 'missing_hours' && (!hasHourlyVolume || (r.startTime && r.endTime))) return false;
                return !!flagLabels[f];
            }).map(f => flagLabels[f]);
            const options = [`<option value="">— non reliée —</option>`].concat(subjects.map(s =>
                `<option value="${escapeHtml(s.id)}" ${s.id === r.subjectId ? 'selected' : ''}>${escapeHtml(s.code ? s.code + ' · ' : '')}${escapeHtml(s.name)}</option>`)).join('');
            const hoursCol = hasHourlyVolume ? `
                <td class="tt-cell-hours">${r.hoursDone !== null && r.hoursDone !== undefined ? escapeHtml(r.hoursDone) : '?'} h / ${r.hoursTotal !== null && r.hoursTotal !== undefined ? escapeHtml(r.hoursTotal) : '?'} h</td>
            ` : '';
            return `
                <tr data-row="${escapeHtml(r.id)}" class="${r.status === 'invalid' ? 'planning-modal-row-invalid' : ''}">
                    <td><input type="checkbox" class="tt-include" ${r.include ? 'checked' : ''} ${r.status === 'invalid' ? 'disabled' : ''}></td>
                    <td class="tt-cell-time">${escapeHtml(fmt(r.date))}<br><span class="text-muted">${escapeHtml(r.startTime || '?')}–${escapeHtml(r.endTime || '?')}</span></td>
                    <td><strong>${escapeHtml(r.title || '?')}</strong>${r.teacher ? `<br><span class="text-sm text-muted">${escapeHtml(r.teacher)}</span>` : ''}${r.room ? `<br><span class="text-sm text-muted">📍 ${escapeHtml(r.room)}</span>` : ''}${flags.length ? `<br><span class="planning-flag-warning">⚠ ${escapeHtml(flags.join(', '))}</span>` : ''}</td>
                    ${hoursCol}
                    <td><select class="tt-subject form-input form-select-sm">${options}</select>${r.componentName ? `<br><span class="text-sm text-muted">${escapeHtml(r.componentName)}</span>` : ''}</td>
                </tr>`;
        }).join('');

        const unreadWarningHtml = preview.unreadLines && preview.unreadLines.length > 0 ? `
            <div class="alert alert-warning mb-2">
                <i class="bi bi-exclamation-triangle"></i>
                <div>
                    <strong>${preview.unreadLines.length} ligne(s) non lue(s) :</strong>
                    ${escapeHtml(preview.unreadLines.join(' ; '))}
                </div>
            </div>` : '';

        content.innerHTML = `
            <div class="tt-preview-meta">
                <div>${preview.weekStart ? `Semaine du <strong>${escapeHtml(fmt(preview.weekStart))}</strong> au <strong>${escapeHtml(fmt(preview.weekEnd))}</strong>` : 'Semaine non reconnue'}</div>
                <label class="tt-group-label">Groupe :
                    <select class="tt-group form-input form-select-sm">
                        ${groups.map(g => `<option value="${escapeHtml(g)}" ${g === preview.group ? 'selected' : ''}>${escapeHtml(g)}</option>`).join('')}
                    </select>
                </label>
            </div>
            ${preview.replacesExistingImport ? `<div class="alert alert-warning mb-2"><i class="bi bi-arrow-repeat"></i> Cette semaine a déjà été importée : ses cours seront remplacés.</div>` : ''}
            ${unreadWarningHtml}
            ${(preview.warnings || []).filter(w => !w.includes('ligne(s) non lue(s)')).map(w => `<div class="alert alert-warning mb-1"><i class="bi bi-exclamation-triangle"></i> ⚠ ${escapeHtml(w)}</div>`).join('')}
            <p class="modal-hint my-2">Vérifie chaque ligne, coche les séances à ajouter, corrige la matière si besoin, puis valide.</p>
            <div class="table-container planning-modal-preview-table-wrap">
                <table class="data-table">
                    <thead><tr><th></th><th>Jour</th><th>Cours</th>${hasHourlyVolume ? '<th>Heures</th>' : ''}<th>Matière</th></tr></thead>
                    <tbody>${rowsHtml || `<tr><td colspan="${hasHourlyVolume ? 5 : 4}" class="text-muted p-3">Aucune séance pour ce groupe.</td></tr>`}</tbody>
                </table>
            </div>
            <div class="tt-error mt-2"></div>
            <div class="modal-actions">
                <button type="button" class="btn btn-secondary tt-back me-auto"><i class="bi bi-arrow-left"></i> Retour</button>
                <button type="button" class="btn btn-ghost tt-cancel">Annuler</button>
                <button type="button" class="btn btn-primary tt-validate" ${preview.rows.length === 0 ? 'disabled' : ''}>Valider</button>
            </div>`;

        const groupSelect = content.querySelector('.tt-group');
        if (groupSelect) groupSelect.addEventListener('change', async () => {
            const updated = await this.app.changeTimetableGroup(preview, groupSelect.value);
            this.renderTimetablePreview(updated, content, ui);
        });

        const btnBack = content.querySelector('.tt-back');
        if (btnBack) btnBack.addEventListener('click', () => {
            this.renderTimetableTabs(content.closest('#timetable-modal'), content, this.container.querySelector('#input-import-timetable'), ui, 'file');
        });

        content.querySelector('.tt-cancel').addEventListener('click', ui.close);
        content.querySelector('.tt-validate').addEventListener('click', async () => {
            const rows = [...content.querySelectorAll('tr[data-row]')].map(tr => ({
                id: tr.getAttribute('data-row'),
                include: !!(tr.querySelector('.tt-include') && tr.querySelector('.tt-include').checked),
                subjectId: tr.querySelector('.tt-subject') ? tr.querySelector('.tt-subject').value : undefined
            }));
            try {
                const res = await this.app.applyTimetableImport(preview, { rows });
                ui.onSaved();
                const extra = [];
                if (res.replaced) extra.push(`${res.replaced} ancien(s) cours de cette semaine remplacé(s).`);
                if (res.unmapped && res.unmapped.length) extra.push(`Non relié(s) au cursus : ${res.unmapped.join(', ')}.`);
                if (res.overlaps && res.overlaps.length) extra.push(`Chevauchement(s) avec ton agenda : ${res.overlaps.map(o => `${o.course.title} / ${o.other.title} (${o.course.date})`).join(' ; ')}.`);
                content.innerHTML = `
                    <div class="text-center p-4">
                        <i class="bi bi-check-circle tt-success-icon"></i>
                        <strong>${escapeHtml(res.count)} cours enregistré(s)</strong> pour la semaine du ${escapeHtml(fmt(res.weekStart))}.
                        <p class="modal-hint mt-2">Le coach suit maintenant l'avancement de tes cours.</p>
                        ${extra.map(x => `<p class="planning-flag-warning mt-1">${escapeHtml(x)}</p>`).join('')}
                        <div class="modal-actions justify-center border-0 mt-4">
                            <button type="button" class="btn btn-primary tt-done">Fermer</button>
                        </div>
                    </div>`;
                content.querySelector('.tt-done').addEventListener('click', ui.close);
            } catch (err) {
                const box = content.querySelector('.tt-error');
                if (box) box.textContent = err.message;
            }
        });
    }
}
