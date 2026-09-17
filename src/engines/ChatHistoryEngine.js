import { Message } from '../models/Message.js';

export class ChatHistoryEngine {
    constructor(storageProvider) {
        this.storage = storageProvider;
    }

    /**
     * @returns {Promise<Array<Message>>} All messages in the storage.
     */
    async getAllMessages() {
        const rawData = await this.storage.loadData('chat_history') || [];
        // Trier par date croissante
        return rawData.map(m => new Message(m)).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    }

    /**
     * @param {Object} messageData Config pour le Message (role, content, conversationId)
     * @returns {Promise<Message>} Le message sauvegardé
     */
    async saveMessage(messageData) {
        const message = new Message(messageData);
        let messages = await this.storage.loadData('chat_history') || [];
        messages.push(message);
        await this.storage.saveData('chat_history', messages);
        return message;
    }

    /**
     * @param {string} conversationId 
     * @returns {Promise<Array<Message>>} Messages appartenant à cette conversation, triés chronologiquement.
     */
    async getConversation(conversationId) {
        const messages = await this.getAllMessages();
        return messages.filter(m => m.conversationId === conversationId);
    }

    /**
     * @param {string} conversationId 
     * @param {number} limit 
     * @returns {Promise<Array<Message>>} Les 'limit' derniers messages, toujours ordonnés chronologiquement
     */
    async getRecentMessages(conversationId, limit = 50) {
        const conversation = await this.getConversation(conversationId);
        return conversation.slice(-limit);
    }

    /**
     * @param {string} conversationId 
     * @returns {Promise<void>} Supprime les messages de cette conversation
     */
    async clearConversation(conversationId) {
        let messages = await this.storage.loadData('chat_history') || [];
        const initialLength = messages.length;
        messages = messages.filter(m => m.conversationId !== conversationId);
        
        if (messages.length !== initialLength) {
            await this.storage.saveData('chat_history', messages);
        }
    }
}
