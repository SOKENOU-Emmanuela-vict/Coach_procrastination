import fs from 'fs';
import { execSync } from 'child_process';
import { CoachOrchestrator } from './src/ai/CoachOrchestrator.js';

function assert(condition, message) {
    if (!condition) {
        console.error(`❌ FAIL: ${message}`);
        process.exitCode = 1;
        process.exit(1);
    }
    console.log(`✅ PASS: ${message}`);
}

async function run() {
    console.log("=== TEST POINT 0: Clé Gemini & Indépendance temporelle ===");

    // 1. Vérification absence de clé codée en dur dans CoachOrchestrator.js
    const source = fs.readFileSync('./src/ai/CoachOrchestrator.js', 'utf8');
    assert(!source.includes('QVEuQWI'), "Aucune chaîne Base64 suspecte / clé hardcodée dans CoachOrchestrator.js");
    assert(!source.includes('AIza'), "Aucune clé AIza directe dans CoachOrchestrator.js");
    assert(source.includes("window.localStorage.getItem('gemini_api_key')"), "Lecture via localStorage gemini_api_key présente");
    assert(source.includes("process.env.GEMINI_API_KEY"), "Lecture via process.env.GEMINI_API_KEY présente");

    // 2. Instanciation sans variable d'env ni localStorage
    const savedEnv = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    const orchestrator = new CoachOrchestrator({ getSlots: () => [] });
    assert(orchestrator.llmProvider === null, "Sans clé configurée, llmProvider est null (aucun fallback secret)");
    if (savedEnv) process.env.GEMINI_API_KEY = savedEnv;

    // 3. Vérification du calcul dynamique de date dans test_sprint_scenarios.mjs
    const sprintSource = fs.readFileSync('./test_sprint_scenarios.mjs', 'utf8');
    assert(!sprintSource.includes('"2026-09-21"'), "Date fixe '2026-09-21' retirée de test_sprint_scenarios.mjs");
    assert(sprintSource.includes('monday60') || sprintSource.includes('targetMonday'), "Calcul dynamique d'un lundi futur présent dans test_sprint_scenarios.mjs");

    // 4. Scan complet du dépôt git pour vérifier l'absence totale de clés d'API (AIza, sk-, AQ.)
    const trackedFiles = execSync('git ls-files', { encoding: 'utf8' }).split(/\r?\n/).filter(Boolean);
    let secretViolations = 0;
    for (const file of trackedFiles) {
        if (file === 'test_point_0_api_key_and_date_independence.mjs' || file.startsWith('tests/fixtures/')) continue;
        try {
            const content = fs.readFileSync(file, 'utf8');
            // Clés AIza réelles (39 caractères)
            if (/AIza[0-9A-Za-z-_]{30,}/.test(content)) {
                console.error(`❌ Violation détectée : motif AIza dans ${file}`);
                secretViolations++;
            }
            // Clés Vertex AI Express réelles AQ. (50+ caractères)
            if (/AQ\.[0-9A-Za-z-_]{30,}/.test(content) && !content.includes('FAKE_TEST')) {
                console.error(`❌ Violation détectée : motif AQ. dans ${file}`);
                secretViolations++;
            }
            // Clés OpenAI sk-... ou sk-proj-...
            if (/sk-[0-9A-Za-z-_]{20,}/.test(content) || /sk-proj-[0-9A-Za-z-_]{20,}/.test(content)) {
                console.error(`❌ Violation détectée : motif sk- dans ${file}`);
                secretViolations++;
            }
        } catch (_) {}
    }
    assert(secretViolations === 0, "Scan Git complet : zéro clé API dans tous les fichiers suivis (AIza, sk-, AQ.)");

    console.log("Tous les tests du Point 0 sont validés avec succès !");
}

run();
