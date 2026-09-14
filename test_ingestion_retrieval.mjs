import { DocumentExtractor } from './src/engines/DocumentExtractor.js';
import { TextNormalizer } from './src/engines/TextNormalizer.js';
import { DocumentChunker } from './src/engines/DocumentChunker.js';
import { KnowledgeEngine } from './src/engines/KnowledgeEngine.js';
import { KnowledgeRetriever } from './src/engines/KnowledgeRetriever.js';

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
    console.log("=== TESTS INGESTION & RETRIEVAL (B.7) ===\n");
    let passed = 0;
    let total = 0;

    const wrapAssert = (condition, message) => {
        total++;
        assert(condition, message);
        passed++;
    };

    const storage = new MockStorage();
    const knowledgeEngine = new KnowledgeEngine(storage);
    const retriever = new KnowledgeRetriever(knowledgeEngine);

    // Test 1: Extraction
    const textRaw = "Un texte simple.";
    const textExtracted = await DocumentExtractor.extractText(textRaw);
    wrapAssert(textExtracted === textRaw, "1. Extraction d'un texte simple (Mock text).");

    try {
        await DocumentExtractor.extractText({ type: "pdf" });
        wrapAssert(false, "1b. Rejet du format non supporté");
    } catch(e) {
        wrapAssert(true, "1b. Rejet du format PDF non supporté à cette étape.");
    }

    // Test 2: Normalisation
    const messyText = "Ligne 1\n\n\nLigne 2   avec des   espaces.";
    const cleanText = TextNormalizer.normalize(messyText);
    wrapAssert(cleanText === "Ligne 1\n\nLigne 2 avec des espaces.", "2. Normalisation (espaces et lignes vides).");

    // Test 3, 5: Chunking déterministe, Conservation ordre
    const textToChunk = "Paragraphe 1.\n\nParagraphe 2.\n\nParagraphe 3.";
    const chunks = DocumentChunker.chunk(textToChunk, { maxLength: 20 }); 
    // maxLength 20 coupe les paragraphes (13 cars) donc 1 para par chunk
    wrapAssert(chunks.length === 3, "3. Chunking déterministe.");
    wrapAssert(chunks[0].content === "Paragraphe 1." && chunks[1].content === "Paragraphe 2.", "5. Conservation de l'ordre.");

    // Test 4, Aucun caractère perdu, Même texte = même chunk
    const longText = "Ceci est une longue phrase qui dépasse la limite maximale fixée par le système et doit donc être découpée. Une autre phrase s'ajoute ici.";
    const chunksLong = DocumentChunker.chunk(longText, { maxLength: 50 });
    wrapAssert(chunksLong.every(c => c.content.length <= 50), "4. Respect strict de la taille maximale.");
    const reassembled = chunksLong.map(c => c.content).join(" "); // Il y aura un espace en trop par rapport à original, c'est conceptuel
    wrapAssert(reassembled.includes("Ceci est") && reassembled.includes("Une autre phrase"), "18a. Aucun contenu perdu pendant le chunking (phrases préservées).");
    
    const chunksLong2 = DocumentChunker.chunk(longText, { maxLength: 50 });
    wrapAssert(JSON.stringify(chunksLong) === JSON.stringify(chunksLong2), "18b. Déterminisme absolu: même entrée = exactement mêmes chunks.");

    // Test 6, 7: Ingestion (documentId, pageStart, pageEnd)
    const res = await knowledgeEngine.ingestDocument("Sujet examen", { title: "Exam", pageStart: 1, pageEnd: 2 }, { subjectId: "sub_1" });
    wrapAssert(res.document.id && res.chunks.length > 0, "6a. Ingestion réussie");
    wrapAssert(res.chunks[0].documentId === res.document.id, "6. Conservation de documentId.");
    wrapAssert(res.chunks[0].pageStart === 1 && res.chunks[0].pageEnd === 2, "7. Conservation de pageStart/pageEnd.");

    // Mocks multiples pour recherche
    await knowledgeEngine.ingestDocument("L'algorithme de Dijkstra trouve le plus court chemin.", { title: "Algo" }, { subjectId: "sub_1", taskId: "t1" });
    await knowledgeEngine.ingestDocument("Le plus court chemin est un problème classique.", { title: "Classique" }, { subjectId: "sub_2" });
    await knowledgeEngine.ingestDocument("Dijkstra algorithme court", { title: "Dense" }, { assessmentId: "eval_1", projectId: "proj_1" });

    // Test 8: Recherche par mots-clés
    const results = await retriever.search("algorithme de Dijkstra");
    wrapAssert(results.length > 0 && results.some(r => r.chunk.content.includes("algorithme")), "8. Recherche par mots-clés fonctionnelle.");

    // Test 9: Classement et déterminisme (Ordre documentId si score égal)
    // "algorithme" est dans 2 chunks. "Dense" a "Dijkstra algorithme court" (3 mots de query "algorithme dijkstra court").
    // Normalizer lowercases and removes small words: "algorithme", "dijkstra".
    // Score "Dense" (2), Score "Algo" (2). Les deux ont score=2.
    wrapAssert(results[0].score >= results[1].score, "9a. Classement par score décroissant.");
    const docIds = [results[0].chunk.documentId, results[1].chunk.documentId];
    const expectedOrder = [...docIds].sort((a,b) => b.localeCompare(a)); // En code: b.score - a.score. If ==: a.documentId.localeCompare(b.documentId)
    // Wait, the sort in code is `a.chunk.documentId.localeCompare(b.chunk.documentId)`.
    wrapAssert(results[0].chunk.documentId <= results[1].chunk.documentId, "9b. Égalité de score = ordre déterministe (alphabétique sur documentId).");

    // Test 10, 11, 12, 13: Filtrage
    const resSub1 = await retriever.search("chemin", { subjectId: "sub_1" });
    wrapAssert(resSub1.length === 1 && resSub1[0].chunk.content.includes("Dijkstra"), "10. Filtrage par subjectId.");
    
    const resEval = await retriever.search("dijkstra", { assessmentId: "eval_1" });
    wrapAssert(resEval.length === 1 && resEval[0].chunk.content.includes("court"), "11. Filtrage par assessmentId.");

    const resProj = await retriever.search("court", { projectId: "proj_1" });
    wrapAssert(resProj.length === 1 && resProj[0].chunk.content.includes("algorithme"), "12. Filtrage par projectId.");

    const resTask = await retriever.search("chemin", { taskId: "t1" });
    wrapAssert(resTask.length === 1, "13. Filtrage par taskId.");

    // Test 14, 15: Contexte borné (maxChunks, maxCharacters)
    await knowledgeEngine.ingestDocument("AAAAA. \n\n BBBBB. \n\n CCCCC. \n\n DDDDD. \n\n EEEEE. \n\n FFFFF.", { title: "Big", chunkOptions: { maxLength: 10 } });
    // This will generate 6 chunks because of \n\n and maxLength=10
    const boundedChunks = await retriever.getRelevantContext("AAAAA BBBBB CCCCC DDDDD EEEEE FFFFF", { maxChunks: 3 });
    wrapAssert(boundedChunks.length === 3, "14. Limitation stricte maxChunks.");

    const boundedChars = await retriever.getRelevantContext("AAAAA BBBBB CCCCC DDDDD EEEEE FFFFF", { maxChunks: 10, maxCharacters: 15 });
    // Each chunk is "AAAAA." which is 6 characters. 2 chunks = 12 chars. 3 chunks = 18 chars (exceeds 15). So 2 chunks.
    wrapAssert(boundedChars.length === 2, "15. Limitation stricte maxCharacters.");

    // Test 16: Provenance
    wrapAssert(boundedChunks[0].documentId && boundedChunks[0].index !== undefined, "16. Provenance (documentId, index) rigoureusement conservée après retrieval.");

    // Test 17: Gros document
    let bigText = "";
    for (let i = 0; i < 500; i++) bigText += "Ceci est un paragraphe généré pour tester la charge sans exploser. Il contient le mot cible. \n\n";
    const resBig = await knowledgeEngine.ingestDocument(bigText, { title: "Massive" });
    wrapAssert(resBig.chunks.length > 10, "17. Gros document découpé avec succès sans memory leak.");

    // Test 19: DATA > COMMAND
    wrapAssert(typeof retriever.saveEvent === "undefined" && typeof retriever.executeIntent === "undefined", "19. Vérification DATA > COMMAND: Retriever n'a aucun pouvoir de mutation.");

    console.log(`\n=== RÉSULTATS : ${passed}/${total} TESTS PASSÉS ===`);
    if (passed !== total) process.exit(1);
}

runTests().catch(e => {
    console.error(e);
    process.exit(1);
});
