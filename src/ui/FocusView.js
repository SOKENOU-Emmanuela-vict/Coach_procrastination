import { sanitizeUrl } from '../utils/security.js';
import { Motion } from './motion.js';

export class FocusView {
    constructor(containerId, app) {
        this.container = typeof containerId === 'string' && typeof document !== 'undefined' ? document.getElementById(containerId) : (containerId || (typeof document !== 'undefined' ? document.getElementById('view-container') : null));
        this.app = app;
        this.timerInterval = null;
        this.currentSessionId = null;
        this.focusEndTime = null;
        this.openedResourceWindow = null;
    }

    triggerTimeUpAlert(sessionTitle) {
        // 1. Fermer l'onglet externe du cours s'il a été ouvert par le chrono
        try {
            if (this.openedResourceWindow && !this.openedResourceWindow.closed) {
                this.openedResourceWindow.close();
                console.log("Onglet de ressource fermé automatiquement par la fin du chrono.");
            }
        } catch(e) {
            console.warn("Fermeture onglet externe : " + e.message);
        }

        // 2. Ramener le focus sur l'application
        try { window.focus(); } catch(e) {}

        // 3. Alerte sonore (Carillon de fin de session via AudioContext)
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const playBeep = (freq, startTime, duration) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(freq, ctx.currentTime + startTime);
                gain.gain.setValueAtTime(0.3, ctx.currentTime + startTime);
                gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + startTime + duration);
                osc.connect(gain);
                osc.connect(ctx.destination);
                osc.start(ctx.currentTime + startTime);
                osc.stop(ctx.currentTime + startTime + duration);
            };
            playBeep(880, 0, 0.3);      // A5
            playBeep(880, 0.4, 0.3);    // A5
            playBeep(1320, 0.8, 0.6);   // E6
        } catch(e) {
            console.warn("Audio non supporté : " + e.message);
        }

        // 4. Notification native Bureau
        if ('Notification' in window && Notification.permission === 'granted') {
            try {
                const n = new Notification("Temps écoulé : " + sessionTitle, {
                    body: "Ton chrono est terminé ! Le site du cours a été fermé. Reviens sur Learning OS pour valider ta session !",
                    icon: "https://emma21vict.github.io/Coach_procrastination/favicon.ico"
                });
                n.onclick = () => {
                    window.focus();
                    n.close();
                };
            } catch(e) {}
        }
    }
    
    render(session) {
        if (typeof document !== 'undefined' && document.body) {
            document.body.className = 'theme-light';
            if (typeof document.body.setAttribute === 'function') {
                document.body.setAttribute('data-univers', 'focus');
            }
        }

        if (this.timerInterval) {
            clearInterval(this.timerInterval);
        }

        if (!session) {
            const hasAnyPlanned = this.app?.state?.dailyPlan?.sessions?.length > 0;
            const message = hasAnyPlanned 
                ? "Toutes les sessions prévues sont terminées ! 🎉" 
                : "Aucune session de focus active ou programmée pour aujourd'hui.";
            this.container.innerHTML = `
<div class="focus-viewport">
    <div class="focus-topbar">
        <h2 class="focus-topbar-title"><i class="bi bi-stopwatch"></i> Mode Focus</h2>
        <div class="focus-topbar-actions">
            <button type="button" id="btn-focus-quit-desktop" class="btn-focus-quit"><i class="bi bi-house-door"></i> Quitter (Bureau)</button>
            <button type="button" id="btn-focus-quit-plan" class="btn-focus-quit"><i class="bi bi-calendar3"></i> Quitter (Planning)</button>
        </div>
    </div>
    <div class="focus-central-wrapper">
        <div class="focus-card focus-empty-card stats">
            <div class="focus-empty-icon">
                <i class="bi bi-bullseye"></i>
            </div>
            <h3 class="focus-empty-title">${message}</h3>
            <p class="focus-empty-subtitle">Sélectionne ou ajoute une tâche dans ton planning pour démarrer un chrono de travail.</p>
            <div class="focus-empty-actions">
                <button type="button" id="btn-focus-desktop" class="btn-focus-action-secondary"><i class="bi bi-house-door"></i> Retour au Bureau</button>
                <button type="button" id="btn-focus-back" class="btn-focus-action-primary"><i class="bi bi-calendar3"></i> Aller au Planning</button>
                <button type="button" id="btn-focus-bilan" class="btn-focus-action-secondary"><i class="bi bi-trophy"></i> Faire mon Bilan</button>
            </div>
        </div>
    </div>
</div>
            `;
            const btnBilan = document.getElementById('btn-focus-bilan');
            if (btnBilan && typeof btnBilan.addEventListener === 'function') {
                btnBilan.addEventListener('click', () => {
                    Motion.buttonTap(btnBilan);
                    this.app.showBilan();
                });
            }
            
            const btnDesktop = document.getElementById('btn-focus-desktop');
            if (btnDesktop && typeof btnDesktop.addEventListener === 'function') {
                btnDesktop.addEventListener('click', () => {
                    Motion.buttonTap(btnDesktop);
                    if (this.timerInterval) clearInterval(this.timerInterval);
                    if (this.app.state) this.app.state.activeFocusSession = null;
                    this.app.renderView('desktop');
                });
            }

            const btnBack = document.getElementById('btn-focus-back');
            if (btnBack && typeof btnBack.addEventListener === 'function') {
                btnBack.addEventListener('click', () => {
                    Motion.buttonTap(btnBack);
                    this.app.renderView('planning');
                });
            }
            
            if (typeof document !== 'undefined') {
                Motion.fadeIn('.focus-card', { duration: 0.25 });
            }
            return;
        }

        this.container.innerHTML = `
<div class="focus-viewport">
    <div class="focus-topbar">
        <h2 class="focus-topbar-title"><i class="bi bi-stopwatch"></i> Mode Focus</h2>
        <div class="focus-topbar-actions">
            <button type="button" id="btn-focus-quit-desktop" class="btn-focus-quit"><i class="bi bi-house-door"></i> Quitter (Bureau)</button>
            <button type="button" id="btn-focus-quit-plan" class="btn-focus-quit"><i class="bi bi-calendar3"></i> Quitter (Planning)</button>
        </div>
    </div>
    <div class="focus-central-wrapper">
        <div class="focus-card stats">
            <h3 class="focus-session-title">${session.title}</h3>
            <div class="focus-session-objective"><i class="bi bi-bullseye"></i> Objectif : ${session.objective || session.skillLabel || 'Session de travail'}</div>
            ${session.expectedResult ? `<div class="focus-session-result"><i class="bi bi-check2-circle"></i> Résultat attendu : ${session.expectedResult}</div>` : ''}
            
            <div id="focus-timer-display" class="focus-timer-display">
                ${session.expectedDuration}:00
            </div>

            <div id="focus-warning-banner" class="focus-warning-banner" hidden>
                <strong><i class="bi bi-exclamation-triangle"></i> Attention : Plus que 15 minutes !</strong><br>
                Veux-tu prolonger ton temps avant la fermeture automatique du cours ?
            </div>

            <div id="focus-time-extensions" class="focus-extensions-row">
                <button type="button" class="btn-extend-time" data-min="10"><i class="bi bi-plus-circle"></i> +10 min</button>
                <button type="button" class="btn-extend-time" data-min="15"><i class="bi bi-plus-circle"></i> +15 min</button>
                <button type="button" class="btn-extend-time" data-min="30"><i class="bi bi-plus-circle"></i> +30 min</button>
            </div>

            ${session.resourceLink ? `<button type="button" id="btn-open-resource" class="btn-open-resource" data-url="${session.resourceLink}"><i class="bi bi-box-arrow-up-right"></i> Ouvrir le cours certifiant</button>` : ''}
            
            <div id="focus-evaluation" class="focus-eval-section" hidden>
                <div class="focus-eval-heading"><i class="bi bi-check2-square"></i> Bilan de la session</div>
                
                <div class="focus-form-group">
                    <label class="focus-form-label" for="f-status">Statut de réalisation</label>
                    <select id="f-status" class="focus-select">
                        <option value="completed">Terminée (100%)</option>
                        <option value="partial">Partielle (Inachevée)</option>
                        <option value="skipped">Ignorée (Sautée)</option>
                        <option value="cancelled">Annulée</option>
                    </select>
                </div>

                <div class="focus-proof-card">
                    <label class="focus-proof-title"><i class="bi bi-file-earmark-check"></i> Preuve (Proof) & Capture d'écran</label>
                    <select id="f-proof-type" class="focus-select">
                        <option value="">-- Aucune preuve --</option>
                        <option value="Capture">Capture / Photo d'écran (Recommandé)</option>
                        <option value="GitHub Commit">GitHub Commit</option>
                        <option value="Certificat">Certificat / Badge</option>
                        <option value="Projet">Lien de Projet</option>
                        <option value="Note">Note / Résumé</option>
                    </select>
                    <input type="text" id="f-proof-url" class="focus-input" placeholder="URL du lien ou projet (optionnel)">
                    <input type="text" id="f-proof-desc" class="focus-input" placeholder="Description courte (ex: Exercice Python terminé)">
                    
                    <!-- BOUTON CLAIR POUR UPLOADER UNE CAPTURE / PHOTO -->
                    <div id="capture-upload-zone" class="capture-upload-zone">
                        <label for="f-proof-file" class="capture-upload-label">
                            <i class="bi bi-camera"></i> Joindre une capture d'écran ou photo
                        </label>
                        <p class="capture-upload-hint">PNG, JPG, WEBP — Votre fichier sera enregistré dans vos preuves</p>
                        <input type="file" id="f-proof-file" accept="image/*" hidden>
                        <div id="proof-image-preview" class="proof-preview-box" hidden>
                            <img id="proof-img-thumb" class="proof-preview-img" src="" alt="Capture jointe">
                            <p class="proof-preview-success"><i class="bi bi-check-circle"></i> Photo capturée avec succès !</p>
                            <button type="button" id="btn-remove-proof-file" class="btn-remove-proof"><i class="bi bi-trash"></i> Retirer l'image</button>
                        </div>
                    </div>
                </div>
                
                <div class="focus-form-group">
                    <label class="focus-form-label" for="f-actual-difficulty">Niveau de maîtrise</label>
                    <select id="f-actual-difficulty" class="focus-select">
                        <option value="🟢" ${session.difficulty === '🟢' ? 'selected' : ''}>🟢 Je maîtrise</option>
                        <option value="🟡" ${session.difficulty === '🟡' ? 'selected' : ''}>🟡 À revoir</option>
                        <option value="🔴" ${session.difficulty === '🔴' ? 'selected' : ''}>🔴 Je n'ai pas compris</option>
                    </select>
                </div>

                <div class="focus-form-group">
                    <label class="focus-form-label" for="f-reflection">Commentaire / Réflexion</label>
                    <textarea id="f-reflection" class="focus-textarea" rows="2" placeholder="Ex: J'ai compris les boucles mais je dois revoir les listes..."></textarea>
                </div>

                <div class="focus-form-group">
                    <label class="focus-form-label" for="f-quality">Qualité ressentie (1-5)</label>
                    <input type="range" id="f-quality" min="1" max="5" value="3" class="focus-input">
                </div>

                <div class="focus-form-group">
                    <label class="focus-form-label" for="f-energy">Énergie restante (1-5)</label>
                    <input type="range" id="f-energy" min="1" max="5" value="3" class="focus-input">
                </div>
                
                <button type="button" id="btn-confirm-task" data-id="${session.id}" class="btn-confirm-task"><i class="bi bi-check2-circle"></i> Valider et Enregistrer</button>
            </div>

            <button type="button" id="btn-pre-complete-task" class="btn-pre-complete"><i class="bi bi-check2"></i> Valider ou stopper la session</button>
        </div>
    </div>
</div>
        `;
        
        const btnQuitDesktop = document.getElementById('btn-focus-quit-desktop');
        if (btnQuitDesktop && typeof btnQuitDesktop.addEventListener === 'function') {
            btnQuitDesktop.addEventListener('click', () => {
                Motion.buttonTap(btnQuitDesktop);
                if (this.timerInterval) clearInterval(this.timerInterval);
                if (this.app.state) this.app.state.activeFocusSession = null;
                this.app.renderView('desktop');
            });
        }
        const btnQuitPlan = document.getElementById('btn-focus-quit-plan');
        if (btnQuitPlan && typeof btnQuitPlan.addEventListener === 'function') {
            btnQuitPlan.addEventListener('click', () => {
                Motion.buttonTap(btnQuitPlan);
                if (this.timerInterval) clearInterval(this.timerInterval);
                if (this.app.state) this.app.state.activeFocusSession = null;
                this.app.renderView('planning');
            });
        }

        const btnOpenResource = document.getElementById('btn-open-resource');
        if (btnOpenResource && typeof btnOpenResource.addEventListener === 'function') {
            btnOpenResource.addEventListener('click', (e) => {
                Motion.buttonTap(btnOpenResource);
                const url = e.currentTarget.getAttribute('data-url');
                const safeUrl = sanitizeUrl(url);
                if (safeUrl && safeUrl !== '#') {
                    this.openedResourceWindow = window.open(safeUrl, '_blank', 'noopener,noreferrer');
                }
                if ('Notification' in window && Notification.permission !== 'granted') {
                    try { Notification.requestPermission(); } catch(err) {}
                }
            });
        }

        const extendButtons = this.container ? this.container.querySelectorAll('.btn-extend-time') : [];
        extendButtons.forEach(btn => {
            if (typeof btn.addEventListener === 'function') {
                btn.addEventListener('click', (e) => {
                    Motion.buttonTap(btn);
                    const addMin = parseInt(e.currentTarget.getAttribute('data-min'), 10);
                    this.focusEndTime += addMin * 60 * 1000;
                    remainingSeconds = Math.max(0, Math.floor((this.focusEndTime - Date.now()) / 1000));
                    updateTimerDisplay();
                    
                    const banner = document.getElementById('focus-warning-banner');
                    if (banner) banner.hidden = true;
                    
                    if (remainingSeconds > 900) {
                        this.hasWarned15Min = false;
                    }
                    
                    const originalText = btn.innerHTML;
                    btn.innerHTML = `<i class="bi bi-check2"></i> +${addMin}m ajoutées !`;
                    btn.classList.add('extended');
                    setTimeout(() => {
                        btn.innerHTML = originalText;
                        btn.classList.remove('extended');
                    }, 1500);
                });
            }
        });

        const btnPreComplete = document.getElementById('btn-pre-complete-task');
        const evalSection = document.getElementById('focus-evaluation');
        const btnConfirm = document.getElementById('btn-confirm-task');
        const timerDisplay = document.getElementById('focus-timer-display');

        if (this.currentSessionId !== session.id || !this.focusEndTime) {
            this.currentSessionId = session.id;
            this.focusStartTime = Date.now();
            this.focusEndTime = Date.now() + (session.expectedDuration * 60 * 1000);
            this.hasWarned15Min = false;
        }

        let remainingSeconds = Math.max(0, Math.floor((this.focusEndTime - Date.now()) / 1000));
        
        const updateTimerDisplay = () => {
            if (!timerDisplay) return;
            const m = Math.floor(remainingSeconds / 60);
            const s = remainingSeconds % 60;
            timerDisplay.textContent = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        };

        // Initial display update
        updateTimerDisplay();

        this.timerInterval = setInterval(() => {
            remainingSeconds = Math.max(0, Math.floor((this.focusEndTime - Date.now()) / 1000));
            if (remainingSeconds > 0) {
                updateTimerDisplay();
                if (remainingSeconds <= 900 && remainingSeconds > 895 && !this.hasWarned15Min) {
                    this.hasWarned15Min = true;
                    const banner = document.getElementById('focus-warning-banner');
                    if (banner) banner.hidden = false;

                    try {
                        const ctx = new (window.AudioContext || window.webkitAudioContext)();
                        const playDing = (freq, duration) => {
                            const osc = ctx.createOscillator();
                            const gain = ctx.createGain();
                            osc.type = 'triangle';
                            osc.frequency.setValueAtTime(freq, ctx.currentTime);
                            gain.gain.setValueAtTime(0.25, ctx.currentTime);
                            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
                            osc.connect(gain);
                            osc.connect(ctx.destination);
                            osc.start();
                            osc.stop(ctx.currentTime + duration);
                        };
                        playDing(660, 0.6); // E5 doux
                    } catch(e) {}

                    if ('Notification' in window && Notification.permission === 'granted') {
                        try {
                            new Notification("Plus que 15 minutes : " + session.title, {
                                body: "Il reste 15 minutes au chrono ! Tu peux prolonger ton temps (+10m, +15m, +30m) si tu as besoin d'avancer encore.",
                                icon: "https://emma21vict.github.io/Coach_procrastination/favicon.ico"
                            });
                        } catch(e) {}
                    }
                }
            } else {
                clearInterval(this.timerInterval);
                updateTimerDisplay();
                if (timerDisplay) {
                    timerDisplay.classList.add('focus-timer-finished');
                }
                this.triggerTimeUpAlert(session.title);
                // Auto-show evaluation when time is up
                if (btnPreComplete && evalSection && evalSection.hidden) {
                    btnPreComplete.click();
                }
            }
        }, 1000);

        if (btnPreComplete && typeof btnPreComplete.addEventListener === 'function') {
            btnPreComplete.addEventListener('click', () => {
                Motion.buttonTap(btnPreComplete);
                btnPreComplete.hidden = true;
                if (evalSection) {
                    evalSection.hidden = false;
                    Motion.fadeIn(evalSection, { duration: 0.25 });
                }
            });
        }

        // UPLOAD DE CAPTURE D'ÉCRAN / PHOTO
        this.currentProofImage = null;
        const proofFileInput = document.getElementById('f-proof-file');
        const proofPreview = document.getElementById('proof-image-preview');
        const proofThumb = document.getElementById('proof-img-thumb');
        const btnRemoveProofFile = document.getElementById('btn-remove-proof-file');
        const proofTypeSelect = document.getElementById('f-proof-type');

        if (proofFileInput && typeof proofFileInput.addEventListener === 'function') {
            proofFileInput.addEventListener('change', (e) => {
                const file = e.target.files && e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        this.currentProofImage = event.target.result;
                        if (proofThumb && proofPreview) {
                            proofThumb.src = this.currentProofImage;
                            proofPreview.hidden = false;
                            Motion.fadeIn(proofPreview, { duration: 0.2 });
                        }
                        if (proofTypeSelect && !proofTypeSelect.value) {
                            proofTypeSelect.value = "Capture";
                        }
                    };
                    reader.readAsDataURL(file);
                }
            });
        }

        if (btnRemoveProofFile && typeof btnRemoveProofFile.addEventListener === 'function') {
            btnRemoveProofFile.addEventListener('click', (e) => {
                e.stopPropagation();
                Motion.buttonTap(btnRemoveProofFile);
                this.currentProofImage = null;
                if (proofFileInput) proofFileInput.value = "";
                if (proofPreview) proofPreview.hidden = true;
            });
        }

        if (btnConfirm && typeof btnConfirm.addEventListener === 'function') {
            btnConfirm.addEventListener('click', (e) => {
                Motion.buttonTap(btnConfirm);
                const targetBtn = e.currentTarget;
                const id = targetBtn.getAttribute('data-id');
                const proofTypeEl = document.getElementById('f-proof-type');
                const proofType = proofTypeEl ? proofTypeEl.value : '';
                const proofUrlEl = document.getElementById('f-proof-url');
                const proofDescEl = document.getElementById('f-proof-desc');
                
                let proofObj = null;
                if (proofType || this.currentProofImage || (proofUrlEl && proofUrlEl.value)) {
                    proofObj = {
                        type: proofType || "Capture",
                        url: proofUrlEl ? proofUrlEl.value : '',
                        description: proofDescEl ? proofDescEl.value : '',
                        image: this.currentProofImage || null,
                        date: this.app.getPedagogicalDate(),
                        source: session.title
                    };
                }
                
                const actualDuration = this.focusStartTime ? Math.round((Date.now() - this.focusStartTime) / 60000) : session.expectedDuration;
                
                const statusEl = document.getElementById('f-status');
                const diffEl = document.getElementById('f-actual-difficulty');
                const refEl = document.getElementById('f-reflection');
                const qualEl = document.getElementById('f-quality');
                const nrgEl = document.getElementById('f-energy');

                const metrics = {
                    status: (statusEl && statusEl.value) || 'completed',
                    actualDuration: actualDuration,
                    proof: proofObj,
                    difficulty: (diffEl && diffEl.value) || '🟢',
                    reflection: (refEl && refEl.value) || '',
                    quality: qualEl ? parseInt(qualEl.value, 10) : 3,
                    energy: nrgEl ? parseInt(nrgEl.value, 10) : 3
                };
                
                this.currentSessionId = null;
                this.focusStartTime = null;
                this.focusEndTime = null;

                // Logique intelligente de redirection
                let nextView = 'desktop';
                
                const sessions = this.app.state.dailyPlan && this.app.state.dailyPlan.sessions ? this.app.state.dailyPlan.sessions : [];
                const habits = this.app.state.dailyPlan && this.app.state.dailyPlan.habits ? this.app.state.dailyPlan.habits : [];
                
                const incompleteSessions = sessions.filter(s => !s.completed && s.id !== id);
                const incompleteHabits = habits.filter(h => !h.completed && h.id !== id);
                
                if (incompleteSessions.length === 0 && incompleteHabits.length === 0) {
                    // Toutes les tâches de la journée sont terminées !
                    nextView = 'coach';
                } else if (incompleteSessions.length > 0) {
                    // Vérifier s'il est l'heure de la tâche suivante
                    const nextSess = incompleteSessions[0];
                    if (nextSess.startTime) {
                        const timeParts = nextSess.startTime.split(/[:h]/);
                        if (timeParts.length === 2) {
                            const sh = parseInt(timeParts[0], 10);
                            const sm = parseInt(timeParts[1], 10);
                            const now = new Date();
                            const currentMinutes = now.getHours() * 60 + now.getMinutes();
                            const sessionMinutes = sh * 60 + sm;
                            
                            // Si on est déjà à l'heure de la tâche suivante (marge de 10 min)
                            if (currentMinutes >= sessionMinutes - 10) {
                                nextView = 'planning';
                            }
                        }
                    }
                }

                this.app.markSessionCompleted(id, metrics, nextView);
            });
        }

        if (typeof document !== 'undefined') {
            Motion.fadeIn('.focus-card', { duration: 0.25 });
        }
    }
}
