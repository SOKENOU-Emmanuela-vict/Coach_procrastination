export class User {
    constructor(id, name) {
        this.id = id;
        this.name = name;
        
        // Gamification
        this.streak = 0;
        this.lastActive = null;
        
        // Académique
        this.formation = null;
        this.niveau = null;
        this.groupe = null;
        this.currentSemesterId = null;
        
        // Technique
        this.schemaVersion = "1.1";
        this.preferences = {
            theme: "dark",
            focusDuration: 25,
            breakDuration: 5,
            desktop: {
                widgets: {
                    now: true,
                    today: true,
                    upcoming: true,
                    academic: true,
                    languages: true,
                    shortcuts: true
                },
                shortcuts: [] // e.g. { label: 'GitHub', url: 'https://github.com' }
            }
        };
    }
}
