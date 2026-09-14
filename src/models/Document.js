export class Document {
    constructor({
        id = crypto.randomUUID(),
        title,
        type = "other",
        sourceUrl = null,
        status = "pending",
        addedAt = new Date().toISOString(),
        linkedTo = {},
        metadata = {}
    }) {
        this.id = id;
        this.title = title;
        this.type = type;
        this.sourceUrl = sourceUrl;
        this.status = status;
        this.addedAt = addedAt;
        
        // Optional links to domain models
        this.linkedTo = {
            subjectId: linkedTo.subjectId || null,
            assessmentId: linkedTo.assessmentId || null,
            projectId: linkedTo.projectId || null,
            taskId: linkedTo.taskId || null
        };
        
        this.metadata = metadata;
    }
}
