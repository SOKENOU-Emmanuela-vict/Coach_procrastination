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
        // Une erreur identique à la dernière erreur affichée n'est pas réenregistrée (pas de pollution répétée)
        if (message.role === 'assistant' && message.metadata && message.metadata.error) {
            const lastAssistant = messages.slice().reverse().find(m => m && m.role === 'assistant' && m.conversationId === message.conversationId);
            if (lastAssistant && lastAssistant.metadata && lastAssistant.metadata.error && lastAssistant.content === message.content) {
                return new Message(lastAssistant);
            }
        }
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

    /**
     * Retire de l'historique les messages d'erreur technique du coach (anciennes versions : « Erreur lors de l'analyse : … »,
     * « Erreur critique… », erreurs Gemini brutes) et ne garde que le DERNIER message marqué metadata.error.
     * @returns {Promise<number>} nombre de messages retirés
     */
    async purgeTechnicalErrors() {
        const messages = await this.storage.loadData('chat_history') || [];
        const legacy = /^(Erreur lors de l'analyse|Erreur lors de la planification|Erreur :|Erreur critique)|Erreur du LLM Provider|Erreur API Gemini/i;
        let lastErrorIdx = -1;
        messages.forEach((m, i) => { if (m && m.role === 'assistant' && m.metadata && m.metadata.error) lastErrorIdx = i; });
        const kept = messages.filter((m, i) => {
            if (!m || m.role !== 'assistant') return true;
            if (legacy.test(String(m.content || ''))) return false;
            if (m.metadata && m.metadata.error && i !== lastErrorIdx) return false;
            return true;
        });
        if (kept.length !== messages.length) await this.storage.saveData('chat_history', kept);
        return messages.length - kept.length;
    }
}
