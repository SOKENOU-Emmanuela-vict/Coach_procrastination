/**
 * Dialogue « on décide ensemble » quand un créneau proposé par le coach chevauche un événement
 * flexible (révision, sortie, sport…). Aucune interface nouvelle : le coach pose la question dans
 * le chat et l'utilisateur répond en texte libre (« oui », « déplace », « remplace », « non »…).
 */

const norm = (text) => String(text || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const MOVE = '(?:deplace|deplacer|deplaces|deplacez|decale|decaler|decales|decalez|bouge|bouger|reporte|reporter|repousse|repousser)';
const REPLACE = '(?:remplace|remplacer|remplaces|remplacez|supprime|supprimer|supprimes|supprimez|annule|annuler|annules|enleve|enlever|retire|retirer|efface|effacer)';

// « ne le déplace pas », « supprime pas »… : le verbe est nié
const negated = (t, verbs) => new RegExp(`\\b(?:ne|n)\\s+(?:le\\s+|la\\s+|les\\s+|l\\s+)?${verbs}\\b|\\b${verbs}\\s+(?:le\\s+|la\\s+|les\\s+)?pas\\b`).test(t);
const has = (t, verbs) => new RegExp(`\\b${verbs}\\b`).test(t);

/**
 * @param {string} text - réponse de l'utilisateur
 * @returns {'move'|'replace'|'keep'|'other'|null} null si le message n'est pas une réponse à la question
 */
export function detectFlexibleConflictAnswer(text) {
    const t = norm(text);
    if (!t || t.length > 160) return null; // un long message est une autre demande : on laisse le coach répondre
    if (has(t, MOVE) && !negated(t, MOVE)) return 'move';
    if (has(t, REPLACE) && !negated(t, REPLACE)) return 'replace';
    if (/\b(?:non|nan|nope|autre|ailleurs|plutot pas|pas ce creneau|cherche)\b/.test(t)) return 'other';
    if (/\b(?:oui|ouais|ouai|ok|okay|okk|yes|d accord|daccord|dac|vas y|go|garde|garder|gardes|les deux|quand meme|valide|accepte|j accepte|parfait|ca marche|ca me va|planifie)\b/.test(t)) return 'keep';
    return null;
}

const quoteList = (events) => (events || []).map(e => `« ${e.title} » (${e.startTime}-${e.endTime})`).join(', ');

/**
 * Texte des choix proposés à l'utilisateur.
 * @param {Array} events - événements flexibles chevauchés
 * @param {Object} [opts] - { allowMove: true }
 */
export function flexibleConflictChoices(events, opts = {}) {
    const names = (events || []).map(e => `« ${e.title} »`).join(', ');
    const parts = [`« oui » pour planifier quand même (${names} reste en place)`];
    if (opts.allowMove !== false) parts.push(`« déplace » pour que je décale ${names} sur un autre créneau libre`);
    parts.push(`« remplace » pour retirer ${names} de ton agenda`);
    parts.push(`« non » pour que je cherche un autre créneau`);
    return `Réponds-moi dans le chat : ${parts.join(', ')}.`;
}

/**
 * Question posée quand le meilleur créneau chevauche des événements flexibles.
 */
export function buildFlexibleConflictQuestion({ candidate, deadline = null, duration, excluded = false }) {
    const scope = deadline ? `avant l'échéance (${deadline})` : `dans les prochains jours`;
    const intro = excluded
        ? `Je n'ai pas d'autre créneau totalement libre de ${duration} minutes ${scope}.`
        : `Je n'ai trouvé aucun créneau totalement libre de ${duration} minutes ${scope}.`;
    return `${intro} Le meilleur créneau est le ${candidate.date} de ${candidate.startTime} à ${candidate.endTime}, `
        + `mais il chevauche ${candidate.overlappingFlexible.length > 1 ? 'tes événements flexibles' : 'ton événement flexible'} ${quoteList(candidate.overlappingFlexible)}. `
        + `On décide ensemble. ${flexibleConflictChoices(candidate.overlappingFlexible)}`;
}
