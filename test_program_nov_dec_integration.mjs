import test from 'node:test';
import assert from 'node:assert';
import { AcademicEngine, DEFAULT_PROGRAM_CERTIFICATIONS } from './src/engines/AcademicEngine.js';
import { ProjectEngine, DEFAULT_GRAND_PROJECT } from './src/engines/ProjectEngine.js';
import { LanguageEngine, DEFAULT_PROGRAM_ENGLISH } from './src/engines/LanguageEngine.js';
import { CheckInEngine } from './src/engines/CheckInEngine.js';
import { CourseRevisionScheduler } from './src/engines/CourseRevisionScheduler.js';
import { PlanningEngine } from './src/engines/PlanningEngine.js';
import { parseDailyProgramIntent } from './src/ai/ChatIntentParser.js';
import { CoachLocalReply } from './src/ai/CoachLocalReply.js';
import { Event } from './src/models/Event.js';

class MemoryStorage {
    constructor() { this.store = new Map(); }
    async loadData(key) { return this.store.get(key) || null; }
    async saveData(key, val) { this.store.set(key, JSON.parse(JSON.stringify(val))); return true; }
}

test('=== VALIDATION INTÉGRALE DU PROGRAMME 18 NOV - 25 DÉC 2026 ===', async (t) => {
    const storage = new MemoryStorage();

    // -------------------------------------------------------------
    // AXE A : Certifications et Compétences Techniques (50 min/j)
    // -------------------------------------------------------------
    await t.test('Axe A : Formations techniques & Certifications', async () => {
        const acad = new AcademicEngine(storage);
        const certs = await acad.getCertifications();
        
        assert(Array.isArray(certs), "Les certifications sont retournées sous forme de tableau");
        assert.strictEqual(certs.length, 4, "Exactement 4 formations prioritaires/complémentaires initialisées");

        const cisco = certs.find(c => c.id === 'cert_cisco_iot');
        const kaggle = certs.find(c => c.id === 'cert_kaggle_ml');
        const nvidia = certs.find(c => c.id === 'cert_nvidia_dl');
        const ibm = certs.find(c => c.id === 'cert_ibm_ai');

        assert(cisco, "Cisco Introduction to IoT est présent");
        assert.strictEqual(cisco.domain, "Internet of Things (IoT)");
        assert(cisco.type.includes('Badge') && cisco.type.includes('Certificat'), "Distinction Badge & Certificat pour Cisco");

        assert(kaggle, "Kaggle Intro to Machine Learning est présent");
        assert.strictEqual(kaggle.domain, "Machine Learning");
        assert.strictEqual(kaggle.type, "Certificat de réussite");

        assert(nvidia, "NVIDIA Fundamentals of Deep Learning est présent");
        assert.strictEqual(nvidia.domain, "Deep Learning (PyTorch)");
        assert.strictEqual(nvidia.type, "Certificat professionnel");

        assert(ibm, "IBM SkillsBuild AI Fundamentals est présent comme facultatif");
        assert.strictEqual(ibm.status, "optional");

        // Mise à jour de la progression sur NVIDIA
        nvidia.completedModules = 4;
        nvidia.progress = 50;
        nvidia.status = 'in_progress';
        nvidia.justification = 'Nebius Academy lab 4 validé';
        await acad.saveCertification(nvidia);

        const updatedCerts = await acad.getCertifications();
        const savedNvidia = updatedCerts.find(c => c.id === 'cert_nvidia_dl');
        assert.strictEqual(savedNvidia.completedModules, 4);
        assert.strictEqual(savedNvidia.progress, 50);
        assert.strictEqual(savedNvidia.status, 'in_progress');
        assert.strictEqual(savedNvidia.justification, 'Nebius Academy lab 4 validé');
    });

    // -------------------------------------------------------------
    // AXE B : Grand Projet Innovant (6 modules & 3 idées Phase 1)
    // -------------------------------------------------------------
    await t.test('Axe B : Grand Projet Innovant, 6 Modules & Phase 1', async () => {
        const projectEngine = new ProjectEngine(storage);
        const projects = await projectEngine.getProjects();

        assert(projects.length >= 1, "Le projet est initialisé");
        const grandProj = projects.find(p => p.id === 'proj_grand_programme_2026');
        assert(grandProj, "Le Grand Projet Innovant (IoT & IA) est présent");
        assert.strictEqual(grandProj.targetDate, "2026-12-25", "Date cible au 25 décembre 2026");

        // Vérification des 6 modules
        const steps = grandProj.tasks || grandProj.steps || [];
        assert.strictEqual(steps.length, 6, "Le projet comporte les 6 modules requis");
        assert(steps[0].title.includes("Module 1"), "Module 1 IoT présent");
        assert(steps[1].title.includes("Module 2"), "Module 2 Données présent");
        assert(steps[2].title.includes("Module 3"), "Module 3 ML présent");
        assert(steps[3].title.includes("Module 4"), "Module 4 DL PyTorch présent");
        assert(steps[4].title.includes("Module 5"), "Module 5 API présent");
        assert(steps[5].title.includes("Module 6"), "Module 6 Interface présent");

        // Vérification de la Phase 1 (Étude des 3 problèmes réels au Bénin/Afrique)
        const ideas = grandProj.ideationStudies || [];
        assert.strictEqual(ideas.length, 3, "Phase 1 : 3 problèmes réels étudiés");
        ideas.forEach((idea, idx) => {
            assert(idea.problem, `Idée ${idx + 1} a un problème réel décrit`);
            assert(idea.existingSolutions, `Idée ${idx + 1} a les solutions existantes identifiées`);
            assert(idea.innovation, `Idée ${idx + 1} a une innovation réelle évaluée`);
            assert(idea.feasibilityCost, `Idée ${idx + 1} a un coût/faisabilité chiffré`);
            assert(idea.targetUsers, `Idée ${idx + 1} a des utilisateurs cibles définis`);
        });

        // Sélection de l'idée 1 pour le prototype
        grandProj.ideationStudies[0].chosen = true;
        grandProj.ideationStudies[1].chosen = false;
        grandProj.ideationStudies[2].chosen = false;
        await projectEngine.saveProject(grandProj);

        const reloadedProjects = await projectEngine.getProjects();
        const savedProj = reloadedProjects.find(p => p.id === 'proj_grand_programme_2026');
        assert.strictEqual(savedProj.ideationStudies[0].chosen, true, "L'Idée 1 est retenue pour le prototype");
    });

    // -------------------------------------------------------------
    // AXE C : Anglais A1 vers A2 fonctionnel (45 min/j)
    // -------------------------------------------------------------
    await t.test('Axe C : Anglais A1→A2 & Routine des 4 Piliers', async () => {
        const langEngine = new LanguageEngine(storage);
        const langs = await langEngine.getLanguages();
        
        assert(langs.length >= 1, "La langue est initialisée");
        const english = langs.find(l => l.id === 'lang_english' || /anglais|english/i.test(l.name));
        assert(english, "L'anglais est configuré");
        assert.strictEqual(english.level, "A1", "Niveau de départ A1");
        assert.strictEqual(english.targetMilestoneDate, "2026-12-25", "Milestone au 25 décembre");
        assert(english.goal.includes("A2"), "Objectif A2 mentionné");

        // Vérification des 4 piliers quotidiens (10m vocab, 10m écoute, 10m prononciation, 15m conversation = 45m)
        assert(english.pillars, "Les 4 piliers de la routine sont présents");
        assert.strictEqual(english.pillars.vocab.duration, 10, "10 min vocabulaire");
        assert.strictEqual(english.pillars.listening.duration, 10, "10 min écoute");
        assert.strictEqual(english.pillars.pronunciation.duration, 10, "10 min prononciation");
        assert.strictEqual(english.pillars.conversation.duration, 15, "15 min conversation");
        const totalPillarDuration = english.pillars.vocab.duration + english.pillars.listening.duration + english.pillars.pronunciation.duration + english.pillars.conversation.duration;
        assert.strictEqual(totalPillarDuration, 45, "Total strict de 45 minutes pour la routine quotidienne d'anglais");

        // Validation d'un pilier du jour
        await langEngine.toggleDailyPillar(english.id, 'vocab', true);
        const updatedEnglish = await langEngine.getLanguage(english.id);
        assert.strictEqual(updatedEnglish.pillars.vocab.doneToday, true, "Pilier vocabulaire marqué fait");
        assert(updatedEnglish.tracking.minutesStudied >= 10, "Minutes d'étude incrémentées");
    });

    // -------------------------------------------------------------
    // AXE D : Six Livres de Développement Personnel (25 min/j)
    // -------------------------------------------------------------
    await t.test('Axe D : Les 6 Livres et suivi de lecture', async () => {
        const projectEngine = new ProjectEngine(storage);
        const books = await projectEngine.getBooks();

        assert.strictEqual(books.length, 6, "Exactement 6 livres de développement personnel initialisés");

        const titles = books.map(b => b.title);
        assert(titles.some(t => t.includes("7 habitudes")), "Covey présent");
        assert(titles.some(t => t.includes("Un rien peut tout changer")), "Clear présent");
        assert(titles.some(t => t.includes("Comment parler en public")), "Carnegie Public Speaking présent");
        assert(titles.some(t => t.includes("Comment se faire des amis")), "Carnegie Friends présent");
        assert(titles.some(t => t.includes("Essentialisme")), "McKeown présent");
        assert(titles.some(t => t.includes("Deep Work")), "Newport présent");

        // Progression de lecture sur James Clear
        const clearBook = books.find(b => b.title.includes("Un rien peut tout changer"));
        clearBook.pagesRead = 25;
        clearBook.status = 'reading';
        clearBook.notes = "Règle des 2 minutes pour vaincre la friction au démarrage";
        clearBook.practicalApplications = ["Préparer mes affaires de veille de cours"];
        await projectEngine.saveBook(clearBook);

        const updatedBooks = await projectEngine.getBooks();
        const savedClear = updatedBooks.find(b => b.title.includes("Un rien peut tout changer"));
        assert.strictEqual(savedClear.pagesRead, 25);
        assert.strictEqual(savedClear.status, 'reading');
        assert(savedClear.notes.includes("Règle des 2 minutes"));
        assert.strictEqual(savedClear.practicalApplications.length, 1);
    });

    // -------------------------------------------------------------
    // AXE E : Deux Pas Quotidiens (1 Perso + 1 Pro)
    // -------------------------------------------------------------
    await t.test('Axe E : Bilan Quotidien avec Pas Personnel et Professionnel', async () => {
        const checkInEngine = new CheckInEngine(storage, null, null, null);
        const checkInDate = '2026-11-18';

        const savedCheckIn = await checkInEngine.saveCheckIn({
            date: checkInDate,
            energy: 'high',
            sleep: { durationMinutes: 450, quality: 'good' },
            dayAssessment: 'completed',
            blockers: [],
            personalStep: {
                action: "Engager une discussion de 5 minutes avec un collègue d'IA que je connais peu",
                expectedResult: "Échange cordial et prise de contact positive",
                status: "completed",
                reflection: "J'ai vaincu mon appréhension, la conversation était très enrichissante."
            },
            professionalStep: {
                action: "Écrire le script de capture de capteur IoT en MicroPython pour l'ESP32",
                expectedResult: "Script testé localement et poussé sur GitHub",
                status: "completed",
                reflection: "Lecture des données température/humidité opérationnelle."
            }
        });

        assert(savedCheckIn, "Check-in enregistré");
        assert.strictEqual(savedCheckIn.personalStep.status, "completed");
        assert.strictEqual(savedCheckIn.professionalStep.status, "completed");
        assert(savedCheckIn.personalStep.reflection.includes("appréhension"));
        assert(savedCheckIn.professionalStep.action.includes("MicroPython"));

        const retrieved = await checkInEngine.getCheckIn(checkInDate);
        assert(retrieved, "Check-in relu avec succès");
        assert.strictEqual(retrieved.personalStep.action, "Engager une discussion de 5 minutes avec un collègue d'IA que je connais peu");
        assert.strictEqual(retrieved.professionalStep.expectedResult, "Script testé localement et poussé sur GitHub");
    });

    // -------------------------------------------------------------
    // SCHEDULER : Programme 3h Quotidien (180 min strict)
    // -------------------------------------------------------------
    await t.test('Scheduler : Programme 3h (180 min strict) sans conflit de cours', async () => {
        const planningEngine = new PlanningEngine(storage);
        const scheduler = new CourseRevisionScheduler({ planningEngine, storage });
        const testDate = '2026-11-18';

        // Poser un cours universitaire de 08:00 à 12:00
        const schoolCourse = new Event({
            id: 'ev_course_test_1',
            title: "Systèmes d'exploitation & Linux",
            date: testDate,
            startTime: '08:00',
            endTime: '12:00',
            type: 'course',
            source: 'school_schedule'
        });
        await planningEngine.saveEvent(schoolCourse);

        // Planifier le programme 3h
        const progResult = await scheduler.scheduleDailyProgram180({ dateStr: testDate });
        assert(progResult.success, "Le scheduler 3h s'exécute avec succès");
        assert.strictEqual(progResult.count, 5, "Exactement 5 blocs planifiés pour le programme 3h");

        // Vérifier les durées : 50 + 45 + 45 + 25 + 15 = 180 min
        const totalDuration = progResult.scheduled.reduce((sum, ev) => sum + (ev.duration || 0), 0);
        assert.strictEqual(totalDuration, 180, "Total strict cumulé de 180 minutes (3 heures)");

        // Vérifier qu'aucun bloc ne chevauche le cours de 08:00 à 12:00
        progResult.scheduled.forEach(block => {
            const blockStartH = parseInt(block.startTime.split(':')[0], 10);
            const blockEndH = parseInt(block.endTime.split(':')[0], 10);
            // Le cours est de 8h à 12h, donc un bloc valide ne peut pas commencer entre 8h et 12h
            const conflict = (block.startTime < '12:00' && block.endTime > '08:00');
            assert(!conflict, `Le bloc ${block.title} (${block.startTime}-${block.endTime}) ne chevauche pas le cours universitaire`);
        });

        // Idempotence : une seconde exécution n'ajoute pas de doublons
        const progResult2 = await scheduler.scheduleDailyProgram180({ dateStr: testDate });
        assert.strictEqual(progResult2.count, 0, "Idempotence : 0 doublon ajouté si déjà planifié");
    });

    // -------------------------------------------------------------
    // CHAT INTENT & COACH
    // -------------------------------------------------------------
    await t.test('Chat Intent & Coach : Reconnaissance du Programme 3h', async () => {
        assert(parseDailyProgramIntent("programme 3h"), "programme 3h reconnu");
        assert(parseDailyProgramIntent("planifie mon programme"), "planifie mon programme reconnu");
        assert(parseDailyProgramIntent("programme intensif"), "programme intensif reconnu");
        assert(parseDailyProgramIntent("mes 3 heures"), "mes 3 heures reconnu");
        assert(!parseDailyProgramIntent("bonjour comment vas tu"), "message neutre non confondu");

        const reply = CoachLocalReply.build({
            planning: {
                events: [
                    { id: '1', title: 'Formations Techniques (IoT / ML / DL)', startTime: '12:15', endTime: '13:05', duration: 50, source: 'program_180' },
                    { id: '2', title: 'Grand Projet Innovant (IoT & IA)', startTime: '13:15', endTime: '14:00', duration: 45, source: 'program_180' },
                    { id: '3', title: 'Anglais A1→A2 (Routine 4 Piliers)', startTime: '17:00', endTime: '17:45', duration: 45, source: 'program_180' },
                    { id: '4', title: 'Lecture : Développement Personnel', startTime: '18:00', endTime: '18:25', duration: 25, source: 'program_180' },
                    { id: '5', title: 'Bilan & Pas Quotidiens', startTime: '18:35', endTime: '18:50', duration: 15, source: 'program_180' }
                ]
            },
            currentDate: '2026-11-18'
        }, "programme 3h");

        assert(reply.message.includes("180 min") || reply.message.includes("Programme 3h"), "Le coach répond avec le détail du programme 3h");
        assert(reply.facts.topic === 'daily_program_180', "Le topic est daily_program_180");
        assert.strictEqual(reply.facts.count, 5, "5 blocs confirmés");
    });
});
