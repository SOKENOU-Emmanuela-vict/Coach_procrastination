export class AcademicView {
    constructor(containerId, app) {
        this.container = document.getElementById(containerId);
        this.app = app;
    }

    render(state) {
        const user = state.userProfile || {};
        const summary = state.academicSummary;

        let html = `
            <div style="padding:15px; color:#e0e0e0; font-family:sans-serif; overflow-y:auto; height:100%;">
                <h2 style="color:#00f2fe; margin-top:0; border-bottom:1px solid #1a3644; padding-bottom:10px;">🎓 Espace Académique</h2>
                
                ${this._renderProfile(user)}
                
                ${summary ? this._renderSummary(summary) : '<p style="color:#88a7b7;">Aucun semestre courant sélectionné ou données introuvables.</p>'}
                
                ${summary ? this._renderAlertsAndAssessments(summary) : ''}
                
                ${summary ? this._renderSubjects(summary) : ''}
            </div>
        `;

        this.container.innerHTML = html;
    }

    _renderProfile(user) {
        const getValue = (val) => (val !== null && val !== undefined && val !== '') ? val : '<span style="color:#88a7b7; font-style:italic;">Non renseigné</span>';
        
        return `
            <div style="background:#0b1a20; padding:15px; border-radius:8px; border:1px solid #1a3644; margin-bottom:20px;">
                <h3 style="color:#fff; margin-top:0; margin-bottom:15px; font-size:16px;">👤 Profil Étudiant</h3>
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; font-size:14px;">
                    <div><strong style="color:#a8d8ea;">Nom :</strong> ${getValue(user.name)}</div>
                    <div><strong style="color:#a8d8ea;">Formation :</strong> ${getValue(user.formation)}</div>
                    <div><strong style="color:#a8d8ea;">Niveau :</strong> ${getValue(user.niveau)}</div>
                    <div><strong style="color:#a8d8ea;">Groupe :</strong> ${getValue(user.groupe)}</div>
                    <div style="grid-column:1 / -1;"><strong style="color:#a8d8ea;">Semestre courant :</strong> ${getValue(user.currentSemesterId)}</div>
                </div>
            </div>
        `;
    }

    _renderSummary(summary) {
        const avgValue = summary.average && summary.average.value !== null ? `${summary.average.value}/20` : '--/20';
        
        let avgStatusText = '';
        if (summary.average.status === 'missing_coefficients') avgStatusText = 'Coefficients manquants';
        else if (summary.average.status === 'incomplete') avgStatusText = 'Notes manquantes';
        else if (summary.average.status === 'complete') avgStatusText = 'Calcul complet';
        else avgStatusText = 'Données incomplètes';

        let cectHtml = '';
        if (summary.cectStatus) {
            cectHtml = `
                <div style="margin-top:10px; border-top:1px dashed #1a3644; padding-top:10px;">
                    <div style="color:#fff; font-size:14px;"><strong style="color:#a8d8ea;">CECT :</strong> ${summary.cectStatus.detailedTotal} détaillés / ${summary.cectStatus.officialTotal} officiels</div>
                    ${summary.cectStatus.discrepancy > 0 ? `
                        <div style="color:#ff9800; font-size:13px; margin-top:5px; padding:5px; background:rgba(255,152,0,0.1); border-radius:4px; border:1px solid #ff9800;">
                            ⚠️ Écart documentaire : ${summary.cectStatus.discrepancy} CECT — ${summary.cectStatus.status === 'to_confirm' ? 'à confirmer' : summary.cectStatus.status}
                        </div>
                    ` : ''}
                </div>
            `;
        }

        return `
            <div style="background:#152b36; padding:15px; border-radius:8px; border-left:4px solid #00f2fe; margin-bottom:20px;">
                <h3 style="color:#00f2fe; margin-top:0; margin-bottom:10px; font-size:16px;">📊 Synthèse : ${summary.semester.name || summary.semester.id}</h3>
                
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <div style="font-size:24px; font-weight:bold; color:#fff;">${avgValue}</div>
                        <div style="font-size:12px; color:#88a7b7;">${avgStatusText}</div>
                    </div>
                </div>
                ${cectHtml}
            </div>
        `;
    }

    _renderAlertsAndAssessments(summary) {
        let html = '';

        // Alertes
        if (summary.alerts && summary.alerts.length > 0) {
            html += `
                <div style="background:rgba(244,67,54,0.1); border:1px solid #f44336; border-radius:8px; padding:15px; margin-bottom:20px;">
                    <h3 style="color:#f44336; margin-top:0; margin-bottom:10px; font-size:14px;">⚠️ Alertes Académiques</h3>
                    <ul style="margin:0; padding-left:20px; color:#e0e0e0; font-size:13px;">
            `;
            summary.alerts.forEach(al => {
                html += `<li style="margin-bottom:5px;"><strong>[${al.code}]</strong> ${al.message}</li>`;
            });
            html += `</ul></div>`;
        }

        // Évaluations à venir
        if (summary.upcomingAssessments && summary.upcomingAssessments.length > 0) {
            html += `
                <div style="background:#0b1a20; padding:15px; border-radius:8px; border:1px solid #1a3644; margin-bottom:20px;">
                    <h3 style="color:#fff; margin-top:0; margin-bottom:10px; font-size:14px;">📅 Prochaines Évaluations</h3>
            `;
            summary.upcomingAssessments.forEach(ass => {
                const dayColor = ass.daysRemaining <= 7 ? '#f44336' : (ass.daysRemaining <= 15 ? '#ff9800' : '#4caf50');
                html += `
                    <div style="background:#152b36; padding:10px; border-radius:6px; margin-bottom:8px; display:flex; justify-content:space-between; align-items:center;">
                        <div>
                            <div style="color:#fff; font-size:14px; font-weight:bold;">${ass.title}</div>
                            <div style="color:#88a7b7; font-size:12px;">Matière : ${ass.subjectName} | Date : ${new Date(ass.targetDate).toLocaleDateString('fr-FR')}</div>
                        </div>
                        <div style="color:${dayColor}; font-weight:bold; font-size:14px;">
                            J-${ass.daysRemaining}
                        </div>
                    </div>
                `;
            });
            html += `</div>`;
        }

        return html;
    }

    _renderSubjects(summary) {
        let html = `
            <div style="background:#0b1a20; padding:15px; border-radius:8px; border:1px solid #1a3644; margin-bottom:20px;">
                <h3 style="color:#fff; margin-top:0; margin-bottom:15px; font-size:16px;">📚 Matières du semestre</h3>
        `;

        if (!summary.subjects || summary.subjects.length === 0) {
            html += `<p style="color:#88a7b7; font-size:13px;">Aucune matière trouvée.</p></div>`;
            return html;
        }

        summary.subjects.forEach(sub => {
            const avgStr = sub.average !== null ? `${sub.average}/20` : '--/20';
            let statusBadge = '';
            if (sub.status === 'complete') statusBadge = '<span style="background:#4caf50; color:#fff; padding:2px 6px; border-radius:4px; font-size:11px;">Complet</span>';
            else if (sub.status === 'incomplete_weights') statusBadge = '<span style="background:#ff9800; color:#fff; padding:2px 6px; border-radius:4px; font-size:11px;">Coeff manquants</span>';
            else if (sub.status === 'no_grades') statusBadge = '<span style="background:#88a7b7; color:#fff; padding:2px 6px; border-radius:4px; font-size:11px;">Sans note</span>';

            html += `
                <div style="border-bottom:1px solid #1a3644; padding-bottom:10px; margin-bottom:10px;">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <div style="font-size:14px; color:#00f2fe; font-weight:bold;">${sub.name} <span style="color:#88a7b7; font-weight:normal; font-size:12px;">(${sub.subjectId})</span></div>
                        <div style="font-size:14px; font-weight:bold; color:#fff;">${avgStr}</div>
                    </div>
                    <div style="margin-top:5px; display:flex; justify-content:space-between; align-items:center;">
                        ${statusBadge}
                        <div style="font-size:11px; color:#88a7b7;">
                            Évaluations prises en compte : ${sub.assessmentsUsed ? sub.assessmentsUsed.length : 0}
                        </div>
                    </div>
                </div>
            `;
        });

        html += `</div>`;
        return html;
    }
}
