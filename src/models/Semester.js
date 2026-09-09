export class Semester {
    constructor(id, yearId, name, status = 'active', metadata = {}) {
        this.id = id;
        this.yearId = yearId;
        this.name = name;
        this.status = status; // active, completed, upcoming
        this.metadata = metadata; // Ex: { officialCectTotal: 30, calculatedDetailedCectTotal: 26, cectDiscrepancy: 4, cectStatus: "to_confirm" }
    }
}
