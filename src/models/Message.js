export class Message {
    constructor(config) {
        if (!config.conversationId) {
            throw new Error("conversationId est obligatoire pour un Message.");
        }
        if (!config.role || !['user', 'assistant', 'system'].includes(config.role)) {
            throw new Error("role invalide. Rôles acceptés : user, assistant, system.");
        }
        if (typeof config.content !== 'string') {
            throw new Error("content doit être une chaîne de caractères.");
        }

        this.id = config.id || `msg_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        this.conversationId = config.conversationId;
        this.role = config.role;
        this.content = config.content;
        this.metadata = config.metadata || {};
        
        // Permet d'injecter une date déterministe depuis les tests
        this.createdAt = config.createdAt || new Date().toISOString();
    }
}
