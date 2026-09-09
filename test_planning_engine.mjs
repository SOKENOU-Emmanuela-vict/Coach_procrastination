import { MemoryProvider } from './src/services/MemoryProvider.js';
import { PlanningEngine } from './src/engines/PlanningEngine.js';
import { Event } from './src/models/Event.js';
import { AvailabilityWindow } from './src/models/AvailabilityWindow.js';
import { Subject } from './src/models/Subject.js';
import { Assessment } from './src/models/Assessment.js';
import { SchedulerEngine } from './src/engines/SchedulerEngine.js';

async function runPlanningTests() {
    console.log("=== DEBUT DES TESTS DU MOTEUR DE PLANIFICATION ===");
    
    const storage = new MemoryProvider();
    const planningEngine = new PlanningEngine(storage);
    const schedulerEngine = new SchedulerEngine(storage);
    
    // Setup académique fictif
    await storage.saveData('acad_subjects', [new Subject('sub_1', 'sem_1', 'Maths', 5, null, 5, 4, 4)]);
    await storage.saveData('acad_assessments', [new Assessment('ass_1', 'sub_1', 'Exam', 'exam', 1, 20)]);
    await storage.saveData('bootcamp_program', [{ days: [{ sessions: [{ title: 'Legacy' }] }] }]);

    // TEST 1, 2, 3, 4, 13, 14 : Créations et attributs
    console.log("\n--- TEST 1, 2, 3, 4, 13, 14 : Créations et attributs ---");
    const eLocked = new Event({ id: 'e1', type: 'class', date: '2026-10-10', startTime: '10:00', endTime: '12:00', lockStatus: 'locked', priority: 'high', subjectId: 'sub_1' });
    const eFlex = new Event({ id: 'e2', type: 'revision', date: '2026-10-10', startTime: '14:00', endTime: '15:30', lockStatus: 'flexible', priority: 'low', assessmentId: 'ass_1' });
    await planningEngine.saveEvent(eLocked);
    await planningEngine.saveEvent(eFlex);
    
    console.log(`Event Locked créé: ${eLocked.lockStatus === 'locked'}`);
    console.log(`Event Flexible créé: ${eFlex.lockStatus === 'flexible'}`);
    console.log(`Lié à Subject: ${eLocked.subjectId === 'sub_1'}`);
    console.log(`Lié à Assessment: ${eFlex.assessmentId === 'ass_1'}`);
    console.log(`Priority et LockStatus indépendants (locked/high): ${eLocked.priority === 'high' && eLocked.lockStatus === 'locked'}`);
    console.log(`Duration cohérente (10h-12h = 120min): ${eLocked.duration === 120}`);

    // TEST Rétrocompatibilité Constructeur Legacy
    console.log("\n--- TEST Rétrocompatibilité Constructeur Event ---");
    const eLegacy = new Event('leg1', 'legacyType', '2026-10-10', 'bloc', 'Haute', true);
    console.log(`Construction Legacy sans erreur: ${eLegacy.id === 'leg1' && eLegacy.type === 'legacyType'}`);
    console.log(`Propriétés Legacy préservées: impact='${eLegacy.impact}', priority='${eLegacy.priority}', mandatory=${eLegacy.mandatory}`);
    console.log(`Valeurs par défaut respectées: lockStatus='${eLegacy.lockStatus}', duration=${eLegacy.duration}`);


    // TEST 5, 6, 7 : Chevauchements et Conflits
    console.log("\n--- TEST 5, 6, 7 : Chevauchements et Conflits ---");
    await planningEngine.saveEvent(new Event({ id: 'e3', type: 'class', date: '2026-10-10', startTime: '11:00', endTime: '13:00', lockStatus: 'locked' }));
    await planningEngine.saveEvent(new Event({ id: 'e4', type: 'personal', date: '2026-10-10', startTime: '11:30', endTime: '12:30', lockStatus: 'flexible' }));
    const conflicts = await planningEngine.detectConflicts('2026-10-10');
    
    const critConflict = conflicts.find(c => c.type === 'CRITICAL_CONFLICT');
    const warnConflict = conflicts.find(c => c.type === 'WARNING_CONFLICT');
    console.log(`Conflit Locked vs Locked détécté (CRITICAL) : ${!!critConflict}`);
    console.log(`Conflit Flexible vs Locked détécté (WARNING) : ${!!warnConflict}`);

    // TEST 8, 9 : Invalide et Orphelin
    console.log("\n--- TEST 8, 9 : Invalide et Orphelin ---");
    await planningEngine.saveEvent(new Event({ id: 'e5', type: 'bug', date: '2026-10-11', startTime: '15:00', endTime: '14:00' })); // Heure invalide
    await planningEngine.saveEvent(new Event({ id: 'e6', type: 'class', date: '2026-10-11', startTime: '08:00', endTime: '09:00', subjectId: 'fake_sub' })); // Orphelin
    const conflictsDay2 = await planningEngine.detectConflicts('2026-10-11');
    
    console.log(`Horaires invalides (TIME_CONFLICT) : ${conflictsDay2.some(c => c.type === 'TIME_CONFLICT')}`);
    console.log(`Relation orpheline (DATA_CONFLICT) : ${conflictsDay2.some(c => c.type === 'DATA_CONFLICT')}`);

    // TEST 10, 15, 16, 17, 18, 19, 20 : Disponibilités et Créneaux Libres
    console.log("\n--- TEST 10, 15-20 : Disponibilités et Créneaux Libres ---");
    
    // 20. Absence = aucune disponibilité
    const slotsEmpty = await planningEngine.getAvailableSlots('2026-10-12');
    console.log(`Aucune disponibilité inventée (absence window = 0 créneau) : ${slotsEmpty.length === 0}`);

    // 17. Plusieurs AvailabilityWindows + 16. Respect explicite
    await planningEngine.saveAvailabilityWindow(new AvailabilityWindow({ id: 'w1', date: '2026-10-12', startTime: '09:00', endTime: '12:00' }));
    await planningEngine.saveAvailabilityWindow(new AvailabilityWindow({ id: 'w2', date: '2026-10-12', startTime: '14:00', endTime: '18:00' }));
    
    // 18. Events locked superposés (fusion) et 19. Events flexibles (ignorés)
    await planningEngine.saveEvent(new Event({ id: 'l1', type: 'class', date: '2026-10-12', startTime: '10:00', endTime: '11:00', lockStatus: 'locked' }));
    await planningEngine.saveEvent(new Event({ id: 'l2', type: 'class', date: '2026-10-12', startTime: '10:30', endTime: '11:30', lockStatus: 'locked' })); // Chevauche l1
    await planningEngine.saveEvent(new Event({ id: 'f1', type: 'revision', date: '2026-10-12', startTime: '14:00', endTime: '15:00', lockStatus: 'flexible' })); // Flexible, ne doit pas bloquer
    
    const slots = await planningEngine.getAvailableSlots('2026-10-12');
    // Le locked couvre 10:00 à 11:30. Fenêtre 1 (09:00-12:00) devient : 09:00-10:00 et 11:30-12:00
    // Fenêtre 2 (14:00-18:00) reste intacte car f1 est flexible.
    console.log(`Disponibilités explicites respectées (pas de 08:00-22:00) : ${slots.length === 3}`);
    console.log(`Créneau 1 : ${slots[0]?.startTime}-${slots[0]?.endTime} (Attendu: 09:00-10:00)`);
    console.log(`Créneau 2 : ${slots[1]?.startTime}-${slots[1]?.endTime} (Attendu: 11:30-12:00)`);
    console.log(`Créneau 3 : ${slots[2]?.startTime}-${slots[2]?.endTime} (Attendu: 14:00-18:00)`);
    console.log(`Event flexible distingué d'un blocage : ${slots[2]?.durationMinutes === 240}`);

    // TEST 11 : Aucun déplacement automatique
    console.log("\n--- TEST 11 : Aucun déplacement automatique ---");
    const eventsDay1After = await planningEngine.getEventsForDate('2026-10-10');
    const e2After = eventsDay1After.find(e => e.id === 'e2');
    console.log(`L'événement flexible e2 n'a pas été déplacé malgré les conflits : ${e2After.startTime === '14:00'}`);

    // TEST 12 : Scheduler Legacy intact
    console.log("\n--- TEST 12 : Scheduler Legacy intact ---");
    const program = await schedulerEngine.getFullProgram();
    console.log(`Le Scheduler continue de fonctionner : ${program !== null && program[0].days !== undefined}`);

    // TEST 13 : Validation de Event.js dans saveEvent
    console.log("\n--- TEST 13 : Validation de Event.js dans saveEvent ---");
    // Si on passe un objet sans source (qui n'est pas une instance d'Event)
    await planningEngine.saveEvent({ id: 'val1', type: 'revision', date: '2026-10-13' });
    const eventsDay13 = await planningEngine.getEventsForDate('2026-10-13');
    const valEvent = eventsDay13.find(e => e.id === 'val1');
    // Le constructeur de Event.js ajoute des defaults comme lockStatus = 'flexible' et source = 'system'
    console.log(`L'événement a traversé Event.js et reçu lockStatus par défaut: ${valEvent.lockStatus === 'flexible'}`);
    console.log(`L'événement a traversé Event.js et reçu source par défaut: ${valEvent.source === 'system'}`);

    console.log("\n=== FIN DES TESTS ===");
}

runPlanningTests().catch(console.error);
