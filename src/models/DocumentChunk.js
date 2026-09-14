export class DocumentChunk {
    constructor({
        id = crypto.randomUUID(),
        documentId,
        index,
        content,
        pageStart = null,
        pageEnd = null,
        sectionTitle = null,
        metadata = {}
    }) {
        if (!documentId) throw new Error("DocumentChunk must have a documentId");
        if (index === undefined || index === null) throw new Error("DocumentChunk must have an index");
        if (!content) throw new Error("DocumentChunk must have content");

        this.id = id;
        this.documentId = documentId;
        this.index = index;
        this.content = content;
        this.pageStart = pageStart;
        this.pageEnd = pageEnd;
        this.sectionTitle = sectionTitle;
        this.metadata = metadata;
    }
}
