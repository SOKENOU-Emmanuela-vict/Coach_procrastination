import { Event } from '../models/Event.js';
import { AvailabilityWindow } from '../models/AvailabilityWindow.js';

export class CalendarView {
    constructor(containerId, app) {
        this.container = document.getElementById(containerId);
        this.app = app;
        this.currentDate = new Date();
        this.viewMode = 'day'; // 'day' or 'week'
    }

    _formatDate(dateObj) {
        return dateObj.toLocaleDateString('fr-CA'); // YYYY-MM-DD
    }

    _getStartOfWeek(dateObj) {
        const d = new Date(dateObj);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Lundi
        return new Date(d.setDate(diff));
    }

    _generateId() {
        return Math.random().toString(36).substr(2, 9);
    }

    async render(state) {
        const calData = state.calendarData || { events: [], availabilities: [] };
        
        let html = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
                <h2 style="margin:0;">📅 Agenda Temporel</h2>
                <div style="display:flex; gap:10px;">
                    <button id="btn-view-day" style="background:${this.viewMode === 'day' ? '#00f2fe' : '#152b36'}; color:${this.viewMode === 'day' ? '#0f2027' : '#00f2fe'}; border:1px solid #00f2fe; padding:8px 12px; border-radius:6px; cursor:pointer; font-weight:bold;">Jour</button>
                    <button id="btn-view-week" style="background:${this.viewMode === 'week' ? '#00f2fe' : '#152b36'}; color:${this.viewMode === 'week' ? '#0f2027' : '#00f2fe'}; border:1px solid #00f2fe; padding:8px 12px; border-radius:6px; cursor:pointer; font-weight:bold;">Semaine</button>
                </div>
            </div>
            
            <div style="display:flex; justify-content:space-between; align-items:center; background:#0b1a20; padding:10px; border-radius:8px; margin-bottom:20px; border:1px solid #1a3644;">
                <button id="btn-prev" style="background:transparent; border:none; color:#00f2fe; cursor:pointer; font-size:20px;">◀</button>
                <h3 style="margin:0; color:#fff;">
                    ${this.viewMode === 'day' ? 
                        this.currentDate.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : 
                        `Semaine du ${this._getStartOfWeek(this.currentDate).toLocaleDateString('fr-FR', {day:'numeric', month:'short'})}`}
                </h3>
                <button id="btn-next" style="background:transparent; border:none; color:#00f2fe; cursor:pointer; font-size:20px;">▶</button>
            </div>

            <div style="margin-bottom:20px; display:flex; gap:10px;">
                <button id="btn-add-event" style="background:#4caf50; color:white; border:none; padding:10px 15px; border-radius:6px; cursor:pointer; font-weight:bold;">+ Nouvel Événement</button>
                <button id="btn-add-avail" style="background:#2196f3; color:white; border:none; padding:10px 15px; border-radius:6px; cursor:pointer; font-weight:bold;">+ Nouvelle Disponibilité</button>
            </div>

            <div id="calendar-content"></div>
            
            <!-- Modals Container -->
            <div id="calendar-modals"></div>
        `;

        this.container.innerHTML = html;

        const contentDiv = document.getElementById('calendar-content');
        if (this.viewMode === 'day') {
            contentDiv.innerHTML = await this._renderDayView(this._formatDate(this.currentDate), calData);
        } else {
            contentDiv.innerHTML = await this._renderWeekView(calData);
        }

        this._attachEventListeners(calData);
    }

    async _renderDayView(dateStr, calData) {
        const events = calData.events.filter(e => e.date === dateStr);
        const availabilities = calData.availabilities.filter(a => a.date === dateStr);
        const conflicts = await this.app.getConflictsForDate(dateStr);
        
        let allDayEvents = events.filter(e => !e.startTime && !e.endTime);
        let timeEvents = events.filter(e => e.startTime || e.endTime);
        
        // Tri chronologique des events temporels
        timeEvents.sort((a, b) => (a.startTime || '23:59').localeCompare(b.startTime || '23:59'));
        availabilities.sort((a, b) => (a.startTime || '23:59').localeCompare(b.startTime || '23:59'));

        let html = '';

        // 1. Conflits
        if (conflicts && conflicts.length > 0) {
            html += `<div style="background:rgba(244,67,54,0.1); border:1px solid #f44336; padding:10px; border-radius:6px; margin-bottom:15px;">
                <strong style="color:#f44336;">⚠️ Conflits détectés (${conflicts.length})</strong>
                <ul style="margin:5px 0 0 0; padding-left:20px; font-size:13px; color:#e0e0e0;">`;
            conflicts.forEach(c => {
                html += `<li>${c.message}</li>`;
            });
            html += `</ul></div>`;
        }

        // 2. Événements sans horaire
        if (allDayEvents.length > 0) {
            html += `<div style="background:#152b36; border-left:4px solid #9c27b0; padding:10px; border-radius:6px; margin-bottom:20px;">
                <h4 style="margin:0 0 10px 0; color:#9c27b0; font-size:14px;">📌 Événements sans horaire</h4>`;
            allDayEvents.forEach(e => {
                html += this._renderEventCard(e);
            });
            html += `</div>`;
        }

        // 3. Timeline (Événements temporels + Disponibilités)
        html += `<h4 style="color:#e0e0e0; font-size:14px; margin-bottom:10px;">🕒 Timeline</h4>`;
        
        if (timeEvents.length === 0 && availabilities.length === 0) {
            html += `<p style="color:#88a7b7; font-size:14px;">Aucune donnée temporelle pour ce jour.</p>`;
            return html;
        }

        // Pour simplifier la vue chronologique V1, on liste simplement tout de haut en bas trié par heure.
        const timelineItems = [
            ...timeEvents.map(e => ({ type: 'event', data: e, time: e.startTime || '23:59' })),
            ...availabilities.map(a => ({ type: 'availability', data: a, time: a.startTime || '23:59' }))
        ];
        
        timelineItems.sort((a, b) => a.time.localeCompare(b.time));

        timelineItems.forEach(item => {
            if (item.type === 'event') {
                html += this._renderEventCard(item.data);
            } else {
                html += this._renderAvailabilityCard(item.data);
            }
        });

        return html;
    }

    async _renderWeekView(calData) {
        let html = `<div style="display:grid; grid-template-columns:repeat(7, 1fr); gap:10px; overflow-x:auto;">`;
        
        const startOfWeek = this._getStartOfWeek(this.currentDate);
        
        for (let i = 0; i < 7; i++) {
            const d = new Date(startOfWeek);
            d.setDate(d.getDate() + i);
            const dateStr = this._formatDate(d);
            
            const eventsCount = calData.events.filter(e => e.date === dateStr).length;
            const availCount = calData.availabilities.filter(a => a.date === dateStr).length;
            
            const isToday = dateStr === this._formatDate(new Date());
            
            html += `
                <div style="background:#0b1a20; border:1px solid ${isToday ? '#00f2fe' : '#1a3644'}; border-radius:6px; padding:10px; min-width:120px;">
                    <div style="text-align:center; margin-bottom:10px; border-bottom:1px solid #1a3644; padding-bottom:5px;">
                        <strong style="color:${isToday ? '#00f2fe' : '#e0e0e0'}; font-size:14px;">${d.toLocaleDateString('fr-FR', {weekday:'short'})}</strong>
                        <div style="font-size:12px; color:#88a7b7;">${d.toLocaleDateString('fr-FR', {day:'numeric', month:'numeric'})}</div>
                    </div>
                    <div style="font-size:12px; color:#fff; margin-bottom:5px;">📅 ${eventsCount} évnts</div>
                    <div style="font-size:12px; color:#2196f3;">🟢 ${availCount} dispos</div>
                    <button class="btn-jump-day" data-date="${dateStr}" style="width:100%; margin-top:10px; background:transparent; border:1px solid #88a7b7; color:#88a7b7; padding:4px; border-radius:4px; cursor:pointer; font-size:11px;">Voir détails</button>
                </div>
            `;
        }
        html += `</div>`;
        return html;
    }

    _renderEventCard(e) {
        const borderColor = e.lockStatus === 'locked' ? '#ff9800' : '#4caf50';
        const timeRange = e.startTime && e.endTime ? `${e.startTime} - ${e.endTime}` : (e.startTime || 'Sans horaire');
        return `
            <div style="background:#0e1e26; border-left:4px solid ${borderColor}; padding:10px; border-radius:6px; margin-bottom:10px; display:flex; justify-content:space-between; align-items:center;">
                <div>
                    <div style="font-size:14px; color:#fff; font-weight:bold;">${e.title || 'Sans titre'}</div>
                    <div style="font-size:12px; color:#a8d8ea; margin-top:3px;">
                        🕒 ${timeRange} | 🏷️ ${e.type || 'Événement'} | ⚡ ${e.priority || 'medium'}
                    </div>
                </div>
                <div style="display:flex; gap:5px; align-items:center;">
                    <div style="font-size:11px; padding:2px 6px; border-radius:4px; border:1px solid ${borderColor}; color:${borderColor};">
                        ${e.lockStatus === 'locked' ? '🔒' : '🔓'}
                    </div>
                    <button class="btn-edit-event" data-id="${e.id}" style="background:transparent; border:none; cursor:pointer; color:#00f2fe; padding:0 5px;">✏️</button>
                    <button class="btn-delete-event" data-id="${e.id}" style="background:transparent; border:none; cursor:pointer; color:#f44336; padding:0 5px;">❌</button>
                </div>
            </div>
        `;
    }

    _renderAvailabilityCard(a) {
        return `
            <div style="background:rgba(33,150,243,0.1); border:1px dashed #2196f3; padding:10px; border-radius:6px; margin-bottom:10px; display:flex; justify-content:space-between; align-items:center;">
                <div>
                    <div style="font-size:13px; color:#2196f3; font-weight:bold;">🟢 Disponibilité déclarée</div>
                    <div style="font-size:12px; color:#a8d8ea; margin-top:3px;">🕒 ${a.startTime} - ${a.endTime} | source: ${a.source || 'utilisateur'}</div>
                </div>
                <div style="display:flex; gap:5px;">
                    <button class="btn-edit-avail" data-id="${a.id}" style="background:transparent; border:none; cursor:pointer; color:#00f2fe; padding:0 5px;">✏️</button>
                    <button class="btn-delete-avail" data-id="${a.id}" style="background:transparent; border:none; cursor:pointer; color:#f44336; padding:0 5px;">❌</button>
                </div>
            </div>
        `;
    }

    _attachEventListeners(calData) {
        const safeQuery = (selector, event, handler) => {
            document.querySelectorAll(selector).forEach(el => {
                el.addEventListener(event, handler);
            });
        };

        // Navigation Jours / Semaines
        document.getElementById('btn-prev').addEventListener('click', () => {
            const d = new Date(this.currentDate);
            if (this.viewMode === 'day') d.setDate(d.getDate() - 1);
            else d.setDate(d.getDate() - 7);
            this.currentDate = d;
            this.render(this.app.state);
        });

        document.getElementById('btn-next').addEventListener('click', () => {
            const d = new Date(this.currentDate);
            if (this.viewMode === 'day') d.setDate(d.getDate() + 1);
            else d.setDate(d.getDate() + 7);
            this.currentDate = d;
            this.render(this.app.state);
        });

        document.getElementById('btn-view-day').addEventListener('click', () => {
            this.viewMode = 'day';
            this.render(this.app.state);
        });

        document.getElementById('btn-view-week').addEventListener('click', () => {
            this.viewMode = 'week';
            this.render(this.app.state);
        });

        safeQuery('.btn-jump-day', 'click', (e) => {
            const dateStr = e.currentTarget.getAttribute('data-date');
            this.currentDate = new Date(dateStr + 'T12:00:00');
            this.viewMode = 'day';
            this.render(this.app.state);
        });

        // Modales (Event & Availability)
        document.getElementById('btn-add-event').addEventListener('click', () => {
            this._showEventModal();
        });

        document.getElementById('btn-add-avail').addEventListener('click', () => {
            this._showAvailModal();
        });

        safeQuery('.btn-edit-event', 'click', (e) => {
            const id = e.currentTarget.getAttribute('data-id');
            const event = calData.events.find(ev => ev.id === id);
            if (event) this._showEventModal(event);
        });

        safeQuery('.btn-delete-event', 'click', (e) => {
            const id = e.currentTarget.getAttribute('data-id');
            if (confirm("Supprimer cet événement ?")) {
                this.app.deleteCalendarEvent(id);
            }
        });

        safeQuery('.btn-edit-avail', 'click', (e) => {
            const id = e.currentTarget.getAttribute('data-id');
            const avail = calData.availabilities.find(av => av.id === id);
            if (avail) this._showAvailModal(avail);
        });

        safeQuery('.btn-delete-avail', 'click', (e) => {
            const id = e.currentTarget.getAttribute('data-id');
            if (confirm("Supprimer cette disponibilité ?")) {
                this.app.deleteCalendarAvailability(id);
            }
        });
    }

    _showEventModal(event = null) {
        const isEdit = !!event;
        const targetDate = event ? event.date : this._formatDate(this.currentDate);
        
        const calData = this.app.state.calendarData || {};
        const subjects = calData.subjects || [];
        const assessments = calData.assessments || [];
        const projects = calData.projects || [];
        
        let subjectOptions = `<option value="">-- Aucune matière --</option>`;
        subjects.forEach(s => {
            subjectOptions += `<option value="${s.id}" ${event && event.subjectId === s.id ? 'selected' : ''}>${s.name}</option>`;
        });

        let projectOptions = `<option value="">-- Aucun projet --</option>`;
        projects.forEach(p => {
            projectOptions += `<option value="${p.id}" ${event && event.projectId === p.id ? 'selected' : ''}>${p.title}</option>`;
        });

        const html = `
            <div style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.8); display:flex; justify-content:center; align-items:center; z-index:1000; overflow-y:auto; padding:20px;">
                <div style="background:#0f2027; padding:20px; border-radius:8px; width:90%; max-width:500px; border:1px solid #00f2fe; max-height:90vh; overflow-y:auto;">
                    <h3 style="color:#00f2fe; margin-top:0;">${isEdit ? 'Modifier' : 'Ajouter'} un Événement</h3>
                    <input type="text" id="ev-title" placeholder="Titre de l'événement" value="${event ? event.title || '' : ''}" style="width:100%; padding:8px; margin-bottom:10px; background:#152b36; color:#fff; border:1px solid #1a3644; border-radius:4px;" />
                    
                    <div style="display:flex; gap:10px; margin-bottom:10px; flex-wrap:wrap;">
                        <input type="date" id="ev-date" value="${targetDate}" style="flex:1; min-width:120px; padding:8px; background:#152b36; color:#fff; border:1px solid #1a3644; border-radius:4px;" />
                        <input type="time" id="ev-start" value="${event ? event.startTime || '' : ''}" style="flex:1; min-width:100px; padding:8px; background:#152b36; color:#fff; border:1px solid #1a3644; border-radius:4px;" title="Heure de début" />
                        <input type="time" id="ev-end" value="${event ? event.endTime || '' : ''}" style="flex:1; min-width:100px; padding:8px; background:#152b36; color:#fff; border:1px solid #1a3644; border-radius:4px;" title="Heure de fin" />
                    </div>
                    
                    <div style="margin-bottom:10px;">
                        <label style="color:#88a7b7; font-size:12px;">Durée souhaitée (minutes) - Optionnel si pas d'horaire fixe</label>
                        <input type="number" id="ev-target-duration" value="${event && event.targetDuration ? event.targetDuration : ''}" placeholder="ex: 90" style="width:100%; padding:8px; background:#152b36; color:#fff; border:1px solid #1a3644; border-radius:4px;" />
                    </div>

                    <div style="display:flex; gap:10px; margin-bottom:10px;">
                        <select id="ev-type" style="flex:1; padding:8px; background:#152b36; color:#fff; border:1px solid #1a3644; border-radius:4px;">
                            <option value="Cours" ${event && event.type === 'Cours' ? 'selected' : ''}>Cours / TD / TP</option>
                            <option value="Examen" ${event && event.type === 'Examen' ? 'selected' : ''}>Examen / Devoir</option>
                            <option value="Personnel" ${event && event.type === 'Personnel' ? 'selected' : ''}>Personnel / Autre</option>
                        </select>
                        <select id="ev-lock" style="flex:1; padding:8px; background:#152b36; color:#fff; border:1px solid #1a3644; border-radius:4px;">
                            <option value="locked" ${event && event.lockStatus === 'locked' ? 'selected' : ''}>🔒 Fixe (FIXED)</option>
                            <option value="flexible" ${event && event.lockStatus === 'flexible' ? 'selected' : ''}>🔓 Optimisable (OPTIMIZABLE)</option>
                        </select>
                    </div>

                    <select id="ev-priority" style="width:100%; padding:8px; margin-bottom:10px; background:#152b36; color:#fff; border:1px solid #1a3644; border-radius:4px;">
                        <option value="high" ${event && event.priority === 'high' ? 'selected' : ''}>🔴 Haute Priorité</option>
                        <option value="medium" ${event && (!event.priority || event.priority === 'medium') ? 'selected' : ''}>🟡 Priorité Normale</option>
                        <option value="low" ${event && event.priority === 'low' ? 'selected' : ''}>🟢 Basse Priorité</option>
                    </select>

                    <div style="border:1px solid #1a3644; padding:10px; border-radius:6px; margin-bottom:10px; background:#11232c;">
                        <label style="color:#88a7b7; font-size:12px; display:block; margin-bottom:5px;">Relations Académiques</label>
                        <select id="ev-subject" style="width:100%; padding:8px; margin-bottom:5px; background:#152b36; color:#fff; border:1px solid #1a3644; border-radius:4px;">
                            ${subjectOptions}
                        </select>
                        <select id="ev-assessment" style="width:100%; padding:8px; background:#152b36; color:#fff; border:1px solid #1a3644; border-radius:4px;" ${!event || !event.subjectId ? 'disabled' : ''}>
                            <option value="">-- Aucune évaluation --</option>
                        </select>
                    </div>

                    <div style="border:1px solid #1a3644; padding:10px; border-radius:6px; margin-bottom:15px; background:#11232c;">
                        <label style="color:#88a7b7; font-size:12px; display:block; margin-bottom:5px;">Relations Projet</label>
                        <select id="ev-project" style="width:100%; padding:8px; margin-bottom:5px; background:#152b36; color:#fff; border:1px solid #1a3644; border-radius:4px;">
                            ${projectOptions}
                        </select>
                        <select id="ev-task" style="width:100%; padding:8px; background:#152b36; color:#fff; border:1px solid #1a3644; border-radius:4px;" ${!event || !event.projectId ? 'disabled' : ''}>
                            <option value="">-- Aucune tâche --</option>
                        </select>
                    </div>

                    <div style="display:flex; justify-content:space-between;">
                        <button id="btn-cancel-modal" style="background:transparent; color:#88a7b7; border:1px solid #88a7b7; padding:8px 15px; border-radius:4px; cursor:pointer;">Annuler</button>
                        <button id="btn-save-modal" style="background:#00f2fe; color:#0f2027; border:none; padding:8px 15px; border-radius:4px; cursor:pointer; font-weight:bold;">Enregistrer</button>
                    </div>
                </div>
            </div>
        `;

        document.getElementById('calendar-modals').innerHTML = html;

        // Populate dynamic dropdowns
        const subjectSelect = document.getElementById('ev-subject');
        const assessmentSelect = document.getElementById('ev-assessment');
        const projectSelect = document.getElementById('ev-project');
        const taskSelect = document.getElementById('ev-task');

        const populateAssessments = (subjectId, selectedAssessmentId = null) => {
            assessmentSelect.innerHTML = '<option value="">-- Aucune évaluation --</option>';
            if (!subjectId) {
                assessmentSelect.disabled = true;
                return;
            }
            const filteredAssessments = assessments.filter(a => a.subjectId === subjectId);
            if (filteredAssessments.length > 0) {
                assessmentSelect.disabled = false;
                filteredAssessments.forEach(a => {
                    const isSelected = selectedAssessmentId === a.id ? 'selected' : '';
                    assessmentSelect.innerHTML += `<option value="${a.id}" ${isSelected}>${a.title}</option>`;
                });
            } else {
                assessmentSelect.disabled = true;
            }
        };

        const populateTasks = (projectId, selectedTaskId = null) => {
            taskSelect.innerHTML = '<option value="">-- Aucune tâche --</option>';
            if (!projectId) {
                taskSelect.disabled = true;
                return;
            }
            const project = projects.find(p => p.id === projectId);
            if (project && project.tasks && project.tasks.length > 0) {
                taskSelect.disabled = false;
                project.tasks.forEach(t => {
                    const isSelected = selectedTaskId === t.id ? 'selected' : '';
                    taskSelect.innerHTML += `<option value="${t.id}" ${isSelected}>${t.title}</option>`;
                });
            } else {
                taskSelect.disabled = true;
            }
        };

        // Initial population
        if (event) {
            if (event.subjectId) populateAssessments(event.subjectId, event.assessmentId);
            if (event.projectId) populateTasks(event.projectId, event.taskId);
        }

        // Listeners
        subjectSelect.addEventListener('change', (e) => {
            populateAssessments(e.target.value);
        });

        projectSelect.addEventListener('change', (e) => {
            populateTasks(e.target.value);
        });

        document.getElementById('btn-cancel-modal').addEventListener('click', () => {
            document.getElementById('calendar-modals').innerHTML = '';
        });

        document.getElementById('btn-save-modal').addEventListener('click', () => {
            const targetDurRaw = document.getElementById('ev-target-duration').value;
            const targetDuration = targetDurRaw ? parseInt(targetDurRaw, 10) : null;
            
            const evConfig = {
                id: isEdit ? event.id : this._generateId(),
                title: document.getElementById('ev-title').value || 'Sans titre',
                date: document.getElementById('ev-date').value,
                startTime: document.getElementById('ev-start').value || null,
                endTime: document.getElementById('ev-end').value || null,
                type: document.getElementById('ev-type').value,
                lockStatus: document.getElementById('ev-lock').value,
                priority: document.getElementById('ev-priority').value,
                subjectId: document.getElementById('ev-subject').value || null,
                assessmentId: document.getElementById('ev-assessment').value || null,
                projectId: document.getElementById('ev-project').value || null,
                taskId: document.getElementById('ev-task').value || null,
                targetDuration: targetDuration,
                source: isEdit ? event.source : 'system'
            };
            
            this.app.saveCalendarEvent(new Event(evConfig));
            document.getElementById('calendar-modals').innerHTML = '';
        });
    }

    _showAvailModal(avail = null) {
        const isEdit = !!avail;
        const targetDate = avail ? avail.date : this._formatDate(this.currentDate);

        const html = `
            <div style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.8); display:flex; justify-content:center; align-items:center; z-index:1000;">
                <div style="background:#0f2027; padding:20px; border-radius:8px; width:90%; max-width:400px; border:1px solid #2196f3;">
                    <h3 style="color:#2196f3; margin-top:0;">${isEdit ? 'Modifier' : 'Ajouter'} Disponibilité</h3>
                    
                    <div style="display:flex; flex-direction:column; gap:10px; margin-bottom:15px;">
                        <label style="color:#88a7b7; font-size:12px;">Date</label>
                        <input type="date" id="av-date" value="${targetDate}" style="padding:8px; background:#152b36; color:#fff; border:1px solid #1a3644; border-radius:4px;" />
                        
                        <label style="color:#88a7b7; font-size:12px;">Heure de début</label>
                        <input type="time" id="av-start" value="${avail ? avail.startTime : '08:00'}" style="padding:8px; background:#152b36; color:#fff; border:1px solid #1a3644; border-radius:4px;" />
                        
                        <label style="color:#88a7b7; font-size:12px;">Heure de fin</label>
                        <input type="time" id="av-end" value="${avail ? avail.endTime : '18:00'}" style="padding:8px; background:#152b36; color:#fff; border:1px solid #1a3644; border-radius:4px;" />
                    </div>

                    <div style="display:flex; justify-content:space-between;">
                        <button id="btn-cancel-modal" style="background:transparent; color:#88a7b7; border:1px solid #88a7b7; padding:8px 15px; border-radius:4px; cursor:pointer;">Annuler</button>
                        <button id="btn-save-modal" style="background:#2196f3; color:#fff; border:none; padding:8px 15px; border-radius:4px; cursor:pointer; font-weight:bold;">Enregistrer</button>
                    </div>
                </div>
            </div>
        `;

        document.getElementById('calendar-modals').innerHTML = html;

        document.getElementById('btn-cancel-modal').addEventListener('click', () => {
            document.getElementById('calendar-modals').innerHTML = '';
        });

        document.getElementById('btn-save-modal').addEventListener('click', () => {
            const avConfig = {
                id: isEdit ? avail.id : this._generateId(),
                date: document.getElementById('av-date').value,
                startTime: document.getElementById('av-start').value,
                endTime: document.getElementById('av-end').value,
                source: isEdit ? avail.source : 'utilisateur'
            };
            
            const newAvail = new AvailabilityWindow(avConfig);
            this.app.saveCalendarAvailability(newAvail);
            document.getElementById('calendar-modals').innerHTML = '';
        });
    }
}
