export class AvailabilityWindow {
    constructor({ id, date, startTime, endTime, source = 'user_defined' }) {
        this.id = id;
        this.date = date; // Format: 'YYYY-MM-DD'
        this.startTime = startTime; // Format: 'HH:MM'
        this.endTime = endTime; // Format: 'HH:MM'
        this.source = source; // e.g. 'school_free', 'user_defined', 'system'
    }

    get duration() {
        if (!this.startTime || !this.endTime) return 0;
        const [startH, startM] = this.startTime.split(':').map(Number);
        const [endH, endM] = this.endTime.split(':').map(Number);
        return (endH * 60 + endM) - (startH * 60 + startM);
    }
}
