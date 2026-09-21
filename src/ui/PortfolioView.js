export class PortfolioView {
    constructor(containerId, app) {
        this.container = document.getElementById(containerId);
        this.app = app;
        this.activeTab = 'all'; // 'all', 'proofs', 'checkins'
    }
    
    render(state) {
        const report = state.monthlyReport || {
            month: new Date().getMonth() + 1,
            year: new Date().getFullYear(),
            summary: "Bootcamp intensif en cours. Progression constante sur 4 semaines.",
            totalHours: 0,
            daysActive: 0,
            avgQuality: 4.0,
            proofsGenerated: 0
        };

        // Collecter les stats par domaine
        let domainsHtml = "";
        if (state.learningGraph && state.learningGraph.nodes) {
            domainsHtml = `<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 15px; margin-bottom: 25px;">`;
            Object.values(state.learningGraph.nodes).forEach(node => {
                // node: { id, title, level, confidence, hours, proofs }
                const hrs = (node.hours || 0).toFixed(1);
                const prfCount = node.proofs ? node.proofs.length : 0;
                let color = node.color || "#00f2fe";

                domainsHtml += `
                <div style="background: linear-gradient(135deg, #162c38 0%, #0f2027 100%); border: 1px solid ${color}; border-radius: 12px; padding: 15px; box-shadow: 0 4px 10px rgba(0,0,0,0.3);">
                    <h4 style="color: ${color}; margin: 0 0 10px 0; font-size: 16px; border-bottom: 1px solid #1e3f52; padding-bottom: 8px;">${node.title}</h4>
                    <div style="display:flex; justify-content:space-between; margin-bottom: 6px;">
                        <span style="color:#88a7b7; font-size:13px;">Temps passé :</span>
                        <strong style="color:#ffffff; font-size:13px;">${hrs} h</strong>
                    </div>
                    <div style="display:flex; justify-content:space-between; margin-bottom: 6px;">
                        <span style="color:#88a7b7; font-size:13px;">Preuves validées :</span>
                        <strong style="color:#ffffff; font-size:13px;">${prfCount}</strong>
                    </div>
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-top: 10px;">
                        <span style="color:#88a7b7; font-size:12px;">Avancement</span>
                        <div style="width: 60%; background: #071015; border-radius: 10px; height: 8px; overflow: hidden; border: 1px solid #1e3f52;">
                            <div style="width: ${Math.min(100, node.level || 0)}%; background: ${color}; height: 100%; border-radius: 10px;"></div>
                        </div>
                    </div>
                </div>`;
            });
            domainsHtml += `</div>`;
        }

        let totalProofsCount = 0;
        let proofsCardsHtml = "";
        if (state.learningGraph && state.learningGraph.nodes) {
            Object.values(state.learningGraph.nodes).forEach(node => {
                if (node.proofs && node.proofs.length > 0) {
                    node.proofs.forEach(p => {
                        totalProofsCount++;
                        const hasImg = p.image ? true : false;
                        proofsCardsHtml += `
                        <div class="proof-card" style="background: linear-gradient(135deg, #12242f 0%, #0c1921 100%); border: 1px solid #2a5268; border-radius: 12px; padding: 15px; margin-bottom: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.3); transition: transform 0.2s;">
                            <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:10px;">
                                <div>
                                    <span style="background: #1a3848; color: #00f2fe; padding: 4px 10px; border-radius: 20px; font-size: 12px; font-weight: bold;">
                                        📌 ${p.type || "Capture / Preuve"}
                                    </span>
                                    <span style="color: #88a7b7; font-size: 12px; margin-left: 10px;">📅 ${p.date || 'Récemment'}</span>
                                </div>
                                <span style="color: ${node.color || '#ff9800'}; font-size: 12px; font-weight: bold;">🎯 ${node.title}</span>
                            </div>
                            
                            <div style="margin-top: 10px; font-size: 14px; color: #ffffff; line-height: 1.4; font-weight: 500;">
                                ${p.description || "Preuve d'accomplissement de séance validée avec succès."}
                            </div>
                            
                            ${hasImg ? `
                            <div style="margin-top: 12px; text-align: center; background: #071015; padding: 8px; border-radius: 8px; border: 1px solid #1e3f52;">
                                <img src="${p.image}" alt="Capture d'écran preuve" style="max-width: 100%; max-height: 240px; border-radius: 6px; cursor: pointer; border: 1px solid #00f2fe;" onclick="const win = window.open(); win.document.write('<img src=\\'${p.image}\\' style=\\'max-width:100%;\\'>');">
                                <p style="font-size: 11px; color: #00f2fe; margin: 4px 0 0 0;">🔍 Cliquez sur l'image pour l'agrandir</p>
                            </div>` : ''}

                            <div style="margin-top: 10px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
                                <span style="font-size: 12px; color: #88a7b7;">Origine : <strong style="color:#e0e0e0;">${p.source || 'Séance du Bootcamp'}</strong></span>
                                ${p.url ? `<a href="${p.url}" target="_blank" style="background: #00f2fe; color: #0f2027; padding: 5px 12px; border-radius: 15px; font-size: 12px; font-weight: bold; text-decoration: none;">🔗 Voir le lien officiel →</a>` : ''}
                            </div>
                        </div>`;
                    });
                }
            });
        }

        if (!proofsCardsHtml) {
            proofsCardsHtml = `
            <div style="background: #0f2027; border: 1px dashed #2a5268; border-radius: 10px; padding: 25px; text-align: center; color: #88a7b7;">
                <p style="font-size: 15px; margin: 0;">📸 Aucune capture ou preuve n'a encore été ajoutée.</p>
                <p style="font-size: 13px; margin: 5px 0 0 0;">Validez une séance dans l'écran <strong>Planning / Focus</strong> et cliquez sur "📸 Joindre une photo" !</p>
            </div>`;
        }

        // Collecter l'historique des bilans
        let totalCheckinsCount = 0;
        let checkinsHtml = "";
        if (state.allCheckins) {
            const dates = Object.keys(state.allCheckins).sort((a, b) => new Date(b) - new Date(a));
            totalCheckinsCount = dates.length;
            dates.forEach(date => {
                const j = state.allCheckins[date];
                if (!j) return;
                const moodEmojis = ["", "😭", "😟", "😐", "🙂", "🤩"];
                const moodLabel = moodEmojis[j.mood] || "🙂";
                const hasVoice = j.voiceNote ? true : false;
                
                checkinsHtml += `
                <div style="background: linear-gradient(135deg, #12242f 0%, #0c1921 100%); border: 1px solid #2a5268; border-radius: 12px; padding: 16px; margin-bottom: 15px; box-shadow: 0 4px 12px rgba(0,0,0,0.3);">
                    <div style="display:flex; justify-content:space-between; align-items:center; border-bottom: 1px solid #1e3f52; padding-bottom: 10px; margin-bottom: 12px; flex-wrap:wrap; gap:10px;">
                        <span style="color: #00f2fe; font-weight: bold; font-size: 16px;">📅 Bilan du ${date}</span>
                        <div style="display:flex; gap:12px; align-items:center;">
                            <span style="background:#1a3848; color:#fff; padding:4px 10px; border-radius:15px; font-size:12px;">Humeur : ${moodLabel} (${j.mood}/5)</span>
                            <span style="background:#1a3848; color:#fff; padding:4px 10px; border-radius:15px; font-size:12px;">⚡ Énergie : ${j.energy || 3}/5</span>
                        </div>
                    </div>

                    ${hasVoice ? `
                    <div style="background: #162c38; border: 1px solid #00f2fe; border-radius: 8px; padding: 10px; margin-bottom: 12px;">
                        <span style="color: #00f2fe; font-size: 12px; font-weight: bold; display: block; margin-bottom: 5px;">🎧 Note Audio Vocale enregistrée :</span>
                        <audio controls src="${j.voiceNote}" style="width: 100%; max-height: 38px;"></audio>
                    </div>` : ''}

                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 10px;">
                        ${j.learned ? `
                        <div style="background:#0a161c; padding:10px; border-radius:8px; border-left:3px solid #00f2fe;">
                            <strong style="color:#00f2fe; font-size:12px; display:block; margin-bottom:4px;">💡 J'ai appris :</strong>
                            <span style="color:#e0e0e0; font-size:13px; line-height:1.4;">${j.learned}</span>
                        </div>` : ''}

                        ${j.blockers ? `
                        <div style="background:#0a161c; padding:10px; border-radius:8px; border-left:3px solid #ff9800;">
                            <strong style="color:#ff9800; font-size:12px; display:block; margin-bottom:4px;">🚧 Bloqué par :</strong>
                            <span style="color:#e0e0e0; font-size:13px; line-height:1.4;">${j.blockers}</span>
                        </div>` : ''}

                        ${j.improve ? `
                        <div style="background:#0a161c; padding:10px; border-radius:8px; border-left:3px solid #4CAF50;">
                            <strong style="color:#4CAF50; font-size:12px; display:block; margin-bottom:4px;">🚀 À améliorer demain :</strong>
                            <span style="color:#e0e0e0; font-size:13px; line-height:1.4;">${j.improve}</span>
                        </div>` : ''}
                    </div>
                </div>`;
            });
        }

        if (!checkinsHtml) {
            checkinsHtml = `
            <div style="background: #0f2027; border: 1px dashed #2a5268; border-radius: 10px; padding: 25px; text-align: center; color: #88a7b7;">
                <p style="font-size: 15px; margin: 0;">📖 Aucun bilan n'a encore été enregistré.</p>
                <p style="font-size: 13px; margin: 5px 0 0 0;">Faites votre point avec le Coach en fin de journée !</p>
            </div>`;
        }

        this.container.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; margin-bottom: 20px;">
                <div>
                    <h2 style="margin:0; color:#ffffff; font-size: 24px;">🏆 Mon Portfolio Officiel & Historique</h2>
                    <p style="margin:4px 0 0 0; color:#88a7b7; font-size:14px;">Vitrine complète de vos compétences, captures d'écran, vocaux et accomplissements</p>
                </div>
                <div style="display:flex; gap:10px;">
                    <button type="button" id="btn-export-data" style="background:transparent; color:#ffb74d; font-weight:bold; border:1px solid #ffb74d; padding:10px 15px; border-radius:20px; cursor:pointer; font-size:13px;">
                        💾 Exporter Backup
                    </button>
                    <label for="input-import-data" style="background:transparent; color:#ffb74d; font-weight:bold; border:1px solid #ffb74d; padding:10px 15px; border-radius:20px; cursor:pointer; font-size:13px; display:inline-block;">
                        📂 Importer Backup
                    </label>
                    <input type="file" id="input-import-data" accept=".json" style="display:none;">
                    <button type="button" onclick="window.print()" style="background:linear-gradient(90deg, #00f2fe, #4facfe); color:#0f2027; font-weight:bold; border:none; padding:10px 18px; border-radius:20px; cursor:pointer; font-size:13px; box-shadow: 0 2px 8px rgba(0,242,254,0.3);">
                        🖨️ Exporter en PDF / Imprimer
                    </button>
                </div>
            </div>

            <!-- CARTE HÉROS VITRINE DES BADGES -->
            <div style="background: linear-gradient(135deg, #152b36 0%, #0c1921 100%); border: 2px solid #00f2fe; border-radius: 15px; padding: 20px; margin-bottom: 25px; box-shadow: 0 8px 25px rgba(0,0,0,0.4);">
                <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:15px; border-bottom:1px solid #2a5268; padding-bottom:15px; margin-bottom:15px;">
                    <div>
                        <h3 style="color:#00f2fe; margin:0; font-size:18px;">🎓 Cohorte Force-N 2026 — Bootcamp 4 Semaines</h3>
                        <p style="color:#e0e0e0; font-size:13px; margin:4px 0 0 0;">${report.summary}</p>
                    </div>
                    <div style="display:flex; gap:8px; flex-wrap:wrap;">
                        <span style="background:#0f2027; color:#00f2fe; border:1px solid #00f2fe; padding:6px 12px; border-radius:20px; font-size:12px; font-weight:bold;">🚀 Bootcamp Actif</span>
                        <span style="background:#0f2027; color:#ff9800; border:1px solid #ff9800; padding:6px 12px; border-radius:20px; font-size:12px; font-weight:bold;">🎓 Force-N</span>
                    </div>
                </div>

                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 12px; text-align: center;">
                    <div style="background:#0f2027; padding:12px; border-radius:10px; border:1px solid #2a5268;">
                        <span style="font-size: 22px; font-weight: bold; color: #00f2fe; display: block;">${totalProofsCount}</span>
                        <span style="font-size: 12px; color: #88a7b7;">📸 Preuves & Captures</span>
                    </div>
                    <div style="background:#0f2027; padding:12px; border-radius:10px; border:1px solid #2a5268;">
                        <span style="font-size: 22px; font-weight: bold; color: #ffb74d; display: block;">${totalCheckinsCount}</span>
                        <span style="font-size: 12px; color: #88a7b7;">📖 Bilans Remplis</span>
                    </div>
                    <div style="background:#0f2027; padding:12px; border-radius:10px; border:1px solid #2a5268;">
                        <span style="font-size: 22px; font-weight: bold; color: #4CAF50; display: block;">${report.totalHours || 0} h</span>
                        <span style="font-size: 12px; color: #88a7b7;">⏱️ Heures de Vol</span>
                    </div>
                    <div style="background:#0f2027; padding:12px; border-radius:10px; border:1px solid #2a5268;">
                        <span style="font-size: 22px; font-weight: bold; color: #e1bee7; display: block;">${report.avgQuality || 4.0} / 5</span>
                        <span style="font-size: 12px; color: #88a7b7;">⭐ Qualité Moyenne</span>
                    </div>
                </div>

                <div style="margin-top: 15px; display:flex; gap:10px; flex-wrap:wrap; justify-content:center;">
                    <span style="background:#18323f; color:#fff; padding:5px 12px; border-radius:15px; font-size:11px;">🇬🇧 Anglais & Storytelling FR</span>
                    <span style="background:#18323f; color:#fff; padding:5px 12px; border-radius:15px; font-size:11px;">🛡️ Cybersécurité & TryHackMe</span>
                    <span style="background:#18323f; color:#fff; padding:5px 12px; border-radius:15px; font-size:11px;">🤖 IA & Code Python</span>
                    <span style="background:#18323f; color:#fff; padding:5px 12px; border-radius:15px; font-size:11px;">📊 Excel & Analyse de données</span>
                </div>
            </div>

            <!-- SECTION DOMAINES / MATIÈRES -->
            <h3 style="color: #00f2fe; border-left: 4px solid #00f2fe; padding-left: 10px; margin-bottom: 15px; font-size: 18px;">
                📚 Mes Matières & Domaines d'Étude
            </h3>
            ${domainsHtml}

            <!-- ONGLES DE NAVIGATION DU PORTFOLIO -->
            <div style="display:flex; gap:10px; margin-bottom:20px; border-bottom:1px solid #2a5268; padding-bottom:10px; flex-wrap:wrap;">
                <button type="button" class="tab-btn-portfolio" data-tab="all" style="background:#00f2fe; color:#0f2027; font-weight:bold; border:none; padding:8px 16px; border-radius:20px; cursor:pointer; font-size:13px;">
                    ⭐ Vue Complète
                </button>
                <button type="button" class="tab-btn-portfolio" data-tab="proofs" style="background:#152b36; color:#e0e0e0; border:1px solid #2a5268; padding:8px 16px; border-radius:20px; cursor:pointer; font-size:13px;">
                    📸 Galerie des Preuves (${totalProofsCount})
                </button>
                <button type="button" class="tab-btn-portfolio" data-tab="checkins" style="background:#152b36; color:#e0e0e0; border:1px solid #2a5268; padding:8px 16px; border-radius:20px; cursor:pointer; font-size:13px;">
                    📖 Historique des Bilans (${totalCheckinsCount})
                </button>
            </div>

            <!-- SECTION DES PREUVES -->
            <div id="portfolio-section-proofs" style="margin-bottom: 35px;">
                <h3 style="color: #00f2fe; border-left: 4px solid #00f2fe; padding-left: 10px; margin-bottom: 15px; font-size: 18px;">
                    📸 Mes Preuves & Captures d'Écran
                </h3>
                ${proofsCardsHtml}
            </div>

            <!-- SECTION DES JOURNAUX -->
            <div id="portfolio-section-checkins">
                <h3 style="color: #00f2fe; border-left: 4px solid #00f2fe; padding-left: 10px; margin-bottom: 15px; font-size: 18px;">
                    📖 Historique de mes Bilans Quotidiens
                </h3>
                ${checkinsHtml}
            </div>
        `;

        this.attachPortfolioTabs();
    }

    attachPortfolioTabs() {
        const buttons = document.querySelectorAll('.tab-btn-portfolio');
        const secProofs = document.getElementById('portfolio-section-proofs');
        const secCheckins = document.getElementById('portfolio-section-checkins');

        buttons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tab = e.currentTarget.getAttribute('data-tab');
                
                // Mettre à jour le style des boutons
                buttons.forEach(b => {
                    b.style.background = '#152b36';
                    b.style.color = '#e0e0e0';
                    b.style.fontWeight = 'normal';
                    b.style.border = '1px solid #2a5268';
                });
                
                e.currentTarget.style.background = "#00f2fe";
                e.currentTarget.style.color = '#0f2027';
                e.currentTarget.style.fontWeight = 'bold';
                e.currentTarget.style.border = 'none';

                // Mettre à jour l'affichage
                if (tab === 'all') {
                    secProofs.style.display = 'block';
                    secCheckins.style.display = 'block';
                } else if (tab === 'proofs') {
                    secProofs.style.display = 'block';
                    secCheckins.style.display = 'none';
                } else if (tab === 'checkins') {
                    secProofs.style.display = 'none';
                    secCheckins.style.display = 'block';
                }
            });
        });

        // Event listeners for Export / Import
        const btnExport = document.getElementById('btn-export-data');
        if (btnExport) {
            btnExport.addEventListener('click', async () => {
                try {
                    const dbKeys = ['study_history', 'user_profile', 'daily_checkins', 'bootcamp_program_version'];
                    const exportData = {};
                    for (const key of dbKeys) {
                        exportData[key] = await this.app.storage.loadData(key);
                    }
                    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportData));
                    const downloadAnchorNode = document.createElement('a');
                    downloadAnchorNode.setAttribute("href", dataStr);
                    downloadAnchorNode.setAttribute("download", "backup_procrastination.json");
                    document.body.appendChild(downloadAnchorNode); // required for firefox
                    downloadAnchorNode.click();
                    downloadAnchorNode.remove();
                    alert("Sauvegarde téléchargée avec succès !");
                } catch(e) {
                    alert("Erreur lors de l'export: " + e.message);
                }
            });
        }

        const inputImport = document.getElementById('input-import-data');
        if (inputImport) {
            inputImport.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (!file) return;
                
                if (confirm("⚠️ Attention : l'importation va écraser TOUTES vos données actuelles. Voulez-vous continuer ?")) {
                    const reader = new FileReader();
                    reader.onload = async (event) => {
                        try {
                            const importedData = JSON.parse(event.target.result);
                            for (const key in importedData) {
                                await this.app.storage.saveData(key, importedData[key]);
                            }
                            alert("Données importées avec succès ! L'application va redémarrer.");
                            window.location.reload(true);
                        } catch(err) {
                            alert("Fichier de sauvegarde invalide ou corrompu.");
                        }
                    };
                    reader.readAsText(file);
                } else {
                    inputImport.value = ""; // Reset input
                }
            });
        }
    }
}
