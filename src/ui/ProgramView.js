export class ProgramView {
    constructor(containerId, app) {
        this.container = document.getElementById(containerId);
        this.app = app;
    }
    
    render(programData) {
        if (!programData || programData.length === 0) {
            this.container.innerHTML = "<h2>📅 Programme</h2><p>Aucun programme trouvé.</p>";
            return;
        }

        let html = "<h2>📅 Programme Bootcamp (30 Jours)</h2>";
        
        const skillNames = {
            'english_speaking': 'Anglais',
            'reading': 'Lecture',
            'reflection': 'Bilan',
            'cyber_linux': 'Linux',
            'cyber_network': 'Réseau / Cisco',
            'ia_pandas': 'Pandas',
            'data_excel': 'Excel',
            'dev_git': 'Git/GitHub',
            'cyber_osint': 'OSINT',
            'ia_ml': 'Machine Learning',
            'ia_python': 'Python',
            'cyber_tryhackme': 'Cybersécurité'
        };
        
        programData.forEach((weekObj, wIdx) => {
            const missionsHtml = (weekObj.missions && weekObj.missions.length)
                ? `<div style="background:#0b1a20; padding:10px; border-radius:4px; margin-bottom:12px; border: 1px solid rgba(0,242,254,0.3);">
                    <strong style="color:#ff9800; font-size:13px;">🎯 Missions de la Semaine (Checklist Dimanche) :</strong>
                    <ul style="margin:6px 0 0 15px; padding:0; font-size:13px; color:#e0e0e0;">
                        ${weekObj.missions.map(m => `<li style="margin-bottom:4px;">${m}</li>`).join('')}
                    </ul>
                   </div>`
                : '';

            html += `
            <div style="background: #152b36; padding: 15px; border-radius: 8px; margin-bottom: 20px; border-left: 5px solid #00f2fe;">
                <h3 style="margin-bottom: 4px; color:#fff;">Semaine ${weekObj.week} — <span style="color:#00f2fe;">${weekObj.theme || ''}</span></h3>
                ${weekObj.objective ? `<p style="font-size:13px; color:#a8d8ea; margin: 0 0 10px 0;"><em>"${weekObj.objective}"</em></p>` : ''}
                ${missionsHtml}
                <div style="display:flex; flex-direction:column; gap:12px;">
            `;
            
            weekObj.days.forEach((dayObj, dIdx) => {
                const formattedDate = this.getFormattedDate(weekObj.week, dayObj.day);
                html += `
                    <div style="background: #0f2027; padding: 12px; border-radius: 6px;">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 8px; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom:6px;">
                            <strong style="color: #ff9800;">Jour ${dayObj.day} - <span style="color: #00f2fe; text-transform: capitalize;">${formattedDate}</span></strong>
                        </div>
                `;
                dayObj.sessions.forEach((s, sIdx) => {
                    const skillLabel = skillNames[s.skillId] || 'Général';
                    const blockBadge = s.block ? `<span style="background:#0f2027; border: 1px solid #00f2fe; padding: 2px 6px; border-radius: 4px; font-size:11px; margin-right:6px;">${s.block}</span>` : '';
                    html += `
                        <div style="margin-left: 5px; margin-bottom: 12px; padding: 10px; background:#11222b; border-left: 3px solid #00f2fe; border-radius:4px;">
                            <div style="display:flex; justify-content:space-between; align-items:center;">
                                <span style="font-size:14px; font-weight:bold;">${blockBadge}${s.title} <strong style="color:#ff9800; font-size:12px;">(${skillLabel})</strong></span>
                                <div>
                                    <span style="font-size:12px; margin-right:8px;">⭐ ${s.difficulty || '🟢'}</span>
                                    <button class="btn-edit-session" data-w="${wIdx}" data-d="${dIdx}" data-s="${sIdx}" style="background:transparent; border:none; color:#00f2fe; cursor:pointer;" title="Éditer">✏️</button>
                                    <button class="btn-delete-session" data-w="${wIdx}" data-d="${dIdx}" data-s="${sIdx}" style="background:transparent; border:none; color:#ff5252; cursor:pointer; margin-left:5px;" title="Supprimer">🗑️</button>
                                </div>
                            </div>
                            <div style="font-size:12px; color:#ccc; margin-top:4px;">⏱ Durée : <strong>${s.expectedDuration} min</strong>${s.startTime ? ` (${s.startTime} → ${s.endTime || ''})` : ''}</div>
                            ${s.objective ? `<div style="font-size:13px; color:#e0e0e0; margin-top:4px;">🎯 <strong>Objectif :</strong> ${s.objective}</div>` : ''}
                            ${s.expectedResult ? `<div style="font-size:12px; color:#a8d8ea; margin-top:2px;">📌 <strong>Résultat attendu :</strong> ${s.expectedResult}</div>` : ''}
                            ${s.proof ? `<div style="font-size:12px; color:#ffb74d; margin-top:2px;">📝 <strong>Preuve :</strong> ${s.proof}</div>` : ''}
                            ${s.resourceLink ? `<div style="margin-top:4px;"><a href="${s.resourceLink}" target="_blank" style="font-size:12px; color:#00f2fe; text-decoration:underline;">🔗 Ouvrir la ressource</a></div>` : ''}
                        </div>
                    `;
                });
                
                html += `
                    <button class="btn-add-session" data-w="${wIdx}" data-d="${dIdx}" style="width:100%; background:#2a5268; color:white; border:none; padding:5px; border-radius:3px; font-size:12px; margin-top:5px; cursor:pointer;">+ Ajouter une tâche</button>
                    </div>
                `;
            });
            html += `</div></div>`;
        });
        
        this.container.innerHTML = html;
        
        this.container.querySelectorAll('.btn-edit-session').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const w = e.target.getAttribute('data-w');
                const d = e.target.getAttribute('data-d');
                const s = e.target.getAttribute('data-s');
                this.openEditModal(programData, w, d, s);
            });
        });
        
        this.container.querySelectorAll('.btn-delete-session').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const w = e.target.getAttribute('data-w');
                const d = e.target.getAttribute('data-d');
                const s = e.target.getAttribute('data-s');
                this.deleteSession(programData, w, d, s);
            });
        });
        
        this.container.querySelectorAll('.btn-add-session').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const w = e.target.getAttribute('data-w');
                const d = e.target.getAttribute('data-d');
                this.addSession(programData, w, d);
            });
        });
    }

    openEditModal(programData, w, d, s) {
        const session = programData[w].days[d].sessions[s];
        const newTitle = prompt("Nouveau titre de la session :", session.title);
        if (newTitle !== null) {
            session.title = newTitle;
            const newDuration = prompt("Durée prévue (min) :", session.expectedDuration);
            if (newDuration) session.expectedDuration = parseInt(newDuration);
            const newLink = prompt("Lien de ressource (optionnel) :", session.resourceLink || "");
            if (newLink !== null) session.resourceLink = newLink;
            
            this.app.saveProgram(programData);
        }
    }

    deleteSession(programData, w, d, s) {
        if (confirm("Supprimer cette session ?")) {
            programData[w].days[d].sessions.splice(s, 1);
            this.app.saveProgram(programData);
        }
    }

    addSession(programData, w, d) {
        const title = prompt("Titre de la nouvelle session :");
        if (title) {
            const duration = prompt("Durée prévue (min) :", "30");
            programData[w].days[d].sessions.push({
                title: title,
                skillId: "cyber_linux",
                expectedDuration: parseInt(duration) || 30,
                resourceLink: ""
            });
            this.app.saveProgram(programData);
        }
    }

    getFormattedDate(week, day) {
        // Le bootcamp officiel commence le Mardi 4 Août 2026
        const startDate = new Date('2026-08-04T12:00:00');
        const dayOffset = (week - 1) * 7 + (day - 1);
        startDate.setDate(startDate.getDate() + dayOffset);
        
        return startDate.toLocaleDateString('fr-FR', {
            weekday: 'long',
            day: 'numeric',
            month: 'long'
        });
    }
}
