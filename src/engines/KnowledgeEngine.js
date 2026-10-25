import { Document } from '../models/Document.js';
import { DocumentChunk } from '../models/DocumentChunk.js';
import { DocumentExtractor } from './DocumentExtractor.js';
import { TextNormalizer } from './TextNormalizer.js';
import { DocumentChunker } from './DocumentChunker.js';

export class KnowledgeEngine {
    constructor(storage) {
        this.storage = storage;
        this.DOCUMENTS_KEY = 'knowledge_documents';
        this.CHUNKS_KEY = 'knowledge_chunks';
    }

    // --- Documents API ---

    async getDocuments() {
        const data = await this.storage.loadData(this.DOCUMENTS_KEY);
        return Array.isArray(data) ? data.map(d => new Document(d)) : [];
    }

    async getDocumentById(id) {
        const docs = await this.getDocuments();
        return docs.find(d => d.id === id) || null;
    }

    async saveDocument(docData) {
        const docs = await this.getDocuments();
        const doc = docData instanceof Document ? docData : new Document(docData);
        
        const index = docs.findIndex(d => d.id === doc.id);
        if (index >= 0) {
            docs[index] = doc;
        } else {
            docs.push(doc);
        }
        
        await this.storage.saveData(this.DOCUMENTS_KEY, docs);
        return doc;
    }

    /**
     * Recherche d'un doublon par empreinte, nom + taille
     */
    async findDuplicate({ title, size, fingerprint }) {
        const docs = await this.getDocuments();
        for (const doc of docs) {
            if (fingerprint && doc.metadata && doc.metadata.fingerprint === fingerprint) {
                return doc;
            }
            if (title && size && doc.title === title && doc.metadata && doc.metadata.size === size) {
                return doc;
            }
            if (title && doc.title === title && !size && (!doc.metadata || !doc.metadata.size)) {
                return doc;
            }
        }
        return null;
    }

    /**
     * Supprime un document et TOUS ses chunks associés (aucun orphelin)
     */
    async deleteDocument(documentId) {
        if (!documentId) return false;

        const docs = await this.getDocuments();
        const updatedDocs = docs.filter(d => d.id !== documentId);
        await this.storage.saveData(this.DOCUMENTS_KEY, updatedDocs);

        const chunks = await this.getChunks();
        const updatedChunks = chunks.filter(c => c.documentId !== documentId);
        await this.storage.saveData(this.CHUNKS_KEY, updatedChunks);

        return true;
    }

    /**
     * Modifie la matière associée à un document
     */
    async updateDocumentSubject(documentId, newSubjectId) {
        const doc = await this.getDocumentById(documentId);
        if (!doc) return null;
        doc.linkedTo = { ...(doc.linkedTo || {}), subjectId: newSubjectId || null };
        await this.saveDocument(doc);
        return doc;
    }

    async ingestDocument(source, metadata = {}, linkedTo = {}, options = {}) {
        const replace = options.replace || metadata.replace || false;
        const subjectId = linkedTo.subjectId || metadata.subjectId || null;
        const title = metadata.title || (source && source.name) || "Document Inconnu";
        const size = metadata.size || (source && source.size) || null;

        // 1. Extraction détaillée
        const extraction = await DocumentExtractor.extractText(source, {
            detailed: true,
            llmProvider: metadata.llmProvider || this.llmProvider
        });

        const rawText = typeof extraction === 'string' ? extraction : extraction.text;
        const pages = (extraction && Array.isArray(extraction.pages)) ? extraction.pages : null;
        const fingerprint = metadata.fingerprint || (extraction && extraction.fingerprint) || null;

        // 2. Vérification anti-doublon
        const duplicate = await this.findDuplicate({ title, size, fingerprint });
        if (duplicate) {
            if (!replace) {
                const err = new Error(`Ce document a déjà été importé ("${duplicate.title}").`);
                err.isDuplicate = true;
                err.existingDocument = duplicate;
                throw err;
            }
            await this.deleteDocument(duplicate.id);
        }

        // 3. Document
        const doc = new Document({
            id: (replace && duplicate) ? duplicate.id : undefined,
            title: title,
            type: metadata.type || (source && source.name ? DocumentExtractor.detectFormat(source) : "other") || "other",
            sourceUrl: typeof source === 'string' ? null : (source.url || null),
            status: "indexed",
            linkedTo: {
                ...linkedTo,
                subjectId: subjectId
            },
            metadata: {
                ...metadata,
                size: size,
                fingerprint: fingerprint,
                pageCount: extraction && extraction.pageCount ? extraction.pageCount : (pages ? pages.length : 1),
                chunkCount: 0
            }
        });

        // 4. Chunking (page par page si paginé, sinon bloc entier)
        const chunkOptions = metadata.chunkOptions || { maxLength: 1000 };
        const savedChunks = [];
        let chunkIndex = 0;

        const hasExplicitPages = metadata.pageStart != null || metadata.pageEnd != null;

        if (pages && pages.length > 0 && !(pages.length === 1 && hasExplicitPages)) {
            for (const page of pages) {
                const normalizedPageText = TextNormalizer.normalize(page.text);
                if (!normalizedPageText.trim()) continue;
                const pageChunks = DocumentChunker.chunk(normalizedPageText, chunkOptions);
                for (const rc of pageChunks) {
                    const chunk = new DocumentChunk({
                        documentId: doc.id,
                        index: chunkIndex++,
                        content: rc.content,
                        pageStart: page.pageNumber,
                        pageEnd: page.pageNumber,
                        sectionTitle: metadata.sectionTitle || null,
                        metadata: { page: page.pageNumber }
                    });
                    await this.saveChunk(chunk);
                    savedChunks.push(chunk);
                }
            }
        } else {
            const normalizedText = TextNormalizer.normalize(rawText);
            const rawChunks = DocumentChunker.chunk(normalizedText, chunkOptions);
            const defaultPage = (pages && pages[0] && pages[0].pageNumber) ? pages[0].pageNumber : 1;
            const pStart = metadata.pageStart != null ? metadata.pageStart : defaultPage;
            const pEnd = metadata.pageEnd != null ? metadata.pageEnd : defaultPage;
            for (const rc of rawChunks) {
                const chunk = new DocumentChunk({
                    documentId: doc.id,
                    index: chunkIndex++,
                    content: rc.content,
                    pageStart: pStart,
                    pageEnd: pEnd,
                    sectionTitle: metadata.sectionTitle || null
                });
                await this.saveChunk(chunk);
                savedChunks.push(chunk);
            }
        }

        doc.metadata.chunkCount = savedChunks.length;
        await this.saveDocument(doc);

        return { document: doc, chunks: savedChunks };
    }

    async getDocumentsBySubject(subjectId) {
        const docs = await this.getDocuments();
        return docs.filter(d => d.linkedTo && d.linkedTo.subjectId === subjectId);
    }

    // --- Chunks API ---

    async getChunks() {
        const data = await this.storage.loadData(this.CHUNKS_KEY);
        return Array.isArray(data) ? data.map(c => new DocumentChunk(c)) : [];
    }

    async getChunksByDocument(documentId) {
        const chunks = await this.getChunks();
        return chunks.filter(c => c.documentId === documentId).sort((a, b) => a.index - b.index);
    }

    async saveChunk(chunkData) {
        const chunks = await this.getChunks();
        const chunk = chunkData instanceof DocumentChunk ? chunkData : new DocumentChunk(chunkData);
        
        const index = chunks.findIndex(c => c.id === chunk.id);
        if (index >= 0) {
            chunks[index] = chunk;
        } else {
            chunks.push(chunk);
        }
        
        await this.storage.saveData(this.CHUNKS_KEY, chunks);
        return chunk;
    }

    // --- Aggregation API ---

    async getChunksForAssessment(assessmentId) {
        const docs = await this.getDocuments();
        const relevantDocs = docs.filter(d => d.linkedTo && d.linkedTo.assessmentId === assessmentId);
        
        const chunks = await this.getChunks();
        const docIds = relevantDocs.map(d => d.id);
        
        return chunks.filter(c => docIds.includes(c.documentId)).sort((a, b) => a.index - b.index);
    }

    async getChunksForSubject(subjectId) {
        const docs = await this.getDocuments();
        const relevantDocs = docs.filter(d => d.linkedTo && d.linkedTo.subjectId === subjectId);
        
        const chunks = await this.getChunks();
        const docIds = relevantDocs.map(d => d.id);
        
        return chunks.filter(c => docIds.includes(c.documentId)).sort((a, b) => a.index - b.index);
    }

    async getChunksForProject(projectId) {
        const docs = await this.getDocuments();
        const relevantDocs = docs.filter(d => d.linkedTo && d.linkedTo.projectId === projectId);
        
        const chunks = await this.getChunks();
        const docIds = relevantDocs.map(d => d.id);
        
        return chunks.filter(c => docIds.includes(c.documentId)).sort((a, b) => a.index - b.index);
    }

    async getChunksForTask(taskId) {
        const docs = await this.getDocuments();
        const relevantDocs = docs.filter(d => d.linkedTo && d.linkedTo.taskId === taskId);
        
        const chunks = await this.getChunks();
        const docIds = relevantDocs.map(d => d.id);
        
        return chunks.filter(c => docIds.includes(c.documentId)).sort((a, b) => a.index - b.index);
    }
}
