import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { DocumentExtractor } from './src/engines/DocumentExtractor.js';
import { KnowledgeEngine } from './src/engines/KnowledgeEngine.js';
import { KnowledgeRetriever } from './src/engines/KnowledgeRetriever.js';
import { MemoryProvider } from './src/services/MemoryProvider.js';

const ROOT_DIR = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = path.join(ROOT_DIR, 'tests', 'fixtures');
const require = createRequire(import.meta.url);

let passed = 0;
let total = 0;

function assert(condition, message) {
    total++;
    if (!condition) {
        console.error(`❌ FAIL: ${message}`);
        process.exit(1);
    }
    passed++;
    console.log(`✅ PASS: ${message}`);
}

async function runTests() {
    console.log('=== TESTS V1-T1 : EXTRACTION & GESTION DES DOCUMENTS (SANS NODE_MODULES) ===\n');

    // Vérification préalable : exécution autonome sans node_modules
    assert(!fs.existsSync(path.join(ROOT_DIR, 'node_modules')), '0. Exécution autonome vérifiée (aucun dossier node_modules requis)');

    const storage = new MemoryProvider();
    const engine = new KnowledgeEngine(storage);
    const retriever = new KnowledgeRetriever(engine);

    // 1. Fichier .txt
    const txtContent = 'Théorème de Cayley : tout groupe fini est isomorphe à un sous-groupe du groupe symétrique.';
    const txtBytes = new TextEncoder().encode(txtContent);
    const resTxt = await engine.ingestDocument(
        { name: 'notes_groupes.txt', type: 'text/plain', size: txtBytes.byteLength, data: txtBytes },
        { title: 'Notes Groupes TXT' },
        { subjectId: 'mth1321' }
    );
    assert(resTxt.document.type === 'text_file' && resTxt.chunks.length === 1, '1. Ingestion d’un fichier .txt réussie');
    assert(resTxt.chunks[0].content.includes('Cayley'), '1b. Contenu .txt fidèlement extrait et découpé');

    // 2. Fichier .md
    const mdContent = '# Résumé POO\n\n## Interfaces\n\nUne interface définit un contrat explicite `Comparable` en Java.';
    const resMd = await engine.ingestDocument(
        {
            name: 'fiche_java.md',
            type: 'text/markdown',
            size: Buffer.byteLength(mdContent, 'utf8'),
            text: async () => mdContent
        },
        { title: 'Fiche Java MD' },
        { subjectId: 'inf1322' }
    );
    assert(resMd.document.type === 'text_file' && resMd.chunks.some(c => c.content.includes('Comparable')), '2. Ingestion d’un fichier .md réussie');

    // 3. Fichier PDF paginé (2 pages avec mot distinctif en page 2)
    const pdfBuf = fs.readFileSync(path.join(FIXTURES_DIR, 'cours_2pages.pdf'));
    const resPdf = await engine.ingestDocument(
        {
            name: 'cours_2pages.pdf',
            type: 'application/pdf',
            size: pdfBuf.byteLength,
            data: new Uint8Array(pdfBuf)
        },
        { title: 'Cours Algèbre 2 Pages' },
        { subjectId: 'mth1321' }
    );
    assert(resPdf.document.type === 'pdf' && resPdf.document.metadata.pageCount === 2, '3a. PDF de 2 pages reconnu avec pageCount === 2');
    const page1Chunk = resPdf.chunks.find(c => c.content.includes('Lagrange'));
    const page2Chunk = resPdf.chunks.find(c => c.content.includes('MORPHISME_NOYAU_P2'));
    assert(Boolean(page1Chunk) && page1Chunk.pageStart === 1 && page1Chunk.pageEnd === 1, '3b. Extrait de la page 1 indexé avec pageStart=1, pageEnd=1');
    assert(Boolean(page2Chunk) && page2Chunk.pageStart === 2 && page2Chunk.pageEnd === 2, '3c. Mot distinctif de la page 2 extrait avec pageStart=2, pageEnd=2');

    const searchPdf = await retriever.search('MORPHISME_NOYAU_P2', { subjectId: 'mth1321' });
    assert(searchPdf.length > 0 && searchPdf[0].chunk.pageStart === 2, '3d. KnowledgeRetriever retrouve le mot distinctif et sa page exacte (p. 2)');

    // 4. Fichier .docx
    const docxBuf = fs.readFileSync(path.join(FIXTURES_DIR, 'cours_poo.docx'));
    const resDocx = await engine.ingestDocument(
        {
            name: 'cours_poo.docx',
            type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            size: docxBuf.byteLength,
            data: docxBuf
        },
        { title: 'Cours POO DOCX' },
        { subjectId: 'inf1322' }
    );
    assert(resDocx.document.type === 'docx' && resDocx.chunks.some(c => c.content.includes('POLYMORPHISME_HERITAGE_DOCX')), '4. Extraction et indexation d’un fichier .docx via mammoth local réussies');

    // 5. Détection de doublon + remplacement explicite
    const chunksCountBeforeDup = (await engine.getChunks()).length;
    let dupError = null;
    try {
        await engine.ingestDocument(
            {
                name: 'copie_renommee.pdf',
                type: 'application/pdf',
                size: pdfBuf.byteLength,
                data: new Uint8Array(pdfBuf)
            },
            { title: 'Copie renommée du même PDF' },
            { subjectId: 'mth1321' }
        );
    } catch (err) {
        dupError = err;
    }
    assert(Boolean(dupError) && dupError.isDuplicate === true && dupError.existingDocument.id === resPdf.document.id, '5a. Doublon détecté par empreinte SHA-256 (err.isDuplicate === true)');
    assert((await engine.getChunks()).length === chunksCountBeforeDup, '5b. Aucun chunk parasite créé lors du rejet de doublon');

    const replacedPdf = await engine.ingestDocument(
        {
            name: 'cours_2pages.pdf',
            type: 'application/pdf',
            size: pdfBuf.byteLength,
            data: new Uint8Array(pdfBuf)
        },
        { title: 'Cours Algèbre 2 Pages (Remplacé)' },
        { subjectId: 'mth1321' },
        { replace: true }
    );
    assert(replacedPdf.document.id === resPdf.document.id && (await engine.getChunks()).length === chunksCountBeforeDup, '5c. Remplacement explicite (replace: true) conserve l’ID sans dupliquer les chunks');

    // 6. Changement de matière (updateDocumentSubject)
    const updatedDoc = await engine.updateDocumentSubject(resTxt.document.id, 'inf1322');
    assert(updatedDoc && updatedDoc.linkedTo.subjectId === 'inf1322', '6a. Changement de matière enregistré sur le document');
    const infChunks = await engine.getChunksForSubject('inf1322');
    assert(infChunks.some(c => c.documentId === resTxt.document.id), '6b. Les extraits suivent immédiatement la nouvelle matière associée');

    // 7. Suppression complète (document + tous ses chunks, zéro orphelin)
    const deletedOk = await engine.deleteDocument(resPdf.document.id);
    const remainingDocs = await engine.getDocuments();
    const remainingChunks = await engine.getChunks();
    assert(deletedOk === true && !remainingDocs.some(d => d.id === resPdf.document.id), '7a. Document supprimé de la liste des documents');
    assert(!remainingChunks.some(c => c.documentId === resPdf.document.id), '7b. Tous les chunks du document supprimé ont été purgés (0 orphelin)');
    assert(remainingChunks.some(c => c.documentId === resDocx.document.id), '7c. Les chunks des autres documents sont intacts');

    // 8. Fichier trop gros (> 15 Mo)
    let oversizeErr = null;
    try {
        await engine.ingestDocument({
            name: 'enorme_cours.pdf',
            type: 'application/pdf',
            size: 16 * 1024 * 1024,
            data: new Uint8Array(16)
        });
    } catch (err) {
        oversizeErr = err;
    }
    assert(Boolean(oversizeErr) && /15\s*Mo/i.test(oversizeErr.message), '8. Fichier > 15 Mo rejeté avec un message explicite');

    // 9. Format inconnu
    let unknownFormatErr = null;
    try {
        await engine.ingestDocument({
            name: 'programme.exe',
            type: 'application/octet-stream',
            size: 512,
            data: new Uint8Array([0x4d, 0x5a, 0x90, 0x00])
        });
    } catch (err) {
        unknownFormatErr = err;
    }
    assert(Boolean(unknownFormatErr) && /Format de fichier non pris en charge/i.test(unknownFormatErr.message), '9. Format inconnu rejeté avec liste des formats supportés');

    // 10. PDF sans couche texte (scanné) : erreur claire sans clé Gemini, fallback OCR si fournisseur présent
    const scanBuf = fs.readFileSync(path.join(FIXTURES_DIR, 'scan_sans_texte.pdf'));
    let scanNoKeyErr = null;
    try {
        await engine.ingestDocument({
            name: 'scan_sans_texte.pdf',
            type: 'application/pdf',
            size: scanBuf.byteLength,
            data: new Uint8Array(scanBuf)
        });
    } catch (err) {
        scanNoKeyErr = err;
    }
    assert(
        Boolean(scanNoKeyErr) && scanNoKeyErr.message.includes('Ce PDF est une image'),
        '10a. PDF sans couche texte rejeté clairement lorsqu’aucune clé Gemini n’est configurée'
    );

    const mockOcrProvider = {
        hasKey: () => true,
        generateFromFile: async ({ mimeType, data }) => {
            assert(mimeType === 'application/pdf' && data.length > 20, '10b. Fallback multimodal reçoit le PDF encodé en base64');
            return JSON.stringify({ text: 'Transcription OCR simulée du polycopié scanné.' });
        }
    };
    const resScanOcr = await engine.ingestDocument(
        {
            name: 'scan_sans_texte.pdf',
            type: 'application/pdf',
            size: scanBuf.byteLength,
            data: new Uint8Array(scanBuf)
        },
        { title: 'Scan transcrit', llmProvider: mockOcrProvider },
        { subjectId: 'mth1321' }
    );
    assert(resScanOcr.chunks.some(c => c.content.includes('Transcription OCR simulée')), '10c. Fallback multimodal indexe le texte transcrit quand une clé est présente');

    // 11. Vérification des fixtures emploi du temps (.csv et .xlsx) pour le chantier V1
    const csvText = fs.readFileSync(path.join(FIXTURES_DIR, 'emploi_du_temps.csv'), 'utf8');
    assert(csvText.includes('MTH1321') && csvText.includes('Groupe 2'), '11a. Fixture emploi_du_temps.csv présente et lisible');

    const XLSX = require('./vendor/sheetjs/xlsx.mini.min.js');
    const xlsxBuf = fs.readFileSync(path.join(FIXTURES_DIR, 'emploi_du_temps.xlsx'));
    const wb = XLSX.read(xlsxBuf, { type: 'buffer' });
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 });
    assert(rows.length === 4 && rows[1][4] === 'MTH1321', '11b. Fixture emploi_du_temps.xlsx présente et relue via SheetJS local sans node_modules');

    console.log(`\n=== RÉSULTATS V1-T1 : ${passed}/${total} ASSERTIONS PASSÉES ===`);
}

runTests().catch((err) => {
    console.error('❌ ERREUR NON GÉRÉE DANS test_v1_t1_documents.mjs :', err);
    process.exit(1);
});
