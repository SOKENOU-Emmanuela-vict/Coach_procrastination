/**
 * test_correctif_y1_grammar.mjs
 * Test dédié pour le Correctif Y1 - Point 3 :
 * - Grammaire rigoureuse : « 1 extrait » vs « N extraits »
 * - « 1 document importé » vs « N documents importés »
 * - Message de succès : « 1 extrait indexé » vs « N extraits indexés »
 */

import { CoachLocalReply } from './src/ai/CoachLocalReply.js';
import { DocumentsModal } from './src/ui/DocumentsModal.js';

let passed = 0;
let total = 0;

function assert(condition, message) {
    total++;
    if (!condition) {
        console.error(`❌ FAIL: ${message}`);
        throw new Error(message);
    }
    passed++;
    console.log(`✅ PASS: ${message}`);
}

console.log("=== TESTS CORRECTIF Y1 - POINT 3 : ACCORDS GRAMMATICAUX EXTRAITS ET DOCUMENTS ===");

// 1. Test CoachLocalReply avec 1 seul document et 1 seul extrait
const mockRetriever1 = {
    knowledgeEngine: {
        getDocuments: async () => [
            { id: 'doc1', title: 'Fascicule Unique', metadata: { pageCount: 1, chunkCount: 1 } }
        ],
        getChunks: async () => [
            { id: 'c1', documentId: 'doc1', content: 'Contenu du fascicule.', pageStart: 1, pageEnd: 1 }
        ]
    }
};

const res1 = await CoachLocalReply.resolve({}, "Quels documents j'ai ?", { code: 'NO_LLM' }, mockRetriever1);
assert(res1.message.includes('Tu as 1 document importé :'), "1a. Singulier document : 'Tu as 1 document importé :'");
assert(res1.message.includes('1 extrait'), "1b. Singulier extrait : '1 extrait'");
assert(!res1.message.includes('1 extraits'), "1c. Pas de '1 extraits'");
assert(!res1.message.includes('1 document(s)'), "1d. Pas de parenthèse '1 document(s)'");

// 2. Test CoachLocalReply avec 2 documents et plusieurs extraits
const mockRetriever2 = {
    knowledgeEngine: {
        getDocuments: async () => [
            { id: 'doc1', title: 'Fascicule 1', metadata: { pageCount: 2, chunkCount: 3 } },
            { id: 'doc2', title: 'Fascicule 2', metadata: { pageCount: 5, chunkCount: 10 } }
        ],
        getChunks: async () => []
    }
};

const res2 = await CoachLocalReply.resolve({}, "Quels documents j'ai ?", { code: 'NO_LLM' }, mockRetriever2);
assert(res2.message.includes('Tu as 2 documents importés :'), "2a. Pluriel documents : 'Tu as 2 documents importés :'");
assert(res2.message.includes('3 extraits'), "2b. Pluriel extrait doc 1 : '3 extraits'");
assert(res2.message.includes('10 extraits'), "2c. Pluriel extrait doc 2 : '10 extraits'");
assert(!res2.message.includes('extraits(s)'), "2d. Pas de 'extraits(s)'");

// 3. Test CoachLocalReply lors d'une recherche introuvable avec 1 document
const resNotFound1 = await CoachLocalReply.resolve({}, "Résume le document Inexistant", { code: 'NO_LLM' }, mockRetriever1);
assert(resNotFound1.message.includes('Tu as 1 document importé :'), "3a. Singulier document lors d'une recherche introuvable");

// 4. Test CoachLocalReply lors d'une recherche de sujet introuvable avec 1 document
const resNoTopic1 = await CoachLocalReply.resolve({}, "Cherche mécanique quantique", { code: 'NO_LLM' }, mockRetriever1);
assert(resNoTopic1.message.includes('Tu as 1 document importé.'), "4a. Singulier document lors d'un sujet introuvable");

// 5. Test DocumentsModal : Rendu HTML d'un tableau contenant 1 extrait vs N extraits
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
    querySelectorAll() {
        return [];
    }
}

const mockBody = new FakeElement('body');
const mockDoc = {
    body: mockBody,
    createElement: (tag) => new FakeElement(tag),
    getElementById: (id) => mockBody.querySelector('#' + id)
};

global.document = mockDoc;
global.window = { prompt: () => null, confirm: () => true };

const modalManager = new DocumentsModal({
    state: { academicSubjects: [] },
    knowledgeEngine: {
        getDocuments: async () => [
            { id: 'd1', title: 'Doc Solo', metadata: { pageCount: 1, chunkCount: 1, size: 1024 } },
            { id: 'd2', title: 'Doc Multi', metadata: { pageCount: 4, chunkCount: 4, size: 4096 } }
        ]
    }
});

const modalEl = modalManager.ensureModal();
await modalManager.open();

const modalHtml = modalEl.innerHTML;
assert(modalHtml.includes('1 extrait'), "5a. DocumentsModal affiche '1 extrait' pour le document à 1 extrait");
assert(modalHtml.includes('4 extraits'), "5b. DocumentsModal affiche '4 extraits' pour le document à 4 extraits");
assert(!modalHtml.includes('1 extraits'), "5c. Aucun '1 extraits' dans le tableau");

console.log(`\n🎉 BILAN POINT 3 : ${passed}/${total} TESTS PASSÉS !`);
