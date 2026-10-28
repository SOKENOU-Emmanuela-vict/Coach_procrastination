import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { MemoryProvider } from './src/services/MemoryProvider.js';
import { KnowledgeEngine } from './src/engines/KnowledgeEngine.js';
import { KnowledgeRetriever } from './src/engines/KnowledgeRetriever.js';
import { App } from './src/core/App.js';
import { AcademicView } from './src/ui/AcademicView.js';
import { DocumentsModal } from './src/ui/DocumentsModal.js';
import { DocumentExtractor } from './src/engines/DocumentExtractor.js';

const ROOT_DIR = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = path.join(ROOT_DIR, 'tests', 'fixtures');

console.log("=== TESTS Y1-A : ÉCRAN DOCUMENTS DANS ÉCOLE ===");

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

// Mock DOM minimaliste pour Node.js
class FakeElement {
    constructor(tagName = 'div') {
        this.tagName = tagName;
        this.id = '';
        this.className = '';
        this.classList = {
            add: (c) => { if (!this.className.includes(c)) this.className += ` ${c}`; },
            remove: (c) => { this.className = this.className.replace(new RegExp(`\\b${c}\\b`, 'g'), '').trim(); },
            contains: (c) => this.className.includes(c)
        };
        this.attributes = {};
        this._innerHTML = '';
        this.children = [];
        this.listeners = {};
        this.style = {};
        this.value = '';
        this.hidden = false;
    }
    setAttribute(k, v) { this.attributes[k] = String(v); }
    getAttribute(k) { return this.attributes[k] || (k === 'id' ? this.id : null); }
    addEventListener(type, cb) {
        if (!this.listeners[type]) this.listeners[type] = [];
        this.listeners[type].push(cb);
    }
    dispatchEvent(event) {
        const list = this.listeners[event.type] || [];
        for (const cb of list) cb(event);
    }
    click() { this.dispatchEvent({ type: 'click', target: this, stopPropagation: () => {} }); }
    get innerHTML() {
        if (this.children.length > 0) {
            return this._innerHTML + this.children.map(c => c.innerHTML).join('');
        }
        return this._innerHTML;
    }
    set innerHTML(val) {
        this._innerHTML = val;
    }
    appendChild(child) {
        this.children.push(child);
    }
    scrollIntoView() {}
    querySelector(sel) {
        if (sel.startsWith('#')) {
            const targetId = sel.slice(1);
            if (this.id === targetId) return this;
            for (const c of this.children) {
                const found = c.querySelector(sel);
                if (found) return found;
            }
            if (this._innerHTML.includes(`id="${targetId}"`)) {
                let el = this.children.find(c => c.id === targetId);
                if (!el) {
                    el = new FakeElement();
                    el.id = targetId;
                    this.children.push(el);
                }
                return el;
            }
        }
        return null;
    }
    querySelectorAll(sel) {
        return [];
    }
}

const mockBody = new FakeElement('body');
const mockDoc = {
    body: mockBody,
    createElement: (tag) => new FakeElement(tag),
    getElementById: (id) => {
        if (id === 'app-root' || id === 'view-container') return new FakeElement('div');
        return mockBody.querySelector('#' + id);
    }
};

const realDoc = global.document;
const realWin = global.window;

try {
    global.document = mockDoc;
    global.window = {
        localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
        confirm: () => true,
        prompt: () => '1'
    };

    const storage = new MemoryProvider();
    const app = new App(storage, null, null, null, null, null, null, null);
    app.state.academicSubjects = [
        { id: 'sub_algo', name: 'Algorithmique', code: 'INF101', cect: 6, semesterId: 'sem_s3_26' },
        { id: 'sub_math', name: 'Algèbre Linéaire', code: 'MTH102', cect: 6, semesterId: 'sem_s3_26' }
    ];

    // 1. AcademicView contient le bouton global et le bouton par matière
    const container = new FakeElement('div');
    container.id = 'app-root';
    const acadView = new AcademicView(container, app);
    acadView.render(app.state);

    test('1. Bouton global #btn-open-documents présent dans le bandeau de l’École', () => {
        assert(container.innerHTML.includes('id="btn-open-documents"'), 'Le bouton #btn-open-documents est présent dans le HTML');
        assert(container.innerHTML.includes('Documents'), 'Le libellé Documents est affiché');
    });

    test('2. Bouton Documents présent sur chaque carte de matière', () => {
        assert(container.innerHTML.includes('data-action="documents"'), 'data-action="documents" est présent sur les cartes');
        assert(container.innerHTML.includes('title="Documents de cette matière"'), 'Le titre explicatif est présent');
    });

    // 2. Modale des documents & Confidentialité
    const modalManager = new DocumentsModal(app);
    const modalEl = modalManager.ensureModal();

    test('3. Modale des documents créée avec classes CSS génériques et zéro style inline', () => {
        assert(modalEl.className.includes('modal-backdrop'), 'modal-backdrop présent');
        assert(modalEl.className.includes('hidden'), 'Masquée par défaut');
        assert(!modalEl.innerHTML.includes('style="'), 'Zéro attribut style inline dans le squelette de la modale');
    });

    await testAsync('4. Phrase de confidentialité explicite présente dans la modale (Règle 5)', async () => {
        await modalManager.open();
        const html = modalEl.innerHTML;
        assert(html.includes('Tes documents restent sur cet appareil ; seuls quelques extraits sont envoyés à Gemini quand une clé est configurée.'),
            'Phrase de confidentialité exacte de la règle 5 présente');
    });

    // 3. Ingestion de documents réels
    await testAsync('5. Ingestion d’un document texte collé', async () => {
        await app.knowledgeEngine.ingestDocument(
            'Théorème de Pythagore dans un triangle rectangle : a² + b² = c².',
            { title: 'Formulaire Géométrie' },
            { subjectId: 'sub_math' }
        );
        const docs = await app.knowledgeEngine.getDocuments();
        const doc = docs.find(d => d.title === 'Formulaire Géométrie');
        assert(Boolean(doc), 'Document texte collé retrouvé dans la base');
        assert(doc.linkedTo.subjectId === 'sub_math', 'Matière associée sub_math correcte');
    });

    await testAsync('6. Ingestion d’un fichier .docx réel depuis tests/fixtures', async () => {
        const docxBuf = fs.readFileSync(path.join(FIXTURES_DIR, 'cours_poo.docx'));
        const resDocx = await app.knowledgeEngine.ingestDocument(
            {
                name: 'cours_poo.docx',
                type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                size: docxBuf.byteLength,
                data: docxBuf
            },
            { title: 'Cours POO' },
            { subjectId: 'sub_algo' }
        );
        assert(resDocx.document.type === 'docx', 'Format docx reconnu');
        assert(resDocx.chunks.length > 0, 'Extraits découpés pour le fichier Word');
    });

    await testAsync('7. Ingestion d’un PDF paginé réel (2 pages) depuis tests/fixtures', async () => {
        const pdfBuf = fs.readFileSync(path.join(FIXTURES_DIR, 'cours_2pages.pdf'));
        const resPdf = await app.knowledgeEngine.ingestDocument(
            {
                name: 'cours_2pages.pdf',
                type: 'application/pdf',
                size: pdfBuf.byteLength,
                data: new Uint8Array(pdfBuf)
            },
            { title: 'Algèbre 2 Pages' },
            { subjectId: 'sub_math' }
        );
        assert(resPdf.document.type === 'pdf', 'Format pdf reconnu');
        assert(resPdf.document.metadata.pageCount === 2, 'PageCount égal à 2');
    });

    await testAsync('8. Consultation de la liste des documents avec nombre d’extraits et taille', async () => {
        await modalManager.renderContent();
        const bodyHtml = modalEl.innerHTML;
        assert(bodyHtml.includes('Formulaire Géométrie'), 'Titre formulaire géométrie visible');
        assert(bodyHtml.includes('Cours POO'), 'Titre Cours POO visible');
        assert(bodyHtml.includes('Algèbre 2 Pages'), 'Titre Algèbre 2 Pages visible');
        assert(bodyHtml.includes('extraits'), 'Nombre d’extraits mentionné');
    });

    await testAsync('9. Changement de matière d’un document', async () => {
        const docs = await app.knowledgeEngine.getDocuments();
        const docPyth = docs.find(d => d.title === 'Formulaire Géométrie');
        await app.knowledgeEngine.updateDocumentSubject(docPyth.id, 'sub_algo');
        const updated = await app.knowledgeEngine.getDocumentById(docPyth.id);
        assert(updated.linkedTo.subjectId === 'sub_algo', 'Matière mise à jour vers sub_algo');
    });

    await testAsync('10. Suppression propre d’un document sans extraits orphelins', async () => {
        const docs = await app.knowledgeEngine.getDocuments();
        const docDel = docs.find(d => d.title === 'Formulaire Géométrie');
        const chunksBefore = await app.knowledgeEngine.getChunks();
        const docDelChunksCount = chunksBefore.filter(c => c.documentId === docDel.id).length;
        assert(docDelChunksCount > 0, 'Le document avait bien des extraits indexés');

        await app.knowledgeEngine.deleteDocument(docDel.id);
        const docsAfter = await app.knowledgeEngine.getDocuments();
        const chunksAfter = await app.knowledgeEngine.getChunks();

        assert(!docsAfter.some(d => d.id === docDel.id), 'Document supprimé de la liste');
        assert(!chunksAfter.some(c => c.documentId === docDel.id), 'Zéro extrait orphelin restant');
        assert.strictEqual(chunksAfter.length, chunksBefore.length - docDelChunksCount, 'Le nombre de chunks restants est exactement réduit du compte du document supprimé');
    });

    // 4. Erreurs Règle 6
    await testAsync('11. Règle 6 : Fichier vide rejeté avec message clair', async () => {
        let err = null;
        try {
            await DocumentExtractor.extractText('');
        } catch (e) { err = e; }
        assert(Boolean(err) && err.message === 'Le fichier est vide.', 'Fichier vide rejeté');
    });

    await testAsync('12. Règle 6 : Fichier > 15 Mo rejeté avec message clair', async () => {
        let err = null;
        try {
            await DocumentExtractor.extractText({ name: 'gros.pdf', size: 16 * 1024 * 1024, type: 'application/pdf' });
        } catch (e) { err = e; }
        assert(Boolean(err) && err.message.includes('15 Mo'), 'Limite 15 Mo vérifiée');
    });

    await testAsync('13. Règle 6 : Ancien Word .doc rejeté avec recommandation .docx', async () => {
        let err = null;
        try {
            await DocumentExtractor.extractText({ name: 'vieux_cours.doc', size: 1024 });
        } catch (e) { err = e; }
        assert(Boolean(err) && err.message.includes('.docx depuis Word'), 'Message spécifique pour .doc présent');
    });

    await testAsync('14. Règle 6 : PDF scanné sans texte sans clé Gemini rejeté avec message explicite', async () => {
        const scanBuf = fs.readFileSync(path.join(FIXTURES_DIR, 'scan_sans_texte.pdf'));
        let err = null;
        try {
            await DocumentExtractor.extractText({
                name: 'scan_sans_texte.pdf',
                type: 'application/pdf',
                size: scanBuf.byteLength,
                data: new Uint8Array(scanBuf)
            });
        } catch (e) { err = e; }
        assert(Boolean(err) && err.message === 'Ce PDF est une image : ajoute une clé Gemini pour le lire, ou colle le texte.', 'Message exact PDF scanné vérifié');
    });

    await testAsync('15. Règle 6 : Format non pris en charge rejeté avec liste des formats', async () => {
        let err = null;
        try {
            await DocumentExtractor.extractText({ name: 'script.py', size: 100 });
        } catch (e) { err = e; }
        assert(Boolean(err) && err.message.includes('Formats acceptés : PDF, Word (.docx), texte (.txt, .md)'), 'Liste des formats acceptés fournie');
    });

    // 5. Doublon et remplacement
    await testAsync('16. Détection de doublon et remplacement réussi', async () => {
        const pdfBuf = fs.readFileSync(path.join(FIXTURES_DIR, 'cours_2pages.pdf'));
        let dupErr = null;
        try {
            await app.knowledgeEngine.ingestDocument(
                {
                    name: 'cours_2pages.pdf',
                    type: 'application/pdf',
                    size: pdfBuf.byteLength,
                    data: new Uint8Array(pdfBuf)
                },
                { title: 'Algèbre 2 Pages' }
            );
        } catch (e) { dupErr = e; }
        assert(Boolean(dupErr) && dupErr.isDuplicate === true, 'Doublon détecté');

        const replaced = await app.knowledgeEngine.ingestDocument(
            {
                name: 'cours_2pages.pdf',
                type: 'application/pdf',
                size: pdfBuf.byteLength,
                data: new Uint8Array(pdfBuf)
            },
            { title: 'Algèbre 2 Pages (MAJ)' },
            {},
            { replace: true }
        );
        assert(Boolean(replaced) && replaced.document.title === 'Algèbre 2 Pages (MAJ)', 'Remplacement du document effectué sans erreur');
    });

} finally {
    global.document = realDoc;
    global.window = realWin;
}

console.log(`\n=== BILAN Y1-A : ${passed}/${total} TESTS PASSÉS ===`);
if (passed === total) {
    console.log("🎉 TOUS LES TESTS DE L'ÉCRAN DOCUMENTS (Y1-A) SONT VALIDES !");
} else {
    process.exit(1);
}
