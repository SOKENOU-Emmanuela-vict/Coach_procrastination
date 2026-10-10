import { escapeHtml } from '../utils/html.js';

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
            summary: "Progression constante sur 4 semaines.",
            totalHours: 0,
            daysActive: 0,
            avgQuality: 4.0,
            proofsGenerated: 0
        };

        // Section Projets & Tâches
        let projectsHtml = `
        <div style="background:#12242f; padding:15px; border:1px solid #2a5268; border-radius:10px; margin-bottom:15px; display:flex; justify-content:space-between; align-items:center;">
            <h4 style="color:#00f2fe; margin:0;">🎯 Mes Éléments</h4>
            <button type="button" class="btn-open-modal" data-action="new" style="background:#00f2fe; color:#0f2027; border:none; padding:8px 15px; border-radius:5px; cursor:pointer; font-weight:bold;">➕ Ajouter un élément</button>
        </div>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 15px;">`;
        if (state.projects) {
            state.projects.forEach(p => {
                projectsHtml += `<div style="background:#12242f; padding:15px; border:1px solid #2a5268; border-radius:10px; position:relative;">
                    <h4 style="color:#00f2fe; margin:0 0 5px 0; padding-right:50px;">🎯 ${escapeHtml(p.title)}</h4>
                    <div style="color:#88a7b7; font-size:12px;">Domaine: ${p.domain || '-'} | Progression : ${p.progress}%</div>
                    <div style="background:#071015; border-radius:10px; height:6px; overflow:hidden; margin-top:5px;">
                        <div style="width:${p.progress}%; background:#00f2fe; height:100%;"></div>
                    </div>
                    <div style="position:absolute; top:15px; right:15px; display:flex; gap:5px;">
                        <button class="btn-edit-item" data-id="${p.id}" data-type="project" style="background:transparent; border:none; color:#ffb74d; cursor:pointer;">✏️</button>
                        <button class="btn-delete-item" data-id="${p.id}" data-type="project" style="background:transparent; border:none; color:#f44336; cursor:pointer;">🗑️</button>
                    </div>
                </div>`;
            });
        }
        if (state.books) {
            state.books.forEach(b => {
                projectsHtml += `<div style="background:#12242f; padding:15px; border:1px solid #ffb74d; border-radius:10px; position:relative;">
                    <h4 style="color:#ffb74d; margin:0 0 5px 0; padding-right:50px;">📖 ${escapeHtml(b.title)}</h4>
                    <div style="color:#88a7b7; font-size:12px;">Domaine: ${b.domain || '-'} | Avancement : ${b.pagesRead}/${b.totalPages} pages</div>
                    <div style="position:absolute; top:15px; right:15px; display:flex; gap:5px;">
                        <button class="btn-edit-item" data-id="${b.id}" data-type="book" style="background:transparent; border:none; color:#ffb74d; cursor:pointer;">✏️</button>
                        <button class="btn-delete-item" data-id="${b.id}" data-type="book" style="background:transparent; border:none; color:#f44336; cursor:pointer;">🗑️</button>
                    </div>
                </div>`;
            });
        }
        if (state.personalTasks) {
            state.personalTasks.forEach(t => {
                const color = t.status === 'completed' || t.status === 'done' ? '#4CAF50' : '#e0e0e0';
                projectsHtml += `<div style="background:#12242f; padding:15px; border:1px solid ${color}; border-radius:10px; position:relative;">
                    <h4 style="color:${color}; margin:0; font-size:14px; padding-right:50px;">${t.status === 'completed' || t.status === 'done' ? '✅' : '⏳'} ${escapeHtml(t.title)}</h4>
                    <div style="color:#88a7b7; font-size:11px; margin-top:4px;">Domaine: ${t.domain || '-'} | Date: ${t.dueDate || '-'} | Priorité: ${t.priority || '-'}</div>
                    <div style="position:absolute; top:15px; right:15px; display:flex; gap:5px;">
                        <button class="btn-edit-item" data-id="${t.id}" data-type="task" style="background:transparent; border:none; color:#ffb74d; cursor:pointer;">✏️</button>
                        <button class="btn-delete-item" data-id="${t.id}" data-type="task" style="background:transparent; border:none; color:#f44336; cursor:pointer;">🗑️</button>
                    </div>
                </div>`;
            });
        }
        projectsHtml += `</div>`;
        if ((!state.projects || !state.projects.length) && (!state.books || !state.books.length) && (!state.personalTasks || !state.personalTasks.length)) {
            projectsHtml = `<div style="background: #0f2027; border: 1px dashed #2a5268; border-radius: 10px; padding: 25px; text-align: center; color: #88a7b7;">Aucun projet, livre ou tâche pour le moment. Vous pouvez en créer via le chat avec le Coach !</div>`;
        }

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
                                <span style="font-size: 12px; color: #88a7b7;">Origine : <strong style="color:#e0e0e0;">${p.source || 'Séance'}</strong></span>
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
                // Le bilan quotidien (CheckInEngine) stocke energy = 'low' | 'medium' | 'high' et blockers = [] ; mood est optionnel
                const energyScore = typeof j.energy === 'number' ? j.energy : ({ low: 2, medium: 3, high: 4 }[j.energy] || 3);
                const blockersText = Array.isArray(j.blockers) ? j.blockers.filter(Boolean).join(', ') : (j.blockers || '');
                
                checkinsHtml += `
                <div style="background: linear-gradient(135deg, #12242f 0%, #0c1921 100%); border: 1px solid #2a5268; border-radius: 12px; padding: 16px; margin-bottom: 15px; box-shadow: 0 4px 12px rgba(0,0,0,0.3);">
                    <div style="display:flex; justify-content:space-between; align-items:center; border-bottom: 1px solid #1e3f52; padding-bottom: 10px; margin-bottom: 12px; flex-wrap:wrap; gap:10px;">
                        <span style="color: #00f2fe; font-weight: bold; font-size: 16px;">📅 Bilan du ${date}</span>
                        <div style="display:flex; gap:12px; align-items:center;">
                            <span style="background:#1a3848; color:#fff; padding:4px 10px; border-radius:15px; font-size:12px;">Humeur : ${moodLabel} (${j.mood ?? '-'}/5)</span>
                            <span style="background:#1a3848; color:#fff; padding:4px 10px; border-radius:15px; font-size:12px;">⚡ Énergie : ${energyScore}/5</span>
                        </div>
                    </div>

                    ${hasVoice ? `
                    <div style="background: #162c38; border: 1px solid #00f2fe; border-radius: 8px; padding: 10px; margin-bottom: 12px;">
                        <span style="color: #00f2fe; font-size: 12px; font-weight: bold; display: block; margin-bottom: 5px;">🎧 Note Audio Vocale enregistrée :</span>
                        <audio controls src="${escapeHtml(j.voiceNote)}" style="width: 100%; max-height: 38px;"></audio>
                    </div>` : ''}

                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 10px;">
                        ${j.learned ? `
                        <div style="background:#0a161c; padding:10px; border-radius:8px; border-left:3px solid #00f2fe;">
                            <strong style="color:#00f2fe; font-size:12px; display:block; margin-bottom:4px;">💡 J'ai appris :</strong>
                            <span style="color:#e0e0e0; font-size:13px; line-height:1.4;">${escapeHtml(j.learned)}</span>
                        </div>` : ''}

                        ${blockersText ? `
                        <div style="background:#0a161c; padding:10px; border-radius:8px; border-left:3px solid #ff9800;">
                            <strong style="color:#ff9800; font-size:12px; display:block; margin-bottom:4px;">🚧 Bloqué par :</strong>
                            <span style="color:#e0e0e0; font-size:13px; line-height:1.4;">${escapeHtml(blockersText)}</span>
                        </div>` : ''}

                        ${j.improve ? `
                        <div style="background:#0a161c; padding:10px; border-radius:8px; border-left:3px solid #4CAF50;">
                            <strong style="color:#4CAF50; font-size:12px; display:block; margin-bottom:4px;">🚀 À améliorer demain :</strong>
                            <span style="color:#e0e0e0; font-size:13px; line-height:1.4;">${escapeHtml(j.improve)}</span>
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
                        <h3 style="color:#00f2fe; margin:0; font-size:18px;">🎓 Programme d'Apprentissage Personnel</h3>
                        <p style="color:#e0e0e0; font-size:13px; margin:4px 0 0 0;">${report.summary}</p>
                    </div>
                    <div style="display:flex; gap:8px; flex-wrap:wrap;">
                        <span style="background:#0f2027; color:#00f2fe; border:1px solid #00f2fe; padding:6px 12px; border-radius:20px; font-size:12px; font-weight:bold;">🚀 Session Active</span>
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
                <button type="button" class="tab-btn-portfolio active" data-tab="all" style="background:#00f2fe; color:#0f2027; font-weight:bold; border:none; padding:8px 16px; border-radius:20px; cursor:pointer; font-size:13px;">
                    ⭐ Vue Complète
                </button>
                <button type="button" class="tab-btn-portfolio" data-tab="proofs" style="background:#152b36; color:#e0e0e0; border:1px solid #2a5268; padding:8px 16px; border-radius:20px; cursor:pointer; font-size:13px;">
                    📸 Captures (${totalProofsCount})
                </button>
                <button type="button" class="tab-btn-portfolio" data-tab="checkins" style="background:#152b36; color:#e0e0e0; border:1px solid #2a5268; padding:8px 16px; border-radius:20px; cursor:pointer; font-size:13px;">
                    📖 Bilans (${totalCheckinsCount})
                </button>
                <button type="button" class="tab-btn-portfolio" data-tab="projects" style="background:#152b36; color:#e0e0e0; border:1px solid #2a5268; padding:8px 16px; border-radius:20px; cursor:pointer; font-size:13px;">
                    🎯 Projets & Tâches
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

            <!-- SECTION DES PROJETS & TACHES -->
            <div id="portfolio-section-projects" style="display:none; margin-bottom: 35px;">
                <h3 style="color: #00f2fe; border-left: 4px solid #00f2fe; padding-left: 10px; margin-bottom: 15px; font-size: 18px;">
                    🎯 Mes Projets, Livres & Tâches
                </h3>
                ${projectsHtml}
            </div>

            <!-- MODAL EDITION ITEM -->
            <div id="item-editor-modal" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.7); z-index:9999; justify-content:center; align-items:center;">
                <div style="background:#152b36; border:1px solid #00f2fe; border-radius:12px; padding:25px; width:400px; max-width:90%;">
                    <h3 id="modal-item-header" style="color:#00f2fe; margin-top:0;">Éditer l'élément</h3>
                    
                    <input type="hidden" id="modal-item-id">
                    
                    <div style="margin-bottom:12px;">
                        <label style="color:#88a7b7; font-size:12px;">Type</label>
                        <select id="modal-item-type-select" style="width:100%; padding:8px; border-radius:5px; background:#0f2027; color:#e0e0e0; border:1px solid #2a5268;">
                            <option value="project">Projet</option>
                            <option value="book">Livre</option>
                            <option value="task">Tâche</option>
                        </select>
                    </div>

                    <div style="margin-bottom:12px;">
                        <label style="color:#88a7b7; font-size:12px;">Titre</label>
                        <input type="text" id="modal-item-title" style="width:100%; padding:8px; border-radius:5px; background:#0f2027; color:#e0e0e0; border:1px solid #2a5268;">
                    </div>

                    <div style="margin-bottom:12px;">
                        <label style="color:#88a7b7; font-size:12px;">Domaine</label>
                        <select id="modal-item-domain" style="width:100%; padding:8px; border-radius:5px; background:#0f2027; color:#e0e0e0; border:1px solid #2a5268;">
                            <option value="ecole">École</option>
                            <option value="langue">Langues</option>
                            <option value="fitness">Fitness / Bien-être</option>
                            <option value="lecture">Lecture</option>
                            <option value="projet">Projet</option>
                            <option value="perso">Personnel</option>
                        </select>
                    </div>

                    <div style="margin-bottom:12px;">
                        <label style="color:#88a7b7; font-size:12px;">Échéance (Optionnel)</label>
                        <input type="date" id="modal-item-dueDate" style="width:100%; padding:8px; border-radius:5px; background:#0f2027; color:#e0e0e0; border:1px solid #2a5268;">
                    </div>

                    <div style="margin-bottom:12px;">
                        <label style="color:#88a7b7; font-size:12px;">Durée estimée (min)</label>
                        <input type="number" id="modal-item-duration" style="width:100%; padding:8px; border-radius:5px; background:#0f2027; color:#e0e0e0; border:1px solid #2a5268;">
                    </div>

                    <div style="margin-bottom:12px;">
                        <label style="color:#88a7b7; font-size:12px;">Importance</label>
                        <select id="modal-item-priority" style="width:100%; padding:8px; border-radius:5px; background:#0f2027; color:#e0e0e0; border:1px solid #2a5268;">
                            <option value="low">Basse</option>
                            <option value="medium">Moyenne</option>
                            <option value="high">Haute</option>
                        </select>
                    </div>

                    <div style="margin-bottom:20px;">
                        <label style="color:#88a7b7; font-size:12px;">Cible (ex: nbre total de pages)</label>
                        <input type="number" id="modal-item-target" style="width:100%; padding:8px; border-radius:5px; background:#0f2027; color:#e0e0e0; border:1px solid #2a5268;">
                    </div>

                    <div style="display:flex; justify-content:flex-end; gap:10px;">
                        <button type="button" id="btn-modal-cancel" style="background:transparent; color:#88a7b7; border:1px solid #2a5268; padding:8px 15px; border-radius:5px; cursor:pointer;">Annuler</button>
                        <button type="button" id="btn-modal-save" style="background:#00f2fe; color:#0f2027; border:none; padding:8px 15px; border-radius:5px; cursor:pointer; font-weight:bold;">Sauvegarder</button>
                    </div>
                </div>
            </div>
        `;

        this.attachPortfolioTabs();
    }

    attachPortfolioTabs() {
        const buttons = document.querySelectorAll('.tab-btn-portfolio');
        const secProofs = document.getElementById('portfolio-section-proofs');
        const secCheckins = document.getElementById('portfolio-section-checkins');
        const secProjects = document.getElementById('portfolio-section-projects');
        
        // -- LOGIQUE DU MODAL --
        const modal = document.getElementById('item-editor-modal');
        const modalId = document.getElementById('modal-item-id');
        const modalType = document.getElementById('modal-item-type-select');
        const modalTitle = document.getElementById('modal-item-title');
        const modalDomain = document.getElementById('modal-item-domain');
        const modalDueDate = document.getElementById('modal-item-dueDate');
        const modalDuration = document.getElementById('modal-item-duration');
        const modalPriority = document.getElementById('modal-item-priority');
        const modalTarget = document.getElementById('modal-item-target');
        
        const openModal = (data = {}) => {
            modalId.value = data.id || '';
            modalType.value = data.type || 'project';
            modalType.disabled = !!data.id; // Impossible de changer le type d'un élément existant
            modalTitle.value = data.title || '';
            modalDomain.value = data.domain || 'perso';
            modalDueDate.value = data.dueDate || data.targetDate || '';
            modalDuration.value = data.duration || data.estimatedMinutes || '';
            modalPriority.value = data.priority || 'medium';
            modalTarget.value = data.target || data.totalPages || '';
            modal.style.display = 'flex';
        };

        const closeModal = () => { modal.style.display = 'none'; };

        document.querySelectorAll('.btn-open-modal').forEach(btn => {
            btn.addEventListener('click', () => openModal());
        });
        
        document.getElementById('btn-modal-cancel')?.addEventListener('click', closeModal);

        document.querySelectorAll('.btn-edit-item').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.currentTarget.getAttribute('data-id');
                const type = e.currentTarget.getAttribute('data-type');
                let item = null;
                if (type === 'project') item = (await this.app.projectEngine.getProjects()).find(i => i.id === id);
                if (type === 'book') item = (await this.app.projectEngine.getBooks()).find(i => i.id === id);
                if (type === 'task') item = (await this.app.projectEngine.getPersonalTasks()).find(i => i.id === id);
                if (item) openModal({ ...item, type });
            });
        });

        document.querySelectorAll('.btn-delete-item').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.currentTarget.getAttribute('data-id');
                const type = e.currentTarget.getAttribute('data-type');
                if (confirm('Êtes-vous sûr de vouloir supprimer cet élément ?')) {
                    if (type === 'project') await this.app.projectEngine.deleteProject(id);
                    if (type === 'book') await this.app.projectEngine.deleteBook(id);
                    if (type === 'task') await this.app.projectEngine.deletePersonalTask(id);
                    this.app.renderView('portfolio');
                }
            });
        });

        document.getElementById('btn-modal-save')?.addEventListener('click', async () => {
            const id = modalId.value;
            const type = modalType.value;
            const title = modalTitle.value.trim();
            if (!title) return alert("Le titre est requis");
            
            const baseData = {
                title,
                domain: modalDomain.value,
                priority: modalPriority.value,
            };

            if (type === 'project') {
                const existing = id ? (await this.app.projectEngine.getProjects()).find(i => i.id === id) : {};
                await this.app.projectEngine.saveProject({
                    ...existing, ...baseData, id: id || undefined,
                    targetDate: modalDueDate.value || null,
                });
            } else if (type === 'book') {
                const existing = id ? (await this.app.projectEngine.getBooks()).find(i => i.id === id) : {};
                await this.app.projectEngine.saveBook({
                    ...existing, ...baseData, id: id || undefined,
                    totalPages: modalTarget.value ? parseInt(modalTarget.value, 10) : 0,
                    targetDate: modalDueDate.value || null,
                });
            } else if (type === 'task') {
                const existing = id ? (await this.app.projectEngine.getPersonalTasks()).find(i => i.id === id) : {};
                await this.app.projectEngine.savePersonalTask({
                    ...existing, ...baseData, id: id || undefined,
                    dueDate: modalDueDate.value || null,
                    estimatedMinutes: modalDuration.value ? parseInt(modalDuration.value, 10) : 30
                });
            }
            closeModal();
            this.app.renderView('portfolio');
        });

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
                secProofs.style.display = 'none';
                secCheckins.style.display = 'none';
                secProjects.style.display = 'none';

                if (tab === 'all') {
                    secProofs.style.display = 'block';
                    secCheckins.style.display = 'block';
                    secProjects.style.display = 'block';
                } else if (tab === 'proofs') {
                    secProofs.style.display = 'block';
                } else if (tab === 'checkins') {
                    secCheckins.style.display = 'block';
                } else if (tab === 'projects') {
                    secProjects.style.display = 'block';
                }
            });
        });

        // Event listeners for Export / Import
        const btnExport = document.getElementById('btn-export-data');
        if (btnExport) {
            btnExport.addEventListener('click', async () => {
                try {
                    // Sauvegarde COMPLÈTE : toutes les clés du stockage, fournie par l'App
                    const exportData = await this.app.exportAllData();
                    const blob = new Blob([JSON.stringify(exportData)], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const downloadAnchorNode = document.createElement('a');
                    downloadAnchorNode.setAttribute("href", url);
                    downloadAnchorNode.setAttribute("download", "backup_procrastination.json");
                    document.body.appendChild(downloadAnchorNode); // required for firefox
                    downloadAnchorNode.click();
                    downloadAnchorNode.remove();
                    setTimeout(() => URL.revokeObjectURL(url), 1000);
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
                            // Validation + écriture déléguées à l'App
                            await this.app.importAllData(importedData);
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
