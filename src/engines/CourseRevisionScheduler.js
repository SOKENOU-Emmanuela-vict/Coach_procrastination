import { Event } from '../models/Event.js';
import { parseLocalDate, toLocalDateStr, addDaysStr, timeToMinutes } from '../utils/dateUtils.js';

/**
 * Planificateur automatique de révisions de cours post-cours dans les créneaux libres.
 * Règle : pour chaque cours suivi dans la semaine (emploi du temps), planifier une séance
 * de révision / consolidation (ex: 60 min) dans un créneau libre de la semaine (après-midi
 * sans cours, soirée, mercredi ou week-end), sans collision avec les cours obligatoires ni le sommeil.
 */
export class CourseRevisionScheduler {
    constructor({ planningEngine, planningIntelligence = null, storage = null } = {}) {
        this.planningEngine = planningEngine;
        this.planningIntelligence = planningIntelligence;
        this.storage = storage;
    }

    _minutesToTime(min) {
        const h = Math.floor(min / 60);
        const m = min % 60;
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }

    /**
     * Détermine le début de la semaine (lundi) à partir d'une date (ou de la date du jour).
     */
    static mondayOf(dateStr) {
        const d = parseLocalDate(dateStr || toLocalDateStr(new Date()));
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(d.setDate(diff));
        return toLocalDateStr(monday);
    }

    /**
     * Planifie des séances de révision pour tous les cours de la semaine cible dans les créneaux libres.
     * @param {Object} options
     * @param {string} [options.weekStart] - YYYY-MM-DD (lundi)
     * @param {string} [options.weekEnd] - YYYY-MM-DD (dimanche)
     * @param {number} [options.durationMinutes] - Durée par séance (défaut 60 min)
     * @returns {Promise<{ success: boolean, scheduled: Array, count: number, message: string }>}
     */
    async scheduleWeeklyRevisions({ weekStart = null, weekEnd = null, durationMinutes = 60 } = {}) {
        if (!this.planningEngine) {
            return { success: false, scheduled: [], count: 0, message: "PlanningEngine non disponible" };
        }

        const start = weekStart || CourseRevisionScheduler.mondayOf();
        const end = weekEnd || addDaysStr(start, 6);

        // 1. Récupérer tous les événements existants de la semaine
        const allEvents = (await this.planningEngine.getEvents()) || [];
        const weekEvents = allEvents.filter(e => e.date && e.date >= start && e.date <= end);

        // 2. Identifier les cours de l'emploi du temps
        const courseEvents = weekEvents.filter(e => 
            e.source === 'school_schedule' || 
            e.type === 'course' || 
            e.type === 'cours' || 
            e.type === 'class'
        );

        if (courseEvents.length === 0) {
            return {
                success: true,
                scheduled: [],
                count: 0,
                message: "Aucun cours enregistré cette semaine pour planifier des révisions."
            };
        }

        // 3. Extraire les matières distinctes
        const distinctSubjects = new Map();
        for (const c of courseEvents) {
            const rawTitle = String(c.title || '').trim();
            // Nettoyer les mentions horaires ou professeurs si présents
            const cleanTitle = rawTitle.replace(/\s*\(\d+\s*h\s*\/\s*\d+\s*h\).*$/i, '').trim();
            const key = c.subjectId || cleanTitle.toLowerCase();
            if (!distinctSubjects.has(key)) {
                distinctSubjects.set(key, {
                    key,
                    subjectId: c.subjectId || null,
                    title: cleanTitle,
                    firstCourseDate: c.date,
                    courses: [c]
                });
            } else {
                distinctSubjects.get(key).courses.push(c);
            }
        }

        // 4. Vérifier les révisions déjà planifiées cette semaine
        const existingRevisions = weekEvents.filter(e => 
            e.type === 'revision' || 
            e.type === 'Revision' || 
            /r[ée]vision/i.test(e.title || '')
        );

        const scheduled = [];
        const preferredStudyTimes = [
            { start: '15:00', end: '16:00' },
            { start: '16:30', end: '17:30' },
            { start: '18:00', end: '19:00' },
            { start: '19:30', end: '20:30' }
        ];

        // 5. Pour chaque matière, planifier une séance de révision
        for (const [subKey, sub] of distinctSubjects.entries()) {
            // Si une révision pour cette matière existe déjà cette semaine, ne pas doubler
            const alreadyPlanned = existingRevisions.some(r => {
                if (sub.subjectId && r.subjectId === sub.subjectId) return true;
                const rTitle = String(r.title || '').toLowerCase();
                return rTitle.includes(sub.title.toLowerCase());
            });

            if (alreadyPlanned) continue;

            // Trouver un jour idéal : le jour même du cours (après le cours), ou les jours suivants dans la semaine
            const sortedCourseDates = sub.courses.map(c => c.date).sort();
            const earliestDate = sortedCourseDates[0];

            let candidateFound = null;

            // Parcourir les jours de la semaine à partir du premier cours (ou dès le début de semaine)
            const daysInWeek = [];
            for (let i = 0; i < 7; i++) {
                daysInWeek.push(addDaysStr(start, i));
            }

            // Trier les jours : privilégier les jours où l'étudiante a eu cours (après-midi/soirée), ou les jours libres (mercredi, samedi, dimanche)
            const prioritizedDays = daysInWeek.filter(d => d >= earliestDate).concat(daysInWeek.filter(d => d < earliestDate));

            for (const day of prioritizedDays) {
                // Vérifier les créneaux déjà occupés ce jour-là
                const dayEvents = [
                    ...weekEvents.filter(e => e.date === day),
                    ...scheduled.filter(e => e.date === day)
                ];

                for (const slot of preferredStudyTimes) {
                    const slotStart = timeToMinutes(slot.start);
                    const slotEnd = slotStart + durationMinutes;
                    const slotEndStr = this._minutesToTime(slotEnd);

                    // Vérifier conflit avec les événements du jour
                    const hasConflict = dayEvents.some(ev => {
                        if (!ev.startTime || !ev.endTime) return false;
                        const evStart = timeToMinutes(ev.startTime);
                        const evEnd = timeToMinutes(ev.endTime);
                        return (slotStart < evEnd && evStart < slotEnd);
                    });

                    if (!hasConflict) {
                        candidateFound = {
                            date: day,
                            startTime: slot.start,
                            endTime: slotEndStr
                        };
                        break;
                    }
                }

                if (candidateFound) break;
            }

            // Si un créneau a été trouvé, créer l'événement de révision
            if (candidateFound) {
                const stamp = Date.now() + scheduled.length;
                const revEvent = new Event({
                    id: `rev_course_${start}_${stamp}`,
                    title: `Révision : ${sub.title}`,
                    date: candidateFound.date,
                    startTime: candidateFound.startTime,
                    endTime: candidateFound.endTime,
                    duration: durationMinutes,
                    targetDuration: durationMinutes,
                    type: 'revision',
                    subjectId: sub.subjectId,
                    lockStatus: 'flexible',
                    priority: 'high',
                    source: 'auto_course_revision',
                    notes: `Session de consolidation automatique pour le cours de ${sub.title}.`
                });

                await this.planningEngine.saveEvent(revEvent);
                scheduled.push(revEvent);
            }
        }

        const count = scheduled.length;
        const message = count > 0
            ? `${count} séance${count > 1 ? 's' : ''} de révision planifiée${count > 1 ? 's' : ''} dans tes créneaux libres cette semaine.`
            : "Toutes tes matières ont déjà une séance de révision planifiée cette semaine !";

        return {
            success: true,
            scheduled,
            count,
            message
        };
    }

    /**
     * Planifie les 5 blocs du programme quotidien intensif (180 min strict) dans les créneaux libres du jour.
     * Répartition :
     * 1. Formations techniques (IoT, ML, DL) : 50 min
     * 2. Grand projet : 45 min
     * 3. Anglais (Routine 4 piliers) : 45 min
     * 4. Lecture développement personnel : 25 min
     * 5. Bilan et révision : 15 min
     * @param {Object} options
     * @param {string} [options.dateStr] - YYYY-MM-DD
     */
    async scheduleDailyProgram180({ dateStr = null } = {}) {
        if (!this.planningEngine) {
            return { success: false, scheduled: [], count: 0, message: "PlanningEngine non disponible" };
        }

        const targetDate = dateStr || toLocalDateStr(new Date());

        const PROGRAM_BLOCKS = [
            {
                key: 'formations',
                title: "Formations Techniques (IoT / ML / DL)",
                duration: 50,
                type: 'formation',
                priority: 'high',
                notes: "NVIDIA Deep Learning, Cisco IoT ou Kaggle ML (50 min)."
            },
            {
                key: 'projet',
                title: "Grand Projet Innovant (IoT & IA)",
                duration: 45,
                type: 'project',
                priority: 'high',
                notes: "Avancement sur l'un des 6 modules ou étude comparative Phase 1 (45 min)."
            },
            {
                key: 'anglais',
                title: "Anglais A1→A2 (Routine 4 Piliers)",
                duration: 45,
                type: 'language',
                priority: 'medium',
                notes: "10m Vocabulaire, 10m Écoute, 10m Prononciation, 15m Conversation (45 min)."
            },
            {
                key: 'lecture',
                title: "Lecture : Développement Personnel",
                duration: 25,
                type: 'reading',
                priority: 'medium',
                notes: "Lecture libre de 25 min parmi les 6 livres du programme."
            },
            {
                key: 'bilan',
                title: "Bilan & Pas Quotidiens",
                duration: 15,
                type: 'bilan',
                priority: 'high',
                notes: "Synthèse de la journée, pas personnel & pas professionnel (15 min)."
            }
        ];

        // 1. Récupérer les événements existants de ce jour
        const allEvents = (await this.planningEngine.getEvents()) || [];
        const dayEvents = allEvents.filter(e => e.date === targetDate);

        // 2. Vérifier les blocs déjà planifiés pour éviter les doublons
        const scheduled = [];
        const existingProgramEvents = dayEvents.filter(e => e.source === 'program_180');

        // Créneaux horaires prioritaires selon l'heure de la journée (12h-14h, 17h-22h30)
        // On explore les minutes de la journée (08:00 à 22:30 = 480 à 1350)
        let currentScanMinute = 480; // 08:00
        const endScanMinute = 1350;   // 22:30

        const activeIntervals = [
            ...dayEvents.filter(e => e.startTime && e.endTime).map(e => ({
                start: timeToMinutes(e.startTime),
                end: timeToMinutes(e.endTime)
            }))
        ];

        for (const block of PROGRAM_BLOCKS) {
            const alreadyExists = existingProgramEvents.some(e => 
                (e.notes && e.notes.includes(block.key)) || 
                (e.title && e.title.toLowerCase().includes(block.key.toLowerCase())) ||
                e.type === block.type
            );

            if (alreadyExists) continue;

            const dur = block.duration;
            let bookedSlot = null;

            // Scanner minute par minute pour trouver une plage continue libre
            for (let m = currentScanMinute; m + dur <= endScanMinute; m += 15) {
                const slotStart = m;
                const slotEnd = m + dur;

                const hasConflict = activeIntervals.some(inter => {
                    return (slotStart < inter.end && inter.start < slotEnd);
                });

                if (!hasConflict) {
                    bookedSlot = {
                        start: slotStart,
                        end: slotEnd,
                        startTime: this._minutesToTime(slotStart),
                        endTime: this._minutesToTime(slotEnd)
                    };
                    // Marquer l'intervalle comme occupé
                    activeIntervals.push({ start: slotStart, end: slotEnd });
                    // Avancer le scan avec un tampon de 10 min
                    currentScanMinute = slotEnd + 10;
                    break;
                }
            }

            if (bookedSlot) {
                const stamp = Date.now() + scheduled.length;
                const progEvent = new Event({
                    id: `ev_prog180_${targetDate}_${block.key}_${stamp}`,
                    title: block.title,
                    date: targetDate,
                    startTime: bookedSlot.startTime,
                    endTime: bookedSlot.endTime,
                    duration: dur,
                    targetDuration: dur,
                    type: block.type,
                    lockStatus: 'flexible',
                    priority: block.priority,
                    source: 'program_180',
                    notes: `${block.notes} [clé: ${block.key}]`
                });

                await this.planningEngine.saveEvent(progEvent);
                scheduled.push(progEvent);
            }
        }

        const count = scheduled.length;
        const message = count > 0
            ? `${count} session${count > 1 ? 's' : ''} du Programme 3h insérée${count > 1 ? 's' : ''} dans tes créneaux libres pour le ${targetDate}.`
            : `Le Programme 3h est déjà entièrement positionné pour le ${targetDate} !`;

        return {
            success: true,
            scheduled,
            count,
            totalMinutes: 180,
            message
        };
    }
}
