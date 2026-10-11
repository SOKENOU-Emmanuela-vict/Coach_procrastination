import { parseLocalDate } from '../utils/dateUtils.js';

/**
 * EventModal
 * Formulaire réutilisable d'ajout et d'édition d'événements pour PlanningView et CalendarView.
 * Champs gérés sans IA :
 *  - Titre
 *  - Date
 *  - Heure début / Heure fin
 *  - Type (cours, révision, examen, projet, langue, sport, personnel, autre)
 *  - Répétition (aucune, quotidienne 7j, hebdomadaire 4 sem, hebdomadaire 8 sem)
 *  - Verrouillé / Flexible
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
        modal.style.cssText = 'display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.7); z-index:99999; justify-content:center; align-items:center; font-family:"Inter", sans-serif;';
        modal.innerHTML = `
        <div style="background:#152b36; border:1px solid #00f2fe; border-radius:16px; padding:25px; width:440px; max-width:90%; box-shadow:0 20px 40px rgba(0,0,0,0.6); color:#e0e0e0; box-sizing:border-box;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
                <h3 id="event-modal-title" style="color:#00f2fe; margin:0; font-size:18px; font-weight:700;">Ajouter un événement</h3>
                <button type="button" id="event-modal-close-btn" style="background:transparent; border:none; color:#88a7b7; font-size:20px; cursor:pointer;">&times;</button>
            </div>
            
            <input type="hidden" id="event-modal-id">

            <div style="margin-bottom:14px;">
                <label style="color:#88a7b7; font-size:12px; display:block; margin-bottom:5px;">Titre de l'événement *</label>
                <input type="text" id="event-modal-field-title" placeholder="Ex: Cours d'Algorithmie, Révision TD..." style="width:100%; padding:9px 12px; border-radius:6px; background:#0f2027; color:#fff; border:1px solid #2a5268; box-sizing:border-box; font-size:13px;">
            </div>

            <div style="margin-bottom:14px;">
                <label style="color:#88a7b7; font-size:12px; display:block; margin-bottom:5px;">Date *</label>
                <input type="date" id="event-modal-field-date" style="width:100%; padding:9px 12px; border-radius:6px; background:#0f2027; color:#fff; border:1px solid #2a5268; box-sizing:border-box; font-size:13px;">
            </div>

            <div style="display:flex; gap:12px; margin-bottom:14px;">
                <div style="flex:1;">
                    <label style="color:#88a7b7; font-size:12px; display:block; margin-bottom:5px;">Heure début *</label>
                    <input type="time" id="event-modal-field-start" value="09:00" style="width:100%; padding:9px 12px; border-radius:6px; background:#0f2027; color:#fff; border:1px solid #2a5268; box-sizing:border-box; font-size:13px;">
                </div>
                <div style="flex:1;">
                    <label style="color:#88a7b7; font-size:12px; display:block; margin-bottom:5px;">Heure fin *</label>
                    <input type="time" id="event-modal-field-end" value="10:00" style="width:100%; padding:9px 12px; border-radius:6px; background:#0f2027; color:#fff; border:1px solid #2a5268; box-sizing:border-box; font-size:13px;">
                </div>
            </div>

            <div style="display:flex; gap:12px; margin-bottom:14px;">
                <div style="flex:1;">
                    <label style="color:#88a7b7; font-size:12px; display:block; margin-bottom:5px;">Type d'événement</label>
                    <select id="event-modal-field-type" style="width:100%; padding:9px 12px; border-radius:6px; background:#0f2027; color:#fff; border:1px solid #2a5268; box-sizing:border-box; font-size:13px;">
                        <option value="course">Cours / TD</option>
                        <option value="revision">Révision</option>
                        <option value="exam">Examen / Évaluation</option>
                        <option value="project">Projet</option>
                        <option value="language">Langue</option>
                        <option value="sport">Sport / Bien-être</option>
                        <option value="personal">Personnel / Life</option>
                        <option value="other">Autre</option>
                    </select>
                </div>
                <div style="flex:1;">
                    <label style="color:#88a7b7; font-size:12px; display:block; margin-bottom:5px;">Statut (IA / Conflits)</label>
                    <select id="event-modal-field-lock" style="width:100%; padding:9px 12px; border-radius:6px; background:#0f2027; color:#fff; border:1px solid #2a5268; box-sizing:border-box; font-size:13px;">
                        <option value="flexible">Flexible (ajustable)</option>
                        <option value="locked">Verrouillé (fixe)</option>
                    </select>
                </div>
            </div>

            <div style="margin-bottom:22px;">
                <label style="color:#88a7b7; font-size:12px; display:block; margin-bottom:5px;">Répétition</label>
                <select id="event-modal-field-repetition" style="width:100%; padding:9px 12px; border-radius:6px; background:#0f2027; color:#fff; border:1px solid #2a5268; box-sizing:border-box; font-size:13px;">
                    <option value="none">Aucune répétition</option>
                    <option value="daily">Chaque jour (7 jours)</option>
                    <option value="weekly">Chaque semaine (4 semaines)</option>
                    <option value="weekly_8">Chaque semaine (8 semaines)</option>
                </select>
            </div>

            <div style="display:flex; justify-content:space-between; align-items:center;">
                <button type="button" id="event-modal-delete-btn" style="background:#ef4444; color:white; border:none; padding:9px 16px; border-radius:6px; cursor:pointer; font-size:13px; font-weight:600; display:none;">
                    Supprimer
                </button>
                <div style="display:flex; gap:10px; margin-left:auto;">
                    <button type="button" id="event-modal-cancel-btn" style="background:transparent; color:#88a7b7; border:1px solid #2a5268; padding:9px 16px; border-radius:6px; cursor:pointer; font-size:13px;">Annuler</button>
                    <button type="button" id="event-modal-save-btn" style="background:#00f2fe; color:#0f2027; border:none; padding:9px 18px; border-radius:6px; cursor:pointer; font-weight:bold; font-size:13px;">Enregistrer</button>
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
        if (delBtn) delBtn.style.display = isEdit ? 'inline-block' : 'none';

        modal.style.display = 'flex';
    }

    close() {
        const modal = document.getElementById(this.modalId);
        if (modal) modal.style.display = 'none';
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
