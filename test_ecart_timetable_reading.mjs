/**
 * test_ecart_timetable_reading.mjs
 * Test dédié pour l'écart :
 * "Import emploi du temps : le coach ne doit pas faire semblant d'avoir lu l'emploi du temps
 * ou présenter le nom du fichier comme preuve de lecture. Il annonce explicitement ce qu'il a lu
 * (cours, groupes détectés ou non) ou s'il n'a rien trouvé / si la lecture a échoué."
 */
import { App } from './src/core/App.js';
import { MemoryProvider } from './src/services/MemoryProvider.js';
import { ChatHistoryEngine } from './src/engines/ChatHistoryEngine.js';
import { SchedulerEngine } from './src/engines/SchedulerEngine.js';
import { AcademicSeeder } from './src/data/AcademicSeeder.js';
import { GROUND_TRUTH_G2, MockTimetableLLM } from './mock_timetable_gemini.mjs';

let failures = 0;
function assert(cond, msg) {
    if (cond) {
        console.log(`✅ PASS: ${msg}`);
    } else {
        console.error(`❌ FAIL: ${msg}`);
        failures++;
        process.exitCode = 1;
    }
}

global.window = {};
global.document = {
    getElementById: () => ({ innerHTML: '', addEventListener: () => {}, querySelectorAll: () => [], querySelector: () => null }),
    body: { className: '', classList: { add: () => {}, remove: () => {} } },
    querySelectorAll: () => [],
    querySelector: () => null
};

const FAKE_PDF_B64 = Buffer.from('%PDF-1.4 faux emploi du temps').toString('base64');

async function createTestApp(responseOrError) {
    const storage = new MemoryProvider();
    const chat = new ChatHistoryEngine(storage);
    const scheduler = new SchedulerEngine(storage);
    const app = new App(storage, scheduler, null, null, null, null, chat);
    app.coachEngine.coachAI.llmReasoning = null;
    app.renderView = async () => {};
    await new AcademicSeeder(app.academicEngine).seed();
    await app.refreshAcademicSubjects();

    if (responseOrError instanceof Error) {
        app.timetableImporter.llmProvider = {
            extractJSON: async () => { throw responseOrError; }
        };
    } else {
        const llm = new MockTimetableLLM(responseOrError);
        app.timetableImporter.llmProvider = llm;
    }

    app.state.userProfile = { name: 'Emmanuela', currentSemesterId: 'sem_s3_26', groupe: 'Groupe 2' };
    app.clock = () => new Date(2026, 9, 4, 18, 0);
    return { app, storage, chat };
}

async function run() {
    console.log("=== TESTS DÉDIÉS : EMPLOI DU TEMPS - VÉRACITÉ DE LECTURE ===");

    // Cas 1: Échec de lecture (erreur LLM)
    {
        const { app, chat } = await createTestApp(new Error("Format non reconnu par l'IA"));
        let threw = false;
        try {
            await app.extractTimetable({ base64: FAKE_PDF_B64, mimeType: 'application/pdf', fileName: 'edt_corrompu.pdf' });
        } catch (e) {
            threw = true;
        }
        assert(threw, "1. L'extraction lève bien une exception en cas d'erreur de lecture");
        const messages = await chat.getAllMessages();
        const lastMsg = messages[messages.length - 1];
        assert(lastMsg && lastMsg.role === 'assistant', "2. Le coach enregistre un message suite à l'échec");
        assert(lastMsg.content.includes("La lecture de l'emploi du temps a échoué") && lastMsg.content.includes("Aucun cours n'a pu être lu"),
            "3. Le coach annonce explicitement que la lecture a échoué et qu'aucun cours n'a pu être lu");
        assert(!lastMsg.content.includes("J'ai bien lu edt_corrompu.pdf"),
            "4. Le coach ne prétend pas avoir lu le fichier en citant seulement son nom");
    }

    // Cas 2: Document analysé mais 0 cours trouvés
    {
        const emptyResponse = JSON.stringify({
            weekStart: '2026-10-05',
            weekEnd: '2026-10-11',
            groupsFound: [],
            sessions: []
        });
        const { app, chat } = await createTestApp(emptyResponse);
        const preview = await app.extractTimetable({ base64: FAKE_PDF_B64, mimeType: 'application/pdf', fileName: 'page_blanche.pdf' });
        assert(preview.rows.length === 0, "5. Aperçu retourné avec 0 cours");
        const messages = await chat.getAllMessages();
        const lastMsg = messages[messages.length - 1];
        assert(lastMsg.content.includes("J'ai analysé le document mais je n'ai trouvé aucun cours"),
            "6. Le coach annonce clairement qu'aucun cours n'a été trouvé");
        assert(lastMsg.content.includes("aucun groupe spécifique détecté"),
            "7. Le coach indique qu'aucun groupe spécifique n'a été détecté");
    }

    // Cas 3: Document avec cours et groupes détectés
    {
        const { app, chat } = await createTestApp(GROUND_TRUTH_G2);
        const preview = await app.extractTimetable({ base64: FAKE_PDF_B64, mimeType: 'application/pdf', fileName: 'planning_officiel.pdf' });
        assert(preview.rows.length === 7, "8. 7 cours lus pour le groupe 2");
        const messages = await chat.getAllMessages();
        const readMsg = messages[messages.length - 1];
        assert(readMsg.content.includes("Lecture de l'emploi du temps : 7 cours lu(s)"),
            "9. Le coach annonce exactement 7 cours lus");
        assert(readMsg.content.includes("Groupe 2"),
            "10. Le coach annonce les groupes détectés (Groupe 2)");

        // Application et annonce finale
        const res = await app.applyTimetableImport(preview, {});
        assert(res.success && res.count === 7, "11. Import appliqué avec 7 cours");
        const historyAfter = await chat.getAllMessages();
        const applyMsg = historyAfter[historyAfter.length - 1];
        assert(applyMsg.content.includes("7 cours ajouté(s) à ton planning"),
            "12. L'annonce finale confirme les 7 cours ajoutés au planning");
        assert(applyMsg.content.includes("Groupe 2"),
            "13. Le groupe est précisé dans l'annonce finale");
    }

    // Cas 4: Multi-groupes avec MESSY_TEXT
    {
        const { MESSY_TEXT } = await import('./mock_timetable_gemini.mjs');
        const { app, chat } = await createTestApp(MESSY_TEXT);
        const preview = await app.extractTimetable({ base64: FAKE_PDF_B64, mimeType: 'application/pdf', fileName: 'emploi_messy.pdf' });
        assert(preview.groupsFound.includes('Groupe 1') && preview.groupsFound.includes('Groupe 2'), "14. Multi-groupes détectés");
        const messages = await chat.getAllMessages();
        const readMsg = messages[messages.length - 1];
        assert(readMsg.content.includes("Groupe 1, Groupe 2"), "15. Le coach annonce les deux groupes détectés");
    }

    if (failures === 0) {
        console.log("\n🎉 Tous les tests d'annonce de lecture de l'emploi du temps sont passés !");
    } else {
        console.error(`\n❌ ${failures} test(s) ont échoué.`);
    }
}

run();
