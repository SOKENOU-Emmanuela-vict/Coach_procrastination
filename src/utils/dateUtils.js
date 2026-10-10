/**
 * Helpers de dates en heure LOCALE.
 * new Date('YYYY-MM-DD') est interprété en UTC (minuit UTC), ce qui décale d'un jour
 * ou d'une heure selon le fuseau. Ces helpers évitent ce piège.
 */
export function parseLocalDate(dateStr) {
    if (!dateStr || typeof dateStr !== 'string') return new Date(NaN);
    const m = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return new Date(dateStr);
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

export function toLocalDateStr(dateObj = new Date()) {
    return dateObj.toLocaleDateString('fr-CA'); // YYYY-MM-DD local
}

export function addDaysStr(dateStr, days) {
    const d = parseLocalDate(dateStr);
    d.setDate(d.getDate() + days);
    return toLocalDateStr(d);
}

export function timeToMinutes(timeStr) {
    if (!timeStr) return 0;
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + (m || 0);
}

export function minutesToTime(minutes) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}
