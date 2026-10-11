import { ScheduleIngestionEngine } from './ScheduleIngestionEngine.js';
import { SubjectMatcher, MATCH_THRESHOLD } from './SubjectMatcher.js';
import { CourseProgressEngine } from './CourseProgressEngine.js';
import { TextNormalizer } from './TextNormalizer.js';
import { ScheduleImportEntry } from '../models/ScheduleImportEntry.js';
import { parseLocalDate, toLocalDateStr, addDaysStr, timeToMinutes } from '../utils/dateUtils.js';

/**
 * Import de l'emploi du temps hebdomadaire (PDF scanné ou photo) :
 *   fichier → Gemini (lecture multimodale, sortie JSON imposée) → normalisation / validation
 *   → filtrage du groupe → rapprochement avec le cursus → APERÇU validé par l'étudiante
 *   → cours verrouillés écrits par PlanningEngine.applyWeeklyTimetable (réimport de la même semaine = remplacement).
 * Aucun appel réseau ici en dehors de llmProvider.generateFromFile (remplacé par un faux fournisseur dans les tests).
 */

export const DEFAULT_GROUP = 'Groupe 2';
export const TIMETABLE_SOURCE = 'school_schedule'; // déjà exclu des sessions Focus par SchedulerEngine
export const MAX_FILE_BYTES = 15 * 1024 * 1024;
export const SUPPORTED_MIME_TYPES = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'image/heic', 'image/heif'];

/** Schéma de réponse imposé à Gemini (generationConfig.responseSchema, sous-ensemble OpenAPI). */
export const TIMETABLE_RESPONSE_SCHEMA = {
    type: 'OBJECT',
    properties: {
        documentDate: { type: 'STRING', nullable: true, description: "Date du document (ex. « SSE du 02/10/2026 »), format JJ/MM/AAAA" },
        semester: { type: 'STRING', nullable: true },
        days: {
            type: 'ARRAY',
            items: { type: 'OBJECT', properties: { label: { type: 'STRING' }, date: { type: 'STRING', nullable: true } }, required: ['label'] }
        },
        entries: {
            type: 'ARRAY',
            items: {
                type: 'OBJECT',
                properties: {
                    group: { type: 'STRING', description: "Groupe de la ligne, ex. « Groupe 2 »" },
                    dayLabel: { type: 'STRING', description: "En-tête de colonne, ex. « Lundi 05 oct. »" },
                    date: { type: 'STRING', nullable: true, description: 'AAAA-MM-JJ' },
                    startTime: { type: 'STRING', description: 'HH:MM' },
                    endTime: { type: 'STRING', description: 'HH:MM' },
                    title: { type: 'STRING' },
                    hoursDone: { type: 'INTEGER', nullable: true },
                    hoursTotal: { type: 'INTEGER', nullable: true },
                    teacher: { type: 'STRING', nullable: true },
                    room: { type: 'STRING', nullable: true },
                    rawText: { type: 'STRING', nullable: true }
                },
                required: ['group', 'dayLabel', 'startTime', 'endTime', 'title']
            }
        }
    },
    required: ['entries']
};

const MONTHS = { jan: 1, janv: 1, janvier: 1, fev: 2, fevr: 2, fevrier: 2, mar: 3, mars: 3, avr: 4, avril: 4, mai: 5, juin: 6,
    juil: 7, juillet: 7, aou: 8, aout: 8, sep: 9, sept: 9, septembre: 9, oct: 10, octobre: 10, nov: 11, novembre: 11, dec: 12, decembre: 12 };
const WEEKDAYS = { dimanche: 0, lundi: 1, mardi: 2, mercredi: 3, jeudi: 4, vendredi: 5, samedi: 6 };
const HOURS_RE = /\(?\s*(\d{1,3})\s*h\s*\/\s*(\d{1,3})\s*h\s*\)?/i;
const TEACHER_RE = /\b(?:M\.|Mr\.?|Mme\.?|Mlle\.?|Monsieur|Madame|Dr\.?|Pr\.?)\s+[A-Za-zÀ-ÖØ-öø-ÿ'’.\- ]{2,}$/;
const TIME_RANGE_RE = /(\d{1,2})\s*[h:]\s*(\d{2})?\s*(?:-|–|—|à|a|to)\s*(\d{1,2})\s*[h:]\s*(\d{2})?/i;

export class TimetableImportEngine {
    /**
     * @param {Object} deps - { storage, planningEngine, llmProvider (doit offrir generateFromFile), ingestion }
     */
    constructor({ storage, planningEngine, llmProvider = null, ingestion = null } = {}) {
        this.storage = storage;
        this.planningEngine = planningEngine;
        this.llmProvider = llmProvider;
        this.ingestion = ingestion || new ScheduleIngestionEngine();
    }

    /** « Groupe 2 », « G2 », « groupe2 », 2 → '2' ; null si absent. */
    static normalizeGroup(g) {
        if (g === null || g === undefined) return null;
        const t = TextNormalizer.forMatching(String(g));
        const m = t.match(/(?:groupe|grp|gr|g)?\s*(\d+)/);
        return m ? m[1] : (t || null);
    }

    static groupLabel(g) {
        const n = TimetableImportEngine.normalizeGroup(g);
        return n && /^\d+$/.test(n) ? `Groupe ${n}` : (g || DEFAULT_GROUP);
    }

    canExtract() {
        return !!(this.llmProvider && typeof this.llmProvider.generateFromFile === 'function');
    }

    buildPrompt({ referenceDate = null } = {}) {
        return [
            "Tu lis un emploi du temps universitaire hebdomadaire scanné (IFRI, Université d'Abomey-Calavi).",
            "Structure : un tableau. Colonnes = jours (ex. « Lundi 05 oct. » … « Samedi 10 oct. »). Lignes = groupes",
            "(« Groupe 1 » : 7h – 09h45 puis 10h – 12h45 ; « Groupe 2 » : 13h – 15h45 puis 16h – 18h45), avec la salle (ex. IRAN 2).",
            "Chaque cellule non vide = une séance : « @tous », l'intitulé du cours, « (XXH/YYH) » et l'enseignant.",
            "XXH = heures CUMULÉES faites après cette séance, YYH = volume horaire total prévu pour ce cours.",
            "Règles :",
            "- Extrais les séances de TOUS les groupes, une entrée par cellule non vide, avec son groupe.",
            "- Si la cellule indique un horaire particulier (ex. « 8h à 12h »), il remplace l'horaire de la ligne.",
            "- Une cellule peut se poursuivre sur la page suivante (même colonne de jour) : fusionne la suite dans la MÊME entrée",
            "  (intitulé complet, heures, enseignant). Ne crée jamais d'entrée séparée pour une suite de cellule.",
            "- hoursDone = XX et hoursTotal = YY en nombres entiers ; null si illisible. N'invente rien.",
            "- startTime / endTime au format HH:MM (24 h). date au format AAAA-MM-JJ, l'année étant celle du document"
                + (referenceDate ? ` (date de référence : ${referenceDate})` : '') + '.',
            "- title = intitulé du cours seul, sans « @tous », sans les heures ni l'enseignant.",
            "- documentDate = date du document (ex. « SSE du 02/10/2026 »).",
            "Réponds UNIQUEMENT avec le JSON demandé."
        ].join('\n');
    }

    /**
     * Lecture du fichier par Gemini puis aperçu.
     * @param {Object} params - { base64, mimeType, fileName, sizeBytes, group, referenceDate, subjects, semesterId }
     */
    async extract({ base64, mimeType, fileName = null, sizeBytes = null, group = DEFAULT_GROUP, referenceDate = null, subjects = [], semesterId = null } = {}) {
        if (!base64 || typeof base64 !== 'string') throw new Error("Fichier vide ou illisible.");
        const type = String(mimeType || '').toLowerCase();
        if (!SUPPORTED_MIME_TYPES.includes(type)) throw new Error("Format non pris en charge : envoie un PDF ou une image (PNG, JPEG, WebP).");
        const bytes = sizeBytes || Math.floor(base64.length * 3 / 4);
        if (bytes > MAX_FILE_BYTES) throw new Error("Fichier trop volumineux (15 Mo maximum).");
        if (!this.canExtract()) {
            const err = new Error("Lecture automatique indisponible : aucune clé API Gemini n'est configurée.");
            err.code = 'NO_LLM';
            throw err;
        }
        const ref = referenceDate || toLocalDateStr(new Date());
        const text = await this.llmProvider.generateFromFile({
            prompt: this.buildPrompt({ referenceDate: ref }),
            mimeType: type,
            data: base64,
            responseSchema: TIMETABLE_RESPONSE_SCHEMA
        });
        const existingImports = this.storage ? (await this.storage.loadData('timetable_imports')) || [] : [];
        return this.buildPreview(text, { group, referenceDate: ref, subjects, semesterId, fileName, existingImports });
    }

    /** Extrait l'objet JSON d'une réponse (blocs ```json, texte autour, tableau seul). */
    parseResponse(input) {
        if (input && typeof input === 'object') return Array.isArray(input) ? { entries: input } : input;
        const text = String(input || '').replace(/```(?:json)?/gi, '').trim();
        const tryParse = (s) => { try { return JSON.parse(s); } catch (e) { return undefined; } };
        let obj = tryParse(text);
        if (obj === undefined) {
            const start = text.search(/[\[{]/);
            if (start >= 0) {
                const open = text[start], close = open === '{' ? '}' : ']';
                let depth = 0, inStr = false, esc = false;
                for (let i = start; i < text.length; i++) {
                    const ch = text[i];
                    if (inStr) { if (esc) esc = false; else if (ch === '\\') esc = true; else if (ch === '"') inStr = false; continue; }
                    if (ch === '"') inStr = true;
                    else if (ch === open) depth++;
                    else if (ch === close && --depth === 0) { obj = tryParse(text.slice(start, i + 1)); break; }
                }
            }
        }
        if (obj === undefined || obj === null) throw new Error("Réponse de lecture illisible (JSON introuvable).");
        if (Array.isArray(obj)) return { entries: obj };
        if (!Array.isArray(obj.entries)) {
            const alt = obj.rows || obj.courses || obj.sessions || obj.seances;
            obj.entries = Array.isArray(alt) ? alt : [];
        }
        return obj;
    }

    _pick(o, keys) {
        for (const k of keys) if (o[k] !== undefined && o[k] !== null && o[k] !== '') return o[k];
        return null;
    }

    _parseDocDate(s) {
        if (!s) return null;
        const t = String(s);
        let m = t.match(/(\d{4})-(\d{2})-(\d{2})/);
        if (m) return `${m[1]}-${m[2]}-${m[3]}`;
        m = t.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
        if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
        return null;
    }

    /** « Lundi 05 oct. » → { weekday: 1, day: 5, month: 10 } (champs manquants à null). */
    _parseDayLabel(label) {
        const t = TextNormalizer.forMatching(label || '');
        const weekdayKey = Object.keys(WEEKDAYS).find(k => new RegExp(`\\b${k}\\b`).test(t));
        const dm = t.match(/\b(\d{1,2})\b(?:\s+([a-z]+))?/);
        let month = null;
        if (dm && dm[2]) {
            const key = Object.keys(MONTHS).find(k => dm[2] === k || (dm[2].length >= 3 && k.startsWith(dm[2].slice(0, 4))) || dm[2].startsWith(k));
            month = key ? MONTHS[key] : null;
        }
        return { weekday: weekdayKey !== undefined ? WEEKDAYS[weekdayKey] : null, day: dm ? Number(dm[1]) : null, month };
    }

    _time(value) {
        if (value === null || value === undefined) return null;
        const s = String(value).trim().toLowerCase().replace(/\s+/g, '');
        return this.ingestion.normalizeTime(s.replace(/^(\d{1,2})h(\d{2})$/, '$1:$2'));
    }

    _cleanTitle(title, teacher) {
        let t = String(title || '');
        t = t.replace(/@\s*tous/gi, ' ').replace(HOURS_RE, ' ');
        t = t.replace(TIME_RANGE_RE, ' ');
        if (teacher) {
            const idx = t.toLowerCase().indexOf(String(teacher).toLowerCase());
            if (idx > 0) t = t.slice(0, idx);
        }
        t = t.replace(TEACHER_RE, ' ');
        t = t.replace(/\s+/g, ' ').replace(/^[\s\-–—,;:]+|[\s\-–—,;:(]+$/g, '').trim();
        return t;
    }

    /**
     * Normalise toutes les entrées (tous groupes) : dates, horaires, heures, intitulé, enseignant ;
     * fusionne les suites de cellules (page 2) ; signale les entrées invalides.
     * @returns {{ entries: Array<ScheduleImportEntry>, documentDate, warnings: Array<string> }}
     */
    normalize(raw, { referenceDate = null } = {}) {
        const data = this.parseResponse(raw);
        const warnings = [];
        const ref = parseLocalDate(referenceDate || toLocalDateStr(new Date()));
        const documentDate = this._parseDocDate(data.documentDate) || this._parseDocDate(data.date) || null;
        const anchor = documentDate ? parseLocalDate(documentDate) : ref;

        const yearFor = (month, day) => {
            let best = null;
            for (const y of [anchor.getFullYear() - 1, anchor.getFullYear(), anchor.getFullYear() + 1]) {
                const d = new Date(y, month - 1, day);
                const diff = Math.abs(d - anchor);
                if (!best || diff < best.diff) best = { y, diff };
            }
            return best.y;
        };

        // 1. Lecture brute
        const rows = (data.entries || []).map((e, idx) => {
            if (!e || typeof e !== 'object') return null;
            const rawText = this._pick(e, ['rawText', 'raw', 'text']) || '';
            let titleRaw = String(this._pick(e, ['title', 'course', 'cours', 'intitule', 'subject', 'matiere']) || '');
            let teacher = this._pick(e, ['teacher', 'enseignant', 'professeur', 'prof']);
            if (!teacher) {
                const tm = (titleRaw.match(TEACHER_RE) || String(rawText).match(TEACHER_RE));
                if (tm) teacher = tm[0].trim();
            }
            let hoursDone = this._pick(e, ['hoursDone', 'heuresFaites', 'done']);
            let hoursTotal = this._pick(e, ['hoursTotal', 'heuresTotal', 'total']);
            const hoursText = this._pick(e, ['hours', 'progress', 'avancement']);
            const hm = String(hoursText || '').match(HOURS_RE) || titleRaw.match(HOURS_RE) || String(rawText).match(HOURS_RE);
            if ((hoursDone === null || hoursTotal === null) && hm) {
                if (hoursDone === null) hoursDone = Number(hm[1]);
                if (hoursTotal === null) hoursTotal = Number(hm[2]);
            }
            hoursDone = hoursDone === null ? null : Number(hoursDone);
            hoursTotal = hoursTotal === null ? null : Number(hoursTotal);

            let startTime = this._time(this._pick(e, ['startTime', 'start', 'debut', 'heureDebut']));
            let endTime = this._time(this._pick(e, ['endTime', 'end', 'fin', 'heureFin']));
            const rangeText = [this._pick(e, ['time', 'horaire', 'timeRange']), titleRaw, rawText].filter(Boolean).join(' ');
            const rm = rangeText.match(TIME_RANGE_RE);
            if (rm && (!startTime || !endTime || /\b\d{1,2}\s*h\s*\d{0,2}\s*(?:à|a)\s*\d{1,2}\s*h/i.test(titleRaw + ' ' + rawText))) {
                // horaire écrit dans la cellule (ex. « 8h à 12h ») : prioritaire sur celui de la ligne
                startTime = this._time(`${rm[1]}:${rm[2] || '00'}`);
                endTime = this._time(`${rm[3]}:${rm[4] || '00'}`);
            }

            const dayLabel = this._pick(e, ['dayLabel', 'day', 'jour']) || '';
            let date = this._parseDocDate(this._pick(e, ['date']));
            const parsedDay = this._parseDayLabel(dayLabel);
            if (!date && parsedDay.day && parsedDay.month) {
                const y = yearFor(parsedDay.month, parsedDay.day);
                date = `${y}-${String(parsedDay.month).padStart(2, '0')}-${String(parsedDay.day).padStart(2, '0')}`;
            }
            const continuation = e.continuation === true || (!startTime && !endTime);
            return {
                idx, group: this._pick(e, ['group', 'groupe']), dayLabel, parsedDay, date, startTime, endTime,
                title: this._cleanTitle(titleRaw, teacher), teacher: teacher ? String(teacher).replace(/\s+/g, ' ').trim() : null,
                hoursDone: Number.isFinite(hoursDone) ? hoursDone : null, hoursTotal: Number.isFinite(hoursTotal) ? hoursTotal : null,
                room: this._pick(e, ['room', 'salle']), rawText: rawText || titleRaw, continuation, page: e.page || null
            };
        }).filter(Boolean);

        // 2. Dates manquantes : jour de la semaine + semaine des autres entrées ; cohérence jour/date
        const dated = rows.filter(r => r.date);
        if (dated.length > 0) {
            const first = dated.map(r => r.date).sort()[0];
            const fd = parseLocalDate(first);
            const monday = new Date(fd); monday.setDate(fd.getDate() - ((fd.getDay() + 6) % 7));
            for (const r of rows) {
                if (!r.date && r.parsedDay.weekday !== null) {
                    const d = new Date(monday); d.setDate(monday.getDate() + ((r.parsedDay.weekday + 6) % 7));
                    r.date = toLocalDateStr(d);
                } else if (!r.date && r.parsedDay.day) {
                    const d = new Date(monday.getFullYear(), monday.getMonth(), r.parsedDay.day);
                    if (Math.abs(d - monday) < 8 * 86400000) r.date = toLocalDateStr(d);
                }
            }
        }
        for (const r of rows) {
            if (r.date && r.parsedDay.weekday !== null && parseLocalDate(r.date).getDay() !== r.parsedDay.weekday) {
                warnings.push(`Date incohérente pour « ${r.title || r.dayLabel} » : ${r.dayLabel} ≠ ${r.date}`);
                r.dateMismatch = true;
            }
        }

        // 3. Fusion : même groupe + même jour + même début ; puis suites de cellules (sans horaire)
        const merged = [];
        const mergeInto = (target, src) => {
            if (src.title && !TextNormalizer.forMatching(target.title).includes(TextNormalizer.forMatching(src.title))) {
                target.title = this._cleanTitle(`${target.title} ${src.title}`, target.teacher || src.teacher);
            }
            if (target.hoursDone === null) target.hoursDone = src.hoursDone;
            if (target.hoursTotal === null) target.hoursTotal = src.hoursTotal;
            if (!target.teacher) target.teacher = src.teacher;
            if (!target.room) target.room = src.room;
            target.rawText = `${target.rawText || ''} | ${src.rawText || ''}`.trim();
            target.mergedContinuation = true;
        };
        for (const r of rows.filter(x => !x.continuation)) {
            // même cellule lue deux fois (ex. suite en page 2 avec l'horaire de la ligne) ; sans groupe lu, on rattache par jour + horaire
            const twin = merged.find(m => m.date === r.date && m.startTime === r.startTime
                && (!r.group || TimetableImportEngine.normalizeGroup(m.group) === TimetableImportEngine.normalizeGroup(r.group)));
            if (twin) mergeInto(twin, r); else merged.push(r);
        }
        for (const c of rows.filter(x => x.continuation)) {
            const sameDay = merged.filter(m => m.date && m.date === c.date
                && (!c.group || TimetableImportEngine.normalizeGroup(m.group) === TimetableImportEngine.normalizeGroup(c.group)));
            const incomplete = sameDay.filter(m => m.hoursTotal === null || !m.teacher)
                .sort((a, b) => (b.startTime || '').localeCompare(a.startTime || ''));
            const target = incomplete[0];
            if (target) mergeInto(target, c);
            else { c.status = 'invalid'; merged.push(c); warnings.push(`Morceau de cellule non rattaché : « ${c.rawText || c.title} »`); }
        }

        // 4. Validation
        const entries = merged.map((r, i) => {
            const flags = [];
            let status = r.status || 'proposed';
            if (!r.date || !r.startTime || !r.endTime || !r.title) status = 'invalid';
            else if (timeToMinutes(r.startTime) >= timeToMinutes(r.endTime)) { status = 'invalid'; flags.push('times_inverted'); }
            if (r.hoursDone === null || r.hoursTotal === null) flags.push('missing_hours');
            else if (r.hoursDone > r.hoursTotal) flags.push('hours_inconsistent');
            if (r.dateMismatch) flags.push('date_mismatch');
            if (r.mergedContinuation) flags.push('merged_continuation');
            const dayOfWeek = r.date ? ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][parseLocalDate(r.date).getDay()] : null;
            return new ScheduleImportEntry({
                id: `tt_${i}`,
                dayOfWeek, date: r.date || null, startTime: r.startTime, endTime: r.endTime, title: r.title || '',
                type: 'course', source: TIMETABLE_SOURCE, lockStatus: 'locked', status,
                originalText: r.rawText || null, group: r.group ? TimetableImportEngine.groupLabel(r.group) : null,
                hoursDone: r.hoursDone, hoursTotal: r.hoursTotal, teacher: r.teacher, room: r.room || null, flags
            });
        });
        return { entries, documentDate, warnings };
    }

    /**
     * Aperçu à valider : entrées du groupe choisi, reliées au cursus.
     * @returns {Object} preview { group, groupsFound, weekStart, weekEnd, rows, allEntries, warnings, replacesExistingImport }
     */
    buildPreview(raw, { group = DEFAULT_GROUP, referenceDate = null, subjects = [], semesterId = null, fileName = null, existingImports = [] } = {}) {
        const { entries, documentDate, warnings } = this.normalize(raw, { referenceDate });
        const preview = {
            fileName, documentDate, referenceDate, semesterId,
            allEntries: entries.map(e => ({ ...e })),
            groupsFound: [...new Set(entries.map(e => e.group).filter(Boolean))].sort(),
            baseWarnings: warnings,
            existingWeeks: (existingImports || []).map(i => i.weekStart)
        };
        return this.selectGroup(preview, group, subjects);
    }

    /** (Re)calcule les lignes de l'aperçu pour un groupe, sans nouvel appel à Gemini. */
    selectGroup(preview, group, subjects = []) {
        const wanted = TimetableImportEngine.normalizeGroup(group || DEFAULT_GROUP);
        const anyGroup = preview.allEntries.some(e => e.group);
        const own = preview.allEntries.filter(e => !anyGroup || TimetableImportEngine.normalizeGroup(e.group) === wanted);
        const matcher = new SubjectMatcher(subjects, { semesterId: preview.semesterId });
        const warnings = preview.baseWarnings.slice();
        const dates = own.filter(e => e.date && e.status !== 'invalid').map(e => e.date).sort();
        let weekStart = null, weekEnd = null;
        if (dates.length > 0) {
            const d = parseLocalDate(dates[0]);
            d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
            weekStart = toLocalDateStr(d);
            weekEnd = addDaysStr(weekStart, 6);
            if (dates[dates.length - 1] > weekEnd) warnings.push("L'emploi du temps couvre plus d'une semaine : seules les séances de la première semaine sont proposées.");
        }
        if (own.length === 0) warnings.push(`Aucune séance trouvée pour le ${TimetableImportEngine.groupLabel(group)}.`);

        const rows = own.map(e => {
            const m = matcher.match(e.title, { teacher: e.teacher });
            const flags = (e.flags || []).slice();
            if (m.status === 'unmapped') flags.push('unmapped');
            else if (m.status === 'to_check') flags.push('to_check');
            const outOfWeek = !!(weekStart && e.date && (e.date < weekStart || e.date > weekEnd));
            if (outOfWeek) flags.push('out_of_week');
            const componentName = m.componentCode ? ((subjects.find(s => s.id === m.subjectId)?.components || []).find(c => c.code === m.componentCode)?.name || null) : null;
            return {
                ...e,
                subjectId: m.subjectId,
                subjectName: m.subjectName,
                componentCode: m.componentCode,
                componentName,
                matchConfidence: m.confidence,
                matchStatus: m.status,
                flags,
                include: e.status !== 'invalid' && !outOfWeek
            };
        }).sort((a, b) => ((a.date || '') + (a.startTime || '')).localeCompare((b.date || '') + (b.startTime || '')));

        // Deux séances du même groupe qui se chevauchent : à vérifier (lecture probablement erronée)
        for (const r of rows) {
            if (rows.some(o => o !== r && o.date === r.date && o.startTime && r.startTime
                && timeToMinutes(o.startTime) < timeToMinutes(r.endTime) && timeToMinutes(r.startTime) < timeToMinutes(o.endTime))) {
                if (!r.flags.includes('overlap_in_timetable')) r.flags.push('overlap_in_timetable');
            }
        }

        const coursesCount = rows.length;
        const groupDetected = !!(preview.groupsFound && preview.groupsFound.length > 0);

        return {
            ...preview,
            group: TimetableImportEngine.groupLabel(group || DEFAULT_GROUP),
            weekStart, weekEnd,
            rows,
            coursesCount,
            groupDetected,
            warnings,
            replacesExistingImport: !!(weekStart && (preview.existingWeeks || []).includes(weekStart))
        };
    }

    /**
     * Enregistre les lignes validées.
     * @param {Object} preview - aperçu (buildPreview / selectGroup)
     * @param {Object} [choices] - { rows: [{ id, include, subjectId }] } : cases cochées et matières corrigées dans l'aperçu
     * @returns {Promise<Object>} { success, count, weekStart, weekEnd, replaced, overlaps, unmapped, reason }
     */
    async apply(preview, choices = {}) {
        if (!preview || !Array.isArray(preview.rows) || !preview.weekStart) return { success: false, reason: "Aperçu vide : rien à enregistrer." };
        const subjects = this.storage ? (await this.storage.loadData('acad_subjects')) || [] : [];
        const byId = new Map((choices.rows || []).map(c => [c.id, c]));
        const selected = [];
        for (const r of preview.rows) {
            const c = byId.get(r.id) || {};
            const include = c.include !== undefined ? !!c.include : r.include;
            if (!include) continue;
            if (r.status === 'invalid' || !r.date || !r.startTime || !r.endTime) continue;
            if (r.date < preview.weekStart || r.date > preview.weekEnd) continue;
            let subjectId = r.subjectId, componentCode = r.componentCode;
            if (c.subjectId !== undefined && c.subjectId !== r.subjectId) {
                subjectId = c.subjectId || null;
                componentCode = null; // matière corrigée à la main : l'ECUE proposée ne vaut plus
            }
            if (subjectId && !subjects.find(s => s.id === subjectId)) subjectId = null;
            selected.push({ ...r, subjectId, componentCode: subjectId ? componentCode : null });
        }
        if (selected.length === 0) return { success: false, reason: "Aucune séance cochée." };

        for (let i = 0; i < selected.length; i++) {
            for (let j = i + 1; j < selected.length; j++) {
                const a = selected[i], b = selected[j];
                if (a.date === b.date && timeToMinutes(a.startTime) < timeToMinutes(b.endTime) && timeToMinutes(b.startTime) < timeToMinutes(a.endTime)) {
                    return { success: false, reason: `Deux séances cochées se chevauchent le ${a.date} (« ${a.title} » et « ${b.title} ») : décoche celle qui est fausse.` };
                }
            }
        }

        const stamp = Date.now();
        const events = selected.map((r, i) => ({
            id: `ev_tt_${preview.weekStart}_${i}_${stamp}`,
            title: r.title,
            date: r.date,
            startTime: r.startTime,
            endTime: r.endTime,
            type: 'course',
            impact: 'bloc',
            mandatory: true,
            lockStatus: 'locked',
            priority: 'high',
            subjectId: r.subjectId || null,
            source: TIMETABLE_SOURCE,
            componentCode: r.componentCode || null,
            teacher: r.teacher || null,
            room: r.room || null,
            hoursDone: r.hoursDone,
            hoursTotal: r.hoursTotal,
            importWeek: preview.weekStart
        }));

        const res = await this.planningEngine.applyWeeklyTimetable(events, { weekStart: preview.weekStart, weekEnd: preview.weekEnd });
        if (!res || !res.success) return res || { success: false, reason: "Enregistrement refusé par le planning." };

        // Historique par semaine (réimport de la même semaine = remplacement)
        const imports = ((await this.storage.loadData('timetable_imports')) || []).filter(i => i.weekStart !== preview.weekStart);
        imports.push({
            id: `tti_${preview.weekStart}`,
            weekStart: preview.weekStart,
            weekEnd: preview.weekEnd,
            group: preview.group,
            importedAt: new Date().toISOString(),
            fileName: preview.fileName || null,
            documentDate: preview.documentDate || null,
            entries: selected.map(r => ({
                date: r.date, startTime: r.startTime, endTime: r.endTime, title: r.title, teacher: r.teacher || null, room: r.room || null,
                subjectId: r.subjectId || null, componentCode: r.componentCode || null, hoursDone: r.hoursDone, hoursTotal: r.hoursTotal
            }))
        });
        imports.sort((a, b) => a.weekStart.localeCompare(b.weekStart));
        await this.storage.saveData('timetable_imports', imports);

        // Instantané de l'avancement (avec historique par semaine), recalculé à l'affichage selon l'heure
        const progress = CourseProgressEngine.compute(imports, { subjects });
        await this.storage.saveData('course_progress', { updatedAt: new Date().toISOString(), items: progress.items, bySubject: progress.bySubject });

        // Groupe mémorisé dans le profil (fusion, sans écraser le reste)
        const profile = (await this.storage.loadData('user_profile')) || {};
        if (profile.groupe !== preview.group) await this.storage.saveData('user_profile', { ...profile, groupe: preview.group });

        return {
            success: true,
            count: events.length,
            weekStart: preview.weekStart,
            weekEnd: preview.weekEnd,
            replaced: res.replaced || 0,
            overlaps: res.overlaps || [],
            unmapped: selected.filter(r => !r.subjectId).map(r => r.title),
            group: preview.group,
            groupsFound: preview.groupsFound || [],
            groupDetected: !!(preview.groupsFound && preview.groupsFound.length > 0)
        };
    }

    /** Lundi (YYYY-MM-DD) de la semaine de `date`. */
    static mondayOf(date = new Date()) {
        const d = new Date(date);
        d.setHours(0, 0, 0, 0);
        d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
        return toLocalDateStr(d);
    }

    /**
     * Semaine à importer : le dimanche, c'est la semaine qui commence le lendemain ; sinon la semaine en cours.
     * @returns {{ targetWeekStart, isSunday, imported, lastImportWeek, needsImport }}
     */
    static timetableStatus(imports, now = new Date()) {
        const list = Array.isArray(imports) ? imports : [];
        const isSunday = now.getDay() === 0;
        const target = isSunday ? addDaysStr(TimetableImportEngine.mondayOf(now), 7) : TimetableImportEngine.mondayOf(now);
        const imported = list.some(i => i.weekStart === target);
        const last = list.map(i => i.weekStart).sort().pop() || null;
        return { targetWeekStart: target, isSunday, imported, lastImportWeek: last, needsImport: !imported };
    }
}

export { MATCH_THRESHOLD };
