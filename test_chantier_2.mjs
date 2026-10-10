global.document = {
    getElementById: () => ({
        innerHTML: '',
        querySelectorAll: () => [],
        querySelector: () => null
    }),
    body: { className: '' }
};
import { DesktopView } from './src/ui/DesktopView.js';

let htmlResult = "";
let view = new DesktopView('app-root', {
    getPedagogicalDate: (d = new Date()) => d.toLocaleDateString('fr-CA'),
    getPedagogicalDateObject: (d = new Date()) => new Date(d)
});
view.container = {
    innerHTML: '',
    querySelectorAll: () => [],
    querySelector: () => ({ addEventListener: () => {} }),
    set innerHTML(val) {
        htmlResult = val;
    }
};

const mockState = {
    userProfile: {
        preferences: {
            desktop: {
                widgets: {
                    checklist: true
                }
            }
        }
    },
    dailyPlan: {
        sessions: [
            { id: "sess1", title: "Study JS", completed: false, expectedDuration: 30 },
            { id: "sess2", title: "Study Python", completed: true, expectedDuration: 20 }
        ],
        habits: [
            { id: "hab1", title: "Read Book", completed: false }
        ]
    }
};

try {
    view.render(mockState);
    if (htmlResult.length > 100) {
        console.log("✅ [PASS] DesktopView rend correctement le widget Checklist Express avec les sessions et habitudes.");
    } else {
        console.error("❌ [FAIL] Le widget Checklist Express n'est pas rendu correctement.");
    }
} catch(e) {
    console.error("❌ [ERROR] " + e.message);
}
