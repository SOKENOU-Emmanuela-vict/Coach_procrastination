import fs from 'fs';

global.document = {
    getElementById: (id) => ({ innerHTML: '', querySelectorAll: () => [], addEventListener: () => {} }),
    querySelector: () => ({ classList: { add: () => {}, remove: () => {} }, addEventListener: () => {} }),
    querySelectorAll: () => [],
    createElement: () => ({}),
    body: { classList: { add: () => {}, remove: () => {} }, className: '' }
};
global.window = { addEventListener: () => {}, indexedDB: { databases: async () => [] }, location: { href: '' } };
global.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
global.sessionStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
global.navigator = { serviceWorker: { register: async () => {} } };

import('./src/core/Bootstrap.js').then(async (BootstrapModule) => {
    try {
        console.log('Initializing Bootstrap...');
        await BootstrapModule.Bootstrap.init();
        console.log('Bootstrap init successful!');
    } catch (e) {
        console.error('Error during init:', e);
    }
}).catch(e => {
    console.error('Import error:', e);
});
