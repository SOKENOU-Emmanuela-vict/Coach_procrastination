import { escapeHtml } from '../utils/html.js';
import { parseLocalDate } from '../utils/dateUtils.js';
export class PlanningView {
    constructor(containerId, app) {
        this.container = typeof containerId === 'string' && typeof document !== 'undefined' ? document.getElementById(containerId) : (containerId || (typeof document !== 'undefined' ? document.getElementById('view-container') : null));
        this.app = app;
    }
    
    render(state) {
        if (typeof document !== 'undefined' && document.body) {
            document.body.className = 'theme-light';
        }

        const now = state.selectedDate ? parseLocalDate(state.selectedDate) : (this.app.getPedagogicalDateObject ? this.app.getPedagogicalDateObject() : new Date());
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay() + (now.getDay() === 0 ? -6 : 1)); // Lundi

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
        // Comparaison sur des chaînes YYYY-MM-DD locales (new Date('YYYY-MM-DD') = minuit UTC, et startOfWeek garde l'heure courante)
        const weekStartStr = startOfWeek.toLocaleDateString('fr-CA');
        const weekEndStr = endOfWeek.toLocaleDateString('fr-CA');
        
        const rawEvents = state.calendarData?.events || [];
        const eventsHtml = rawEvents.filter(e => {
            if (!e.date || !e.startTime) return false;
            return e.date >= weekStartStr && e.date <= weekEndStr;
        }).map(e => {
            const dayIndex = weekDays.findIndex(d => d.toLocaleDateString('fr-CA') === e.date);
            if (dayIndex === -1) return '';

            const startParts = e.startTime.split(':');
            const startH = parseInt(startParts[0]);
            const startM = parseInt(startParts[1] || 0);

            if (startH < 7 || startH > 22) return ''; // Outside visible grid

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

            let isSchool = !!e.subjectId;
            if (!isSchool && e.type) {
                const t = e.type.toLowerCase();
                isSchool = t === 'course' || t === 'cours' || t === 'td' || t === 'exam' || t === 'revision' || t === 'révision';
            }
            const bgColor = isSchool ? '#0ea5e9' : (e.type === 'Force-N' ? '#ef4444' : '#10b981');

            return `
            <div style="position: absolute; left: calc(60px + ${dayIndex} * ((100% - 60px) / 7) + 2px); width: calc(((100% - 60px) / 7) - 4px); top: ${top}px; height: ${height}px; background: ${bgColor}; color: white; border-radius: 6px; padding: 4px 6px; font-size: 11px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1); z-index: 10;">
                <div style="display:flex; justify-content:space-between; align-items:center; gap:2px;">
                    <strong style="display:block; text-overflow:ellipsis; white-space:nowrap; overflow:hidden; flex:1;">${escapeHtml(e.title || e.type)}</strong>
                    <div style="display:inline-flex; gap:2px;">
                        ${isSchool ? `<button type="button" class="btn-start-focus" data-id="${escapeHtml(e.id)}" title="Démarrer une session" style="background:transparent; border:none; color:#a7f3d0; cursor:pointer; font-size:10px; padding:0; line-height:1;">▶️</button>` : ''}
                        <button type="button" class="btn-edit-event" data-id="${escapeHtml(e.id)}" title="Modifier" style="background:transparent; border:none; color:white; cursor:pointer; font-size:10px; padding:0; line-height:1;">✏️</button>
                        <button type="button" class="btn-delete-event" data-id="${escapeHtml(e.id)}" title="Supprimer" style="background:transparent; border:none; color:#fca5a5; cursor:pointer; font-size:10px; padding:0; line-height:1;">🗑️</button>
                    </div>
                </div>
                <span style="opacity:0.8; font-size:10px;">${escapeHtml(e.startTime)} - ${escapeHtml(e.endTime || '')}</span>
            </div>
            `;
        }).join('');

        const currentDateStr = now.toLocaleDateString('fr-CA');
        const currentTimeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
        
        const todayEvents = rawEvents.filter(e => e.date === currentDateStr);
        todayEvents.sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));

        let currentSessionHtml = '<div style="text-align:center; padding:20px 0; color:var(--text-muted); font-size:14px;">Aucune session en ce moment.</div>';
        let upcomingHtml = '<div style="color:var(--text-muted); font-size:14px;">Rien de prévu pour le reste de la journée.</div>';
        let aVenirHtml = '<div style="color:var(--text-muted); font-size:14px;">Aucun CC en vue.</div>';

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
            <div style="background: rgba(14, 165, 233, 0.1); border: 1px solid var(--accent-primary); border-radius: 8px; padding: 15px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:5px;">
                    <strong style="color:var(--accent-primary);">${escapeHtml(currentEvent.title || currentEvent.type)}</strong>
                    <div style="display:inline-flex; gap:6px;">
                        <button type="button" class="btn-edit-event" data-id="${escapeHtml(currentEvent.id)}" title="Modifier" style="background:transparent; border:none; color:var(--accent-primary); cursor:pointer; font-size:12px; padding:0;">✏️</button>
                        <button type="button" class="btn-delete-event" data-id="${escapeHtml(currentEvent.id)}" title="Supprimer" style="background:transparent; border:none; color:#ef4444; cursor:pointer; font-size:12px; padding:0;">🗑️</button>
                    </div>
                </div>
                <div style="font-size:12px; color:var(--text-main); margin-bottom:10px;"><i class="bi bi-clock"></i> ${currentEvent.startTime} - ${currentEvent.endTimeStr}</div>
                <button type="button" class="btn-start-focus btn btn-primary" data-id="${escapeHtml(currentEvent.id)}" style="background:var(--accent-primary); color:white; border:none; padding:6px 12px; border-radius:6px; cursor:pointer; font-size:12px; font-weight:600; display:inline-flex; align-items:center; gap:6px;">
                    <i class="bi bi-play-fill"></i> Démarrer une session
                </button>
            </div>`;
        }

        if (upcomingList.length > 0) {
            upcomingHtml = upcomingList.map(e => {
                let isSchoolEv = !!e.subjectId;
                if (!isSchoolEv && e.type) {
                    const t = e.type.toLowerCase();
                    isSchoolEv = t === 'course' || t === 'cours' || t === 'td' || t === 'exam' || t === 'revision' || t === 'révision' || t !== 'perso';
                }
                const focusBtn = isSchoolEv ? `
                    <button type="button" class="btn-start-focus" data-id="${escapeHtml(e.id)}" title="Démarrer une session" style="background:rgba(14,165,233,0.15); color:var(--accent-primary); border:1px solid var(--accent-primary); padding:3px 8px; border-radius:5px; cursor:pointer; font-size:11px; font-weight:600; display:inline-flex; align-items:center; gap:4px;">
                        <i class="bi bi-play-fill"></i> Démarrer une session
                    </button>
                ` : '';

                return `
                <div style="display:flex; justify-content:space-between; align-items:center; padding: 10px 0; border-bottom: 1px solid var(--border-color); gap:8px;">
                    <div style="font-size:13px; font-weight:500; color:var(--text-main); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; flex:1;">${escapeHtml(e.title || e.type)}</div>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <span style="font-size:12px; color:var(--text-muted);">${e.startTime}</span>
                        ${focusBtn}
                        <button type="button" class="btn-edit-event" data-id="${escapeHtml(e.id)}" title="Modifier" style="background:transparent; border:none; color:var(--accent-primary); cursor:pointer; font-size:12px; padding:0;">✏️</button>
                        <button type="button" class="btn-delete-event" data-id="${escapeHtml(e.id)}" title="Supprimer" style="background:transparent; border:none; color:#ef4444; cursor:pointer; font-size:12px; padding:0;">🗑️</button>
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
                <div style="display:flex; justify-content:space-between; padding: 10px 0; border-bottom: 1px solid var(--border-color);">
                    <div style="font-size:13px; font-weight:500; color:#ef4444; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(e.title || e.type)}</div>
                    <div style="font-size:12px; color:var(--text-muted);">${dateStr}</div>
                </div>
                `;
            }).join('');
        }

        let html = `
<div class="bureau" style="display:flex; height:100vh;">
    <!-- SIDEBAR -->
    <div class="bureau-sidebar" style="width: 250px; background: var(--bg-sidebar); border-right: 1px solid var(--border-color); padding: 20px; display: flex; flex-direction: column;">
        <div style="font-size:24px; font-weight:bold; margin-bottom:40px; display:flex; align-items:center; gap:10px;">
            <div style="width:30px; height:30px; border-radius:8px; background:var(--bg-main); border:1px solid var(--border-color); display:flex; align-items:center; justify-content:center; color:var(--accent-primary);">
                <i class="bi bi-check2-square"></i>
            </div>
            Learning OS
        </div>
        
        <!-- ONGLETS -->
        <div style="display:flex; flex-direction:column; gap:5px; flex-grow:1; padding-right:15px;">
            <div class="bureau-nav-item" data-view="desktop" style="display:flex; align-items:center; gap:12px; cursor:pointer; padding:12px 15px; color:var(--text-muted); font-weight:500;">
                <i class="bi bi-house-door" style="font-size:18px;"></i> Bureau
            </div>
            <div class="bureau-nav-item active" data-view="planning" style="display:flex; align-items:center; gap:12px; cursor:pointer; background:rgba(14, 165, 233, 0.1); border-left:4px solid var(--accent-primary); border-radius:0 8px 8px 0; padding:12px 15px 12px 11px; color:var(--text-main); font-weight:600;">
                <i class="bi bi-calendar3" style="font-size:18px; color:var(--accent-primary);"></i> Planning
            </div>
            <div class="bureau-nav-item" data-view="calendar" style="display:flex; align-items:center; gap:12px; cursor:pointer; padding:12px 15px; color:var(--text-muted); font-weight:500;">
                <i class="bi bi-calendar-month" style="font-size:18px;"></i> Calendrier
            </div>
            <div class="bureau-nav-item" data-view="academic" style="display:flex; align-items:center; gap:12px; cursor:pointer; padding:12px 15px; color:var(--text-muted); font-weight:500;">
                <i class="bi bi-mortarboard" style="font-size:18px;"></i> École
            </div>
            <div class="bureau-nav-item" data-view="languages" style="display:flex; align-items:center; gap:12px; cursor:pointer; padding:12px 15px; color:var(--text-muted); font-weight:500;">
                <i class="bi bi-globe" style="font-size:18px;"></i> Langues
            </div>
            <div class="bureau-nav-item" data-view="life" style="display:flex; align-items:center; gap:12px; cursor:pointer; padding:12px 15px; color:var(--text-muted); font-weight:500;">
                <i class="bi bi-heart" style="font-size:18px;"></i> Vie
            </div>
            <div class="bureau-nav-item" data-view="chat" style="display:flex; align-items:center; gap:12px; cursor:pointer; padding:12px 15px; color:var(--text-muted); font-weight:500;">
                <i class="bi bi-robot" style="font-size:18px;"></i> Coach
            </div>
            <div class="bureau-nav-item" data-view="dashboard" style="display:flex; align-items:center; gap:12px; cursor:pointer; padding:12px 15px; color:var(--text-muted); font-weight:500;">
                <i class="bi bi-speedometer2" style="font-size:18px;"></i> Tableau de bord
            </div>
            <div class="bureau-nav-item" data-view="weekly" style="display:flex; align-items:center; gap:12px; cursor:pointer; padding:12px 15px; color:var(--text-muted); font-weight:500;">
                <i class="bi bi-journal-check" style="font-size:18px;"></i> Hebdo
            </div>
            <div class="bureau-nav-item" data-view="portfolio" style="display:flex; align-items:center; gap:12px; cursor:pointer; padding:12px 15px; color:var(--text-muted); font-weight:500;">
                <i class="bi bi-award" style="font-size:18px;"></i> Portfolio
            </div>
        </div>
    </div>

    <!-- MAIN CONTENT -->
    <div class="bureau-content" style="flex: 1; padding: 30px; overflow-y: auto; background: var(--bg-main);">
        <!-- TOPBAR -->
        <div class="bureau-topbar" style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 30px;">
            <div>
                <h1 style="font-size: 24px; font-weight: 700; color:var(--text-main); letter-spacing:1px; margin:0;">PLANNING HEBDO</h1>
                <p style="color: var(--text-muted); font-size:14px; margin:5px 0 0 0;">${semaineStr}</p>
            </div>
            <div class="bureau-topbar-actions" style="display:flex; gap:12px; align-items:center;">
                <button id="btn-add-event-planning" style="background:#00f2fe; color:#0f2027; border:none; padding:10px 16px; border-radius:8px; font-weight:bold; cursor:pointer; font-size:13px; display:inline-flex; align-items:center; gap:6px;"><i class="bi bi-plus-lg"></i> Ajouter un événement</button>
                <button id="btn-import-timetable" style="background:var(--accent-primary); color:white; border:none; padding:10px 16px; border-radius:8px; font-weight:bold; cursor:pointer; font-size:13px;"><i class="bi bi-file-earmark-arrow-up"></i> Importer l'emploi du temps</button>
                <input type="file" id="input-import-timetable" accept="application/pdf,image/*,.docx,.xlsx,.csv" style="display:none;">
                <div style="text-align:right;">
                    <strong style="display:block; font-size:14px; color:var(--text-main);">${escapeHtml(state.userProfile?.name || 'Étudiant')}</strong>
                </div>
                <div class="bureau-profile-avatar" style="width:40px; height:40px; border-radius:12px; background:var(--accent-primary); display:flex; align-items:center; justify-content:center; font-weight:bold; color:white; font-size:18px;">
                    É
                </div>
            </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 300px; gap: 30px;">
            
            <!-- TIMELINE -->
            <div class="bureau-card" style="background: var(--bg-card); border-radius: 12px; border: 1px solid var(--border-color); overflow: hidden; padding:0;">
                
                <!-- HEADER DAYS -->
                <div style="display:grid; grid-template-columns: 60px repeat(7, 1fr); border-bottom: 1px solid var(--border-color); background: #f8fafc;">
                    <div style="border-right: 1px solid var(--border-color);"></div>
                    ${weekDays.map((d) => {
                        const isToday = d.toDateString() === now.toDateString();
                        const parts = formatter.formatToParts(d);
                        const weekdayName = parts.find(p => p.type === 'weekday').value;
                        const dayNum = parts.find(p => p.type === 'day').value;
                        const colorStyle = isToday ? 'color:var(--accent-primary);' : 'color:var(--text-muted);';
                        const numStyle = isToday ? 'color:var(--accent-primary);' : 'color:var(--text-main);';
                        const bgStyle = isToday ? 'background: rgba(14, 165, 233, 0.1);' : '';
                        
                        return `
                        <div style="text-align:center; padding: 15px 0; border-right: 1px solid var(--border-color); ${bgStyle}">
                            <div style="font-size:11px; font-weight:bold; ${colorStyle} text-transform:uppercase;">${weekdayName}</div>
                            <strong style="font-size:18px; ${numStyle}">${dayNum}</strong>
                        </div>
                        `;
                    }).join('')}
                </div>

                <!-- TIME BLOCKS GRID -->
                <div style="display:flex; flex-direction:column; position: relative;">
                    ${eventsHtml}
                    ${[7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22].map(hour => {
                        return `
                        <div style="display:grid; grid-template-columns: 60px repeat(7, 1fr); border-bottom: 1px solid var(--border-color); height: 51px; box-sizing: border-box;">
                            <div style="border-right: 1px solid var(--border-color); text-align:right; padding: 5px 10px; font-size:11px; color:var(--text-muted);">
                                ${hour.toString().padStart(2, '0')}:00
                            </div>
                            <div style="border-right: 1px solid var(--border-color);"></div>
                            <div style="border-right: 1px solid var(--border-color);"></div>
                            <div style="border-right: 1px solid var(--border-color);"></div>
                            <div style="border-right: 1px solid var(--border-color); background: rgba(14, 165, 233, 0.02);"></div>
                            <div style="border-right: 1px solid var(--border-color);"></div>
                            <div style="border-right: 1px solid var(--border-color);"></div>
                            <div></div>
                        </div>
                        `;
                    }).join('')}
                </div>
            </div>

            <!-- RIGHT PANEL -->
            <div style="display:flex; flex-direction:column; gap:20px;">
                
                <!-- SESSION ACTUELLE -->
                <div class="bureau-card" style="background: var(--bg-card); border-radius: 12px; border: 1px solid var(--border-color); padding:20px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
                        <strong style="font-size:13px; color:var(--text-muted); text-transform:uppercase; letter-spacing:1px;">Session Actuelle</strong>
                        <i class="bi bi-life-preserver" style="color:var(--text-muted);"></i>
                    </div>
                    ${currentSessionHtml}
                </div>

                <!-- SUITE DU PROGRAMME -->
                <div class="bureau-card" style="background: var(--bg-card); border-radius: 12px; border: 1px solid var(--border-color); padding:20px;">
                    <div style="margin-bottom:20px;">
                        <strong style="font-size:13px; color:var(--text-muted); text-transform:uppercase; letter-spacing:1px;">Suite du programme</strong>
                    </div>
                    ${upcomingHtml}
                </div>

                <!-- À VENIR -->
                <div class="bureau-card" style="background: var(--bg-card); border-radius: 12px; border: 1px solid var(--border-color); padding:20px;">
                    <div style="display:flex; align-items:center; gap:8px; margin-bottom:20px; color:#ef4444;">
                        <i class="bi bi-bell-fill"></i>
                        <strong style="font-size:13px; text-transform:uppercase; letter-spacing:1px;">À Venir</strong>
                    </div>
                    ${aVenirHtml}
                </div>

            </div>

        </div>
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

        // BINDINGS
        this.container.querySelectorAll('.bureau-nav-item').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const viewName = e.currentTarget.getAttribute('data-view');
                if (viewName) {
                    this.app.renderView(viewName);
                }
            });
        });

        this.attachTimetableImport();

        // CRUD Événements sans IA
        const btnAdd = this.container.querySelector('#btn-add-event-planning');
        if (btnAdd) {
            btnAdd.addEventListener('click', () => {
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
                <i class="bi bi-cloud-arrow-up" style="font-size:36px; color:var(--accent-primary); display:block; margin-bottom:8px;"></i>
                <strong>Dépose un fichier ou clique pour choisir</strong>
                <p class="modal-hint">PDF, PNG, JPEG, WebP, DOCX, XLSX, CSV (max 15 Mo)</p>
            </div>
            <div id="tt-file-feedback" style="margin-top:12px;"></div>
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

        // Règle Y1-C (d) : Sans clé, si l'utilisateur charge un PDF scanné ou une image
        if (isPdfOrImage && !canLlm) {
            feedback.innerHTML = `
                <div class="alert alert-warning">
                    <i class="bi bi-exclamation-triangle"></i>
                    <div>
                        <strong>Pour lire un PDF scanné ou une photo, configure une clé Gemini dans Réglages, ou colle le texte / utilise la grille.</strong>
                    </div>
                </div>
                <div class="btn-group" style="margin-top:12px; display:flex; flex-wrap:wrap; gap:8px;">
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
                // PDF / image avec clé Gemini
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
            <div class="form-group" style="margin-top:12px;">
                <textarea id="tt-text-input" class="form-input" rows="7" placeholder="Colle ton emploi du temps ici..."></textarea>
            </div>
            <div id="tt-text-feedback" style="margin-top:8px;"></div>
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
            <div class="table-container" style="max-height:280px; overflow-y:auto;">
                <table class="tt-grid-table">
                    <thead>
                        <tr>
                            <th style="width:110px;">Jour</th>
                            <th style="width:90px;">Début</th>
                            <th style="width:90px;">Fin</th>
                            <th>Matière</th>
                            <th style="width:100px;">Salle</th>
                            <th style="width:90px;">Type</th>
                            <th style="width:40px;"></th>
                        </tr>
                    </thead>
                    <tbody id="tt-grid-tbody"></tbody>
                </table>
            </div>
            <div style="margin-top:10px; display:flex; gap:8px;">
                <button type="button" class="btn btn-secondary btn-sm" id="tt-grid-add-row"><i class="bi bi-plus-lg"></i> Ajouter une ligne</button>
            </div>
            <div id="tt-grid-feedback" style="margin-top:10px;"></div>
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
                <td style="text-align:center;">
                    <button type="button" class="btn btn-danger btn-sm tt-row-del" title="Supprimer la ligne" style="padding:2px 6px;">🗑️</button>
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
        const flagLabels = { unmapped: 'matière non reconnue', to_check: 'matière à vérifier', missing_hours: 'heures illisibles', hours_inconsistent: 'heures incohérentes',
            date_mismatch: 'date incohérente', out_of_week: 'hors semaine', overlap_in_timetable: 'chevauchement', times_inverted: 'horaire invalide' };
        const groups = [...new Set(['Groupe 1', 'Groupe 2'].concat(preview.groupsFound || []))];
        const rowsHtml = preview.rows.map(r => {
            const flags = (r.flags || []).filter(f => flagLabels[f]).map(f => flagLabels[f]);
            const options = [`<option value="">— non reliée —</option>`].concat(subjects.map(s =>
                `<option value="${escapeHtml(s.id)}" ${s.id === r.subjectId ? 'selected' : ''}>${escapeHtml(s.code ? s.code + ' · ' : '')}${escapeHtml(s.name)}</option>`)).join('');
            return `
                <tr data-row="${escapeHtml(r.id)}" style="border-bottom:1px solid var(--border-color); ${r.status === 'invalid' ? 'opacity:0.5;' : ''}">
                    <td style="padding:8px 6px;"><input type="checkbox" class="tt-include" ${r.include ? 'checked' : ''} ${r.status === 'invalid' ? 'disabled' : ''}></td>
                    <td style="padding:8px 6px; white-space:nowrap; font-size:12px;">${escapeHtml(fmt(r.date))}<br><span style="color:var(--text-muted);">${escapeHtml(r.startTime || '?')}–${escapeHtml(r.endTime || '?')}</span></td>
                    <td style="padding:8px 6px; font-size:13px;"><strong>${escapeHtml(r.title || '?')}</strong>${r.teacher ? `<br><span style="font-size:11px; color:var(--text-muted);">${escapeHtml(r.teacher)}</span>` : ''}${r.room ? `<br><span style="font-size:11px; color:var(--text-muted);">📍 ${escapeHtml(r.room)}</span>` : ''}${flags.length ? `<br><span style="font-size:11px; color:#f59e0b;">⚠ ${escapeHtml(flags.join(', '))}</span>` : ''}</td>
                    <td style="padding:8px 6px; white-space:nowrap; font-size:12px;">${r.hoursDone !== null && r.hoursDone !== undefined ? escapeHtml(r.hoursDone) : '?'} h / ${r.hoursTotal !== null && r.hoursTotal !== undefined ? escapeHtml(r.hoursTotal) : '?'} h</td>
                    <td style="padding:8px 6px;"><select class="tt-subject" style="max-width:200px; padding:6px; background:var(--bg-card); color:var(--text-main); border:1px solid var(--border-color); border-radius:8px; font-size:12px;">${options}</select>${r.componentName ? `<br><span style="font-size:11px; color:var(--text-muted);">${escapeHtml(r.componentName)}</span>` : ''}</td>
                </tr>`;
        }).join('');

        const unreadWarningHtml = preview.unreadLines && preview.unreadLines.length > 0 ? `
            <div class="alert alert-warning" style="margin-bottom:8px;">
                <i class="bi bi-exclamation-triangle"></i>
                <div>
                    <strong>${preview.unreadLines.length} ligne(s) non lue(s) :</strong>
                    ${escapeHtml(preview.unreadLines.join(' ; '))}
                </div>
            </div>` : '';

        content.innerHTML = `
            <div class="tt-preview-meta">
                <div style="font-size:14px;">${preview.weekStart ? `Semaine du <strong>${escapeHtml(fmt(preview.weekStart))}</strong> au <strong>${escapeHtml(fmt(preview.weekEnd))}</strong>` : 'Semaine non reconnue'}</div>
                <label style="font-size:13px; color:var(--text-muted);">Groupe :
                    <select class="tt-group form-input" style="padding:6px; display:inline-block; width:auto;">
                        ${groups.map(g => `<option value="${escapeHtml(g)}" ${g === preview.group ? 'selected' : ''}>${escapeHtml(g)}</option>`).join('')}
                    </select>
                </label>
            </div>
            ${preview.replacesExistingImport ? `<div class="alert alert-warning" style="margin-bottom:8px;"><i class="bi bi-arrow-repeat"></i> Cette semaine a déjà été importée : ses cours seront remplacés.</div>` : ''}
            ${unreadWarningHtml}
            ${(preview.warnings || []).filter(w => !w.includes('ligne(s) non lue(s)')).map(w => `<div class="alert alert-warning" style="margin-bottom:4px;"><i class="bi bi-exclamation-triangle"></i> ⚠ ${escapeHtml(w)}</div>`).join('')}
            <p class="modal-hint" style="margin:6px 0 10px 0;">Vérifie chaque ligne, coche les séances à ajouter, corrige la matière si besoin, puis valide.</p>
            <div class="table-container" style="max-height:300px; overflow-y:auto;">
                <table class="data-table">
                    <thead><tr style="text-align:left; font-size:11px; color:var(--text-muted); text-transform:uppercase;"><th></th><th>Jour</th><th>Cours</th><th>Heures</th><th>Matière</th></tr></thead>
                    <tbody>${rowsHtml || `<tr><td colspan="5" style="padding:12px; color:var(--text-muted);">Aucune séance pour ce groupe.</td></tr>`}</tbody>
                </table>
            </div>
            <div class="tt-error" style="color:#ef4444; font-size:13px; margin-top:10px;"></div>
            <div class="modal-actions">
                <button type="button" class="btn btn-secondary tt-back" style="margin-right:auto;"><i class="bi bi-arrow-left"></i> Retour</button>
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
                    <div style="text-align:center; padding:20px;">
                        <i class="bi bi-check-circle" style="font-size:36px; color:#10b981; display:block; margin-bottom:10px;"></i>
                        <strong>${escapeHtml(res.count)} cours enregistré(s)</strong> pour la semaine du ${escapeHtml(fmt(res.weekStart))}.
                        <p class="modal-hint" style="margin-top:6px;">Le coach suit maintenant l'avancement de tes cours.</p>
                        ${extra.map(x => `<p style="font-size:12px; color:#f59e0b; margin-top:4px;">${escapeHtml(x)}</p>`).join('')}
                        <div class="modal-actions" style="justify-content:center; border:none; margin-top:20px;">
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
