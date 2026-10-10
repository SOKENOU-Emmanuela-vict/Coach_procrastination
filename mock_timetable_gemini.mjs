/**
 * Faux fournisseur Gemini pour les tests de l'import d'emploi du temps (aucun appel réseau).
 * Vérité terrain : emploi du temps IFRI L2, semaine du 05 au 10 octobre 2026 (scan CamScanner, 2 pages).
 */

// Réponse « propre » : groupe 2 seulement, une entrée par séance
export const GROUND_TRUTH_G2 = {
    documentDate: '02/10/2026',
    semester: 'Semestre 3',
    entries: [
        { group: 'Groupe 2', dayLabel: 'Lundi 05 oct.', date: '2026-10-05', startTime: '16:00', endTime: '18:45', title: 'Structure de données et applications avec C/Python', hoursDone: 9, hoursTotal: 25, teacher: 'M. Vincent ALLADAGNIWEKE', room: 'IRAN 2' },
        { group: 'Groupe 2', dayLabel: 'Mardi 06 oct.', date: '2026-10-06', startTime: '13:00', endTime: '15:45', title: 'Structures algébriques et leurs applications en informatique', hoursDone: 3, hoursTotal: 20, teacher: 'M. Cyrille COMBETE', room: 'IRAN 2' },
        { group: 'Groupe 2', dayLabel: 'Mardi 06 oct.', date: '2026-10-06', startTime: '16:00', endTime: '18:45', title: 'Analyse et conception orientée objet', hoursDone: 10, hoursTotal: 25, teacher: 'Mme Corine Dovonou', room: 'IRAN 2' },
        { group: 'Groupe 2', dayLabel: 'Jeudi 08 oct.', date: '2026-10-08', startTime: '13:00', endTime: '15:45', title: 'Structures algébriques et leurs applications en informatique', hoursDone: 6, hoursTotal: 20, teacher: 'M. Cyrille COMBETE', room: 'IRAN 2' },
        { group: 'Groupe 2', dayLabel: 'Jeudi 08 oct.', date: '2026-10-08', startTime: '16:00', endTime: '18:45', title: 'Structure de données et applications avec C/Python', hoursDone: 12, hoursTotal: 25, teacher: 'M. Vincent ALLADAGNIWEKE', room: 'IRAN 2' },
        { group: 'Groupe 2', dayLabel: 'Vendredi 09 oct.', date: '2026-10-09', startTime: '13:00', endTime: '15:45', title: 'Structures algébriques et leurs applications en informatique', hoursDone: 9, hoursTotal: 20, teacher: 'M. Cyrille COMBETE', room: 'IRAN 2' },
        { group: 'Groupe 2', dayLabel: 'Samedi 10 oct.', date: '2026-10-10', startTime: '08:00', endTime: '12:00', title: 'Analyse et conception orientée objet', hoursDone: 14, hoursTotal: 25, teacher: 'Mme Corine Dovonou', room: 'IRAN 2' }
    ]
};

// Réponse « désordonnée » : texte autour du JSON, lignes du groupe 1, cellules coupées entre les pages 1 et 2,
// dates absentes (seulement l'en-tête du jour), heures en texte, horaire spécial du samedi écrit dans la cellule.
const MESSY_OBJECT = {
    documentDate: 'SSE du 02/10/2026',
    days: [{ label: 'Lundi 05 oct.' }, { label: 'Mardi 06 oct.' }, { label: 'Mercredi 07 oct.' }, { label: 'Jeudi 08 oct.' }, { label: 'Vendredi 09 oct.' }, { label: 'Samedi 10 oct.' }],
    entries: [
        // Groupe 1 (à ignorer pour le groupe 2)
        { group: 'Groupe 1', dayLabel: 'Lundi 05 oct.', startTime: '7h', endTime: '09h45', title: '@tous Analyse et conception orientée objet (09H/25H) M. Ratheil HOUNDJI' },
        { group: 'Groupe 1', dayLabel: 'Mardi 06 oct.', startTime: '07:00', endTime: '09:45', title: 'Structure de données et applications avec C/Python - (12H/25H)', teacher: 'M. Nelson SAHO' },
        { group: 'Groupe 1', dayLabel: 'Mardi 06 oct.', startTime: '10:00', endTime: '12:45', title: 'Structures algébriques et leurs applications en informatique', hours: '03H/20H', teacher: 'M. Ferdinand KOUDJO' },
        { group: 'G1', dayLabel: 'Mercredi 07 oct.', startTime: '07:00', endTime: '09:45', title: 'Structure de données et applications avec C/Python - (18H/25H)', teacher: 'M. Nelson SAHO' },
        { group: 'G1', dayLabel: 'Mercredi 07 oct.', startTime: '10:00', endTime: '12:45', title: 'Structure de données et applications avec C/Python - (15H/25H)', teacher: 'M. Nelson SAHO' },
        { group: 'Groupe 1', dayLabel: 'Jeudi 08 oct.', startTime: '07:00', endTime: '09:45', title: 'Structure de données et applications avec C/Python - (21H/25H)', teacher: 'M. Nelson SAHO' },
        { group: 'Groupe 1', dayLabel: 'Jeudi 08 oct.', startTime: '10:00', endTime: '12:45', title: 'Structure de données et applications avec C/Python - (24H/25H)', teacher: 'M. Nelson SAHO' },
        { group: 'Groupe 1', dayLabel: 'Vendredi 09 oct.', startTime: '07:00', endTime: '09:45', title: 'Structures algébriques et leurs applications en informatique (06H/20H)', teacher: 'M. Ferdinand KOUDJO' },
        { group: 'Groupe 1', dayLabel: 'Vendredi 09 oct.', startTime: '10:00', endTime: '12:45', title: 'Structures algébriques et leurs applications en informatique (09H/20H)', teacher: 'M. Ferdinand KOUDJO' },
        // Groupe 2, page 1 (cellules du bas coupées)
        { group: 'Groupe 2', dayLabel: 'Lundi 05 oct.', startTime: '16h', endTime: '18h45', title: '@tous Structure de données et applications avec', page: 1 },
        { group: 'Groupe 2', dayLabel: 'Mardi 06 oct.', startTime: '13h', endTime: '15h45', title: '@tous Structures algébriques et leurs applications en informatique (03H/20H) M. Cyrille COMBETE' },
        { group: 'Groupe 2', dayLabel: 'Mardi 06 oct.', startTime: '16h', endTime: '18h45', title: '@tous Analyse et conception orientée objet', page: 1 },
        { group: 'Groupe 2', dayLabel: 'Jeudi 08 oct.', startTime: '13:00', endTime: '15:45', title: 'Structures algébriques et leurs applications en informatique', hoursDone: 6, hoursTotal: 20, teacher: 'M. Cyrille COMBETE' },
        { group: 'Groupe 2', dayLabel: 'Jeudi 08 oct.', startTime: '16:00', endTime: '18:45', title: 'Structure de données et applications avec', page: 1 },
        { group: 'Groupe 2', dayLabel: 'Vendredi 09 oct.', startTime: '13:00', endTime: '15:45', title: 'Structures algébriques et leurs applications en informatique', hours: '(09H/20H)', teacher: 'M. Cyrille COMBETE' },
        // horaire de la ligne lu par erreur, mais la cellule dit « 8h à 12h »
        { group: 'Groupe 2', dayLabel: 'Samedi 10 oct.', startTime: '13:00', endTime: '15:45', title: '@tous Analyse et conception orientée objet 8h à 12h (14H/25H) Mme. Corine Dovonou' },
        // Page 2 : suites de cellules (sans horaire, groupe parfois absent)
        { group: 'Groupe 2', dayLabel: 'Lundi 05 oct.', startTime: null, endTime: null, title: 'C/Python - (09H/25H) M. Vincent ALLADAGNIWEKE', page: 2, continuation: true },
        { dayLabel: 'Mardi 06 oct.', title: '(10H/25H) Mme. Corine Dovonou', page: 2 },
        { group: 'Groupe 2', dayLabel: 'Jeudi 08 oct.', title: 'C/Python - (12H/25H)', teacher: 'M. Vincent ALLADAGNIWEKE', page: 2 }
    ]
};
export const MESSY_TEXT = "Voici l'emploi du temps extrait :\n```json\n" + JSON.stringify(MESSY_OBJECT, null, 2) + "\n```\nN'hésite pas si tu veux autre chose !";

/** Faux fournisseur : enregistre les appels, renvoie la réponse fournie. */
export class MockTimetableLLM {
    constructor(response) {
        this.response = response;
        this.calls = [];
    }
    async generateFromFile(params) {
        this.calls.push(params);
        return typeof this.response === 'string' ? this.response : JSON.stringify(this.response);
    }
    async generate() { throw new Error('generate() ne doit pas être appelé par l\'import'); }
}

const pad = (n) => String(n).padStart(2, '0');
const DAYS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

/**
 * Même emploi du temps décalé sur la semaine qui commence au lundi `mondayStr` (YYYY-MM-DD), avec des
 * en-têtes de colonnes cohérents. `overrides` : { [index]: { hoursDone, hoursTotal } }.
 */
export function shiftedTimetable(mondayStr, overrides = {}) {
    const [y, m, d] = mondayStr.split('-').map(Number);
    const monday = new Date(y, m - 1, d);
    const entries = GROUND_TRUTH_G2.entries.map((e, i) => {
        const offset = (new Date(2026, 9, Number(e.date.slice(8, 10))).getDay() + 6) % 7;
        const dt = new Date(monday); dt.setDate(monday.getDate() + offset);
        const date = `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
        return { ...e, ...(overrides[i] || {}), date, dayLabel: `${DAYS[dt.getDay()]} ${pad(dt.getDate())} ${MONTHS[dt.getMonth()]}` };
    });
    return { documentDate: `${pad(monday.getDate())}/${pad(monday.getMonth() + 1)}/${monday.getFullYear()}`, entries };
}
