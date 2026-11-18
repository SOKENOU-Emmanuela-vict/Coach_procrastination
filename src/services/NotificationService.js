import { AppLogger } from '../utils/AppLogger.js';
import { parseLocalDate, toLocalDateStr, timeToMinutes } from '../utils/dateUtils.js';

/**
 * Service de notifications locales (Android via Capacitor & Web via Notification API).
 * Permet de déclencher des rappels sur le téléphone ou le PC avant les cours et révisions,
 * sans serveur externe et sans connexion Internet.
 */
export class NotificationService {
    constructor() {
        this.scheduledIds = new Set();
    }

    /**
     * Vérifie si les notifications sont disponibles (Capacitor natif ou Web Browser).
     */
    static isSupported() {
        if (typeof window === 'undefined') return false;
        if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.LocalNotifications) {
            return true;
        }
        return ('Notification' in window);
    }

    /**
     * Demande la permission d'afficher des notifications à l'utilisateur.
     */
    async requestPermission() {
        if (typeof window === 'undefined') return false;
        
        // 1. Capacitor Android natif
        if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.LocalNotifications) {
            try {
                const status = await window.Capacitor.Plugins.LocalNotifications.requestPermissions();
                return status.display === 'granted';
            } catch (e) {
                AppLogger.error("Erreur permission Capacitor LocalNotifications: " + e.message);
                return false;
            }
        }

        // 2. Web Browser standard
        if ('Notification' in window) {
            try {
                const permission = await Notification.requestPermission();
                return permission === 'granted';
            } catch (e) {
                AppLogger.error("Erreur permission Web Notification: " + e.message);
                return false;
            }
        }

        return false;
    }

    /**
     * Programme un rappel 15 min (ou N min) avant un événement donné.
     * @param {Object} event - { id, title, date, startTime, type }
     * @param {number} minutesBefore
     */
    async scheduleReminder(event, minutesBefore = 15) {
        if (!event || !event.date || !event.startTime) return false;

        const [y, m, d] = event.date.split('-').map(Number);
        const [hour, min] = event.startTime.split(':').map(Number);
        const eventDate = new Date(y, m - 1, d, hour, min, 0);

        // Date de déclenchement du rappel
        const triggerDate = new Date(eventDate.getTime() - (minutesBefore * 60 * 1000));
        const now = new Date();

        // Si l'heure du rappel est déjà passée, ne pas programmer
        if (triggerDate <= now) return false;

        const isRevision = event.type === 'revision' || /r[ée]vision/i.test(event.title || '');
        const title = isRevision ? `📚 Rappel Révision : dans ${minutesBefore} min` : `🎓 Rappel Cours : dans ${minutesBefore} min`;
        const body = `${event.title} commence à ${event.startTime}${event.room ? ` (${event.room})` : ''}. Prépare-toi !`;

        // 1. Capacitor Android
        if (typeof window !== 'undefined' && window.Capacitor?.Plugins?.LocalNotifications) {
            try {
                // Générer un ID numérique stable (32 bits)
                const numericId = Math.abs(this._hashString(event.id || `${event.date}_${event.startTime}`)) % 2147483647;
                await window.Capacitor.Plugins.LocalNotifications.schedule({
                    notifications: [
                        {
                            title,
                            body,
                            id: numericId,
                            schedule: { at: triggerDate },
                            sound: 'beep.wav',
                            smallIcon: 'ic_launcher_round',
                            actionTypeId: '',
                            extra: { eventId: event.id }
                        }
                    ]
                });
                this.scheduledIds.add(event.id);
                AppLogger.info(`Rappel programmé sur Android pour ${event.title} à ${triggerDate.toLocaleTimeString()}`);
                return true;
            } catch (e) {
                AppLogger.error("Erreur scheduling Capacitor: " + e.message);
            }
        }

        // 2. Web Browser standard (Timeout si la page est ouverte)
        const delayMs = triggerDate.getTime() - now.getTime();
        if (delayMs > 0 && delayMs < 24 * 3600 * 1000) { // Dans les 24 heures
            const timer = setTimeout(() => {
                if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
                    new Notification(title, {
                        body,
                        icon: './assets/icons/icon-192.png'
                    });
                }
            }, delayMs);
            if (timer && typeof timer.unref === 'function') {
                timer.unref();
            }
            this.scheduledIds.add(event.id);
            return true;
        }

        return false;
    }

    /**
     * Programme les rappels pour toute une liste d'événements de la semaine.
     * @param {Array} events
     * @param {number} minutesBefore
     */
    async scheduleWeekReminders(events = [], minutesBefore = 15) {
        if (!Array.isArray(events)) return 0;
        let count = 0;
        for (const ev of events) {
            const scheduled = await this.scheduleReminder(ev, minutesBefore);
            if (scheduled) count++;
        }
        return count;
    }

    _hashString(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = ((hash << 5) - hash) + str.charCodeAt(i);
            hash |= 0;
        }
        return hash;
    }
}
