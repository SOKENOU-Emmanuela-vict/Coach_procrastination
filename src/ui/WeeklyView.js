export class WeeklyView {
    constructor(containerId, app) {
        this.container = document.getElementById(containerId);
        this.app = app;
    }

    render(summary) {
        if (!summary) {
            this.container.innerHTML = `
                <div style="text-align: center; padding: 40px;">
                    <h2 style="color: #ff9800;">Erreur ou chargement</h2>
                    <p style="color: #88a7b7;">Impossible de charger la Weekly Review.</p>
                </div>
            `;
            return;
        }

        const { execution, subjectBreakdown, adHocSessions, followUps, trends, dailySummaries } = summary;

        // Période
        let periodStr = "Semaine en cours";
        if (dailySummaries && dailySummaries.length > 0) {
            const start = dailySummaries[0].date;
            const end = dailySummaries[dailySummaries.length - 1].date;
            periodStr = `Du ${start} au ${end}`;
        }

        // Breakdown HTML
        let breakdownHtml = "";
        if (subjectBreakdown && Object.keys(subjectBreakdown).length > 0) {
            for (const [subjectId, metrics] of Object.entries(subjectBreakdown)) {
                breakdownHtml += `
                    <div style="background:#0b1a20; padding:10px; border-radius:6px; margin-bottom:10px; border-left:3px solid #00f2fe;">
                        <strong style="color:#ffffff;">${subjectId}</strong>
                        <div style="font-size:12px; color:#88a7b7; display:flex; gap:15px; margin-top:5px;">
                            <span>Planifié : <strong style="color:#fff;">${metrics.planned || 0}</strong></span>
                            <span>Complété : <strong style="color:#4caf50;">${metrics.completed || 0}</strong></span>
                            <span>Manqué : <strong style="color:#f44336;">${metrics.missed || 0}</strong></span>
                        </div>
                    </div>
                `;
            }
        } else {
            breakdownHtml = "<p style='color:#88a7b7; font-size:13px;'>Aucune donnée de matière disponible.</p>";
        }

        // Follow-ups HTML
        let followUpsHtml = "";
        if (followUps && followUps.length > 0) {
            followUps.forEach(f => {
                followUpsHtml += `<div style="background:#1a1005; border:1px solid #ff9800; padding:8px; border-radius:4px; margin-bottom:5px; font-size:13px;">
                    <strong style="color:#ff9800;">⚠️ À reprendre :</strong> ${f.title} (${f.type})
                </div>`;
            });
        } else {
            followUpsHtml = "<p style='color:#88a7b7; font-size:13px;'>Aucune session marquée à reprendre.</p>";
        }

        // Ad-hoc HTML
        let adhocHtml = "";
        if (adHocSessions && adHocSessions.length > 0) {
            adHocSessions.forEach(a => {
                adhocHtml += `<div style="background:#051a15; border:1px solid #4caf50; padding:8px; border-radius:4px; margin-bottom:5px; font-size:13px;">
                    <strong style="color:#4caf50;">➕ Hors planning :</strong> ${a.title} (${a.actualDuration || 0} min)
                </div>`;
            });
        } else {
            adhocHtml = "<p style='color:#88a7b7; font-size:13px;'>Aucune session hors planning.</p>";
        }

        // Daily HTML
        let dailyHtml = "";
        if (dailySummaries && dailySummaries.length > 0) {
            dailySummaries.forEach(d => {
                dailyHtml += `
                    <div style="background:#11222c; border:1px solid #2a5268; padding:10px; border-radius:6px; margin-bottom:8px; display:flex; justify-content:space-between; align-items:center;">
                        <div>
                            <strong style="color:#00f2fe; display:block; font-size:14px;">📅 ${d.date}</strong>
                            <span style="font-size:11px; color:#88a7b7;">Score : ${d.completionRate}% | Énergie : ${d.energy || 'N/A'}</span>
                        </div>
                        <div style="text-align:right; font-size:12px; color:#e0e0e0;">
                            ✅ ${d.execution?.completed || d.completedSessions || 0} | ❌ ${d.execution?.missed || d.missedSessions || 0}
                        </div>
                    </div>
                `;
            });
        }

        this.container.innerHTML = `
            <h2>📊 Weekly Review</h2>
            <p style="color:#88a7b7; margin-top:0; font-size:14px;">${periodStr}</p>
            
            <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:15px; margin-bottom:20px;">
                <!-- Bloc Temps -->
                <div style="background: linear-gradient(135deg, #162c38 0%, #0f2027 100%); border:1px solid #00f2fe; padding:15px; border-radius:10px; text-align:center; box-shadow: 0 4px 10px rgba(0,0,0,0.3);">
                    <h4 style="color:#00f2fe; margin:0 0 10px 0;">Temps de Travail</h4>
                    <div style="font-size:28px; font-weight:bold; color:#fff;">${execution.actualDuration || execution.actualMinutes || 0} <span style="font-size:14px; color:#88a7b7;">min</span></div>
                    <div style="font-size:12px; color:#88a7b7; margin-top:5px;">sur ${execution.plannedDuration || execution.plannedMinutes || 0} min planifiées</div>
                </div>
                
                <!-- Bloc Taux de Complétion -->
                <div style="background: linear-gradient(135deg, #162c38 0%, #0f2027 100%); border:1px solid #4caf50; padding:15px; border-radius:10px; text-align:center; box-shadow: 0 4px 10px rgba(0,0,0,0.3);">
                    <h4 style="color:#4caf50; margin:0 0 10px 0;">Taux de Complétion</h4>
                    <div style="font-size:28px; font-weight:bold; color:#fff;">${execution.completionRate || 0}%</div>
                    <div style="font-size:12px; color:#88a7b7; margin-top:5px;">✅ ${execution.completed || 0} | ⚠️ ${execution.partial || 0} | ❌ ${execution.missed || 0} | 🚫 ${execution.cancelled || 0}</div>
                </div>

                <!-- Bloc Tendances -->
                <div style="background: linear-gradient(135deg, #162c38 0%, #0f2027 100%); border:1px solid #ff9800; padding:15px; border-radius:10px; text-align:center; box-shadow: 0 4px 10px rgba(0,0,0,0.3);">
                    <h4 style="color:#ff9800; margin:0 0 10px 0;">Tendances Physiologiques</h4>
                    <div style="font-size:14px; color:#e0e0e0; margin-bottom:8px;">Jours d'énergie faible : <strong style="color:#ff9800;">${trends.lowEnergyDays || 0}</strong></div>
                    <div style="font-size:14px; color:#e0e0e0;">Sommeil moyen : <strong style="color:#fff;">${trends.averageSleep ? (trends.averageSleep / 60).toFixed(1) : 0} h</strong></div>
                </div>
            </div>

            <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap:20px; margin-bottom:20px;">
                <!-- Répartition par Matière -->
                <div style="background:#0e1e26; padding:15px; border-radius:10px; border-top:4px solid #00f2fe;">
                    <h3 style="color:#00f2fe; margin-top:0;">📚 Répartition (Matières/Skills)</h3>
                    ${breakdownHtml}
                </div>

                <!-- Follow-ups & Ad-Hoc -->
                <div style="background:#0e1e26; padding:15px; border-radius:10px; border-top:4px solid #ff9800;">
                    <h3 style="color:#ff9800; margin-top:0;">🔄 Follow-ups & Ad-Hoc</h3>
                    ${followUpsHtml}
                    <div style="margin-top:15px; border-top:1px dashed #2a5268; padding-top:10px;">
                        ${adhocHtml}
                    </div>
                </div>
            </div>

            <div style="background:#0e1e26; padding:15px; border-radius:10px; border-top:4px solid #4caf50;">
                <h3 style="color:#4caf50; margin-top:0;">📆 Résumé des Jours</h3>
                ${dailyHtml}
            </div>

            <button id="btn-weekly-back" style="width: 100%; margin-top: 20px; background: transparent; color: #88a7b7; border: 1px solid #2a5268; padding: 12px; border-radius: 20px; cursor: pointer; font-size: 15px;">
                ⬅️ Retour au Dashboard
            </button>
        `;

        const btnBack = document.getElementById('btn-weekly-back');
        if (btnBack) {
            btnBack.addEventListener('click', () => {
                this.app.renderView('coach');
            });
        }
    }
}
