import { 
    parseBookProgress, 
    parsePersonalTaskCreation, 
    parseTaskCompletion 
} from './src/ai/ChatIntentParser.js';

let failed = 0;
let passed = 0;

function assert(condition, message) {
    if (condition) {
        passed++;
    } else {
        console.error("FAIL: " + message);
        failed++;
    }
}

console.log("=== TEST CHAT INTENT ITEMS ===");

// Book Progress
const book1 = parseBookProgress("J'ai lu 20 pages de Dune");
assert(book1 && book1.amount === 20 && book1.unit === 'pages' && book1.titlePhrase === 'dune', "Book parse 1");

const book2 = parseBookProgress("J'ai avancé de 3 chapitres sur mon livre de cuisine");
assert(book2 && book2.amount === 3 && book2.unit === 'chapters' && book2.titlePhrase === 'mon livre de cuisine', "Book parse 2");

const book3 = parseBookProgress("J'ai lu 12 pages");
assert(book3 && book3.amount === 12 && book3.unit === 'pages' && !book3.titlePhrase, "Book parse 3");

// Task Creation
const task1 = parsePersonalTaskCreation("Ajoute faire les courses à mes tâches");
assert(task1 && task1.title === 'faire les courses', "Task create 1");

const task2 = parsePersonalTaskCreation("Il faut que je nettoie le garage");
assert(task2 && task2.title === 'nettoie le garage', "Task create 2");

const task3 = parsePersonalTaskCreation("Rappelle moi de sortir les poubelles dans mes tâches");
assert(task3 && task3.title === 'sortir les poubelles', "Task create 3");

const task4 = parsePersonalTaskCreation("Penser à appeler le medecin");
assert(task4 && task4.title === 'appeler le medecin', "Task create 4");

// Task Completion
const done1 = parseTaskCompletion("J'ai fini la tâche faire les courses");
assert(done1 && done1.title === 'faire les courses', "Task done 1");

const done2 = parseTaskCompletion("J'ai terminé de faire le ménage");
assert(done2 && done2.title === 'faire le menage', "Task done 2");

const done3 = parseTaskCompletion("J'ai fini mon livre Dune");
assert(done3 && done3.title === 'mon livre dune', "Task done 3");

console.log(`Assertions PASS : ${passed}`);
console.log(`Assertions FAIL : ${failed}`);
if (failed > 0) process.exit(1);
