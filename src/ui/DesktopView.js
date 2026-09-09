export class DesktopView {
    constructor(containerId, app) {
        this.container = document.getElementById(containerId);
        this.app = app;
    }
    
    render(state) {
        // --- A. MAINTENANT ---
        const sessions = state.dailyPlan && state.dailyPlan.sessions ? state.dailyPlan.sessions : [];
        const nextSession = sessions.find(s => !s.completed);
        let nowHtml = `<p style="color:#88a7b7; font-size:14px; margin:0;">Aucune session en cours ou à venir aujourd'hui.</p>`;
        
        if (nextSession) {
            nowHtml = `
                <div style="background:#152b36; border-left:4px solid #00f2fe; padding:15px; border-radius:8px;">
                    <div style="font-size:12px; color:#00f2fe; font-weight:bold; text-transform:uppercase; margin-bottom:5px;">Session active / prochaine</div>
                    <div style="font-size:16px; font-weight:bold; color:#fff;">${nextSession.title}</div>
                    <div style="font-size:13px; color:#a8d8ea; margin-top:5px;">⏱ <strong>${nextSession.expectedDuration} min</strong> | 🎯 ${nextSession.objective || 'Avancer dans la mission'}</div>
                </div>
            `;
        }

        // --- B. AUJOURD'HUI ---
        let todayHtml = "";
        const events = state.todayEvents || [];
        
        if (events.length > 0 || sessions.length > 0) {
            // Tri des événements par heure
            const sortedEvents = [...events].sort((a, b) => {
                const tA = a.startTime || '23:59';
                const tB = b.startTime || '23:59';
                return tA.localeCompare(tB);
            });
            
            if (sortedEvents.length > 0) {
                todayHtml += `<h4 style="color:#e0e0e0; margin-top:0; margin-bottom:10px; font-size:14px;">📅 Événements académiques</h4>`;
                sortedEvents.forEach(e => {
                    const lockColor = e.lockStatus === 'locked' ? '#ff9800' : '#4caf50';
                    const timeRange = e.startTime && e.endTime ? `${e.startTime} - ${e.endTime}` : (e.startTime || 'Heure non définie');
                    todayHtml += `
                        <div style="background:#0b1a20; border:1px solid #1a3644; padding:10px; border-radius:6px; margin-bottom:8px; display:flex; justify-content:space-between; align-items:center;">
                            <div>
                                <div style="font-size:14px; color:#fff; font-weight:bold;">${e.title}</div>
                                <div style="font-size:12px; color:#a8d8ea; margin-top:3px;">🕒 ${timeRange} | 📝 ${e.type || 'Événement'}</div>
                            </div>
                            <div style="font-size:11px; padding:3px 6px; border-radius:4px; background:rgba(255,255,255,0.05); color:${lockColor}; border:1px solid ${lockColor};">
                                ${e.lockStatus === 'locked' ? '🔒 Fixe' : '🔓 Flexible'}
                            </div>
                        </div>
                    `;
                });
            }
            
            if (sessions.length > 0) {
                todayHtml += `<h4 style="color:#e0e0e0; margin-top:15px; margin-bottom:10px; font-size:14px;">🚀 Sessions Bootcamp</h4>`;
                sessions.forEach(s => {
                    const statusIcon = s.completed ? '✅' : '⏳';
                    const opacity = s.completed ? '0.5' : '1';
                    const borderColor = s.completed ? '#4caf50' : '#00f2fe';
                    todayHtml += `
                        <div style="opacity:${opacity}; background:#0b1a20; border-left:3px solid ${borderColor}; padding:10px; border-radius:6px; margin-bottom:8px;">
                            <div style="font-size:14px; color:#fff; font-weight:bold;">${statusIcon} ${s.title}</div>
                            <div style="font-size:12px; color:#a8d8ea; margin-top:3px;">⏱ ${s.expectedDuration} min</div>
                        </div>
                    `;
                });
            }
        } else {
            todayHtml = `<p style="color:#88a7b7; font-size:14px; margin:0;">Aucun engagement prévu aujourd'hui.</p>`;
        }

        // --- C. ENSUITE ---
        let upcomingHtml = "";
        const acad = state.academicSummary;
        
        if (acad && acad.upcomingAssessments && acad.upcomingAssessments.length > 0) {
            acad.upcomingAssessments.forEach(ass => {
                const color = ass.daysRemaining <= 7 ? '#f44336' : '#ff9800';
                upcomingHtml += `
                    <div style="background:#0b1a20; border-left:3px solid ${color}; padding:10px; border-radius:6px; margin-bottom:8px; display:flex; justify-content:space-between; align-items:center;">
                        <div>
                            <div style="font-size:14px; color:#fff; font-weight:bold;">${ass.title}</div>
                            <div style="font-size:12px; color:#a8d8ea; margin-top:3px;">📚 ${ass.subjectName}</div>
                        </div>
                        <div style="text-align:right;">
                            <div style="font-size:12px; color:#fff;">${ass.targetDate}</div>
                            <div style="font-size:12px; font-weight:bold; color:${color}; margin-top:2px;">Dans ${ass.daysRemaining} j</div>
                        </div>
                    </div>
                `;
            });
        } else {
            upcomingHtml = `<p style="color:#88a7b7; font-size:14px; margin:0;">Aucune évaluation future n'est programmée.</p>`;
        }

        // --- D. BILAN ACADEMIQUE ---
        let acadInfoHtml = "";
        if (acad) {
            let avgText = "Non calculable";
            let avgColor = "#88a7b7";
            if (acad.average && acad.average.status === "complete") {
                avgText = `${acad.average.value} / 20`;
                avgColor = acad.average.value >= 10 ? "#4caf50" : "#f44336";
            } else if (acad.average && acad.average.status === "incomplete") {
                avgText = "Notes manquantes";
            } else if (acad.average && acad.average.status === "missing_coefficients") {
                avgText = "Coeffs manquants";
            }

            let anomalyHtml = "";
            if (acad.cectStatus && acad.cectStatus.discrepancy > 0) {
                anomalyHtml = `
                    <div style="background:rgba(255,152,0,0.1); border:1px solid #ff9800; padding:10px; border-radius:6px; margin-top:12px; font-size:12px;">
                        <strong style="color:#ff9800; display:block; margin-bottom:5px;">⚠️ Information Documentaire CECT</strong>
                        <span style="color:#e0e0e0;">Total officiel : <strong>${acad.cectStatus.officialTotal}</strong></span><br>
                        <span style="color:#e0e0e0;">Total détaillé : <strong>${acad.cectStatus.detailedTotal}</strong></span><br>
                        <span style="color:#ff9800;">Écart constaté : <strong>${acad.cectStatus.discrepancy}</strong> (Statut: ${acad.cectStatus.status})</span>
                    </div>
                `;
            }

            let alertsHtml = "";
            if (acad.alerts && acad.alerts.length > 0) {
                alertsHtml = `<div style="margin-top:12px;">`;
                acad.alerts.forEach(al => {
                    const icon = al.type === 'DOCUMENTARY_STATE' ? '📄' : '🔔';
                    alertsHtml += `<div style="font-size:12px; padding:8px; border-radius:6px; background:#1a2b33; margin-bottom:6px; border-left:3px solid #00f2fe; color:#e0e0e0;">
                        ${icon} <strong>${al.code}</strong>: ${al.message}
                    </div>`;
                });
                alertsHtml += `</div>`;
            }

            acadInfoHtml = `
                <div style="background:#0b1a20; padding:15px; border-radius:8px; border:1px solid #1a3644;">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <h3 style="color:#00f2fe; margin:0; font-size:16px;">🎓 ${acad.semester ? acad.semester.name : 'Semestre inconnu'}</h3>
                        <div style="background:#152b36; padding:4px 10px; border-radius:6px; font-size:13px; font-weight:bold; color:${avgColor}; border:1px solid ${avgColor};">
                            ${avgText}
                        </div>
                    </div>
                    ${anomalyHtml}
                    ${alertsHtml}
                </div>
            `;
        } else {
            acadInfoHtml = `<p style="color:#88a7b7; font-size:14px; margin:0;">Données académiques indisponibles.</p>`;
        }

        // --- RENDU GLOBAL ---
        this.container.innerHTML = `
            <h2>🖥️ Mon Bureau</h2>
            <p style="color:#88a7b7; font-size:14px; margin-bottom:20px;">Bienvenue dans ton espace de travail personnel.</p>
            
            <div style="display:flex; flex-direction:column; gap:20px; max-width:800px; margin:0 auto;">
                
                <div style="background:#0e1e26; border-left: 5px solid #00f2fe; padding:20px; border-radius:8px; box-shadow: 0 4px 10px rgba(0,0,0,0.3);">
                    <h3 style="color:#00f2fe; margin-top:0; margin-bottom:15px; font-size:18px;">⚡ MAINTENANT</h3>
                    ${nowHtml}
                </div>

                <div style="background:#0e1e26; border-left: 5px solid #4caf50; padding:20px; border-radius:8px; box-shadow: 0 4px 10px rgba(0,0,0,0.3);">
                    <h3 style="color:#4caf50; margin-top:0; margin-bottom:15px; font-size:18px;">📍 AUJOURD'HUI</h3>
                    ${todayHtml}
                </div>

                <div style="background:#0e1e26; border-left: 5px solid #ff9800; padding:20px; border-radius:8px; box-shadow: 0 4px 10px rgba(0,0,0,0.3);">
                    <h3 style="color:#ff9800; margin-top:0; margin-bottom:15px; font-size:18px;">🔭 ENSUITE</h3>
                    ${upcomingHtml}
                </div>

                <div style="background:#0e1e26; border-left: 5px solid #9c27b0; padding:20px; border-radius:8px; box-shadow: 0 4px 10px rgba(0,0,0,0.3);">
                    <h3 style="color:#9c27b0; margin-top:0; margin-bottom:15px; font-size:18px;">📊 BILAN ACADÉMIQUE</h3>
                    ${acadInfoHtml}
                </div>

            </div>
        `;
    }
}
