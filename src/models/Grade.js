export class Grade {
    constructor(id, assessmentId, score, attemptNumber = 1, isFinal = true, feedback = "", dateEarned = null) {
        this.id = id;
        this.assessmentId = assessmentId;
        this.score = score;
        this.attemptNumber = attemptNumber;
        this.isFinal = isFinal;
        this.feedback = feedback;
        this.dateEarned = dateEarned || new Date().toLocaleDateString('fr-CA');
    }
}
