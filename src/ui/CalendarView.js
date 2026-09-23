export class CalendarView {
    constructor(containerId, app) {
        this.container = document.getElementById(containerId);
        this.app = app;
        
        const now = new Date();
        this.currentYear = now.getFullYear();
        this.currentMonth = now.getMonth();
        
        // État des filtres
        this.filters = {
            school: true,
            life: true,
            lang: true
        };
    }
    
    render(state) {
        document.body.className = 'theme-cyber'; 
        
        const events = state.calendarData?.events || [];
        const projects = state.calendarData?.projects || [];
        const assessments = state.calendarData?.assessments || [];
        
        const monthNames = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
        const monthName = monthNames[this.currentMonth];
        
        const daysInMonth = new Date(this.currentYear, this.currentMonth + 1, 0).getDate();
        const firstDayIndex = new Date(this.currentYear, this.currentMonth, 1).getDay(); // 0 (Sun) to 6 (Sat)
        const todayStr = new Date().toLocaleDateString('fr-CA');
        
        // --- HELPERS POUR CATÉGORIES ---
        const isSchool = (e) => !!e.subjectId || e.type === 'Cours' || e.type === 'TD' || e.type === 'Exam';
        const isLife = (e) => !!e.projectId && !isSchool(e) && !isLang(e);
        const isLang = (e) => (e.type && (e.type.toLowerCase() === 'langue' || e.type.toLowerCase() === 'language')) || (e.title && (e.title.toLowerCase().includes('anglais') || e.title.toLowerCase().includes('russe')));
        
        // --- COULEURS ---
        const schoolColor = '#00f2fe';
        const lifeColor = '#f093fb';
        const langColor = '#ff9800';

        let html = `
<div style="min-height:100vh; background:#050510 url('https://images.unsplash.com/photo-1550745165-9bc0b252726f?q=80&w=2000&auto=format&fit=crop') center/cover; padding:30px; display:flex; align-items:center; justify-content:center; font-family:'Inter', sans-serif; position:relative;">
    <div style="position:absolute; inset:0; background:linear-gradient(135deg, rgba(20,10,40,0.8), rgba(5,5,15,0.9)); z-index:1;"></div>
    <div style="position:relative; z-index:2; width:100%; max-width:1400px; height:90vh; background:rgba(20, 20, 35, 0.45); backdrop-filter:blur(20px); border:1px solid rgba(255,255,255,0.1); border-radius:24px; display:flex; overflow:hidden; box-shadow:0 30px 60px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1);">
        
        <!-- LEFT SIDEBAR -->
        <div style="width:280px; background:rgba(0,0,0,0.2); border-right:1px solid rgba(255,255,255,0.05); padding:30px; display:flex; flex-direction:column;">
            
            <div style="display:flex; align-items:center; gap:15px; margin-bottom:50px;">
                <div style="width:40px; height:40px; background:linear-gradient(135deg, #4facfe, #00f2fe); border-radius:12px; display:flex; align-items:center; justify-content:center; font-weight:900; font-size:22px; color:#fff; font-style:italic;">
                    R
                </div>
                <div style="color:#fff; font-weight:800; letter-spacing:1px; font-size:14px; line-height:1.2;">
                    RSK CALENDAR<br><span style="color:#4facfe;">${this.currentYear}</span>
                </div>
            </div>

            <div style="display:flex; flex-direction:column; gap:10px; margin-bottom:40px;">
                <div style="display:flex; align-items:center; gap:15px; padding:12px 15px; background:rgba(255,255,255,0.1); color:#fff; border-radius:10px; cursor:pointer;">
                    <i class="bi bi-calendar-check"></i> <span style="font-size:14px; font-weight:500;">Événements</span>
                </div>
                <div class="bureau-nav-item" data-view="planning" style="display:flex; align-items:center; gap:15px; padding:12px 15px; color:rgba(255,255,255,0.6); border-radius:10px; cursor:pointer; transition:all 0.2s;">
                    <i class="bi bi-clock-history"></i> <span style="font-size:14px; font-weight:500;">Planning (Hebdo)</span>
                </div>
            </div>

            <!-- FILTRES -->
            <div style="margin-bottom:20px;">
                <div style="font-size:11px; color:rgba(255,255,255,0.4); text-transform:uppercase; letter-spacing:1px; margin-bottom:15px; font-weight:700;">Filtres d'affichage</div>
                
                <div id="filter-school" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px; cursor:pointer; opacity:${this.filters.school ? '1' : '0.5'};">
                    <div style="display:flex; align-items:center; gap:10px; color:#fff; font-size:13px;">
                        <div style="width:8px; height:8px; border-radius:50%; background:${schoolColor};"></div>
                        École
                    </div>
                    <div style="width:36px; height:20px; background:${this.filters.school ? schoolColor : 'rgba(255,255,255,0.2)'}; border-radius:10px; position:relative; transition:all 0.2s;">
                        <div style="width:16px; height:16px; background:#fff; border-radius:50%; position:absolute; top:2px; ${this.filters.school ? 'right:2px;' : 'left:2px;'}"></div>
                    </div>
                </div>

                <div id="filter-life" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px; cursor:pointer; opacity:${this.filters.life ? '1' : '0.5'};">
                    <div style="display:flex; align-items:center; gap:10px; color:#fff; font-size:13px;">
                        <div style="width:8px; height:8px; border-radius:50%; background:${lifeColor};"></div>
                        Life
                    </div>
                    <div style="width:36px; height:20px; background:${this.filters.life ? lifeColor : 'rgba(255,255,255,0.2)'}; border-radius:10px; position:relative; transition:all 0.2s;">
                        <div style="width:16px; height:16px; background:#fff; border-radius:50%; position:absolute; top:2px; ${this.filters.life ? 'right:2px;' : 'left:2px;'}"></div>
                    </div>
                </div>

                <div id="filter-lang" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px; cursor:pointer; opacity:${this.filters.lang ? '1' : '0.5'};">
                    <div style="display:flex; align-items:center; gap:10px; color:#fff; font-size:13px;">
                        <div style="width:8px; height:8px; border-radius:50%; background:${langColor};"></div>
                        Langue
                    </div>
                    <div style="width:36px; height:20px; background:${this.filters.lang ? langColor : 'rgba(255,255,255,0.2)'}; border-radius:10px; position:relative; transition:all 0.2s;">
                        <div style="width:16px; height:16px; background:#fff; border-radius:50%; position:absolute; top:2px; ${this.filters.lang ? 'right:2px;' : 'left:2px;'}"></div>
                    </div>
                </div>
            </div>

            <!-- Bouton de retour -->
            <button id="btn-back-desktop" style="margin-top:auto; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); color:#fff; padding:12px; border-radius:10px; cursor:pointer; font-size:13px; font-weight:500; display:flex; justify-content:center; gap:10px; align-items:center;">
                <i class="bi bi-arrow-left"></i> Retour au Bureau
            </button>
        </div>

        <!-- RIGHT MAIN AREA -->
        <div style="flex-grow:1; display:flex; flex-direction:column; padding:30px; position:relative; overflow-y:auto;">
            
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
                <div style="position:relative; width:400px;">
                    <i class="bi bi-search" style="position:absolute; left:15px; top:50%; transform:translateY(-50%); color:rgba(255,255,255,0.4);"></i>
                    <input type="text" placeholder="Rechercher..." style="width:100%; background:rgba(0,0,0,0.2); border:1px solid rgba(255,255,255,0.05); color:#fff; padding:12px 20px 12px 45px; border-radius:12px; outline:none; font-size:13px;">
                </div>
                <div style="display:flex; align-items:center; gap:20px;">
                    <button style="background:linear-gradient(135deg, #00f2fe, #4facfe); border:none; color:#fff; padding:12px 24px; border-radius:12px; font-weight:600; font-size:13px; cursor:pointer; box-shadow:0 10px 20px rgba(79,172,254,0.3); display:flex; align-items:center; gap:10px;">
                        Ajouter Événement <i class="bi bi-plus-lg"></i>
                    </button>
                </div>
            </div>

            <!-- CALENDAR GRID -->
            <div style="display:flex; flex-direction:column; background:rgba(0,0,0,0.15); border-radius:20px; border:1px solid rgba(255,255,255,0.05); padding:25px; margin-bottom:20px; flex-shrink:0;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
                    <div style="font-size:24px; font-weight:800; color:#fff; letter-spacing:1px; text-transform:uppercase;">${monthName} ${this.currentYear}</div>
                    <div style="display:flex; gap:10px;">
                        <button id="btn-prev-month" style="width:35px; height:35px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); border-radius:8px; color:#fff; display:flex; align-items:center; justify-content:center; cursor:pointer;"><i class="bi bi-chevron-left"></i></button>
                        <button id="btn-next-month" style="width:35px; height:35px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); border-radius:8px; color:#fff; display:flex; align-items:center; justify-content:center; cursor:pointer;"><i class="bi bi-chevron-right"></i></button>
                    </div>
                </div>

                <div style="display:grid; grid-template-columns: repeat(7, 1fr); margin-bottom:10px;">
                    ${['DIM','LUN','MAR','MER','JEU','VEN','SAM'].map(d => `<div style="text-align:center; color:rgba(255,255,255,0.4); font-size:12px; font-weight:700;">${d}</div>`).join('')}
                </div>

                <!-- Grid -->
                <div style="display:grid; grid-template-columns: repeat(7, 1fr); gap:10px; auto-rows: minmax(80px, auto);">
                    ${[...Array(firstDayIndex)].map(() => `<div style="background:transparent;"></div>`).join('')}
                    ${[...Array(daysInMonth)].map((_, i) => {
                        let day = i + 1;
                        let dateIter = new Date(this.currentYear, this.currentMonth, day);
                        let dateStr = dateIter.toLocaleDateString('fr-CA');
                        
                        let isToday = (dateStr === todayStr);
                        let dayStyle = isToday ? 'background:#4facfe; color:#fff; width:28px; height:28px; border-radius:50%; display:flex; align-items:center; justify-content:center; margin:0 auto 5px auto;' : 'text-align:center; color:rgba(255,255,255,0.8); margin-bottom:5px;';
                        
                        let dayEvents = events.filter(e => e.date === dateStr).filter(e => {
                            if (isLang(e) && !this.filters.lang) return false;
                            if (isLife(e) && !this.filters.life) return false;
                            if (isSchool(e) && !this.filters.school) return false;
                            return true;
                        }).sort((a,b) => a.startTime.localeCompare(b.startTime));
                        
                        let content = '';
                        
                        dayEvents.slice(0, 4).forEach(e => {
                            let color = schoolColor;
                            if (isLang(e)) color = langColor;
                            else if (isLife(e)) color = lifeColor;
                            
                            // Parse hex to rgba for background
                            let bgColor = 'rgba(0, 242, 254, 0.2)'; // school par defaut
                            if (color === langColor) bgColor = 'rgba(255, 152, 0, 0.2)';
                            if (color === lifeColor) bgColor = 'rgba(240, 147, 251, 0.2)';
                            
                            content += `<div style="background:${bgColor}; border-left:3px solid ${color}; color:#fff; font-size:10px; padding:4px 6px; border-radius:4px; margin-bottom:4px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${e.title} (${e.startTime}-${e.endTime})">${e.startTime} ${e.title}</div>`;
                        });
                        if (dayEvents.length > 4) {
                            content += `<div style="color:rgba(255,255,255,0.5); font-size:10px; text-align:center;">+${dayEvents.length - 4} autres</div>`;
                        }

                        return `
                        <div style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.05); border-radius:12px; padding:10px; overflow:hidden; min-height:80px;">
                            <div style="${dayStyle} font-size:12px; font-weight:600;">${day}</div>
                            ${content}
                        </div>
                        `;
                    }).join('')}
                </div>
            </div>

            <!-- BOTTOM WIDGETS -->
            <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:20px; flex-shrink:0;">
                
                <!-- COLONNE 1: École (Assessments) -->
                <div style="background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); border-radius:16px; padding:20px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
                        <h3 style="margin:0; font-size:12px; color:rgba(255,255,255,0.6); text-transform:uppercase; letter-spacing:1px;">Échéances École</h3>
                        <span style="font-size:11px; color:#4facfe; cursor:pointer;">Voir tout</span>
                    </div>
                    <div style="display:flex; flex-direction:column; gap:12px;">`;
                    
        const futureAssessments = assessments.filter(a => a.date >= todayStr).sort((a,b) => a.date.localeCompare(b.date)).slice(0, 4);
        if (futureAssessments.length > 0) {
            futureAssessments.forEach(a => {
                const day = a.date.split('-')[2];
                html += `
                        <div style="display:flex; gap:15px; align-items:center;">
                            <div style="width:36px; height:36px; border-radius:50%; background:rgba(0, 242, 254, 0.1); border:1px solid ${schoolColor}; display:flex; align-items:center; justify-content:center; font-weight:bold; color:${schoolColor}; font-size:14px;">${day}</div>
                            <div style="overflow:hidden;">
                                <strong style="display:block; color:#fff; font-size:13px; margin-bottom:2px; white-space:nowrap; text-overflow:ellipsis; overflow:hidden;">${a.title}</strong>
                                <span style="font-size:11px; color:rgba(255,255,255,0.4);">Coef ${a.coefficient || 1}</span>
                            </div>
                        </div>`;
            });
        } else {
            html += `<div style="font-size:13px; color:rgba(255,255,255,0.4);">Aucune évaluation à venir.</div>`;
        }

        html += `
                    </div>
                </div>

                <!-- COLONNE 2: Life (Project Tasks) -->
                <div style="background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); border-radius:16px; padding:20px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
                        <h3 style="margin:0; font-size:12px; color:rgba(255,255,255,0.6); text-transform:uppercase; letter-spacing:1px;">Échéances Life</h3>
                        <span style="font-size:11px; color:#f093fb; cursor:pointer;">Voir tout</span>
                    </div>
                    <div style="display:flex; flex-direction:column; gap:12px;">`;
                    
        // Récupérer les tâches des projets Life
        let lifeTasks = [];
        projects.forEach(p => {
            if (p.tasks) {
                p.tasks.forEach(t => {
                    if (t.status !== 'completed' && t.status !== 'done') {
                        lifeTasks.push({ project: p.title, task: t.title, priority: p.priority || 'medium' });
                    }
                });
            }
        });
        
        const topLifeTasks = lifeTasks.slice(0, 4);
        if (topLifeTasks.length > 0) {
            topLifeTasks.forEach((t, i) => {
                html += `
                        <div style="display:flex; gap:15px; align-items:center;">
                            <div style="width:36px; height:36px; border-radius:50%; background:rgba(240, 147, 251, 0.1); border:1px solid ${lifeColor}; display:flex; align-items:center; justify-content:center; font-weight:bold; color:${lifeColor}; font-size:14px;"><i class="bi bi-star-fill"></i></div>
                            <div style="overflow:hidden;">
                                <strong style="display:block; color:#fff; font-size:13px; margin-bottom:2px; white-space:nowrap; text-overflow:ellipsis; overflow:hidden;">${t.task}</strong>
                                <span style="font-size:11px; color:rgba(255,255,255,0.4);">${t.project}</span>
                            </div>
                        </div>`;
            });
        } else {
            html += `<div style="font-size:13px; color:rgba(255,255,255,0.4);">Aucune tâche en cours.</div>`;
        }

        html += `
                    </div>
                </div>

                <!-- COLONNE 3: Langue (Language Events) -->
                <div style="background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); border-radius:16px; padding:20px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
                        <h3 style="margin:0; font-size:12px; color:rgba(255,255,255,0.6); text-transform:uppercase; letter-spacing:1px;">Sessions Langue</h3>
                        <span style="font-size:11px; color:#ff9800; cursor:pointer;">Voir tout</span>
                    </div>
                    <div style="display:flex; flex-direction:column; gap:15px;">
                    `;
                    
        const futureLangEvents = events.filter(e => e.date >= todayStr && isLang(e)).sort((a,b) => {
            if(a.date === b.date) return a.startTime.localeCompare(b.startTime);
            return a.date.localeCompare(b.date);
        }).slice(0, 4);
        
        if (futureLangEvents.length > 0) {
            futureLangEvents.forEach(e => {
                const day = e.date.split('-')[2];
                html += `
                        <div style="display:flex; gap:15px; align-items:center;">
                            <div style="width:36px; height:36px; border-radius:50%; background:rgba(255, 152, 0, 0.1); border:1px solid ${langColor}; display:flex; align-items:center; justify-content:center; font-weight:bold; color:${langColor}; font-size:14px;">${day}</div>
                            <div style="overflow:hidden;">
                                <strong style="display:block; color:#fff; font-size:13px; margin-bottom:2px; white-space:nowrap; text-overflow:ellipsis; overflow:hidden;">${e.title}</strong>
                                <span style="font-size:11px; color:rgba(255,255,255,0.4);">${e.startTime} - ${e.endTime}</span>
                            </div>
                        </div>`;
            });
        } else {
            html += `<div style="font-size:13px; color:rgba(255,255,255,0.4);">Aucune session prévue.</div>`;
        }

        html += `
                    </div>
                </div>
            </div>

        </div>
    </div>
</div>
        `;
        
        this.container.innerHTML = html;

        // Navigation
        const btnBack = this.container.querySelector('#btn-back-desktop');
        if(btnBack) {
            btnBack.addEventListener('click', () => {
                if(this.app.router) this.app.router.render('desktop', this.app.state);
            });
        }

        this.container.querySelectorAll('.bureau-nav-item').forEach(btn => {
            btn.addEventListener('click', (ev) => {
                const viewName = ev.currentTarget.getAttribute('data-view');
                if (viewName && this.app.router) {
                    this.app.router.render(viewName, this.app.state);
                }
            });
        });

        // Mois +/-
        const btnPrev = this.container.querySelector('#btn-prev-month');
        if(btnPrev) {
            btnPrev.addEventListener('click', () => {
                this.currentMonth--;
                if(this.currentMonth < 0) {
                    this.currentMonth = 11;
                    this.currentYear--;
                }
                this.render(state);
            });
        }

        const btnNext = this.container.querySelector('#btn-next-month');
        if(btnNext) {
            btnNext.addEventListener('click', () => {
                this.currentMonth++;
                if(this.currentMonth > 11) {
                    this.currentMonth = 0;
                    this.currentYear++;
                }
                this.render(state);
            });
        }
        
        // Listeners Filtres
        this.container.querySelector('#filter-school')?.addEventListener('click', () => {
            this.filters.school = !this.filters.school;
            this.render(state);
        });
        this.container.querySelector('#filter-life')?.addEventListener('click', () => {
            this.filters.life = !this.filters.life;
            this.render(state);
        });
        this.container.querySelector('#filter-lang')?.addEventListener('click', () => {
            this.filters.lang = !this.filters.lang;
            this.render(state);
        });
    }
}
