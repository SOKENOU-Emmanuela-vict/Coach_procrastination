import { AppLogger } from '../utils/AppLogger.js';

export class AcademicEngine {
    constructor(storageProvider) {
        this.storage = storageProvider;
    }

    // CRUD Methods
    async clearAllData() {
        await this.storage.saveData('acad_years', []);
        await this.storage.saveData('acad_semesters', []);
        await this.storage.saveData('acad_subjects', []);
        await this.storage.saveData('acad_assessments', []);
        await this.storage.saveData('acad_grades', []);
    }

    async getYears() { return await this.storage.loadData('acad_years') || []; }
    async saveYear(year) {
        let items = await this.getYears();
        const index = items.findIndex(i => i.id === year.id);
        if (index >= 0) items[index] = year; else items.push(year);
        await this.storage.saveData('acad_years', items);
    }
    async deleteYear(id) {
        let items = await this.getYears();
        items = items.filter(i => i.id !== id);
        await this.storage.saveData('acad_years', items);
    }

    async getSemesters() { return await this.storage.loadData('acad_semesters') || []; }
    async saveSemester(semester) {
        let items = await this.getSemesters();
        const index = items.findIndex(i => i.id === semester.id);
        if (index >= 0) items[index] = semester; else items.push(semester);
        await this.storage.saveData('acad_semesters', items);
    }
    async deleteSemester(id) {
        let items = await this.getSemesters();
        items = items.filter(i => i.id !== id);
        await this.storage.saveData('acad_semesters', items);
        let subjects = await this.getSubjects();
        for (const sub of subjects) {
            if (sub.semesterId === id) {
                await this.deleteSubject(sub.id);
            }
        }
    }

    async getSubjects() { return await this.storage.loadData('acad_subjects') || []; }
    async saveSubject(subject) {
        let items = await this.getSubjects();
        const index = items.findIndex(i => i.id === subject.id);
        if (index >= 0) items[index] = subject; else items.push(subject);
        await this.storage.saveData('acad_subjects', items);
    }
    async deleteSubject(id) {
        let items = await this.getSubjects();
        items = items.filter(i => i.id !== id);
        await this.storage.saveData('acad_subjects', items);
        const assessments = await this.getAssessments();
        const toDeleteAss = assessments.filter(a => a.subjectId === id);
        const remainingAss = assessments.filter(a => a.subjectId !== id);
        await this.storage.saveData('acad_assessments', remainingAss);
        const toDeleteAssIds = new Set(toDeleteAss.map(a => a.id));
        let grades = await this.getGrades();
        grades = grades.filter(g => !toDeleteAssIds.has(g.assessmentId));
        await this.storage.saveData('acad_grades', grades);
    }

    async getAssessments() { return await this.storage.loadData('acad_assessments') || []; }
    async saveAssessment(assessment) {
        let items = await this.getAssessments();
        const index = items.findIndex(i => i.id === assessment.id);
        if (index >= 0) items[index] = assessment; else items.push(assessment);
        await this.storage.saveData('acad_assessments', items);
    }
    async deleteAssessment(id) {
        let items = await this.getAssessments();
        items = items.filter(i => i.id !== id);
        await this.storage.saveData('acad_assessments', items);
        let grades = await this.getGrades();
        grades = grades.filter(g => g.assessmentId !== id);
        await this.storage.saveData('acad_grades', grades);
    }

    async getGrades() { return await this.storage.loadData('acad_grades') || []; }
    async saveGrade(grade) {
        let items = await this.getGrades();
        const index = items.findIndex(i => i.id === grade.id);
        if (index >= 0) items[index] = grade; else items.push(grade);
        await this.storage.saveData('acad_grades', items);
    }
    async deleteGrade(id) {
        let items = await this.getGrades();
        items = items.filter(i => i.id !== id);
        await this.storage.saveData('acad_grades', items);
    }

    // 1. Validation de l'intégrité des données
    async validateAcademicData() {
        const errors = [];
        const warnings = [];

        const years = await this.getYears();
        const semesters = await this.getSemesters();
        const subjects = await this.getSubjects();
        const assessments = await this.getAssessments();
        const grades = await this.getGrades();

        // Doublons
        const checkDuplicates = (items, typeName) => {
            const ids = items.map(i => i.id);
            if (new Set(ids).size !== ids.length) {
                errors.push(`Duplicate IDs found in ${typeName}`);
            }
        };
        checkDuplicates(years, 'Years');
        checkDuplicates(semesters, 'Semesters');
        checkDuplicates(subjects, 'Subjects');
        checkDuplicates(assessments, 'Assessments');
        checkDuplicates(grades, 'Grades');

        // Cohérence Relations & Bornes
        for (const sub of subjects) {
            if (!sub.name) errors.push(`Subject ${sub.id} missing name`);
            if (!semesters.find(s => s.id === sub.semesterId)) errors.push(`Subject ${sub.id} linked to missing semester ${sub.semesterId}`);
        }

        for (const ass of assessments) {
            if (!subjects.find(s => s.id === ass.subjectId)) errors.push(`Assessment ${ass.id} linked to missing subject ${ass.subjectId}`);
            if (ass.weight === null || ass.weight === undefined || ass.weight <= 0) errors.push(`Assessment ${ass.id} has invalid/missing weight`);
            if (!ass.maxScore || ass.maxScore <= 0) errors.push(`Assessment ${ass.id} has maxScore <= 0`);
        }

        for (const gr of grades) {
            if (!assessments.find(a => a.id === gr.assessmentId)) errors.push(`Grade ${gr.id} linked to missing assessment ${gr.assessmentId}`);
            if (gr.score < 0) errors.push(`Grade ${gr.id} has negative score`);
            
            const ass = assessments.find(a => a.id === gr.assessmentId);
            if (ass && gr.score > ass.maxScore) errors.push(`Grade ${gr.id} has score ${gr.score} > maxScore ${ass.maxScore}`);
        }

        // Avertissement: CECT Incohérence
        for (const sem of semesters) {
            if (sem.metadata && sem.metadata.cectDiscrepancy) {
                warnings.push(`Semester ${sem.id} has CECT discrepancy of ${sem.metadata.cectDiscrepancy} (${sem.metadata.cectStatus})`);
            }
        }

        // Multiples tentatives sans isFinal clair
        for (const ass of assessments) {
            const assGrades = grades.filter(g => g.assessmentId === ass.id);
            if (assGrades.length > 1) {
                const finalGrades = assGrades.filter(g => g.isFinal);
                if (finalGrades.length === 0) {
                    errors.push(`Assessment ${ass.id} has multiple grades but no isFinal=true`);
                } else if (finalGrades.length > 1) {
                    errors.push(`Assessment ${ass.id} has multiple grades marked as isFinal`);
                }
            }
        }

        return { isValid: errors.length === 0, errors, warnings };
    }

    // 2. Calcul de la note d'une Matière à partir des notes de ses évaluations
    /**
     * Note de la matière = moyenne des notes finales de ses évaluations, ramenées sur 20 :
     *  - pondérée par le poids (weight / coefficient) des évaluations si toutes les évaluations notées en ont un ;
     *  - sinon moyenne simple (method 'simple_mean', weightsIncomplete=true si seules certaines ont un poids).
     * status :
     *  - 'complete'  : toutes les évaluations de la matière sont notées → note définitive de la matière ;
     *  - 'partial'   : une partie seulement est notée → average = moyenne provisoire ;
     *  - 'no_grades' : aucune note ; 'no_assessments' : aucune évaluation définie.
     */
    async getSubjectAverage(subjectId) {
        const assessments = (await this.getAssessments()).filter(a => a.subjectId === subjectId);
        const grades = await this.getGrades();
        const hasWeight = (a) => typeof a.weight === 'number' && Number.isFinite(a.weight) && a.weight > 0;

        const assessmentsUsed = [];
        let ambiguous = 0;

        for (const assessment of assessments) {
            const assessmentGrades = grades.filter(g => g.assessmentId === assessment.id);
            if (assessmentGrades.length === 0) continue; // Pas encore de note

            let finalGrade = null;
            if (assessmentGrades.length === 1) {
                finalGrade = assessmentGrades[0];
            } else {
                const finalGrades = assessmentGrades.filter(g => g.isFinal);
                if (finalGrades.length === 1) {
                    finalGrade = finalGrades[0];
                } else {
                    // Ambiguïté des tentatives traitée par la validation, ignorée ici
                    ambiguous++;
                    continue;
                }
            }

            const maxScore = Number(assessment.maxScore) > 0 ? Number(assessment.maxScore) : 20;
            const normalizedScore = (Number(finalGrade.score) / maxScore) * 20;
            if (!Number.isFinite(normalizedScore)) continue;
            assessmentsUsed.push({
                assessmentId: assessment.id,
                gradeId: finalGrade.id,
                score: finalGrade.score,
                normalizedScore: parseFloat(normalizedScore.toFixed(2)),
                weight: hasWeight(assessment) ? assessment.weight : null
            });
        }

        const base = {
            subjectId,
            assessmentsUsed,
            assessmentCount: assessments.length,
            gradedCount: assessmentsUsed.length
        };

        if (assessmentsUsed.length === 0) {
            return { ...base, average: null, status: assessments.length === 0 ? "no_assessments" : "no_grades", method: null, totalWeight: 0 };
        }

        const allWeighted = assessmentsUsed.every(u => u.weight !== null);
        let average;
        let totalWeight;
        if (allWeighted) {
            totalWeight = assessmentsUsed.reduce((acc, u) => acc + u.weight, 0);
            average = assessmentsUsed.reduce((acc, u) => acc + u.normalizedScore * u.weight, 0) / totalWeight;
        } else {
            totalWeight = assessmentsUsed.length;
            average = assessmentsUsed.reduce((acc, u) => acc + u.normalizedScore, 0) / assessmentsUsed.length;
        }

        return {
            ...base,
            average: parseFloat(average.toFixed(2)),
            status: (assessmentsUsed.length === assessments.length && ambiguous === 0) ? "complete" : "partial",
            method: allWeighted ? "weighted" : "simple_mean",
            weightsIncomplete: !allWeighted && assessmentsUsed.some(u => u.weight !== null),
            totalWeight
        };
    }

    // 3. Calcul Moyenne du Semestre
    async getSemesterAverage(semesterId) {
        const subjects = (await this.getSubjects()).filter(s => s.semesterId === semesterId);
        let totalConfiguredCoeff = 0;
        let totalScore = 0;
        let missingCoefficients = [];
        let missingAverages = [];
        let calculatedSubjects = [];

        for (const subject of subjects) {
            const result = await this.getSubjectAverage(subject.id);
            calculatedSubjects.push(result);
            
            if (subject.gradeCoefficient !== null && subject.gradeCoefficient !== undefined) {
                totalConfiguredCoeff += subject.gradeCoefficient;
            } else {
                missingCoefficients.push(subject.id);
            }

            if (result.status !== "complete") {
                missingAverages.push(subject.id);
            } else if (subject.gradeCoefficient !== null && subject.gradeCoefficient !== undefined) {
                totalScore += result.average * subject.gradeCoefficient;
            }
        }

        let finalAverage = null;
        let status = "complete";

        if (missingCoefficients.length > 0) {
            status = "missing_coefficients";
        } else if (missingAverages.length > 0) {
            status = "incomplete";
        } else if (totalConfiguredCoeff === 0) {
            status = "no_subjects";
        } else {
            finalAverage = parseFloat((totalScore / totalConfiguredCoeff).toFixed(2));
        }

        return {
            semesterId,
            average: finalAverage,
            status: status,
            totalCoeff: totalConfiguredCoeff,
            subjects: calculatedSubjects,
            missingCoefficients,
            missingAverages
        };
    }

    // 4. Calcul Moyenne Annuelle
    async getYearAverage(yearId) {
        const semesters = (await this.getSemesters()).filter(s => s.yearId === yearId);
        let totalAverages = 0;
        let validSemesters = 0;
        let incompleteSemesters = [];
        let semesterResults = [];

        // Pas de pondération annuelle institutionnelle inventée.
        // On fait une simple moyenne non-officielle (indicative) des semestres valides.
        for (const semester of semesters) {
            const result = await this.getSemesterAverage(semester.id);
            semesterResults.push(result);

            if (result.status === "complete") {
                totalAverages += result.average;
                validSemesters++;
            } else {
                incompleteSemesters.push(semester.id);
            }
        }

        if (validSemesters === 0) {
            return {
                yearId,
                average: null,
                status: "incomplete",
                semesters: semesterResults,
                incompleteSemesters
            };
        }

        return {
            yearId,
            average: parseFloat((totalAverages / validSemesters).toFixed(2)),
            status: incompleteSemesters.length > 0 ? "indicative_incomplete" : "indicative",
            semesters: semesterResults,
            incompleteSemesters
        };
    }

    // 5. Statut des CECT
    async getCectStatus(semesterId) {
        const semesters = await this.getSemesters();
        const semester = semesters.find(s => s.id === semesterId);
        
        if (!semester) return null;

        if (semester.metadata && semester.metadata.officialCectTotal) {
            return {
                semesterId: semester.id,
                officialCectTotal: semester.metadata.officialCectTotal,
                calculatedDetailedCectTotal: semester.metadata.calculatedDetailedCectTotal,
                cectDiscrepancy: semester.metadata.cectDiscrepancy,
                status: semester.metadata.cectStatus
            };
        }

        const subjects = (await this.getSubjects()).filter(s => s.semesterId === semesterId);
        const detailedCect = subjects.reduce((acc, s) => acc + (s.cect || 0), 0);
        return {
            semesterId: semester.id,
            officialCectTotal: detailedCect,
            calculatedDetailedCectTotal: detailedCect,
            cectDiscrepancy: 0,
            status: "clean"
        };
    }

    // 6. getUpcomingAssessments
    async getUpcomingAssessments(semesterId, dateRef, options = {}) {
        const subjects = (await this.getSubjects()).filter(s => s.semesterId === semesterId);
        const subjectIds = subjects.map(s => s.id);
        const allAssessments = await this.getAssessments();
        const semesterAssessments = allAssessments.filter(a => subjectIds.includes(a.subjectId));
        const grades = await this.getGrades();

        const upcoming = [];
        const refTime = new Date(dateRef).getTime();

        for (const assessment of semesterAssessments) {
            // Exclusion: si note finale existe
            const assessmentGrades = grades.filter(g => g.assessmentId === assessment.id);
            if (assessmentGrades.some(g => g.isFinal)) continue;

            // Exclusion: sans date ou date passée
            if (!assessment.targetDate) continue;
            
            const targetTime = new Date(assessment.targetDate).getTime();
            if (isNaN(targetTime)) continue; // Date invalide -> exclue

            if (targetTime >= refTime) {
                const daysRemaining = Math.ceil((targetTime - refTime) / (1000 * 60 * 60 * 24));
                const subject = subjects.find(s => s.id === assessment.subjectId);
                
                upcoming.push({
                    id: assessment.id,
                    title: assessment.title,
                    subjectId: assessment.subjectId,
                    subjectName: subject ? subject.name : "Unknown Subject",
                    targetDate: assessment.targetDate,
                    daysRemaining: daysRemaining
                });
            }
        }

        // Tri: date croissante, puis titre en cas d'égalité (déterministe)
        upcoming.sort((a, b) => {
            const timeA = new Date(a.targetDate).getTime();
            const timeB = new Date(b.targetDate).getTime();
            if (timeA !== timeB) return timeA - timeB;
            if (a.title && b.title) return a.title.localeCompare(b.title);
            return 0;
        });

        return upcoming;
    }

    // 6.5 getPastDueAssessments
    async getPastDueAssessments(semesterId, dateRef, options = {}) {
        const subjects = (await this.getSubjects()).filter(s => s.semesterId === semesterId);
        const subjectIds = subjects.map(s => s.id);
        const allAssessments = await this.getAssessments();
        const semesterAssessments = allAssessments.filter(a => subjectIds.includes(a.subjectId));
        const grades = await this.getGrades();

        const pastDue = [];
        const refTime = new Date(dateRef).getTime();

        for (const assessment of semesterAssessments) {
            // Exclusion: évaluation déjà notée (note finale saisie)
            const assessmentGrades = grades.filter(g => g.assessmentId === assessment.id);
            if (assessmentGrades.some(g => g.isFinal)) continue;

            // Exclusion: sans date
            if (!assessment.targetDate) continue;
            
            const targetTime = new Date(assessment.targetDate).getTime();
            if (isNaN(targetTime)) continue; // Date invalide -> exclue

            if (targetTime < refTime) {
                const daysOverdue = Math.ceil((refTime - targetTime) / (1000 * 60 * 60 * 24));
                const subject = subjects.find(s => s.id === assessment.subjectId);
                
                pastDue.push({
                    id: assessment.id,
                    title: assessment.title,
                    subjectId: assessment.subjectId,
                    subjectName: subject ? subject.name : "Unknown Subject",
                    targetDate: assessment.targetDate,
                    daysOverdue: daysOverdue
                });
            }
        }

        // Tri: date la plus ancienne en premier
        pastDue.sort((a, b) => {
            const timeA = new Date(a.targetDate).getTime();
            const timeB = new Date(b.targetDate).getTime();
            if (timeA !== timeB) return timeA - timeB;
            if (a.title && b.title) return a.title.localeCompare(b.title);
            return 0;
        });

        return pastDue;
    }

    // 7. getAcademicAlerts
    async getAcademicAlerts(semesterId, dateRef, options = {}) {
        const alertThresholdAverage = options.alertThresholdAverage !== undefined ? options.alertThresholdAverage : 10;
        const imminentDaysThreshold = options.imminentDaysThreshold !== undefined ? options.imminentDaysThreshold : 7;

        const alerts = [];

        // 1. Alertes moyennes critiques
        const avgResult = await this.getSemesterAverage(semesterId);
        for (const subj of avgResult.subjects) {
            if ((subj.status === "complete" || subj.status === "partial") && subj.average < alertThresholdAverage) {
                const subjectName = (await this.getSubjects()).find(s => s.id === subj.subjectId)?.name || subj.subjectId;
                alerts.push({
                    type: "ACADEMIC_STATE",
                    code: "LOW_AVERAGE",
                    message: `Moyenne ${subj.status === "partial" ? "provisoire" : "actuelle"} (${subj.average}) sous le seuil configuré (${alertThresholdAverage}) en ${subjectName}`
                });
            }
        }

        // 2. Semestre incomplet
        if (avgResult.status === "missing_coefficients" || avgResult.status === "incomplete") {
            alerts.push({
                type: "ACADEMIC_STATE",
                code: "INCOMPLETE_SEMESTER",
                message: "Calcul impossible: notes ou coefficients manquants"
            });
        }

        // 3. Anomalie Documentaire CECT
        const cectStatus = await this.getCectStatus(semesterId);
        if (cectStatus && cectStatus.cectDiscrepancy > 0) {
            alerts.push({
                type: "DOCUMENTARY_STATE",
                code: "CECT_DISCREPANCY",
                message: `Écart documentaire: ${cectStatus.calculatedDetailedCectTotal} CECT détaillés pour ${cectStatus.officialCectTotal} officiels`
            });
        }

        // 4. Évaluations imminentes
        const upcoming = await this.getUpcomingAssessments(semesterId, dateRef, options);
        for (const ass of upcoming) {
            if (ass.daysRemaining <= imminentDaysThreshold) {
                alerts.push({
                    type: "ACADEMIC_STATE",
                    code: "IMMINENT_ASSESSMENT",
                    message: `Évaluation prévue dans ${ass.daysRemaining} jour(s) : ${ass.title}`
                });
            }
        }

        return alerts;
    }

    // 8. getSemesterSummary
    async getSemesterSummary(semesterId, dateRef, options = {}) {
        const semesters = await this.getSemesters();
        const semester = semesters.find(s => s.id === semesterId);
        if (!semester) return null;

        const averageResult = await this.getSemesterAverage(semesterId);
        const cectStatus = await this.getCectStatus(semesterId);
        const upcomingAssessments = await this.getUpcomingAssessments(semesterId, dateRef, options);
        const pastDueAssessments = await this.getPastDueAssessments(semesterId, dateRef, options);
        const alerts = await this.getAcademicAlerts(semesterId, dateRef, options);

        let mappedCectStatus = null;
        if (cectStatus) {
            mappedCectStatus = {
                officialTotal: cectStatus.officialCectTotal,
                detailedTotal: cectStatus.calculatedDetailedCectTotal,
                discrepancy: cectStatus.cectDiscrepancy,
                status: cectStatus.status
            };
        }

        // Populate subjects names
        const allSubjects = await this.getSubjects();
        const subjects = averageResult.subjects.map(s => {
            const subjectObj = allSubjects.find(sub => sub.id === s.subjectId);
            return {
                ...s,
                name: subjectObj ? subjectObj.name : "Unknown"
            };
        });

        return {
            semester: {
                id: semester.id,
                name: semester.name
            },
            average: {
                value: averageResult.average,
                status: averageResult.status,
                totalCoeff: averageResult.totalCoeff,
                missingCoefficients: averageResult.missingCoefficients
            },
            subjects: subjects,
            cectStatus: mappedCectStatus,
            upcomingAssessments: upcomingAssessments,
            pastDueAssessments: pastDueAssessments,
            alerts: alerts
        };
    }
}
