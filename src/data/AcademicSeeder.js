import { AcademicYear } from '../models/AcademicYear.js';
import { Semester } from '../models/Semester.js';
import { Subject } from '../models/Subject.js';
import { AppLogger } from '../utils/AppLogger.js';
import {
    CURRICULUM_SEED_VERSION,
    CURRICULUM_YEAR,
    CURRICULUM_SEMESTERS,
    CURRICULUM_SUBJECTS,
    curriculumCectTotal
} from './AcademicCurriculum.js';

const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
const normCode = (c) => (typeof c === 'string' ? c.replace(/\s+/g, '').toUpperCase() : '');
const sameValue = (a, b) => JSON.stringify(a === undefined ? null : a) === JSON.stringify(b === undefined ? null : b);

/** Métadonnées CECT d'un semestre, calculées à partir du cursus officiel. */
function semesterCectMetadata(def) {
    const detailed = curriculumCectTotal(def.id);
    const discrepancy = def.officialCectTotal - detailed;
    return {
        officialCectTotal: def.officialCectTotal,
        calculatedDetailedCectTotal: detailed,
        cectDiscrepancy: discrepancy,
        cectStatus: discrepancy === 0 ? 'verified' : 'to_confirm'
    };
}

function buildSubject(def, id = def.id) {
    return new Subject(id, def.semesterId, def.name, def.cect, def.gradeCoefficient,
        def.importance, def.difficulty, def.personalDifficulty, clone(def.components), def.color, def.code, def.teacher);
}

/**
 * Initialisation des données académiques officielles L2 IA (S3/S4), à partir de AcademicCurriculum.js.
 *  - Nouvelle installation : crée l'année, les semestres et les 16 matières (seedVersion courant).
 *  - Installation existante : n'écrase rien, mais applique la migration versionnée migrate() qui met à jour
 *    les métadonnées officielles des matières sans toucher aux notes, évaluations ni aux liens par id.
 */
export class AcademicSeeder {
    constructor(academicEngine) {
        this.academicEngine = academicEngine;
        this.lastMigration = null;
    }

    async seed() {
        AppLogger.info("Démarrage du seeder académique L2 IA...");

        const years = await this.academicEngine.getYears();
        // 1. Vérification d'idempotence : si l'année existe, on ne recrée rien ; on met seulement à jour le cursus.
        if (years.find(y => y.id === CURRICULUM_YEAR.id)) {
            AppLogger.info("Seeder académique: Les données existent déjà. Initialisation ignorée.");
            try {
                this.lastMigration = await this.migrate();
            } catch (e) {
                // La migration ne doit jamais bloquer le démarrage : elle sera retentée au prochain lancement.
                AppLogger.error("Migration du cursus impossible: " + e.message);
                this.lastMigration = { applied: false, reason: 'ERROR', error: e.message };
            }
            return false;
        }

        // 2. Année Académique
        const l2Year = new AcademicYear(CURRICULUM_YEAR.id, CURRICULUM_YEAR.title, CURRICULUM_YEAR.startDate, CURRICULUM_YEAR.endDate);
        l2Year.seedVersion = CURRICULUM_SEED_VERSION;

        // 3. Semestres S3 et S4 (30 CECT officiels chacun, vérifiés)
        for (const def of CURRICULUM_SEMESTERS) {
            await this.academicEngine.saveSemester(new Semester(def.id, CURRICULUM_YEAR.id, def.name, def.defaultStatus, semesterCectMetadata(def)));
        }

        // 4. Matières S3 + S4
        for (const def of CURRICULUM_SUBJECTS) {
            await this.academicEngine.saveSubject(buildSubject(def));
        }

        // L'année est écrite en dernier : si l'initialisation est interrompue, elle sera refaite au prochain démarrage.
        await this.academicEngine.saveYear(l2Year);

        AppLogger.info("Seeder académique: Toutes les données L2 IA (S3/S4) ont été intégrées avec succès.");
        return true;
    }

    /**
     * Migration versionnée et idempotente du cursus pour les installations existantes.
     *
     * - Ne s'exécute que si year.seedVersion < CURRICULUM_SEED_VERSION (ou options.force).
     * - Retrouve chaque matière officielle par son code (MTH1321…), sinon par les anciens codes/ids des
     *   versions précédentes du seeder (S3-ALG, s4_inf1423…).
     * - Met à jour uniquement les métadonnées officielles : intitulé, code, CECT, enseignant(s), semestre,
     *   composantes (heures). Le coefficient n'est aligné que s'il manquait ou valait l'ancien CECT
     *   (une valeur personnalisée est conservée). L'id de la matière n'est JAMAIS modifié : évaluations,
     *   notes, événements, documents et imports restent liés.
     * - Recrée une matière officielle absente ; ne supprime jamais rien (une matière en double ou ajoutée
     *   à la main est laissée telle quelle et signalée dans warnings).
     * - Recalcule les totaux CECT des semestres (S3 = S4 = 30, écart 0, statut 'verified').
     *
     * @param {Object} [options] - { force: boolean }
     * @returns {Promise<Object>} { applied, reason?, fromVersion, toVersion, changes: [], warnings: [] }
     */
    async migrate(options = {}) {
        const storage = this.academicEngine && this.academicEngine.storage;
        if (!storage || typeof storage.loadData !== 'function' || typeof storage.saveData !== 'function') {
            return { applied: false, reason: 'NO_STORAGE', changes: [], warnings: [] };
        }

        const asArray = (v) => (Array.isArray(v) ? v : []);
        const years = asArray(await storage.loadData('acad_years'));
        const year = years.find(y => y && y.id === CURRICULUM_YEAR.id);
        if (!year) return { applied: false, reason: 'NO_YEAR', changes: [], warnings: [] };

        const fromVersion = Number(year.seedVersion) || 1;
        if (!options.force && fromVersion >= CURRICULUM_SEED_VERSION) {
            return { applied: false, reason: 'UP_TO_DATE', fromVersion, toVersion: CURRICULUM_SEED_VERSION, changes: [], warnings: [] };
        }

        const subjects = asArray(await storage.loadData('acad_subjects'));
        const semesters = asArray(await storage.loadData('acad_semesters'));
        const assessments = asArray(await storage.loadData('acad_assessments'));
        const changes = [];
        const warnings = [];
        let subjectsChanged = false;
        let semestersChanged = false;

        // 1. Semestres : création si absents, totaux CECT officiels (le statut active/upcoming de l'utilisateur est conservé)
        for (const def of CURRICULUM_SEMESTERS) {
            const metadata = semesterCectMetadata(def);
            const sem = semesters.find(s => s && s.id === def.id);
            if (!sem) {
                semesters.push(new Semester(def.id, year.id, def.name, def.defaultStatus, metadata));
                changes.push({ type: 'semester_created', semesterId: def.id });
                semestersChanged = true;
                continue;
            }
            const before = clone(sem);
            sem.metadata = { ...(sem.metadata && typeof sem.metadata === 'object' ? sem.metadata : {}), ...metadata };
            if (!sem.yearId) sem.yearId = year.id;
            if (!sem.name) sem.name = def.name;
            if (!sem.status) sem.status = def.defaultStatus;
            if (!sameValue(before, sem)) {
                changes.push({ type: 'semester_updated', semesterId: def.id, from: before.metadata || null, to: clone(sem.metadata) });
                semestersChanged = true;
            }
        }

        // 2. Matières : correspondance par code officiel, puis anciens codes, puis anciens ids
        const assessmentCount = (id) => assessments.filter(a => a && a.subjectId === id).length;
        const used = new Set();
        for (const def of CURRICULUM_SUBJECTS) {
            const free = (pred) => subjects.filter(s => s && typeof s === 'object' && !used.has(s) && pred(s));
            const legacyCodes = (def.legacyCodes || []).map(normCode);
            let candidates = free(s => normCode(s.code) === def.code);
            let matchedBy = 'code';
            if (candidates.length === 0) { candidates = free(s => legacyCodes.includes(normCode(s.code))); matchedBy = 'legacy_code'; }
            if (candidates.length === 0) { candidates = free(s => s.id === def.id || (def.legacyIds || []).includes(s.id)); matchedBy = 'legacy_id'; }

            if (candidates.length === 0) {
                // Matière officielle absente : on la crée (id officiel, ou variante si l'id est déjà pris)
                let newId = def.id;
                while (subjects.some(s => s && s.id === newId)) newId = `${newId}_official`;
                const created = buildSubject(def, newId);
                subjects.push(created);
                used.add(created);
                changes.push({ type: 'subject_created', subjectId: newId, code: def.code });
                subjectsChanged = true;
                continue;
            }

            // Plusieurs candidats : on met à jour celui qui porte le plus d'évaluations (celui qu'utilise l'étudiante),
            // à égalité celui qui a l'id officiel
            candidates.sort((a, b) => assessmentCount(b.id) - assessmentCount(a.id) || (b.id === def.id) - (a.id === def.id));
            const target = candidates[0];
            candidates.forEach(c => used.add(c));
            if (candidates.length > 1) {
                warnings.push(`Plusieurs matières correspondent à ${def.code} (${candidates.map(c => c.id).join(', ')}) : seule ${target.id} a été mise à jour, les autres sont conservées telles quelles.`);
            }

            const oldCect = target.cect;
            const updates = {
                name: def.name,
                code: def.code,
                cect: def.cect,
                teacher: def.teacher,
                semesterId: def.semesterId,
                components: clone(def.components)
            };
            const coeff = target.gradeCoefficient;
            if (coeff === undefined || coeff === null || (typeof oldCect === 'number' && coeff === oldCect)) {
                updates.gradeCoefficient = def.gradeCoefficient;
            }
            for (const key of ['importance', 'difficulty', 'personalDifficulty', 'color']) {
                if (target[key] === undefined || target[key] === null) updates[key] = def[key];
            }

            for (const [field, value] of Object.entries(updates)) {
                if (sameValue(target[field], value)) continue;
                changes.push({
                    type: 'subject_updated', subjectId: target.id, code: def.code, matchedBy, field,
                    from: field === 'components' ? `${asArray(target[field]).length} composante(s)` : clone(target[field]) ?? null,
                    to: field === 'components' ? `${value.length} composante(s)` : clone(value)
                });
                target[field] = value;
                subjectsChanged = true;
            }
        }

        // 3. Écriture : matières et semestres d'abord, l'année (seedVersion) en dernier
        if (subjectsChanged) await storage.saveData('acad_subjects', subjects);
        if (semestersChanged) await storage.saveData('acad_semesters', semesters);
        if (year.seedVersion !== CURRICULUM_SEED_VERSION) {
            year.seedVersion = CURRICULUM_SEED_VERSION;
            await storage.saveData('acad_years', years);
        }

        const updatedSubjects = new Set(changes.filter(c => c.type === 'subject_updated').map(c => c.subjectId)).size;
        AppLogger.info(`Migration du cursus v${fromVersion} → v${CURRICULUM_SEED_VERSION} : ${updatedSubjects} matière(s) mise(s) à jour, ` +
            `${changes.filter(c => c.type === 'subject_created').length} créée(s), ${warnings.length} avertissement(s). Aucune note ni évaluation modifiée.`);
        warnings.forEach(w => AppLogger.warn(w));

        return { applied: true, fromVersion, toVersion: CURRICULUM_SEED_VERSION, changes, warnings };
    }
}
