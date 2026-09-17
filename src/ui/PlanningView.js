export class PlanningView {
    constructor(containerId, app) {
        this.container = document.getElementById(containerId);
        this.app = app;
    }
    
    render(plan) {
        let dateHtml = "du Jour";
        let dayInfo = "";
        if (plan && plan.date) {
            const dateObj = new Date(plan.date + 'T12:00:00');
            dateHtml = dateObj.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
            
            // Si on a l'index depuis App
            if (this.app && typeof this.app.currentDayIndex === 'number') {
                dayInfo = ` (Jour ${this.app.currentDayIndex + 1})`;
            }
        }
        
        let html = `
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; margin-bottom: 15px;">
            <button id="btn-prev-day" style="background:#152b36; color:#00f2fe; border:1px solid #00f2fe; padding:8px 12px; border-radius:8px; cursor:pointer; font-weight:bold;">⬅️ Précédent</button>
            <h2 style="text-transform: capitalize; margin: 0; text-align: center; flex: 1;">📅 Planning <span style="color:#00f2fe;">${dateHtml}</span>${dayInfo}</h2>
            <button id="btn-next-day" style="background:#152b36; color:#00f2fe; border:1px solid #00f2fe; padding:8px 12px; border-radius:8px; cursor:pointer; font-weight:bold;">Suivant ➡️</button>
        </div>
        `;
        
        html += '<h3 style="color: #00f2fe; border-bottom: 1px solid #00f2fe; padding-bottom: 5px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">';
        html += '<span>🎯 Sessions du Bootcamp</span>';
        html += '<div style="display: flex; gap: 8px; align-items: center;">';
        html += '<a href="https://mail.google.com/" target="_blank" style="background:#ea4335; color:white; padding:5px 10px; font-size:12px; border-radius:15px; text-decoration:none; font-weight:bold; box-shadow: 0 2px 5px rgba(234,67,53,0.3);">📧 Gmail</a>';
        html += '<button id="btn-launch-focus" style="background:#00f2fe; color:#0f2027; padding:5px 10px; font-size:12px; border-radius:15px; border:none; cursor:pointer; font-weight:bold;">▶️ Lancer Focus</button>';
        html += '</div>';
        html += '</h3>';
        html += '<ul class="session-list" style="margin-bottom: 20px;">';
        if (plan && plan.sessions && plan.sessions.length > 0) {
            plan.sessions.forEach(s => {
                const isCompleted = s.completed;
                const style = isCompleted ? 'text-decoration: line-through; opacity: 0.5;' : '';
                const checkIcon = isCompleted ? '✅' : '⬜';
                const linkLabel = (s.resourceLink && s.resourceLink.includes('mail.google.com')) ? '📧 Ouvrir Gmail / Agenda' : '🔗 Ouvrir la ressource';
                const resourceLink = s.resourceLink ? `<br><a href="${s.resourceLink}" target="_blank" style="color: #00f2fe; text-decoration: none; font-size:14px; display:inline-block; margin-top:5px; font-weight:bold;">${linkLabel}</a>` : '';
                
                const timeHtml = s.startTime ? `<span style="background: #2a5268; padding: 2px 6px; border-radius: 4px; color: white; font-size: 12px; margin-right: 10px;">${s.startTime}</span>` : '';
                const diffHtml = s.difficulty ? `<span style="margin-left:5px;">${s.difficulty}</span>` : '';
                
                const blockHtml = s.block ? `<span style="background:#0f2027; border: 1px solid #00f2fe; padding: 2px 6px; border-radius: 4px; font-size:11px; margin-right:6px;">${s.block}</span>` : '';
                
                html += `<li style="${style}; padding: 15px; margin-bottom: 12px; background: #0b1a20; border-left: 4px solid #00f2fe; border-radius: 6px;">
                    <strong style="cursor: pointer;" class="task-checkbox" data-id="${s.id}">${checkIcon} ${timeHtml}${blockHtml}${s.title}</strong>
                    <span style="float:right;">⭐ ${s.difficulty || '🟢'}</span>
                    <br><small style="color: #ccc;">⏱ <strong>${s.expectedDuration} min</strong> | ⚡ Priorité : ${s.priority || 'Normale'} | <span style="color:#ff9800; font-weight:bold;">${s.skillLabel || ''}</span></small>
                    <div style="margin-top: 8px; font-size: 13px; line-height: 1.5; background: rgba(0,242,254,0.05); padding: 8px; border-radius: 4px;">
                        ${s.objective ? `<div><strong>🎯 Objectif :</strong> <span style="color:#e0e0e0;">${s.objective}</span></div>` : ''}
                        ${s.expectedResult ? `<div><strong>📌 Résultat attendu :</strong> <span style="color:#a8d8ea;">${s.expectedResult}</span></div>` : ''}
                        ${s.proof ? `<div><strong>📝 Preuve exigée :</strong> <span style="color:#ffb74d;">${s.proof}</span></div>` : ''}
                        ${!isCompleted && s.resourceLink ? `<div style="margin-top:4px;"><strong>📚 Ressource :</strong> <a href="${s.resourceLink}" target="_blank" style="color: #00f2fe; text-decoration: underline;">Ouvrir le lien</a></div>` : ''}
                    </div>
                </li>`;
            });
        } else {
            html += `<li style="padding: 15px; color: #88a7b7; list-style: none;">Aucune session programmée pour ce jour.</li>`;
        }
        html += '</ul>';

        html += '<h3 style="color: #ff9800; border-bottom: 1px solid #ff9800; padding-bottom: 5px;">🔥 Habitudes du Soir</h3>';
        html += '<ul class="session-list" style="margin-bottom: 20px;">';
        if (plan && plan.habits && plan.habits.length > 0) {
            plan.habits.forEach(h => {
                const isCompleted = h.completed;
                const style = isCompleted ? 'text-decoration: line-through; opacity: 0.5;' : '';
                const checkIcon = isCompleted ? '✅' : '⬜';
                
                html += `<li style="${style}; padding: 10px; margin-bottom: 8px;">
                    <strong style="cursor: pointer;" class="habit-checkbox" data-id="${h.id}">${checkIcon} ${h.title} (${h.minTime} min)</strong>
                    <br><small style="color: #88a7b7;">Objectif : ${h.skillLabel}</small>
                </li>`;
            });
        } else {
            html += `<li style="padding: 10px; color: #88a7b7; list-style: none;">Aucune habitude programmée pour ce soir.</li>`;
        }
        html += '</ul>';

        html += '<button id="btn-show-bilan" style="width:100%; margin-top:20px; background:#2a5268; color:white;">Voir le Bilan de fin de journée</button>';
        this.container.innerHTML = html;
        
        this.container.querySelectorAll('.habit-checkbox').forEach(el => {
            el.addEventListener('click', (e) => {
                const id = e.currentTarget.getAttribute('data-id');
                this.app.markHabitCompleted(id);
            });
        });

        this.container.querySelectorAll('.task-checkbox').forEach(el => {
            el.addEventListener('click', (e) => {
                const id = e.currentTarget.getAttribute('data-id');
                this.app.markSessionCompleted(id, { status: 'completed' }); // Default to completed from Planning list
            });
        });
        
        const btnFocus = document.getElementById('btn-launch-focus');
        if (btnFocus) {
            btnFocus.addEventListener('click', () => {
                this.app.renderView('focus');
            });
        }
        
        const btnPrevDay = document.getElementById('btn-prev-day');
        if (btnPrevDay) {
            btnPrevDay.addEventListener('click', () => {
                if (this.app.shiftDay) this.app.shiftDay(-1);
            });
        }

        const btnNextDay = document.getElementById('btn-next-day');
        if (btnNextDay) {
            btnNextDay.addEventListener('click', () => {
                if (this.app.shiftDay) this.app.shiftDay(1);
            });
        }

        const btnBilan = document.getElementById('btn-show-bilan');
        if (btnBilan) {
            btnBilan.addEventListener('click', () => {
                this.app.showBilan();
            });
        }
    }
}
