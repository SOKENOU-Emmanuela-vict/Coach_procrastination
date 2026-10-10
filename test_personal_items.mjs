import assert from 'assert';
import { MemoryProvider } from './src/services/MemoryProvider.js';
import { ProjectEngine } from './src/engines/ProjectEngine.js';
import { Project } from './src/models/Project.js';
import { Book } from './src/models/Book.js';
import { PersonalTask } from './src/models/PersonalTask.js';

async function runTests() {
    console.log("=== TESTS PROJETS, LECTURES ET TACHES PERSO ===");
    const storage = new MemoryProvider();
    const engine = new ProjectEngine(storage);

    // 1. Projets (vérifier get/save/delete via le nouveau moteur)
    let p1 = new Project({ id: 'p1', title: 'Nouveau site web', status: 'active', priority: 'high' });
    p1.addTask({ title: 'Maquette', status: 'done', estimatedDuration: 120 });
    p1.addTask({ title: 'Développement', status: 'todo', estimatedDuration: 240 });
    
    await engine.saveProject(p1);
    
    let projects = await engine.getProjects();
    assert.strictEqual(projects.length, 1);
    assert.strictEqual(projects[0].progress, 50);

    // 2. Lectures
    let b1 = new Book({ title: 'Clean Code', author: 'Robert C. Martin', totalPages: 464, pagesRead: 100 });
    assert.strictEqual(b1.progress, 22); // 100 / 464 = 21.5 -> 22
    assert.strictEqual(b1.status, 'reading');
    
    await engine.saveBook(b1);
    
    b1.updateProgress({ pagesRead: 464 });
    assert.strictEqual(b1.progress, 100);
    assert.strictEqual(b1.status, 'finished');
    
    await engine.saveBook(b1);
    
    let books = await engine.getBooks();
    assert.strictEqual(books.length, 1);
    assert.strictEqual(books[0].title, 'Clean Code');
    assert.strictEqual(books[0].status, 'finished');

    // 3. Tâches perso
    let t1 = new PersonalTask({ title: 'Faire les courses', category: 'errands', estimatedMinutes: 45 });
    assert.strictEqual(t1.status, 'à faire');
    assert.strictEqual(t1.priority, 'medium');
    
    await engine.savePersonalTask(t1);
    
    let tasks = await engine.getPersonalTasks();
    assert.strictEqual(tasks.length, 1);
    assert.strictEqual(tasks[0].title, 'Faire les courses');

    // Vérifier les listes indépendantes
    assert.strictEqual((await engine.getProjects()).length, 1);
    assert.strictEqual((await engine.getBooks()).length, 1);
    assert.strictEqual((await engine.getPersonalTasks()).length, 1);
    
    // Deletion
    await engine.deletePersonalTask(t1.id);
    assert.strictEqual((await engine.getPersonalTasks()).length, 0);

    console.log("✔ Moteur ProjectEngine fonctionnel");
    console.log("=== TOUS LES TESTS SONT AU VERT ===");
}

runTests().catch(e => {
    console.error(e);
    process.exitCode = 1;
});
