// Test du support du fichier local api_key.txt et de la configuration de clé
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import http from 'http';
import { spawn, execSync } from 'child_process';
import { App } from './src/core/App.js';

console.log("=== TEST DU SUPPORT DU FICHIER LOCAL api_key.txt ===");

const TEST_KEY = 'AQ.LOCAL_FILE_TEST_TOKEN_12345';
const ROOT_DIR = process.cwd();
const keyFilePath = path.join(ROOT_DIR, 'api_key.txt');

function makeRequest(port, reqPath) {
    return new Promise((resolve, reject) => {
        const req = http.request({
            hostname: '127.0.0.1',
            port,
            path: reqPath,
            method: 'GET'
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve({ statusCode: res.statusCode, body: data, headers: res.headers }));
        });
        req.on('error', reject);
        req.end();
    });
}

class MockStorage {
    constructor() { this.store = {}; }
    async loadData(k) { return this.store[k] || null; }
    async saveData(k, v) { this.store[k] = v; }
}

async function run() {
    // 1. Vérification que api_key.txt et .env sont dans .gitignore
    const gitignore = fs.readFileSync(path.join(ROOT_DIR, '.gitignore'), 'utf8');
    assert(gitignore.includes('api_key.txt'), '1. api_key.txt est présent dans .gitignore');
    assert(gitignore.includes('.env'), '2. .env est présent dans .gitignore');
    console.log('✅ PASS: 1. .gitignore protège api_key.txt et .env');

    // Sauvegarde de l'état préalable éventuel de api_key.txt
    const previousContent = fs.existsSync(keyFilePath) ? fs.readFileSync(keyFilePath, 'utf8') : null;

    // 2. Création temporaire de api_key.txt pour le test
    try {
        fs.writeFileSync(keyFilePath, TEST_KEY + '\n', 'utf8');

        // Vérification avec git status que le fichier n'est pas suivi
        const status = execSync('git status --porcelain', { encoding: 'utf8' });
        assert(!status.includes('api_key.txt'), '3. git status ignore bien api_key.txt');
        console.log('✅ PASS: 2. api_key.txt est ignoré par git (aucun risque de fuite)');

        // 3. Démarrage du serveur autonome
        const serverProcess = spawn('node', ['server.js'], {
            cwd: ROOT_DIR,
            env: { ...process.env, PORT: '0' },
            stdio: ['pipe', 'pipe', 'pipe']
        });

        let serverPort = null;
        await new Promise((resolve, reject) => {
            const to = setTimeout(() => reject(new Error('Timeout serveur')), 5000);
            serverProcess.stdout.on('data', (d) => {
                const m = d.toString().match(/http:\/\/127\.0\.0\.1:(\d+)\//);
                if (m) {
                    serverPort = parseInt(m[1], 10);
                    clearTimeout(to);
                    resolve(serverPort);
                }
            });
            serverProcess.on('error', reject);
        });

        try {
            // 4. Test du endpoint /api/config/key
            const resConfig = await makeRequest(serverPort, '/api/config/key');
            assert.strictEqual(resConfig.statusCode, 200, '4. /api/config/key renvoie 200');
            const data = JSON.parse(resConfig.body);
            assert.strictEqual(data.apiKey, TEST_KEY, '5. /api/config/key renvoie la clé de api_key.txt');
            console.log('✅ PASS: 3. /api/config/key lit correctement api_key.txt');

            // 5. Test du blocage direct de /api_key.txt (doit renvoyer 403)
            const resDirect = await makeRequest(serverPort, '/api_key.txt');
            assert.strictEqual(resDirect.statusCode, 403, '6. Accès direct à /api_key.txt renvoie 403 Forbidden');
            console.log('✅ PASS: 4. Accès direct à /api_key.txt bloqué en 403');

            // 6. Test App.syncApiKeyFromFile()
            const store = {};
            const realWindow = global.window;
            const realDocument = global.document;
            const realFetch = global.fetch;

            try {
                global.window = {
                    localStorage: {
                        getItem: (k) => store[k] || null,
                        setItem: (k, v) => { store[k] = String(v); },
                        removeItem: (k) => { delete store[k]; }
                    }
                };
                global.document = {
                    getElementById: () => null,
                    body: { className: '', classList: { add: () => {}, remove: () => {} } },
                    querySelectorAll: () => [],
                    querySelector: () => null
                };
                global.fetch = async (url) => {
                    if (url === '/api/config/key') {
                        return { ok: true, json: async () => ({ apiKey: TEST_KEY }) };
                    }
                    return { ok: false };
                };

                const app = new App(new MockStorage(), null, null, null, null, null, null, null);
                // Pré-rempli avec une ancienne clé différente
                store.gemini_api_key = 'ancienne_cle_invalide';
                const updated = await app.syncApiKeyFromFile();

                assert.strictEqual(updated, true, '7. syncApiKeyFromFile() signale une mise à jour');
                assert.strictEqual(store.gemini_api_key, TEST_KEY, '8. syncApiKeyFromFile() a mis à jour la clé dans localStorage');
                assert.strictEqual(app.getMaskedGeminiApiKey(), '••••2345', '9. Clé masquée reflète la nouvelle clé');
                console.log('✅ PASS: 5. App.syncApiKeyFromFile() synchronise automatiquement la clé dans localStorage');
            } finally {
                global.window = realWindow;
                global.document = realDocument;
                global.fetch = realFetch;
            }

        } finally {
            serverProcess.kill('SIGTERM');
            serverProcess.kill();
        }
    } finally {
        if (previousContent !== null) {
            fs.writeFileSync(keyFilePath, previousContent, 'utf8');
        } else if (fs.existsSync(keyFilePath)) {
            fs.unlinkSync(keyFilePath);
        }
    }

    console.log("\n🎉 TOUS LES TESTS api_key.txt ONT RÉUSSI AVEC SUCCÈS !");
}

run().catch(err => {
    console.error("❌ ÉCHEC DU TEST api_key.txt:", err);
    process.exit(1);
});
