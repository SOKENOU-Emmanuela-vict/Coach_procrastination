export class PlanningView {
    constructor(containerId, app) {
        this.container = document.getElementById(containerId);
        this.app = app;
    }
    
    render(state) {
        if (typeof document !== 'undefined' && document.body) {
            document.body.className = 'theme-light';
        }

        const now = state.selectedDate ? new Date(state.selectedDate) : new Date();
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
        
        const rawEvents = state.calendarData?.events || [];
        const eventsHtml = rawEvents.filter(e => {
            if (!e.date || !e.startTime) return false;
            const ed = new Date(e.date);
            return ed >= startOfWeek && ed <= endOfWeek;
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
            <div style="position: absolute; left: calc(60px + ${dayIndex} * ((100% - 60px) / 7) + 2px); width: calc(((100% - 60px) / 7) - 4px); top: ${top}px; height: ${height}px; background: ${bgColor}; color: white; border-radius: 6px; padding: 4px 8px; font-size: 11px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1); z-index: 10;">
                <strong style="display:block; text-overflow:ellipsis; white-space:nowrap; overflow:hidden;">${e.title || e.type}</strong>
                <span style="opacity:0.8;">${e.startTime} - ${e.endTime || ''}</span>
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
                <strong style="display:block; color:var(--accent-primary); margin-bottom:5px;">${currentEvent.title || currentEvent.type}</strong>
                <div style="font-size:12px; color:var(--text-main);"><i class="bi bi-clock"></i> ${currentEvent.startTime} - ${currentEvent.endTimeStr}</div>
            </div>`;
        }

        if (upcomingList.length > 0) {
            upcomingHtml = upcomingList.map(e => `
            <div style="display:flex; justify-content:space-between; padding: 10px 0; border-bottom: 1px solid var(--border-color);">
                <div style="font-size:13px; font-weight:500; color:var(--text-main); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${e.title || e.type}</div>
                <div style="font-size:12px; color:var(--text-muted);">${e.startTime}</div>
            </div>
            `).join('');
        }

        const next14Days = new Date(now);
        next14Days.setDate(now.getDate() + 14);
        const upcomingCCs = rawEvents.filter(e => {
            if (!e.date) return false;
            const ed = new Date(e.date);
            return ed > now && ed <= next14Days && (e.type === 'Examen' || e.type === 'CC' || e.assessmentId != null || (e.title && e.title.toLowerCase().includes('cc')));
        });

        if (upcomingCCs.length > 0) {
            upcomingCCs.sort((a, b) => a.date.localeCompare(b.date));
            aVenirHtml = upcomingCCs.slice(0, 4).map(e => {
                const ed = new Date(e.date);
                const dateStr = ed.toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: 'short' });
                return `
                <div style="display:flex; justify-content:space-between; padding: 10px 0; border-bottom: 1px solid var(--border-color);">
                    <div style="font-size:13px; font-weight:500; color:#ef4444; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${e.title || e.type}</div>
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
            <div class="bureau-topbar-actions" style="display:flex; gap:15px; align-items:center;">
                <div style="text-align:right;">
                    <strong style="display:block; font-size:14px; color:var(--text-main);">Étudiant</strong>
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
`;

        this.container.innerHTML = html;

        // BINDINGS
        this.container.querySelectorAll('.bureau-nav-item').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const viewName = e.currentTarget.getAttribute('data-view');
                if (viewName && this.app.router) {
                    this.app.router.render(viewName, this.app.state);
                }
            });
        });
    }
}
