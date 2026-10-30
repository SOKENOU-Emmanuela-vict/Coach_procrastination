import { Project } from '../models/Project.js';
import { Book } from '../models/Book.js';
import { PersonalTask } from '../models/PersonalTask.js';
import { Goal } from '../models/Goal.js';
import { AppLogger } from '../utils/AppLogger.js';

export class ProjectEngine {
    constructor(storage) {
        this.storage = storage;
    }

    // --- PROJETS ---
    async getProjects() {
        const raw = await this.storage.loadData('projects') || [];
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
    async getBooks() {
        const raw = await this.storage.loadData('books') || [];
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
