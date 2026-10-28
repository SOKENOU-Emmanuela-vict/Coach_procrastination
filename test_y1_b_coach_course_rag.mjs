import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { MemoryProvider } from './src/services/MemoryProvider.js';
import { KnowledgeEngine } from './src/engines/KnowledgeEngine.js';
import { KnowledgeRetriever } from './src/engines/KnowledgeRetriever.js';
import { CoachAI } from './src/ai/CoachAI.js';
import { CoachLocalReply } from './src/ai/CoachLocalReply.js';
import { parseCourseQuery } from './src/ai/ChatIntentParser.js';
import { PromptBuilder } from './src/ai/PromptBuilder.js';
import { CoachLLMReasoning } from './src/ai/CoachLLMReasoning.js';

const ROOT_DIR = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = path.join(ROOT_DIR, 'tests', 'fixtures');

console.log("=== TESTS Y1-B : LE COACH UTILISE MES COURS (AVEC ET SANS CLÉ) ===");

let passed = 0;
let total = 0;
function test(msg, fn) {
    total++;
    try {
        fn();
        passed++;
        console.log(`✅ PASS: ${msg}`);
    } catch (e) {
        console.error(`❌ FAIL: ${msg}\n`, e);
        process.exitCode = 1;
    }
}
async function testAsync(msg, fn) {
    total++;
    try {
        await fn();
        passed++;
        console.log(`✅ PASS: ${msg}`);
    } catch (e) {
        console.error(`❌ FAIL: ${msg}\n`, e);
        process.exitCode = 1;
    }
}

// 1. Détection des intentions par ChatIntentParser
test('1. Reconnaissance de « quels documents j’ai ? »', () => {
    const q1 = parseCourseQuery("Quels documents j'ai ?");
    assert(q1 && q1.type === 'list_documents', 'list_documents reconnu');
    const q2 = parseCourseQuery("Mes documents");
    assert(q2 && q2.type === 'list_documents', 'mes documents reconnu');
});

test('2. Reconnaissance de « que dit mon cours de <matière> sur <sujet> ? »', () => {
    const q1 = parseCourseQuery("Que dit mon cours d'algorithmique sur la récursivité ?");
    assert(q1 && q1.type === 'course_query', 'course_query reconnu');
    assert(q1.subjectPhrase === 'algorithmique', 'Matière extraite');
    assert(q1.topic.includes('recursivite'), 'Sujet extrait');

    const q2 = parseCourseQuery("Que dit mon cours sur le polymorphisme ?");
    assert(q2 && q2.type === 'course_query' && q2.topic.includes('polymorphisme'), 'Cours sans matière explicite reconnu');
});

test('3. Reconnaissance de « cherche <mot> dans mes cours »', () => {
    const q = parseCourseQuery("Cherche polymorphisme dans mes cours");
    assert(q && q.type === 'course_search', 'course_search reconnu');
    assert(q.topic === 'polymorphisme', 'Mot clé extrait');
});

test('4. Reconnaissance de « résume le document <titre> »', () => {
    const q = parseCourseQuery("Résume le document cours_poo");
    assert(q && q.type === 'summarize_document', 'summarize_document reconnu');
    assert(q.titlePhrase === 'cours_poo', 'Titre de document extrait');
});

// 2. Tests SANS CLÉ (Mode local déterministe)
const storage = new MemoryProvider();
const knowledgeEngine = new KnowledgeEngine(storage);
const knowledgeRetriever = new KnowledgeRetriever(knowledgeEngine);
const coachAiLocal = new CoachAI(null, knowledgeRetriever);

const baseContext = {
    currentDate: '2026-10-28',
    courses: { upcomingSessions: [], timetable: { needsImport: false } },
    academic: { upcomingAssessments: [], pastDueAssessments: [] },
    planning: { events: [], availableSlots: [] },
    personalTasks: [],
    books: [],
    projects: []
};

// Cas A : Sans aucun document importé
await testAsync('5. Sans aucun document : « Quels documents j’ai ? » renvoie le message d’orientation École > Documents', async () => {
    const res = await CoachLocalReply.resolve(baseContext, "Quels documents j'ai ?", { code: 'NO_LLM' }, knowledgeRetriever);
    assert(res.message.includes('Tu n\'as importé aucun document : ouvre École > Documents.'), 'Message exact 0 document');
});

await testAsync('6. Sans aucun document : « Que dit mon cours sur le polymorphisme ? » renvoie l’orientation École > Documents', async () => {
    const res = await CoachLocalReply.resolve(baseContext, "Que dit mon cours sur le polymorphisme ?", { code: 'NO_LLM' }, knowledgeRetriever);
    assert(res.message.includes('Tu n\'as importé aucun document : ouvre École > Documents.'), 'Message exact 0 document');
});

// Cas B : Ingestion de 2 documents réels
const docxBuf = fs.readFileSync(path.join(FIXTURES_DIR, 'cours_poo.docx'));
await knowledgeEngine.ingestDocument(
    {
        name: 'cours_poo.docx',
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        size: docxBuf.byteLength,
        data: docxBuf
    },
    { title: 'Cours POO' },
    { subjectId: 'inf_poo' }
);

const pdfBuf = fs.readFileSync(path.join(FIXTURES_DIR, 'cours_2pages.pdf'));
await knowledgeEngine.ingestDocument(
    {
        name: 'cours_2pages.pdf',
        type: 'application/pdf',
        size: pdfBuf.byteLength,
        data: new Uint8Array(pdfBuf)
    },
    { title: 'Algèbre 2 Pages' },
    { subjectId: 'mth_alg' }
);

await testAsync('7. Avec 2 documents : « Quels documents j’ai ? » liste les vrais titres et nombre', async () => {
    const res = await CoachLocalReply.resolve(baseContext, "Quels documents j'ai ?", { code: 'NO_LLM' }, knowledgeRetriever);
    assert(res.message.includes('2 document(s) importé(s)'), 'Nombre de documents exact (2)');
    assert(res.message.includes('Cours POO') && res.message.includes('Algèbre 2 Pages'), 'Les 2 titres figurent dans la réponse');
});

await testAsync('8. « Que dit mon cours sur POLYMORPHISME_HERITAGE_DOCX ? » renvoie le vrai extrait et la source exacte', async () => {
    const res = await CoachLocalReply.resolve(baseContext, "Que dit mon cours sur POLYMORPHISME_HERITAGE_DOCX ?", { code: 'NO_LLM' }, knowledgeRetriever);
    assert(res.message.includes('POLYMORPHISME_HERITAGE_DOCX'), 'Extrait exact contenant le mot distinctif');
    assert(res.message.includes('Cours POO, p.1'), 'Source exacte avec titre et page p.1');
    assert(!res.message.includes('Lagrange'), 'Aucun mélange avec d’autres documents');
});

await testAsync('9. « Cherche MORPHISME_NOYAU_P2 dans mes cours » retrouve la page 2 du PDF', async () => {
    const res = await CoachLocalReply.resolve(baseContext, "Cherche MORPHISME_NOYAU_P2 dans mes cours", { code: 'NO_LLM' }, knowledgeRetriever);
    assert(res.message.includes('MORPHISME_NOYAU_P2'), 'Mot distinctif de la page 2 extrait');
    assert(res.message.includes('Algèbre 2 Pages, p.2'), 'Source exacte page 2 citée');
});

await testAsync('10. « Résume le document Algèbre 2 Pages » renvoie un « Aperçu du document » avec source', async () => {
    const res = await CoachLocalReply.resolve(baseContext, "Résume le document Algèbre 2 Pages", { code: 'NO_LLM' }, knowledgeRetriever);
    assert(res.message.includes('Aperçu du document « Algèbre 2 Pages » :'), 'Intitulé explicite « Aperçu du document »');
    assert(res.message.includes('Lagrange'), 'Premières phrases du document présentes');
    assert(res.message.includes('Source : Algèbre 2 Pages, p.1'), 'Source citée');
});

await testAsync('11. Sujet absent : « Que dit mon cours sur la photosynthèse ? » répond honnêtement « rien trouvé »', async () => {
    const res = await CoachLocalReply.resolve(baseContext, "Que dit mon cours sur la photosynthèse ?", { code: 'NO_LLM' }, knowledgeRetriever);
    assert(res.message.includes('Je n\'ai rien trouvé sur ça dans tes documents.'), 'Rien trouvé annoncé honnêtement');
    assert(res.message.includes('2 document(s) importé(s)'), 'Rappel du nombre de documents importés');
    assert(!res.message.includes('chlorophylle'), 'Aucune hallucination ou fait inventé');
});

await testAsync('12. Intégration dans CoachAI.analyze(context, query) sans clé Gemini', async () => {
    const recs = await coachAiLocal.analyze(baseContext, "Que dit mon cours sur POLYMORPHISME_HERITAGE_DOCX ?");
    assert(recs.length > 0, 'Recommandations renvoyées');
    const localRec = recs.find(r => r.decisionType === 'LOCAL_REPLY');
    assert(Boolean(localRec), 'Recommandation LOCAL_REPLY présente');
    assert(localRec.message.includes('POLYMORPHISME_HERITAGE_DOCX'), 'Réponse du cours intégrée dans le message');
    assert(localRec.message.includes('Cours POO, p.1'), 'Source exacte citée');
});

// 3. Tests AVEC CLÉ (Vérification RAG et PromptBuilder)
await testAsync('13. Avec clé : CoachLLMReasoning alimente context.knowledge.relevantChunks', async () => {
    let capturedPrompt = null;
    const fakeLlm = {
        generate: async (prompt) => {
            capturedPrompt = prompt;
            return JSON.stringify({
                version: 1,
                type: 'recommendation',
                rationale: 'D’après ton cours (Cours POO, p.1), le polymorphisme permet la surcharge.',
                evidence: [{ documentId: 'doc_poo', pageStart: 1 }]
            });
        }
    };

    const coachWithLlm = new CoachAI(fakeLlm, knowledgeRetriever);
    const recs = await coachWithLlm.analyze(baseContext, "Que dit mon cours sur POLYMORPHISME_HERITAGE_DOCX ?");

    assert(recs.some(r => r.title === "Conseil de l'IA"), 'Décision LLM prise en compte');
    assert(capturedPrompt.includes('=== KNOWLEDGE CONTEXT ==='), 'Section KNOWLEDGE CONTEXT présente dans le prompt');
    assert(capturedPrompt.includes('POLYMORPHISME_HERITAGE_DOCX'), 'Le chunk extrait est injecté dans le prompt');
    assert(capturedPrompt.includes('<untrusted_document_context'), 'Le chunk est strictement balisé anti-injection');
});

console.log(`\n=== BILAN Y1-B : ${passed}/${total} TESTS PASSÉS ===`);
if (passed === total) {
    console.log("🎉 TOUS LES TESTS DU COACH COURS & RAG (Y1-B) SONT VALIDES !");
} else {
    process.exit(1);
}
