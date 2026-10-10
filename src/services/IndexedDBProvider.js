import { StorageProvider } from './StorageProvider.js';
import { AppLogger } from '../utils/AppLogger.js';

export class IndexedDBProvider extends StorageProvider {
    constructor(dbName = 'CoachProcrastinationDB', version = 1) {
        super();
        this.dbName = dbName;
        this.version = version;
        this.db = null;
        this.initPromise = this.initDB();
    }

    initDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);
            request.onerror = (e) => {
                AppLogger.error("IndexedDB error: " + (e.target.errorCode || e.target.error));
                reject(e.target.error);
            };
            request.onsuccess = (e) => {
                this.db = e.target.result;
                resolve(this.db);
            };
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains('keyvaluepairs')) {
                    db.createObjectStore('keyvaluepairs');
                }
            };
        });
    }

    async loadData(key) {
        await this.initPromise;
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['keyvaluepairs'], 'readonly');
            const store = transaction.objectStore('keyvaluepairs');
            const request = store.get(key);
            request.onsuccess = () => resolve(request.result !== undefined ? request.result : null);
            request.onerror = () => reject(request.error);
        });
    }

    async saveData(key, data) {
        await this.initPromise;
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['keyvaluepairs'], 'readwrite');
            const store = transaction.objectStore('keyvaluepairs');
            const request = store.put(data, key);
            request.onsuccess = () => {
                AppLogger.info(`IndexedDB: Saved data for key ${key}`);
                resolve();
            };
            request.onerror = () => reject(request.error);
        });
    }

    async getAllKeys() {
        await this.initPromise;
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['keyvaluepairs'], 'readonly');
            const store = transaction.objectStore('keyvaluepairs');
            const request = store.getAllKeys();
            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => reject(request.error);
        });
    }

    async clearData(key) {
        await this.initPromise;
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['keyvaluepairs'], 'readwrite');
            const store = transaction.objectStore('keyvaluepairs');
            const request = store.delete(key);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }
}
