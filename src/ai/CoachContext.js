export class CoachContextBuilder {
    /**
     * Construit le contexte normalisé pour le raisonnement du Coach.
     * @param {Object} params
     * @param {Object} params.userProfile
     * @param {Object} params.academicSummary 
     * @param {Array} params.temporalEvents - Événements du jour et futurs
     * @param {Array} params.availableSlots - Créneaux disponibles du jour et futurs
     * @param {Array} params.availabilityDates - Jours ayant des disponibilités (y compris occupées par des événements flexibles)
     * @param {Array} params.conflicts - Conflits temporels
     * @param {Object} params.analytics - Statistiques utilisateurs
     * @param {Array} params.projects - Projets et avancement
     * @param {string} params.currentDate - Date courante du système
     * @param {Array} params.chatHistory - Derniers messages de la conversation [{role, content}]
     * @param {Object} params.options - { useLLM: boolean } (par défaut le LLM est autorisé)
     * @param {Object} params.courses - avancement des cours issu des emplois du temps importés :
     *   { progress: [...], bySubject: {...}, upcomingSessions: [...], timetable: { needsImport, isSunday, targetWeekStart… },
     *     gradeRequests: [...] } (absent = fonctionnalité non branchée, aucune règle « cours » n'est appliquée)
     * @returns {Object} Le snapshot de contexte
     */
    static build({ userProfile, academicSummary, temporalEvents, availableSlots, availabilityDates, conflicts, analytics, projects, currentDate, knowledge, chatHistory, options, courses }) {
        const resolvedDate = currentDate || new Date().toLocaleDateString('fr-CA');
        const context = {
            schemaVersion: 1,
            currentDate: resolvedDate,
            user: userProfile || null,
            academic: academicSummary || { upcomingAssessments: [], pastDueAssessments: [], alerts: [], cectStatus: null },
            projects: projects || [],
            planning: {
                events: temporalEvents || [],
                availableSlots: availableSlots || [],
                availabilityDates: availabilityDates || [],
                conflicts: conflicts || [],
                currentDate: resolvedDate
            },
            analytics: analytics || null,
            conversation: Array.isArray(chatHistory) ? chatHistory : [],
            options: options || {}
        };
        
        if (knowledge) {
            context.knowledge = knowledge;
        }

        if (courses) {
            context.courses = courses;
        }

        return context;
    }
}
