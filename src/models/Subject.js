export class Subject {
    constructor(id, semesterId, name, cect, gradeCoefficient, importance = 3, difficulty = 3, personalDifficulty = 3, components = [], color = '#3498db', code = '') {
        this.id = id;
        this.semesterId = semesterId;
        this.name = name;
        this.cect = cect;
        this.gradeCoefficient = gradeCoefficient;
        this.importance = importance; 
        this.difficulty = difficulty;
        this.personalDifficulty = personalDifficulty;
        this.components = components; // e.g. [{name: 'Cours', type: 'theory', hours: 30}, {name: 'TP', type: 'practice', hours: 40}]
        this.color = color;
        this.code = code;
    }
}
