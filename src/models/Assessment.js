export class Assessment {
    constructor(id, subjectId, title, type, weight, maxScore, targetDate) {
        this.id = id;
        this.subjectId = subjectId;
        this.title = title;
        this.type = type; // Exam, Devoir, Projet
        this.weight = weight; // e.g. 0.3 for 30%
        this.maxScore = maxScore;
        this.targetDate = targetDate;
    }
}
