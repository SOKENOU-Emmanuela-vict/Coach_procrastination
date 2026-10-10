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
        const index = projects.findIndex(p => p.id === project.id);
        if (index !== -1) projects[index] = project;
        else projects.push(project);
        await this.storage.saveData('projects', projects);
        AppLogger.info(`ProjectEngine: Projet ${project.id} sauvegardé.`);
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
