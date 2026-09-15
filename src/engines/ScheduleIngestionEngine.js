import { ScheduleImportEntry } from '../models/ScheduleImportEntry.js';

export class ScheduleIngestionEngine {
    constructor() {}

    normalizeDay(dayStr) {
        if (!dayStr) return null;
        const mapping = {
            'lundi': 'monday', 'mardi': 'tuesday', 'mercredi': 'wednesday',
            'jeudi': 'thursday', 'vendredi': 'friday', 'samedi': 'saturday', 'dimanche': 'sunday',
            'monday': 'monday', 'tuesday': 'tuesday', 'wednesday': 'wednesday',
            'thursday': 'thursday', 'friday': 'friday', 'saturday': 'saturday', 'sunday': 'sunday'
        };
        const cleaned = dayStr.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        return mapping[cleaned] || null;
    }

    normalizeTime(timeStr) {
        if (!timeStr) return null;
        let cleaned = timeStr.trim().toLowerCase();
        const regex = /^(\d{1,2})[h:](\d{2})?$/;
        const match = cleaned.match(regex);
        if (match) {
            let h = parseInt(match[1], 10);
            let m = match[2] ? parseInt(match[2], 10) : 0;
            if (h >= 0 && h < 24 && m >= 0 && m < 60) {
                return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
            }
        }
        return null;
    }

    parseSchedule(input) {
        if (!input || typeof input !== 'string') return [];
        const lines = input.split('\n');
        const entries = [];
        let currentDay = null;

        const daysPattern = "Lundi|Mardi|Mercredi|Jeudi|Vendredi|Samedi|Dimanche|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday";
        const dayRegex = new RegExp(`^(${daysPattern})\\s*:?$`, 'i');
        const eventRegex = new RegExp(`^(?:(${daysPattern})\\s+)?(\\d{1,2}[h:]\\d{0,2})\\s*[-→]\\s*(\\d{1,2}[h:]\\d{0,2})\\s*:\\s*(.*)$`, 'i');
        const eventRegexAlt = new RegExp(`^(?:(${daysPattern})\\s+)?(\\d{1,2}[h:]\\d{0,2})\\s*[-→]\\s*(\\d{1,2}[h:]\\d{0,2})\\s+(.*)$`, 'i');

        for (let line of lines) {
            line = line.trim();
            if (!line) continue;

            const dayMatch = line.match(dayRegex);
            if (dayMatch) {
                currentDay = this.normalizeDay(dayMatch[1]);
                continue;
            }

            let match = line.match(eventRegex) || line.match(eventRegexAlt);
            if (match) {
                const inlineDay = match[1] ? this.normalizeDay(match[1]) : currentDay;
                const startTime = this.normalizeTime(match[2]);
                const endTime = this.normalizeTime(match[3]);
                const title = match[4].trim();

                const entry = new ScheduleImportEntry({
                    dayOfWeek: inlineDay,
                    startTime: startTime,
                    endTime: endTime,
                    title: title,
                    originalText: line,
                    status: 'proposed'
                });

                if (!inlineDay || !startTime || !endTime || !title) {
                    entry.status = 'invalid';
                } else if (this._timeToMinutes(startTime) >= this._timeToMinutes(endTime)) {
                    entry.status = 'ambiguous'; // Suspicious times
                }

                entries.push(entry);
            } else {
                if (line.match(/\d{1,2}[h:]/)) {
                    entries.push(new ScheduleImportEntry({
                        dayOfWeek: currentDay,
                        title: line,
                        originalText: line,
                        status: 'invalid'
                    }));
                }
            }
        }
        return entries;
    }

    _timeToMinutes(t) {
        if (!t) return 0;
        const [h,m] = t.split(':').map(Number);
        return h * 60 + m;
    }

    resolveSubjects(entries, subjects) {
        for (const entry of entries) {
            if (entry.status === 'invalid' || !entry.title) continue;

            const titleLower = entry.title.toLowerCase();
            const subject = subjects.find(s => 
                s.name.toLowerCase() === titleLower || 
                (s.code && s.code.toLowerCase() === titleLower)
            );

            if (subject) {
                entry.subjectId = subject.id;
            } else {
                entry.subjectId = null;
                if (entry.status !== 'invalid') {
                    entry.status = 'ambiguous';
                }
            }
        }
        return entries;
    }

    compareSchedules(previousEntries, newEntries) {
        const changes = [];
        const prevMap = new Map();
        
        for (const prev of previousEntries) {
            const key = prev.getIdentityKey();
            if (!prevMap.has(key)) prevMap.set(key, []);
            prevMap.get(key).push(prev);
        }

        const newMap = new Map();
        for (const next of newEntries) {
            if (next.status === 'invalid' || next.status === 'ambiguous') {
                changes.push({ type: next.status.toUpperCase(), oldEntry: null, newEntry: next, requiresConfirmation: true });
                continue;
            }

            const key = next.getIdentityKey();
            if (!newMap.has(key)) newMap.set(key, []);
            newMap.get(key).push(next);
        }

        for (const [key, nextItems] of newMap.entries()) {
            const prevItems = prevMap.get(key) || [];
            
            for (const next of nextItems) {
                let matchFound = false;
                
                for (let i = 0; i < prevItems.length; i++) {
                    const prev = prevItems[i];
                    if (prev.startTime === next.startTime && prev.endTime === next.endTime) {
                        changes.push({ type: 'UNCHANGED', oldEntry: prev, newEntry: next, requiresConfirmation: false });
                        prevItems.splice(i, 1);
                        matchFound = true;
                        break;
                    }
                }

                if (!matchFound) {
                    if (prevItems.length > 0) {
                        const old = prevItems.shift(); 
                        changes.push({ type: 'MOVED', oldEntry: old, newEntry: next, requiresConfirmation: true });
                    } else {
                        changes.push({ type: 'NEW', oldEntry: null, newEntry: next, requiresConfirmation: true });
                    }
                }
            }
        }

        for (const prevItems of prevMap.values()) {
            for (const prev of prevItems) {
                changes.push({ type: 'REMOVED', oldEntry: prev, newEntry: null, requiresConfirmation: true });
            }
        }

        return changes;
    }

    createScheduleImport(input, previousEntries, subjects) {
        let parsed = this.parseSchedule(input);
        parsed = this._deduplicate(parsed);
        parsed = this.resolveSubjects(parsed, subjects);
        const changes = this.compareSchedules(previousEntries, parsed);
        return { changes };
    }

    _deduplicate(entries) {
        const unique = [];
        const seen = new Set();
        for (const entry of entries) {
            const sig = `${entry.dayOfWeek}_${entry.startTime}_${entry.endTime}_${entry.title}`;
            if (!seen.has(sig)) {
                seen.add(sig);
                unique.push(entry);
            }
        }
        return unique;
    }
}
