import { TextNormalizer } from './TextNormalizer.js';
import { timeToMinutes } from '../utils/dateUtils.js';

/**
 * Avancement des cours à partir des emplois du temps importés (clé de stockage 'timetable_imports').
 *
 * Chaque séance de l'emploi du temps porte « (XXH/YYH) » = heures CUMULÉES après la séance / volume total.
 * À un instant donné :
 *  - une séance terminée compte pour XX heures faites ;
 *  - la PREMIÈRE séance à venir compte pour XX moins la durée de la séance (heures faites AVANT elle) ;
 *  - hoursDone = maximum de ces valeurs (les cumuls ne baissent jamais) ; hoursScheduled = maximum des XX
 *    (ce qui sera fait à la fin des semaines importées).
 * Clé d'avancement : l'ECUE (componentCode) si l'intitulé a été relié à un élément constitutif, sinon la matière,
 * sinon l'intitulé lui-même (cours non relié : suivi quand même, mais signalé).
 */
export class CourseProgressEngine {
    static keyFor(entry) {
        if (entry.componentCode) return `ecue:${entry.componentCode}`;
        if (entry.subjectId) return `subject:${entry.subjectId}`;
        return `title:${TextNormalizer.forMatching(entry.title || '')}`;
    }

    static _localDateStr(d) { return d.toLocaleDateString('fr-CA'); }

    static _isEnded(session, todayStr, nowMinutes) {
        if (session.date < todayStr) return true;
        if (session.date > todayStr) return false;
        return timeToMinutes(session.endTime || '23:59') <= nowMinutes;
    }

    /**
     * @param {Array} imports - enregistrements timetable_imports [{ weekStart, entries: [...] }]
     * @param {Object} [opts] - { now: Date, subjects: Array (pour les noms), horizonDays: 14 }
     * @returns {{ items: Array, bySubject: Object, upcomingSessions: Array, lastImport: Object|null }}
     */
    static compute(imports, opts = {}) {
        const now = opts.now instanceof Date ? opts.now : new Date();
        const todayStr = CourseProgressEngine._localDateStr(now);
        const nowMinutes = now.getHours() * 60 + now.getMinutes();
        const subjects = Array.isArray(opts.subjects) ? opts.subjects : [];
        const horizonDays = opts.horizonDays || 14;
        const horizon = new Date(now); horizon.setDate(horizon.getDate() + horizonDays);
        const horizonStr = CourseProgressEngine._localDateStr(horizon);
        const subjectName = (id) => { const s = subjects.find(x => x.id === id); return s ? s.name : null; };
        const componentName = (id, code) => {
            const s = subjects.find(x => x.id === id);
            const c = s && Array.isArray(s.components) ? s.components.find(x => x.code === code) : null;
            return c ? c.name : null;
        };

        const list = Array.isArray(imports) ? imports : [];
        const groups = new Map();
        for (const imp of list) {
            for (const e of (imp.entries || [])) {
                if (!e || !e.date) continue;
                const key = CourseProgressEngine.keyFor(e);
                if (!groups.has(key)) groups.set(key, []);
                groups.get(key).push({ ...e, weekStart: imp.weekStart, importedAt: imp.importedAt || null });
            }
        }

        const items = [];
        const upcomingSessions = [];
        for (const [key, sessionsRaw] of groups.entries()) {
            const sessions = sessionsRaw.slice().sort((a, b) => (a.date + (a.startTime || '')).localeCompare(b.date + (b.startTime || '')));
            let hoursDone = 0, hoursScheduled = 0, hoursTotal = null, lastSessionDate = null, nextSession = null;
            let prevCum = null;
            const history = {};
            for (const s of sessions) {
                const cum = Number.isFinite(s.hoursDone) ? s.hoursDone : null;
                if (Number.isFinite(s.hoursTotal) && s.hoursTotal > 0) hoursTotal = s.hoursTotal; // dernière valeur annoncée
                const durationH = Math.max(0, Math.round((timeToMinutes(s.endTime) - timeToMinutes(s.startTime)) / 60));
                const sessionHours = (cum !== null && prevCum !== null && cum > prevCum) ? cum - prevCum : durationH;
                const ended = CourseProgressEngine._isEnded(s, todayStr, nowMinutes);
                if (cum !== null) {
                    hoursScheduled = Math.max(hoursScheduled, cum);
                    // séance terminée : son cumul ; PREMIÈRE séance à venir : son cumul moins sa durée (fait avant elle)
                    if (ended) hoursDone = Math.max(hoursDone, cum);
                    else if (!nextSession) hoursDone = Math.max(hoursDone, cum - sessionHours);
                    prevCum = Math.max(prevCum || 0, cum);
                }
                if (ended) lastSessionDate = s.date;
                else if (!nextSession) nextSession = { date: s.date, startTime: s.startTime, endTime: s.endTime };
                if (!ended && s.date <= horizonStr) {
                    upcomingSessions.push({ key, date: s.date, startTime: s.startTime, endTime: s.endTime, title: s.title,
                        subjectId: s.subjectId || null, componentCode: s.componentCode || null, hoursDoneAfter: cum, hoursTotal: s.hoursTotal ?? null });
                }
                const w = s.weekStart || null;
                if (w) {
                    const h = history[w] || { weekStart: w, hoursDone: 0, hoursTotal: null, sessions: 0 };
                    h.sessions++;
                    if (cum !== null) h.hoursDone = Math.max(h.hoursDone, cum);
                    if (Number.isFinite(s.hoursTotal)) h.hoursTotal = s.hoursTotal;
                    history[w] = h;
                }
            }
            const last = sessions[sessions.length - 1];
            const subjectId = last.subjectId || null;
            const percent = hoursTotal ? Math.min(100, Math.round((hoursDone / hoursTotal) * 100)) : null;
            items.push({
                key,
                subjectId,
                subjectName: subjectId ? subjectName(subjectId) : null,
                componentCode: last.componentCode || null,
                componentName: last.componentCode ? componentName(subjectId, last.componentCode) : null,
                title: last.title,
                teacher: last.teacher || null,
                hoursDone,
                hoursScheduled,
                hoursTotal,
                percent,
                finished: !!(hoursTotal && hoursDone >= hoursTotal),
                finishedAfterImportedWeeks: !!(hoursTotal && hoursScheduled >= hoursTotal),
                lastSessionDate,
                nextSession,
                mapped: !!subjectId,
                history: Object.values(history).sort((a, b) => a.weekStart.localeCompare(b.weekStart))
            });
        }
        items.sort((a, b) => (a.subjectName || a.title || '').localeCompare(b.subjectName || b.title || ''));
        upcomingSessions.sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime));

        // Agrégat par matière (une matière peut avoir plusieurs ECUE : on additionne celles qui ont été vues)
        const bySubject = {};
        for (const it of items.filter(i => i.subjectId)) {
            const agg = bySubject[it.subjectId] || { subjectId: it.subjectId, subjectName: it.subjectName, hoursDone: 0, hoursTotal: 0, keys: [], finished: true, lastSessionDate: null };
            agg.hoursDone += it.hoursDone;
            agg.hoursTotal += it.hoursTotal || 0;
            agg.keys.push(it.key);
            agg.finished = agg.finished && it.finished;
            if (it.lastSessionDate && (!agg.lastSessionDate || it.lastSessionDate > agg.lastSessionDate)) agg.lastSessionDate = it.lastSessionDate;
            bySubject[it.subjectId] = agg;
        }
        for (const agg of Object.values(bySubject)) {
            agg.percent = agg.hoursTotal ? Math.min(100, Math.round((agg.hoursDone / agg.hoursTotal) * 100)) : null;
        }

        const lastImport = list.slice().sort((a, b) => String(a.weekStart).localeCompare(String(b.weekStart))).pop() || null;
        return {
            items,
            bySubject,
            upcomingSessions,
            lastImport: lastImport ? { weekStart: lastImport.weekStart, weekEnd: lastImport.weekEnd, importedAt: lastImport.importedAt || null, group: lastImport.group || null } : null
        };
    }
}
