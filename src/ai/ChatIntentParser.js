/**
 * Détection par règles (sans LLM) des messages du chat qui pilotent la boucle académique :
 *  - annonce d'une évaluation : « j'ai examen de structures algébriques le 15/10 », « CC de POO jeudi »,
 *    « devoir de stats le 20 octobre », « interro d'IA demain » ;
 *  - réponse à « As-tu des notes à me donner pour X ? » : « 14/20 », « 14 », « j'ai eu 12,5 » ;
 *  - note annoncée spontanément : « j'ai eu 14/20 en algèbre » ;
 *  - « pas encore » / « pas de note » (le coach redemandera plus tard).
 */

const norm = (text) => String(text || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[’']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const pad = (n) => String(n).padStart(2, '0');
const fmt = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const MONTHS = { janvier: 1, janv: 1, fevrier: 2, fevr: 2, fev: 2, mars: 3, avril: 4, avr: 4, mai: 5, juin: 6, juillet: 7, juil: 7,
    aout: 8, septembre: 9, sept: 9, octobre: 10, oct: 10, novembre: 11, nov: 11, decembre: 12, dec: 12 };
const WEEKDAYS = { dimanche: 0, lundi: 1, mardi: 2, mercredi: 3, jeudi: 4, vendredi: 5, samedi: 6 };

// Type d'évaluation (ordre : le plus spécifique d'abord)
const KINDS = [
    { re: /\b(partiel|partiels)\b/, type: 'Partiel' },
    { re: /\b(rattrapage)\b/, type: 'Rattrapage' },
    { re: /\b(cc|controle continu|controle|devoir surveille|ds)\b/, type: 'CC' },
    { re: /\b(interro|interrogation|test)\b/, type: 'Interrogation' },
    { re: /\b(devoir|dm)\b/, type: 'Devoir' },
    { re: /\b(tp note|projet note|soutenance)\b/, type: 'Projet' },
    { re: /\b(examen|examens|exam|exams|evaluation|epreuve|compo|composition)\b/, type: 'Examen' }
];

/**
 * Date relative ou absolue trouvée dans le texte (normalisé), par rapport à `today` (Date locale).
 * L'année est déduite : une date déjà passée de plus de 30 jours est reportée à l'année suivante.
 * @returns {{ date: string, raw: string } | null}
 */
export function parseFrenchDate(t, today = new Date()) {
    const base = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const withYear = (d, m, y) => {
        let year = y ? (y < 100 ? 2000 + y : y) : base.getFullYear();
        let dt = new Date(year, m - 1, d);
        if (dt.getMonth() !== m - 1 || dt.getDate() !== d) return null;
        if (!y && (base - dt) > 30 * 86400000) dt = new Date(year + 1, m - 1, d);
        return dt;
    };
    let m = t.match(/\b(\d{1,2})\s*[\/.\-]\s*(\d{1,2})(?:\s*[\/.\-]\s*(\d{2,4}))?\b/);
    if (m) {
        const dt = withYear(Number(m[1]), Number(m[2]), m[3] ? Number(m[3]) : null);
        if (dt) return { date: fmt(dt), raw: m[0] };
    }
    m = t.match(/\b(\d{1,2})(?:er)?\s+(janvier|janv|fevrier|fevr|fev|mars|avril|avr|mai|juin|juillet|juil|aout|septembre|sept|octobre|oct|novembre|nov|decembre|dec)\.?(?:\s+(\d{4}))?\b/);
    if (m) {
        const dt = withYear(Number(m[1]), MONTHS[m[2]], m[3] ? Number(m[3]) : null);
        if (dt) return { date: fmt(dt), raw: m[0] };
    }
    if (/\bapres demain\b/.test(t)) { const d = new Date(base); d.setDate(d.getDate() + 2); return { date: fmt(d), raw: 'après-demain' }; }
    if (/\bdemain\b/.test(t)) { const d = new Date(base); d.setDate(d.getDate() + 1); return { date: fmt(d), raw: 'demain' }; }
    if (/\baujourd hui\b|\bce matin\b|\bcet apres midi\b|\bce soir\b/.test(t)) return { date: fmt(base), raw: "aujourd'hui" };
    m = t.match(/\b(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)(\s+prochain)?\b/);
    if (m) {
        const target = WEEKDAYS[m[1]];
        const d = new Date(base);
        let delta = (target - d.getDay() + 7) % 7;
        if (delta === 0) delta = 7; // « lundi » dit un lundi = lundi prochain
        if (m[2] && delta < 7 && /semaine prochaine/.test(t) === false) { /* « jeudi prochain » = le prochain jeudi */ }
        d.setDate(d.getDate() + delta);
        return { date: fmt(d), raw: m[0] };
    }
    return null;
}

/**
 * « j'ai examen de X le 15/10 » → { type: 'Examen', subjectPhrase: 'x', date: '2026-10-15', rawDate }
 * Exige un mot d'évaluation ET une matière ; la date peut manquer (date: null → le coach la demandera).
 * Les questions (« quand est mon examen ? ») et les demandes de planification ne sont pas des annonces.
 */
export function parseExamAnnouncement(text, today = new Date()) {
    const t = norm(text);
    if (!t || t.length > 240) return null;
    const kind = KINDS.find(k => k.re.test(t));
    if (!kind) return null;
    if (/\?\s*$/.test(String(text).trim()) && !/\b(j ai|on a|nous avons|il y a)\b/.test(t)) return null;
    if (/\b(planifie|planifier|aide moi|revise|reviser|revision|revisions)\b/.test(t) && !/\b(j ai|on a|nous avons|il y a|prevu|aura)\b/.test(t)) return null;
    if (/\b(j ai eu|note|notes|\d+(?:[.,]\d+)?\s*\/\s*20)\b/.test(t) && !/\b(le|du|ce|demain|lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)\b/.test(t)) return null;

    const dateInfo = parseFrenchDate(t, today);
    // Matière : ce qui suit « examen de / d' / en / sur » jusqu'à la date ou la fin
    const kw = t.match(new RegExp(`${kind.re.source}\\s*(?:\\d+\\s*)?(?:de la |de l |du |des |de |d |en |sur |pour )?(.*)$`));
    let phrase = kw ? kw[kw.length - 1] : '';
    if (dateInfo) phrase = phrase.split(dateInfo.raw)[0];
    phrase = phrase
        .replace(/\b(le|la|les|ce|cette|prochain|prochaine|semaine|qui vient|a|au|pour|vers|dans|jours?|heures?|h)\b\s*$/g, ' ')
        .replace(/\b(le|ce)\s*$/g, ' ')
        .replace(/\b(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche|demain|apres demain|aujourd hui)\b.*$/, ' ')
        .replace(/\b\d{1,2}\s*h\s*\d{0,2}\b.*$/, ' ')
        .replace(/[^a-z0-9+ ]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    phrase = phrase.replace(/\s+(le|la|les|du|de|ce|cette|en)$/, '').trim();
    if (!phrase || phrase.length < 2) return null;
    return { type: kind.type, subjectPhrase: phrase, date: dateInfo ? dateInfo.date : null, rawDate: dateInfo ? dateInfo.raw : null };
}

/**
 * Note dans une réponse courte : « 14/20 », « 14 », « 12,5 », « j'ai eu 15 sur 20 ».
 * @returns {{ score: number, max: number } | null}
 */
export function parseGradeAnswer(text) {
    const t = norm(text);
    if (!t || t.length > 120) return null;
    let m = t.match(/(\d{1,3}(?:[.,]\d{1,2})?)\s*(?:\/|sur)\s*(\d{1,3})\b/);
    if (m) {
        const score = Number(m[1].replace(',', '.')), max = Number(m[2]);
        if (max > 0 && score >= 0 && score <= max) return { score, max };
        return null;
    }
    m = t.match(/^(?:(?:j ai eu|j ai|eu|note|ma note|c est|j ai obtenu|obtenu)\s+)?(\d{1,2}(?:[.,]\d{1,2})?)(?:\s*(?:pts?|points?))?\s*(?:[.!]|$)/);
    if (m) {
        const score = Number(m[1].replace(',', '.'));
        if (score >= 0 && score <= 20) return { score, max: 20 };
    }
    return null;
}

/**
 * Note annoncée avec la matière : « j'ai eu 14/20 en algèbre », « 15 en POO ».
 * @returns {{ score, max, subjectPhrase } | null}
 */
export function parseGradeStatement(text) {
    const t = norm(text);
    if (!t || t.length > 200) return null;
    const m = t.match(/(\d{1,3}(?:[.,]\d{1,2})?)\s*(?:(?:\/|sur)\s*(\d{1,3}))?\s*(?:en|au|a l|a la|de|d)\s+([a-z0-9+ ]{2,})$/);
    if (!m) return null;
    if (!/\b(j ai eu|eu|note|obtenu|j ai)\b/.test(t) && !m[2]) return null;
    const score = Number(m[1].replace(',', '.'));
    const max = m[2] ? Number(m[2]) : 20;
    if (!(max > 0) || score < 0 || score > max) return null;
    const phrase = m[3].replace(/\b(examen|exam|cc|devoir|partiel|interro|interrogation)\b/g, ' ').replace(/\s+/g, ' ').trim();
    if (!phrase) return null;
    return { score, max, subjectPhrase: phrase };
}

/** « pas encore », « pas de note », « non pas encore »… */
export function isNotYetAnswer(text) {
    const t = norm(text);
    if (!t || t.length > 80) return false;
    return /\b(pas encore|pas de notes?|pas eu de notes?|aucune note|pas recu|pas les notes|toujours pas|non)\b/.test(t);
}
