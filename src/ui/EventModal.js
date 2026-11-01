import { parseLocalDate } from '../utils/dateUtils.js';
import { Motion } from './motion.js';

/**
 * EventModal
 * Formulaire réutilisable d'ajout et d'édition d'événements pour PlanningView (vues Semaine et Mois).
 * Champs gérés sans IA :
 *  - Titre
 *  - Date
 *  - Heure début / Heure fin
 *  - Type (cours, révision, examen, projet, langue, sport, personnel, autre)
 *  - Répétition (aucune, quotidienne 7j, hebdomadaire 4 sem, hebdomadaire 8 sem)
 *  - Verrouillé / Flexible
 * 
 * 0 style inline (charte CSS univers-planning.css).
 */
export class EventModal {
    constructor(app) {
        this.app = app;
        this.modalId = 'reusable-event-modal';
    }

    ensureModal() {
        if (typeof document === 'undefined') return null;
        let modal = document.getElementById(this.modalId);
        if (modal) return modal;

        modal = document.createElement('div');
        modal.id = this.modalId;
        modal.className = 'event-modal-backdrop';
        modal.hidden = true;
        modal.style.display = 'none';
        modal.innerHTML = `
        <div class="event-modal-card">
            <div class="event-modal-header">
                <h3 id="event-modal-title" class="event-modal-title">Ajouter un événement</h3>
                <button type="button" id="event-modal-close-btn" class="event-modal-close-btn" aria-label="Fermer">&times;</button>
            </div>
            
            <input type="hidden" id="event-modal-id">

            <div class="event-modal-group">
                <label for="event-modal-field-title" class="event-modal-label">Titre de l'événement *</label>
                <input type="text" id="event-modal-field-title" class="event-modal-input" placeholder="Ex: Cours d'Algorithmie, Révision TD...">
            </div>

            <div class="event-modal-group">
                <label for="event-modal-field-date" class="event-modal-label">Date *</label>
                <input type="date" id="event-modal-field-date" class="event-modal-input">
            </div>

            <div class="event-modal-row">
                <div class="event-modal-col">
                    <label for="event-modal-field-start" class="event-modal-label">Heure début *</label>
                    <input type="time" id="event-modal-field-start" class="event-modal-input" value="09:00">
                </div>
                <div class="event-modal-col">
                    <label for="event-modal-field-end" class="event-modal-label">Heure fin *</label>
                    <input type="time" id="event-modal-field-end" class="event-modal-input" value="10:00">
                </div>
            </div>

            <div class="event-modal-row">
                <div class="event-modal-col">
                    <label for="event-modal-field-type" class="event-modal-label">Type d'événement</label>
                    <select id="event-modal-field-type" class="event-modal-select">
                        <option value="course">Cours / TD</option>
                        <option value="revision">Révision</option>
                        <option value="exam">Examen / Évaluation</option>
                        <option value="project">Projet</option>
                        <option value="language">Langue</option>
                        <option value="sport">Sport / Bien-être</option>
                        <option value="personal">Personnel / Vie quotidienne</option>
                        <option value="other">Autre</option>
                    </select>
                </div>
                <div class="event-modal-col">
                    <label for="event-modal-field-lock" class="event-modal-label">Statut (IA / Conflits)</label>
                    <select id="event-modal-field-lock" class="event-modal-select">
                        <option value="flexible">Flexible (ajustable)</option>
                        <option value="locked">Verrouillé (fixe)</option>
                    </select>
                </div>
            </div>

            <div class="event-modal-group">
                <label for="event-modal-field-repetition" class="event-modal-label">Répétition</label>
                <select id="event-modal-field-repetition" class="event-modal-select">
                    <option value="none">Aucune répétition</option>
                    <option value="daily">Chaque jour (7 jours)</option>
                    <option value="weekly">Chaque semaine (4 semaines)</option>
                    <option value="weekly_8">Chaque semaine (8 semaines)</option>
                </select>
            </div>

            <div class="event-modal-footer">
                <button type="button" id="event-modal-delete-btn" class="event-modal-btn-del" hidden>
                    Supprimer
                </button>
                <div class="event-modal-actions-right">
                    <button type="button" id="event-modal-cancel-btn" class="event-modal-btn-cancel">Annuler</button>
                    <button type="button" id="event-modal-save-btn" class="event-modal-btn-save">Enregistrer</button>
                </div>
            </div>
        </div>
        `;

        if (document.body) {
            document.body.appendChild(modal);
        }

        const closeBtn = modal.querySelector('#event-modal-close-btn');
        if (closeBtn) closeBtn.addEventListener('click', () => this.close());
        const cancelBtn = modal.querySelector('#event-modal-cancel-btn');
        if (cancelBtn) cancelBtn.addEventListener('click', () => this.close());
        modal.addEventListener('click', (e) => {
            if (e.target === modal) this.close();
        });

        const saveBtn = modal.querySelector('#event-modal-save-btn');
        if (saveBtn) {
            saveBtn.addEventListener('click', async () => {
                Motion.buttonTap(saveBtn);
                await this.handleSave();
            });
        }

        const delBtn = modal.querySelector('#event-modal-delete-btn');
        if (delBtn) {
            delBtn.addEventListener('click', async () => {
                const id = document.getElementById('event-modal-id')?.value;
                if (!id) return;
                if (typeof window !== 'undefined' && window.confirm && !window.confirm("Supprimer cet événement ?")) {
                    return;
                }
                await this.app.deleteCalendarEvent(id);
                this.close();
            });
        }

        return modal;
    }

    open(data = {}) {
        const modal = this.ensureModal();
        if (!modal) return;

        const isEdit = !!data.id;
        const idInput = document.getElementById('event-modal-id');
        if (idInput) idInput.value = data.id || '';

        const titleHeader = document.getElementById('event-modal-title');
        if (titleHeader) titleHeader.textContent = isEdit ? "Modifier l'événement" : "Ajouter un événement";

        const titleField = document.getElementById('event-modal-field-title');
        if (titleField) titleField.value = data.title || '';

        const dateField = document.getElementById('event-modal-field-date');
        if (dateField) {
            dateField.value = data.date || (this.app?.getPedagogicalDate ? this.app.getPedagogicalDate() : new Date().toLocaleDateString('fr-CA'));
        }

        const startField = document.getElementById('event-modal-field-start');
        if (startField) startField.value = data.startTime || '09:00';

        const endField = document.getElementById('event-modal-field-end');
        if (endField) endField.value = data.endTime || '10:00';

        const typeField = document.getElementById('event-modal-field-type');
        if (typeField) typeField.value = data.type || 'revision';

        const lockField = document.getElementById('event-modal-field-lock');
        if (lockField) lockField.value = data.lockStatus || 'flexible';

        const repField = document.getElementById('event-modal-field-repetition');
        if (repField) repField.value = data.repetition || 'none';

        const delBtn = document.getElementById('event-modal-delete-btn');
        if (delBtn) {
            delBtn.hidden = !isEdit;
            delBtn.style.display = isEdit ? 'inline-block' : 'none';
        }

        modal.hidden = false;
        modal.style.display = 'flex';
        Motion.modalOpen(modal);
    }

    close() {
        const modal = document.getElementById(this.modalId);
        if (modal) {
            modal.hidden = true;
            modal.style.display = 'none';
        }
    }

    async handleSave() {
        const id = document.getElementById('event-modal-id')?.value;
        const title = document.getElementById('event-modal-field-title')?.value.trim();
        const date = document.getElementById('event-modal-field-date')?.value;
        const startTime = document.getElementById('event-modal-field-start')?.value;
        const endTime = document.getElementById('event-modal-field-end')?.value;
        const type = document.getElementById('event-modal-field-type')?.value;
        const lockStatus = document.getElementById('event-modal-field-lock')?.value;
        const repetition = document.getElementById('event-modal-field-repetition')?.value;

        if (!title) {
            if (typeof alert !== 'undefined') alert("Veuillez saisir un titre");
            return;
        }
        if (!date) {
            if (typeof alert !== 'undefined') alert("Veuillez choisir une date");
            return;
        }
        if (!startTime || !endTime) {
            if (typeof alert !== 'undefined') alert("Veuillez renseigner les heures de début et de fin");
            return;
        }

        const eventData = {
            id: id || undefined,
            title,
            date,
            startTime,
            endTime,
            type,
            lockStatus,
            repetition
        };

        await this.app.saveCalendarEvent(eventData);
        this.close();
    }
}
