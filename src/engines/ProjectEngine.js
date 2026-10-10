import { Project } from '../models/Project.js';
import { Book } from '../models/Book.js';
import { PersonalTask } from '../models/PersonalTask.js';
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
}
