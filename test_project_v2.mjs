import { MemoryProvider } from './src/services/MemoryProvider.js';
import { Project } from './src/models/Project.js';
import { Event } from './src/models/Event.js';
import { PlanningEngine } from './src/engines/PlanningEngine.js';

async function runTests() {
    console.log("=== TESTS PROJET V2 ===");
    let storage = new MemoryProvider();
    let planningEngine = new PlanningEngine(storage);
    
    // --- PROJECT TESTS ---
    // 1. création Project
    let p = new Project("p1", "Test Project");
    console.assert(p.id === "p1", "1. id");
    console.assert(p.title === "Test Project", "1. title");
    
    // 2-4. Status
    console.assert(p.status === "active", "2. status active par défaut");
    p.status = "paused";
    console.assert(p.status === "paused", "3. status paused");
    p.status = "completed";
    console.assert(p.status === "completed", "4. status completed");
    
    // 5-7. Priority
    console.assert(p.priority === "medium", "Priority medium par défaut");
    p.priority = "high";
    console.assert(p.priority === "high", "5. priority high");
    p.priority = "low";
    console.assert(p.priority === "low", "7. priority low");
    
    // 8-9. TargetDate, GoalId
    p.targetDate = "2026-12-31";
    console.assert(p.targetDate === "2026-12-31", "8. targetDate");
    p.goalId = "g1";
    console.assert(p.goalId === "g1", "9. goalId");
    
    // 10. tasks embarquées
    p.tasks = [];
    console.assert(Array.isArray(p.tasks), "10. tasks est un tableau");

    // --- PROGRESSION ---
    // 11. 0 task => 0%
    console.assert(p.progress === 0, "11. zero tasks => 0%");
    
    p.tasks.push({ id: "t1", title: "T1", status: "todo", estimatedDuration: 60, order: 1 });
    p.tasks.push({ id: "t2", title: "T2", status: "in_progress", estimatedDuration: 120, order: 2 });
    
    // 12. tâches partiellement terminées (0 done / 2 = 0%)
    console.assert(p.progress === 0, "12. 0 done => 0%");
    
    p.tasks[0].status = "done";
    // (1 done / 2 = 50%)
    console.assert(p.progress === 50, "12. 1/2 done => 50%");
    
    // 13. toutes tasks terminées => 100%
    p.tasks[1].status = "done";
    console.assert(p.progress === 100, "13. toutes done => 100%");

    // --- TASK STRUCTURE ---
    let t = p.tasks[0];
    console.assert(t.id === "t1", "14-18. Task has id");
    console.assert(t.status === "done", "Task has status");
    console.assert(t.estimatedDuration === 60, "Task has estimatedDuration");
    console.assert(t.order === 1, "Task has order");

    // Enregistrement en base pour le planning
    await storage.saveData('projects', [p]);

    // --- EVENT & PLANNING TESTS ---
    // 19. Event sans Project
    let e1 = new Event({ id: "e1", type: "Cours", date: "2026-10-01", lockStatus: "flexible" });
    await planningEngine.saveEvent(e1);
    
    let conflictsDate = await planningEngine.detectConflicts("2026-10-01");
    console.assert(conflictsDate.length === 0, "19. Event sans Project = OK");

    // 20. Event avec Project
    let e2 = new Event({ id: "e2", type: "Projet", date: "2026-10-01", projectId: "p1", lockStatus: "flexible" });
    await planningEngine.saveEvent(e2);
    conflictsDate = await planningEngine.detectConflicts("2026-10-01");
    console.assert(conflictsDate.length === 0, "20. Event avec Project = OK");

    // 21. Event avec Project + Task
    let e3 = new Event({ id: "e3", type: "Projet", date: "2026-10-01", projectId: "p1", taskId: "t1", lockStatus: "flexible" });
    await planningEngine.saveEvent(e3);
    conflictsDate = await planningEngine.detectConflicts("2026-10-01");
    console.assert(conflictsDate.length === 0, "21. Event avec Project + Task = OK");

    // 22. taskId sans projectId => invalide
    let e4 = new Event({ id: "e4", type: "Projet", date: "2026-10-01", taskId: "t1" });
    await planningEngine.saveEvent(e4);
    conflictsDate = await planningEngine.detectConflicts("2026-10-01");
    let c22 = conflictsDate.find(c => c.event.id === "e4" && c.message.includes("projectId manquant"));
    console.assert(c22 !== undefined, "22. taskId sans projectId => DATA_CONFLICT");

    // 23. task inexistante => conflit
    let e5 = new Event({ id: "e5", type: "Projet", date: "2026-10-01", projectId: "p1", taskId: "t99" });
    await planningEngine.saveEvent(e5);
    conflictsDate = await planningEngine.detectConflicts("2026-10-01");
    let c23 = conflictsDate.find(c => c.event.id === "e5" && c.message.includes("taskId t99 est introuvable"));
    console.assert(c23 !== undefined, "23. Task inexistante => DATA_CONFLICT");

    // 24. project inexistant => conflit
    let e6 = new Event({ id: "e6", type: "Projet", date: "2026-10-01", projectId: "p99" });
    await planningEngine.saveEvent(e6);
    conflictsDate = await planningEngine.detectConflicts("2026-10-01");
    let c24 = conflictsDate.find(c => c.event.id === "e6" && c.message.includes("projectId p99 est introuvable"));
    console.assert(c24 !== undefined, "24. Project inexistant => DATA_CONFLICT");

    // 25. Cross-project task (Project A / Task B1)
    let pA = new Project("pA", "Project A");
    pA.tasks.push({ id: "A1", title: "Task A1", status: "todo", estimatedDuration: 60, order: 1 });
    
    let pB = new Project("pB", "Project B");
    pB.tasks.push({ id: "B1", title: "Task B1", status: "todo", estimatedDuration: 60, order: 1 });
    
    await storage.saveData('projects', [p, pA, pB]);

    let e7 = new Event({ id: "e7", type: "Projet", date: "2026-10-01", projectId: "pA", taskId: "B1" });
    await planningEngine.saveEvent(e7);
    
    let originalE7Start = e7.startTime;
    let originalE7End = e7.endTime;
    
    conflictsDate = await planningEngine.detectConflicts("2026-10-01");
    let c25 = conflictsDate.find(c => c.event.id === "e7" && c.message.includes("taskId B1 est introuvable"));
    console.assert(c25 !== undefined, "25. Cross-project Task => DATA_CONFLICT");
    
    let e7After = (await planningEngine.getEventsForDate("2026-10-01")).find(e => e.id === "e7");
    console.assert(e7After.startTime === originalE7Start, "25. Event startTime intact");
    console.assert(e7After.endTime === originalE7End, "25. Event endTime intact");

    // 26-27. getEventsForProject, getEventsForTask
    let projEvents = await planningEngine.getEventsForProject("p1");
    console.assert(projEvents.length === 3, `Expected 3 proj events, got ${projEvents.length}`);
    
    let taskEvents = await planningEngine.getEventsForTask("p1", "t1");
    console.assert(taskEvents.length === 1, "27. getEventsForTask() = 1 event");

    // --- TEST CRITIQUE : DÉPLACEMENT ---
    // 28-30. locked / flexible test
    let e_locked = new Event({ id: "e_lock", type: "Exam", date: "2026-10-02", startTime: "10:00", endTime: "12:00", lockStatus: "locked" });
    let e_flex = new Event({ id: "e_flex", type: "Projet", date: "2026-10-02", startTime: "11:00", endTime: "13:00", lockStatus: "flexible" });
    await planningEngine.saveEvent(e_locked);
    await planningEngine.saveEvent(e_flex);
    
    let originalStart = e_flex.startTime;
    let originalEnd = e_flex.endTime;

    let conflictsCrit = await planningEngine.detectConflicts("2026-10-02");
    
    console.assert(conflictsCrit.length === 1, "Il doit y avoir 1 conflit detecté (WARNING_CONFLICT).");
    console.assert(conflictsCrit[0].type === "WARNING_CONFLICT", "Le conflit est WARNING_CONFLICT");
    
    // Vérification que les événements N'ONT PAS ÉTÉ DÉPLACÉS
    let flexAfter = (await planningEngine.getEventsForDate("2026-10-02")).find(e => e.id === "e_flex");
    console.assert(flexAfter.startTime === originalStart, "Test critique : le startTime du flexible n'a pas bougé");
    console.assert(flexAfter.endTime === originalEnd, "Test critique : le endTime du flexible n'a pas bougé");
    
    console.log("=> TOUS LES TESTS PROJET V2 SONT VERTS !");
}

runTests().catch(console.error);
