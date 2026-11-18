import { Project } from '../models/Project.js';
import { Book } from '../models/Book.js';
import { PersonalTask } from '../models/PersonalTask.js';
import { Goal } from '../models/Goal.js';
import { AppLogger } from '../utils/AppLogger.js';

export const DEFAULT_GRAND_PROJECT = {
    id: 'proj_grand_programme_2026',
    title: "Grand Projet Innovant (IoT & IA)",
    type: "projet",
    description: "Projet résolvant un véritable problème dans un contexte africain / béninois intégrant IoT, IA et services connectés.",
    status: "in_progress",
    startDate: "2026-11-18",
    endDate: "2026-12-25",
    targetDate: "2026-12-25",
    duration: "111h (45 min/jour)",
    location: "Bénin / Local",
    notes: "Livrable final au 25 décembre : prototype fonctionnel, testé, documenté et présentable, avec dépôt GitHub et démonstration.",
    steps: [
        { id: 'step_mod1_iot', title: "Module 1 : Acquisition de données IoT (capteurs & protocoles)", status: "todo", completed: false },
        { id: 'step_mod2_storage', title: "Module 2 : Préparation et stockage des données", status: "todo", completed: false },
        { id: 'step_mod3_ml', title: "Module 3 : Modèle de Machine Learning", status: "todo", completed: false },
        { id: 'step_mod4_dl', title: "Module 4 : Modèle de Deep Learning (PyTorch)", status: "todo", completed: false },
        { id: 'step_mod5_api', title: "Module 5 : API et communication entre composants", status: "todo", completed: false },
        { id: 'step_mod6_ui', title: "Module 6 : Interface, visualisation et alertes", status: "todo", completed: false }
    ],
    ideationStudies: [
        {
            id: 'idea_1',
            title: "Idée 1 : Suivi et alerte chaîne du froid médicale / agricole (Bénin)",
            problem: "Rupture de conservation des vaccins et denrées périssables causée par les coupures de courant imprévisibles.",
            existingSolutions: "Enregistreurs de température manuels ou alertes SMS rudimentaires sans anticipation.",
            innovation: "Capteur IoT basse consommation + prédiction ML de défaillance thermique avant rupture critique.",
            feasibilityCost: "ESP32 / DHT22 / SIM800L (< 15 000 FCFA), faisable avec matériel disponible localement.",
            targetUsers: "Centres de santé ruraux, coopératives agricoles.",
            chosen: false
        },
        {
            id: 'idea_2',
            title: "Idée 2 : Surveillance intelligente de la qualité de l'eau de consommation / lagune",
            problem: "Contamination chimique et bactérienne rapide de l'eau des forages et zones lagunaires sans contrôle continu.",
            existingSolutions: "Prélèvements manuels trimestriels en laboratoire, longs et coûteux.",
            innovation: "Sonde multiparamètre IoT + classification ML du niveau de potabilité/danger en temps réel.",
            feasibilityCost: "Capteurs pH/turbidité + ESP32 (~25 000 FCFA), étalonnage délicat.",
            targetUsers: "Municipalités, gestionnaires de forages communautaires, riverains.",
            chosen: false
        },
        {
            id: 'idea_3',
            title: "Idée 3 : Détection précoce des maladies des cultures maraîchères (Tomates/Piments)",
            problem: "Pertes massives de récoltes dues aux ravageurs et maladies foliaires détectées trop tard.",
            existingSolutions: "Inspection visuelle empirique par les agriculteurs, recours tardif aux pesticides chimiques.",
            innovation: "Station IoT micro-climat + modèle Deep Learning (Vision Mobile / PyTorch) de classification sur feuilles.",
            feasibilityCost: "Caméra ESP32-CAM + station météo miniature (< 20 000 FCFA), forte valeur ajoutée.",
            targetUsers: "Maraîchers locaux, groupements de femmes agricultrices.",
            chosen: false
        }
    ]
};

export class ProjectEngine {
    constructor(storage) {
        this.storage = storage;
    }

    // --- PROJETS ---
    async getProjects() {
        let raw = await this.storage.loadData('projects');
        if (!raw || !Array.isArray(raw) || raw.length === 0) {
            raw = [DEFAULT_GRAND_PROJECT];
            await this.storage.saveData('projects', raw);
        } else if (!raw.some(p => p.id === 'proj_grand_programme_2026' || (p.ideationStudies && p.ideationStudies.length > 0))) {
            raw.push(DEFAULT_GRAND_PROJECT);
            await this.storage.saveData('projects', raw);
        }
        return raw.map(p => new Project(p));
    }

    async saveProject(project) {
        const projects = await this.getProjects();
        const toSave = project instanceof Project ? project : new Project(project);
        const index = projects.findIndex(p => p.id === toSave.id);
        if (index !== -1) {
            if (projects[index].subjectId && !toSave.subjectId) {
                toSave.subjectId = projects[index].subjectId;
            }
            projects[index] = toSave;
        } else {
            projects.push(toSave);
        }
        await this.storage.saveData('projects', projects);
        AppLogger.info(`ProjectEngine: Projet ${toSave.id} sauvegardé.`);
        return toSave;
    }

    async deleteProject(id) {
        let projects = await this.getProjects();
        projects = projects.filter(p => p.id !== id);
        await this.storage.saveData('projects', projects);
        AppLogger.info(`ProjectEngine: Projet ${id} supprimé.`);
    }

    async calculateProjectRegularity(projectId) {
        const history = await this.storage.loadData('study_history') || [];
        const projectRecords = history.filter(r => r.skillId === projectId && r.status === 'completed');
        
        if (projectRecords.length === 0) return { score: 0, daysWorked: 0, daysElapsed: 0 };
        
        const sortedRecords = projectRecords.sort((a, b) => a.date.localeCompare(b.date));
        const firstDate = new Date(sortedRecords[0].date);
        const today = new Date();
        
        const daysElapsed = Math.max(1, Math.floor((today - firstDate) / (1000 * 60 * 60 * 24)) + 1);
        const uniqueDays = new Set(projectRecords.map(r => r.date)).size;
        
        const score = Math.max(0, Math.min(100, Math.round((uniqueDays / daysElapsed) * 100)));
        return { score, daysWorked: uniqueDays, daysElapsed };
    }

    /**
     * Score de détermination (0-100) :
     *  - Régularité (30 pts) : ratio jours travaillés / jours écoulés
     *  - Fraîcheur  (20 pts) : dernière activité < 3j → 20, < 7j → 10, sinon 0
     *  - Séances faites vs prévues (20 pts) : ratio sessions réalisées / sessions planifiées
     *  - Coach feedback (30 pts) : moyenne des scores laissés lors des "où en es-tu ?"
     */
    async calculateProjectDetermination(projectId) {
        const regularity = await this.calculateProjectRegularity(projectId);
        const regularityPart = Math.round(regularity.score * 0.3);

        // Fraîcheur : dernière session enregistrée dans study_history pour ce projet
        const history = await this.storage.loadData('study_history') || [];
        const projectRecords = history.filter(r => (r.skillId === projectId || r.projectId === projectId) && r.status === 'completed');
        let freshnessPart = 0;
        if (projectRecords.length > 0) {
            const lastDate = projectRecords.map(r => r.date).sort().reverse()[0];
            const daysSinceLast = Math.floor((new Date() - new Date(lastDate)) / (1000 * 60 * 60 * 24));
            freshnessPart = daysSinceLast < 3 ? 20 : (daysSinceLast < 7 ? 10 : 0);
        }

        // Séances faites vs prévues (20 pts)
        const events = await this.storage.loadData('events') || [];
        const projectEvents = events.filter(e => e.projectId === projectId || e.skillId === projectId);
        const doneEvents = projectEvents.filter(e => e.status === 'completed' || e.completed === true);

        const projects = await this.getProjects();
        const project = projects.find(p => p.id === projectId);

        const doneCount = project?.sessionsDone ?? Math.max(projectRecords.length, doneEvents.length);
        const plannedCount = project?.sessionsPlanned ?? project?.targetSessions ?? projectEvents.length;

        let sessionsScore = 0;
        if (plannedCount > 0) {
            sessionsScore = Math.min(100, Math.round((doneCount / plannedCount) * 100));
        } else if (doneCount > 0) {
            sessionsScore = 100;
        }
        const sessionsPart = Math.round(sessionsScore * 0.2);

        // Coach feedback (30 pts)
        let coachPart = 0;
        if (project && project.coachAssessments && project.coachAssessments.length > 0) {
            const avg = project.coachAssessments.reduce((s, a) => s + (Number(a.score) || 0), 0) / project.coachAssessments.length;
            coachPart = Math.round(avg * 0.3);
        }

        const score = Math.min(100, regularityPart + freshnessPart + sessionsPart + coachPart);
        AppLogger.info(`ProjectEngine: Détermination de ${projectId} = ${score} (reg:${regularityPart}, fresh:${freshnessPart}, sess:${sessionsPart}, coach:${coachPart})`);
        return {
            score,
            regularityPart,
            freshnessPart,
            sessionsPart,
            coachPart,
            sessionsDone: doneCount,
            sessionsPlanned: plannedCount
        };
    }

    // --- LECTURES ---
    static DEFAULT_PROGRAM_BOOKS = [
        { id: 'book_covey_7habits', title: "Les 7 habitudes de ceux qui réalisent tout ce qu'ils entreprennent", author: "Stephen Covey", totalPages: 432, pagesRead: 0, status: "to_read", targetDate: "2026-12-25", notes: "" },
        { id: 'book_clear_atomic', title: "Un rien peut tout changer", author: "James Clear", totalPages: 320, pagesRead: 0, status: "to_read", targetDate: "2026-12-25", notes: "" },
        { id: 'book_carnegie_public', title: "Comment parler en public", author: "Dale Carnegie", totalPages: 256, pagesRead: 0, status: "to_read", targetDate: "2026-12-25", notes: "" },
        { id: 'book_carnegie_friends', title: "Comment se faire des amis", author: "Dale Carnegie", totalPages: 320, pagesRead: 0, status: "to_read", targetDate: "2026-12-25", notes: "" },
        { id: 'book_mckeown_essentialism', title: "L'Essentialisme", author: "Greg McKeown", totalPages: 272, pagesRead: 0, status: "to_read", targetDate: "2026-12-25", notes: "" },
        { id: 'book_newport_deepwork', title: "Deep Work", author: "Cal Newport", totalPages: 304, pagesRead: 0, status: "to_read", targetDate: "2026-12-25", notes: "" }
    ];

    async getBooks() {
        let raw = await this.storage.loadData('books');
        if (!raw || !Array.isArray(raw) || raw.length === 0) {
            raw = ProjectEngine.DEFAULT_PROGRAM_BOOKS;
            await this.storage.saveData('books', raw);
        }
        return raw.map(b => new Book(b));
    }

    async saveBook(book) {
        const books = await this.getBooks();
        const index = books.findIndex(b => b.id === book.id);
        if (index !== -1) books[index] = book;
        else books.push(book);
        await this.storage.saveData('books', books);
        AppLogger.info(`ProjectEngine: Livre ${book.id} sauvegardé.`);
    }

    async deleteBook(id) {
        let books = await this.getBooks();
        books = books.filter(b => b.id !== id);
        await this.storage.saveData('books', books);
        AppLogger.info(`ProjectEngine: Livre ${id} supprimé.`);
    }

    // --- TÂCHES PERSONNELLES ---
    async getPersonalTasks() {
        const raw = await this.storage.loadData('personal_tasks') || [];
        return raw.map(t => new PersonalTask(t));
    }

    async savePersonalTask(task) {
        const tasks = await this.getPersonalTasks();
        const index = tasks.findIndex(t => t.id === task.id);
        if (index !== -1) tasks[index] = task;
        else tasks.push(task);
        await this.storage.saveData('personal_tasks', tasks);
        AppLogger.info(`ProjectEngine: Tâche personnelle ${task.id} sauvegardée.`);
    }

    async deletePersonalTask(id) {
        let tasks = await this.getPersonalTasks();
        tasks = tasks.filter(t => t.id !== id);
        await this.storage.saveData('personal_tasks', tasks);
        AppLogger.info(`ProjectEngine: Tâche personnelle ${id} supprimée.`);
    }

    // --- OBJECTIFS (GOALS) ---
    async getGoals() {
        const raw = await this.storage.loadData('goals') || [];
        return raw.map(g => new Goal(g));
    }

    async saveGoal(goal) {
        const goals = await this.getGoals();
        const index = goals.findIndex(g => g.id === goal.id);
        if (index !== -1) goals[index] = goal;
        else goals.push(goal);
        await this.storage.saveData('goals', goals);
        AppLogger.info(`ProjectEngine: Objectif ${goal.id} sauvegardé.`);
    }

    async deleteGoal(id) {
        let goals = await this.getGoals();
        goals = goals.filter(g => g.id !== id);
        await this.storage.saveData('goals', goals);
        AppLogger.info(`ProjectEngine: Objectif ${id} supprimé.`);
    }
}
