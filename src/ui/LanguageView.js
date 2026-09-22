export class LanguageView {
    constructor(containerId, app) {
        this.container = document.getElementById(containerId);
        this.app = app;
    }
    
    render(state) {
        document.body.className = 'theme-warm';
        this.container.innerHTML = `
            <div style="padding:40px; text-align:center;">
                <h2>Languages View</h2>
                <p>À venir (Thème Warm appliqué par défaut)</p>
            </div>
        `;
    }
}
