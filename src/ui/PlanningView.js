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
                <div style="font-size:12px; color:var(--text-main);"><i class="bi bi-clock"></i> ${currentEvent.startTime} - ${currentEvent.endTimeStr}</div>
            </div>`;
        }

        if (upcomingList.length > 0) {
            upcomingHtml = upcomingList.map(e => `
            <div style="display:flex; justify-content:space-between; align-items:center; padding: 10px 0; border-bottom: 1px solid var(--border-color);">
                <div style="font-size:13px; font-weight:500; color:var(--text-main); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; flex:1;">${escapeHtml(e.title || e.type)}</div>
                <div style="display:flex; align-items:center; gap:8px;">
                    <span style="font-size:12px; color:var(--text-muted);">${e.startTime}</span>
                    <button type="button" class="btn-edit-event" data-id="${escapeHtml(e.id)}" title="Modifier" style="background:transparent; border:none; color:var(--accent-primary); cursor:pointer; font-size:12px; padding:0;">✏️</button>
                    <button type="button" class="btn-delete-event" data-id="${escapeHtml(e.id)}" title="Supprimer" style="background:transparent; border:none; color:#ef4444; cursor:pointer; font-size:12px; padding:0;">🗑️</button>
                </div>
            </div>
            `).join('');
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
            <div class="bureau-nav-item" data-view="academic" style="display:flex; align-items:center; gap:12px; cursor:pointer; padding:12px 15px; color:var(--text-muted); font-weight:500;">
                <i class="bi bi-mortarboard" style="font-size:18px;"></i> School
            </div>
            <div class="bureau-nav-item" data-view="languages" style="display:flex; align-items:center; gap:12px; cursor:pointer; padding:12px 15px; color:var(--text-muted); font-weight:500;">
                <i class="bi bi-globe" style="font-size:18px;"></i> Langues
            </div>
            <div class="bureau-nav-item" data-view="life" style="display:flex; align-items:center; gap:12px; cursor:pointer; padding:12px 15px; color:var(--text-muted); font-weight:500;">
                <i class="bi bi-star" style="font-size:18px;"></i> Life
            </div>
            <div class="bureau-nav-item" data-view="chat" style="display:flex; align-items:center; gap:12px; cursor:pointer; padding:12px 15px; color:var(--text-muted); font-weight:500;">
                <i class="bi bi-robot" style="font-size:18px;"></i> Coach
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
                <button id="btn-import-timetable" style="background:var(--accent-primary); color:white; border:none; padding:10px 16px; border-radius:8px; font-weight:bold; cursor:pointer; font-size:13px;"><i class="bi bi-file-earmark-arrow-up"></i> Importer l'emploi du temps (PDF)</button>
                <input type="file" id="input-import-timetable" accept="application/pdf,image/*" style="display:none;">
                <div style="text-align:right;">
                    <strong style="display:block; font-size:14px; color:var(--text-main);">${escapeHtml(state.userProfile?.name || 'Étudiant')}</strong>
                    <span style="color:var(--text-muted); font-size:12px; cursor:pointer;">Déconnexion</span>
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
        <!-- MODAL IMPORT EMPLOI DU TEMPS (même gabarit que la fenêtre de la vue Académique) -->
        <div id="timetable-modal" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.6); z-index:9999; align-items:center; justify-content:center;">
            <div style="background:var(--bg-main); width:90%; max-width:760px; max-height:80vh; border-radius:12px; border:1px solid var(--border-color); display:flex; flex-direction:column; overflow:hidden; box-shadow:0 10px 30px rgba(0,0,0,0.5);">
                <div style="padding:15px 20px; border-bottom:1px solid var(--border-color); display:flex; justify-content:space-between; align-items:center; background:var(--bg-card);">
                    <h3 id="timetable-modal-title" style="margin:0; font-size:18px; color:var(--text-main);"><i class="bi bi-calendar-week"></i> Emploi du temps de la semaine</h3>
                    <button id="timetable-modal-close" style="background:transparent; border:none; color:var(--text-muted); font-size:20px; cursor:pointer;">&times;</button>
                </div>
                <div id="timetable-modal-content" style="padding:20px; overflow-y:auto; flex-grow:1; color:var(--text-main);"></div>
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
    }

    /**
     * Import de l'emploi du temps : fichier (PDF ou photo) → lecture par l'IA → aperçu à valider → enregistrement.
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
            modal.style.display = 'none';
            if (saved) this.app.renderView('planning');
        };
        if (btnClose) btnClose.addEventListener('click', close);
        modal.addEventListener('click', (e) => { if (e.target === modal) close(); });

        const message = (html) => { content.innerHTML = html; modal.style.display = 'flex'; };
        const btnStyle = 'background:var(--accent-primary); color:white; border:none; padding:10px 20px; border-radius:8px; font-weight:bold; cursor:pointer;';
        const btnGhost = 'background:transparent; color:var(--text-muted); border:1px solid var(--border-color); padding:10px 20px; border-radius:8px; font-weight:bold; cursor:pointer;';

        btn.addEventListener('click', () => { input.value = ''; input.click(); });

        input.addEventListener('change', async () => {
            const file = input.files && input.files[0];
            if (!file) return;
            saved = false;
            message(`<div style="text-align:center; padding:20px; color:var(--text-muted);"><i class="bi bi-hourglass-split" style="font-size:32px; color:var(--accent-primary); display:block; margin-bottom:10px;"></i>Lecture de « ${escapeHtml(file.name)} » par l'IA… (quelques secondes)</div>`);
            try {
                const dataUrl = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result);
                    reader.onerror = () => reject(new Error('Fichier illisible.'));
                    reader.readAsDataURL(file);
                });
                const base64 = String(dataUrl).split(',')[1] || '';
                const mimeType = file.type || (/\.pdf$/i.test(file.name) ? 'application/pdf' : '');
                const preview = await this.app.extractTimetable({ base64, mimeType, fileName: file.name, sizeBytes: file.size });
                this.renderTimetablePreview(preview, content, { btnStyle, btnGhost, close, onSaved: () => { saved = true; } });
            } catch (err) {
                message(`<div style="padding:10px; color:#ef4444;">${escapeHtml(err.message)}</div>
                    ${err.code === 'NO_LLM' ? `<p style="color:var(--text-muted); font-size:13px;">Ajoute ta clé Gemini dans les réglages de l'app, puis réessaie.</p>` : ''}
                    <div style="text-align:right; margin-top:15px;"><button class="tt-close" style="${btnGhost}">Fermer</button></div>`);
                const c = content.querySelector('.tt-close');
                if (c) c.addEventListener('click', close);
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
                    <td style="padding:8px 6px; font-size:13px;"><strong>${escapeHtml(r.title || '?')}</strong>${r.teacher ? `<br><span style="font-size:11px; color:var(--text-muted);">${escapeHtml(r.teacher)}</span>` : ''}${flags.length ? `<br><span style="font-size:11px; color:#f59e0b;">⚠ ${escapeHtml(flags.join(', '))}</span>` : ''}</td>
                    <td style="padding:8px 6px; white-space:nowrap; font-size:12px;">${r.hoursDone !== null && r.hoursDone !== undefined ? escapeHtml(r.hoursDone) : '?'} h / ${r.hoursTotal !== null && r.hoursTotal !== undefined ? escapeHtml(r.hoursTotal) : '?'} h</td>
                    <td style="padding:8px 6px;"><select class="tt-subject" style="max-width:200px; padding:6px; background:var(--bg-card); color:var(--text-main); border:1px solid var(--border-color); border-radius:8px; font-size:12px;">${options}</select>${r.componentName ? `<br><span style="font-size:11px; color:var(--text-muted);">${escapeHtml(r.componentName)}</span>` : ''}</td>
                </tr>`;
        }).join('');

        content.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; gap:10px; margin-bottom:12px; flex-wrap:wrap;">
                <div style="font-size:14px;">${preview.weekStart ? `Semaine du <strong>${escapeHtml(fmt(preview.weekStart))}</strong> au <strong>${escapeHtml(fmt(preview.weekEnd))}</strong>` : 'Semaine non reconnue'}</div>
                <label style="font-size:13px; color:var(--text-muted);">Groupe :
                    <select class="tt-group" style="padding:6px; background:var(--bg-card); color:var(--text-main); border:1px solid var(--border-color); border-radius:8px;">
                        ${groups.map(g => `<option value="${escapeHtml(g)}" ${g === preview.group ? 'selected' : ''}>${escapeHtml(g)}</option>`).join('')}
                    </select>
                </label>
            </div>
            ${preview.replacesExistingImport ? `<div style="font-size:12px; color:#f59e0b; margin-bottom:8px;">Cette semaine a déjà été importée : ses cours seront remplacés.</div>` : ''}
            ${(preview.warnings || []).map(w => `<div style="font-size:12px; color:#f59e0b; margin-bottom:4px;">⚠ ${escapeHtml(w)}</div>`).join('')}
            <p style="font-size:12px; color:var(--text-muted); margin:6px 0 10px 0;">Vérifie chaque ligne (lecture automatique), corrige la matière si besoin, puis valide. Les cours seront ajoutés au planning, verrouillés.</p>
            <table style="width:100%; border-collapse:collapse;">
                <thead><tr style="text-align:left; font-size:11px; color:var(--text-muted); text-transform:uppercase;"><th></th><th>Jour</th><th>Cours</th><th>Heures</th><th>Matière</th></tr></thead>
                <tbody>${rowsHtml || `<tr><td colspan="5" style="padding:12px; color:var(--text-muted);">Aucune séance pour ce groupe.</td></tr>`}</tbody>
            </table>
            <div class="tt-error" style="color:#ef4444; font-size:13px; margin-top:10px;"></div>
            <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:15px;">
                <button class="tt-cancel" style="${ui.btnGhost}">Annuler</button>
                <button class="tt-validate" style="${ui.btnStyle}" ${preview.rows.length === 0 ? 'disabled' : ''}>Valider</button>
            </div>`;

        const groupSelect = content.querySelector('.tt-group');
        if (groupSelect) groupSelect.addEventListener('change', async () => {
            const updated = await this.app.changeTimetableGroup(preview, groupSelect.value);
            this.renderTimetablePreview(updated, content, ui);
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
                content.innerHTML = `<div style="text-align:center; padding:15px;"><i class="bi bi-check-circle" style="font-size:36px; color:#10b981; display:block; margin-bottom:10px;"></i>
                    <strong>${escapeHtml(res.count)} cours enregistré(s)</strong> pour la semaine du ${escapeHtml(fmt(res.weekStart))}.
                    <p style="font-size:13px; color:var(--text-muted);">Le coach suit maintenant l'avancement de tes cours.</p>
                    ${extra.map(x => `<p style="font-size:12px; color:#f59e0b;">${escapeHtml(x)}</p>`).join('')}
                    <button class="tt-done" style="${ui.btnStyle}">Fermer</button></div>`;
                content.querySelector('.tt-done').addEventListener('click', ui.close);
            } catch (err) {
                const box = content.querySelector('.tt-error');
                if (box) box.textContent = err.message;
            }
        });
    }
}
