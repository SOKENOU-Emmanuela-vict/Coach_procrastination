import { Document } from './src/models/Document.js';
import { DocumentChunk } from './src/models/DocumentChunk.js';
import { KnowledgeEngine } from './src/engines/KnowledgeEngine.js';
import { CoachContextBuilder } from './src/ai/CoachContext.js';

class MockStorage {
    constructor() { this.data = {}; }
    async loadData(key) { return this.data[key] || []; }
    async saveData(key, value) { this.data[key] = value; }
}

function assert(condition, message) {
    if (!condition) {
        console.error(`❌ FAIL: ${message}`);
        process.exit(1);
    }
    console.log(`✅ PASS: ${message}`);
}

async function runTests() {
    console.log("=== TESTS KNOWLEDGE ENGINE (B.6) ===\n");
    let passed = 0;
    let total = 0;

    const wrapAssert = (condition, message) => {
        total++;
        assert(condition, message);
        passed++;
    };

    const storage = new MockStorage();
    const knowledgeEngine = new KnowledgeEngine(storage);

    // 1. & 2. Créer un Document avec UUID généré
    const doc = new Document({ title: "Syllabus de Maths", type: "syllabus", linkedTo: { subjectId: "sub_math" } });
    wrapAssert(doc.title === "Syllabus de Maths", "1. Création d'un Document");
    wrapAssert(typeof doc.id === "string" && doc.id.length > 10, "2. ID unique généré (randomUUID fallback utilisé)");

    await knowledgeEngine.saveDocument(doc);

    // 3. 4. 5. 6. Créer un Chunk relié
    const chunk1 = new DocumentChunk({
        documentId: doc.id,
        index: 0,
        content: "Le cours abordera les équations différentielles.",
        pageStart: 2,
        pageEnd: 3,
        sectionTitle: "Introduction"
    });
    
    wrapAssert(chunk1.content.includes("équations"), "3. Création d'un DocumentChunk");
    wrapAssert(chunk1.documentId === doc.id, "4. Chunk relié correctement au Document");
    wrapAssert(chunk1.pageStart === 2 && chunk1.pageEnd === 3, "5. Conservation de pageStart et pageEnd");
    wrapAssert(chunk1.sectionTitle === "Introduction", "6. Conservation de sectionTitle");

    await knowledgeEngine.saveChunk(chunk1);
    await knowledgeEngine.saveChunk(new DocumentChunk({
        documentId: doc.id,
        index: 1,
        content: "Partie 2",
    }));

    // 7. Récupérer les chunks d'un document
    const chunks = await knowledgeEngine.getChunksByDocument(doc.id);
    wrapAssert(chunks.length === 2 && chunks[1].index === 1, "7. Récupération des chunks d'un document");

    // 8. Récupérer les documents liés à une Subject
    const subjDocs = await knowledgeEngine.getDocumentsBySubject("sub_math");
    wrapAssert(subjDocs.length === 1 && subjDocs[0].id === doc.id, "8. Récupération des documents liés à une Subject");

    // 9. Récupérer les chunks liés à une Assessment
    const docEval = new Document({ title: "Consignes", linkedTo: { assessmentId: "eval_1" } });
    await knowledgeEngine.saveDocument(docEval);
    await knowledgeEngine.saveChunk(new DocumentChunk({ documentId: docEval.id, index: 0, content: "Test" }));
    const evalChunks = await knowledgeEngine.getChunksForAssessment("eval_1");
    wrapAssert(evalChunks.length === 1 && evalChunks[0].documentId === docEval.id, "9. Récupération des chunks liés à une Assessment");

    // 10. Récupérer les chunks liés à un Project
    const docProj = new Document({ title: "Specs", linkedTo: { projectId: "proj_1" } });
    await knowledgeEngine.saveDocument(docProj);
    await knowledgeEngine.saveChunk(new DocumentChunk({ documentId: docProj.id, index: 0, content: "Specs text" }));
    const projChunks = await knowledgeEngine.getChunksForProject("proj_1");
    wrapAssert(projChunks.length === 1 && projChunks[0].documentId === docProj.id, "10. Récupération des éléments liés à un Project");

    // 11. CoachContext sans knowledge
    const ctxNoKnowledge = CoachContextBuilder.build({ currentDate: "2026-09-12" });
    wrapAssert(ctxNoKnowledge.schemaVersion === 1 && typeof ctxNoKnowledge.knowledge === "undefined", "11. CoachContext est valide et reste identique sans knowledge");

    // 12. CoachContext avec knowledge
    const ctxWithKnowledge = CoachContextBuilder.build({ 
        currentDate: "2026-09-12",
        knowledge: {
            documents: [docProj],
            relevantChunks: projChunks
        }
    });
    wrapAssert(ctxWithKnowledge.knowledge && ctxWithKnowledge.knowledge.relevantChunks.length === 1, "12. CoachContext accepte de manière optionnelle les knowledge");

    // 13. & 14. Architecture boundaries (Safety)
    wrapAssert(typeof knowledgeEngine.saveEvent === "undefined" && typeof knowledgeEngine.executeIntent === "undefined", "13 & 14. KnowledgeEngine ne contient aucune méthode permettant de muter le planning (Data > Command)");
    wrapAssert(chunk1.target === undefined && chunk1.action === undefined, "13b. Un DocumentChunk n'est pas un PlanningIntent");

    // 15. Validation (Basic fields required by chunk)
    try {
        new DocumentChunk({ index: 0, content: "No doc id" });
        wrapAssert(false, "15. Validation: Chunk devrait rejeter l'absence de documentId");
    } catch (e) {
        wrapAssert(e.message.includes("documentId"), "15. Validation: Rejet sans documentId");
    }

    console.log(`\n=== RÉSULTATS : ${passed}/${total} TESTS PASSÉS ===`);
    if (passed !== total) process.exit(1);
}

runTests().catch(e => {
    console.error(e);
    process.exit(1);
});
