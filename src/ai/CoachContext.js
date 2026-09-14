export class CoachContextBuilder {
    /**
     * Construit le contexte normalisé pour le raisonnement du Coach.
     * @param {Object} params
     * @param {Object} params.userProfile
     * @param {Object} params.academicSummary 
     * @param {Array} params.temporalEvents - Événements du jour et futurs
     * @param {Array} params.availableSlots - Créneaux disponibles du jour et futurs
     * @param {Array} params.conflicts - Conflits temporels
     * @param {Object} params.analytics - Statistiques utilisateurs
     * @param {Array} params.projects - Projets et avancement
     * @param {string} params.currentDate - Date courante du système
     * @returns {Object} Le snapshot de contexte
     */
    static build({ userProfile, academicSummary, temporalEvents, availableSlots, conflicts, analytics, projects, currentDate, knowledge }) {
        const context = {
            schemaVersion: 1,
            currentDate: currentDate || new Date().toLocaleDateString('fr-CA'),
            user: userProfile || null,
            academic: academicSummary || { upcomingAssessments: [], pastDueAssessments: [], alerts: [], cectStatus: null },
            projects: projects || [],
            planning: {
                events: temporalEvents || [],
                availableSlots: availableSlots || [],
                conflicts: conflicts || []
            },
            analytics: analytics || null
        };
        
        if (knowledge) {
            context.knowledge = knowledge;
        }

        return context;
    }
}
