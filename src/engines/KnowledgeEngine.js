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

    async ingestDocument(source, metadata = {}, linkedTo = {}) {
        // 1. Extraction
        const rawText = await DocumentExtractor.extractText(source);
        
        // 2. Normalisation
        const normalizedText = TextNormalizer.normalize(rawText);
        
        // 3. Document
        const doc = new Document({
            title: metadata.title || "Document Inconnu",
            type: metadata.type || "other",
            sourceUrl: typeof source === 'string' ? null : source.url,
            status: "indexed",
            linkedTo: linkedTo,
            metadata: metadata
        });
        
        await this.saveDocument(doc);
        
        // 4. Chunking
        const chunkOptions = metadata.chunkOptions || { maxLength: 1000 };
        const rawChunks = DocumentChunker.chunk(normalizedText, chunkOptions);
        
        const savedChunks = [];
        for (const rc of rawChunks) {
            const chunk = new DocumentChunk({
                documentId: doc.id,
                index: rc.index,
                content: rc.content,
                // Page info not supported for raw string ingestion yet, but structure allows it
                pageStart: metadata.pageStart || null,
                pageEnd: metadata.pageEnd || null,
                sectionTitle: metadata.sectionTitle || null
            });
            await this.saveChunk(chunk);
            savedChunks.push(chunk);
        }
        
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
