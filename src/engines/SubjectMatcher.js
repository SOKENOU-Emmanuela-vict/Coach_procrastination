import { TextNormalizer } from './TextNormalizer.js';

/**
 * Rapprochement d'un intitulé libre (emploi du temps, message du chat) avec une matière du cursus
 * ou l'un de ses éléments constitutifs (ECUE = subject.components[]).
 *
 * Les intitulés de l'emploi du temps ne sont pas ceux de la maquette officielle
 * (ex. « Analyse et conception orientée objet » = ECUE 1INF1322 de INF1322 « Approche orientée objet »).
 * Le score combine la similarité de Dice sur les mots significatifs, la couverture des mots de l'intitulé,
 * le code (INF1322) et quelques alias courants (POO, algèbre, stats…). L'enseignant ne sert qu'à départager.
 */

// Alias usuels → id de matière du cursus officiel (ignorés si la matière n'existe pas dans les données)
const ALIASES = [
    { re: /\b(poo|oo|java|orient\w* objet|approche objet)\b/, subjectId: 'inf1322' },
    { re: /\b(algebr\w*|structures? algebriques?)\b/, subjectId: 'mth1321' },
    { re: /\b(sdd|structures? de donnees?|c python)\b/, subjectId: 'inf1323' },
    { re: /\b(stats?|statistiques?|probas?|probabilites?)\b/, subjectId: 'mth1324' },
    { re: /\b(ia|intelligence artificielle)\b/, subjectId: 'inf1325' },
    { re: /\b(web|technologies web)\b/, subjectId: 'inf1326' },
    { re: /\b(gl|genie logiciel|scrum|agile|tests? logiciels?)\b/, subjectId: 'inf1327' },
    { re: /\b(maintenance|electronique)\b/, subjectId: 'inf1328' },
    { re: /\b(python et r|programmation avancee)\b/, subjectId: 'inf1421' },
    { re: /\b(big data)\b/, subjectId: 'inf1422' },
    { re: /\b(cloud)\b/, subjectId: 'inf1423' },
    { re: /\b(ml|machine learning|apprentissage automatique)\b/, subjectId: 'inf1424' },
    { re: /\b(recherche|resolution de probleme)\b/, subjectId: 'inf1425' },
    { re: /\b(gestion de projets?|gestion des projets?)\b/, subjectId: 'ges1426' },
    { re: /\b(communication manageriale|management)\b/, subjectId: 'mgt1427' },
    { re: /\b(anglais|english)\b/, subjectId: 'ang1428' }
];

export const MATCH_THRESHOLD = 0.6;   // au-dessus : matière reliée
export const REVIEW_THRESHOLD = 0.35; // entre les deux : proposée mais « à vérifier »

export class SubjectMatcher {
    /**
     * @param {Array} subjects - matières (acad_subjects) avec leurs components
     * @param {Object} [opts] - { semesterId } : à score égal, préférence pour ce semestre
     */
    constructor(subjects = [], opts = {}) {
        this.subjects = Array.isArray(subjects) ? subjects : [];
        this.semesterId = opts.semesterId || null;
        this.candidates = [];
        for (const s of this.subjects) {
            if (!s || !s.id) continue;
            const base = { subjectId: s.id, subjectName: s.name, subjectCode: s.code || '', semesterId: s.semesterId || null };
            this.candidates.push({ ...base, componentCode: null, label: s.name, tokens: TextNormalizer.tokens(s.name), teacher: s.teacher || '' });
            for (const c of (Array.isArray(s.components) ? s.components : [])) {
                if (!c || !c.name) continue;
                this.candidates.push({ ...base, componentCode: c.code || null, label: c.name, tokens: TextNormalizer.tokens(c.name), teacher: c.teacher || '' });
            }
        }
    }

    _dice(a, b) {
        if (a.length === 0 || b.length === 0) return 0;
        const setB = new Set(b);
        const inter = [...new Set(a)].filter(t => setB.has(t)).length;
        return (2 * inter) / (new Set(a).size + setB.size);
    }

    _coverage(a, b) {
        const setA = [...new Set(a)];
        if (setA.length === 0) return 0;
        const setB = new Set(b);
        return setA.filter(t => setB.has(t)).length / setA.length;
    }

    /**
     * @param {string} title - intitulé à rapprocher
     * @param {Object} [opts] - { teacher, short: true pour une courte mention dans le chat (« algèbre ») }
     * @returns {{ subjectId, subjectName, componentCode, label, confidence, status, ambiguous, alternatives }}
     */
    match(title, opts = {}) {
        const empty = { subjectId: null, subjectName: null, componentCode: null, label: null, confidence: 0, status: 'unmapped', ambiguous: false, alternatives: [] };
        const text = TextNormalizer.forMatching(title);
        if (!text || this.candidates.length === 0) return empty;
        const tokens = TextNormalizer.tokens(title);
        const teacher = TextNormalizer.forMatching(opts.teacher || '');
        const teacherTokens = teacher.split(' ').filter(t => t.length > 2 && !['mme', 'mlle', 'monsieur', 'madame'].includes(t));

        const aliasIds = ALIASES.filter(a => a.re.test(text)).map(a => a.subjectId);

        const scored = this.candidates.map(c => {
            let score = this._dice(tokens, c.tokens);
            // Mention courte (chat) : l'essentiel est que les mots cités figurent dans l'intitulé
            const cov = this._coverage(tokens, c.tokens);
            if (opts.short) score = Math.max(score, 0.85 * cov);
            else score = Math.max(score, 0.75 * cov * this._coverage(c.tokens, tokens) + 0.25 * cov);
            if (c.subjectCode && new RegExp(`\\b${TextNormalizer.forMatching(c.subjectCode)}\\b`).test(text)) score = Math.max(score, 0.95);
            if (aliasIds.includes(c.subjectId)) score = Math.max(score, opts.short ? 0.8 : 0.6);
            if (teacherTokens.length > 0 && c.teacher) {
                const ct = TextNormalizer.forMatching(c.teacher);
                if (teacherTokens.some(t => ct.includes(t))) score += 0.03;
            }
            score = Math.min(1, score);
            // Départage à score égal : semestre courant, puis ECUE (plus précise) pour un intitulé d'emploi du temps,
            // matière entière pour une courte mention dans le chat (« POO », « algèbre »).
            let tie = 0;
            if (this.semesterId && c.semesterId === this.semesterId) tie += 2;
            if (opts.short ? !c.componentCode : !!c.componentCode) tie += 1;
            return { ...c, score, tie };
        }).sort((a, b) => (b.score - a.score) || (b.tie - a.tie));

        const best = scored[0];
        if (!best || best.score < REVIEW_THRESHOLD) return { ...empty, confidence: best ? round(best.score) : 0 };
        // Ambiguïté : une autre MATIÈRE obtient presque le même score
        const rival = scored.find(c => c.subjectId !== best.subjectId);
        const ambiguous = !!(rival && best.score - rival.score < 0.05);
        const confidence = round(ambiguous ? Math.min(best.score, MATCH_THRESHOLD - 0.01) : best.score);
        return {
            subjectId: best.subjectId,
            subjectName: best.subjectName,
            componentCode: best.componentCode,
            label: best.label,
            confidence,
            status: confidence >= MATCH_THRESHOLD ? 'mapped' : 'to_check',
            ambiguous,
            alternatives: scored.filter(c => c.subjectId !== best.subjectId).slice(0, 2)
                .map(c => ({ subjectId: c.subjectId, subjectName: c.subjectName, componentCode: c.componentCode, confidence: round(c.score) }))
        };
    }
}

function round(x) { return Math.round(x * 100) / 100; }
