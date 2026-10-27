import http from 'http';
import assert from 'assert';
import { spawn } from 'child_process';
import path from 'path';

console.log("=== TEST DE SÉCURITÉ : SERVEUR HTTP AUTONOME (Blocages & CSP locale) ===");

function makeRequest(port, requestPath) {
    return new Promise((resolve, reject) => {
        const req = http.request({
            hostname: '127.0.0.1',
            port: port,
            path: requestPath,
            method: 'GET'
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                resolve({
                    statusCode: res.statusCode,
                    headers: res.headers,
                    body: data
                });
            });
        });
        req.on('error', reject);
        req.end();
    });
}

async function run() {
    // 1. Démarrage autonome du serveur sur un port dynamique libre (PORT=0)
    const serverProcess = spawn('node', ['server.js'], {
        cwd: process.cwd(),
        env: { ...process.env, PORT: '0' },
        stdio: ['pipe', 'pipe', 'pipe']
    });

    let serverPort = null;
    const portPromise = new Promise((resolve, reject) => {
        serverProcess.stdout.on('data', (data) => {
            const str = data.toString();
            const match = str.match(/http:\/\/127\.0\.0\.1:(\d+)\//);
            if (match) {
                serverPort = parseInt(match[1], 10);
                resolve(serverPort);
            }
        });
        serverProcess.stderr.on('data', (err) => {
            console.error('Server stderr:', err.toString());
        });
        serverProcess.on('error', reject);
        serverProcess.on('exit', (code) => {
            if (!serverPort) reject(new Error(`Server exited prematurely with code ${code}`));
        });
    });

    const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Timeout en attendant le démarrage du serveur")), 5000)
    );

    try {
        await Promise.race([portPromise, timeoutPromise]);
        console.log(`Serveur démarré automatiquement sur le port dynamique : ${serverPort}`);

        // 2. Requête légitime sur index.html + vérification CSP locale sans jsdelivr
        const resLegit = await makeRequest(serverPort, '/index.html');
        assert.strictEqual(resLegit.statusCode, 200, "1a. Fichier légitime servi avec code 200");
        assert.strictEqual(resLegit.headers['x-content-type-options'], 'nosniff', "1b. En-tête X-Content-Type-Options: nosniff");
        assert.strictEqual(resLegit.headers['x-frame-options'], 'DENY', "1c. En-tête X-Frame-Options: DENY");
        assert(resLegit.headers['content-security-policy']?.includes("default-src 'self'"), "1d. CSP présent");
        assert(!resLegit.headers['content-security-policy']?.includes("cdn.jsdelivr.net"), "1e. CSP assainie : https://cdn.jsdelivr.net retiré");
        assert(resLegit.headers['referrer-policy']?.includes("strict-origin"), "1f. Referrer-Policy présent");
        console.log("✅ PASS: 1. Fichier légitime et CSP locale (zéro CDN)");

        // 3. Blocage strict des dossiers et fichiers sensibles avec code 403
        // 3.1 /.git et sous-dossiers
        const resGit = await makeRequest(serverPort, '/.git/config');
        assert.strictEqual(resGit.statusCode, 403, "2a. Accès à /.git/config bloqué avec 403");

        const resGitDir = await makeRequest(serverPort, '/.git');
        assert.strictEqual(resGitDir.statusCode, 403, "2b. Accès à /.git bloqué avec 403");

        // 3.2 /node_modules
        const resNodeModules = await makeRequest(serverPort, '/node_modules');
        assert.strictEqual(resNodeModules.statusCode, 403, "2c. Accès à /node_modules bloqué avec 403");

        // 3.3 /server.js
        const resServerJs = await makeRequest(serverPort, '/server.js');
        assert.strictEqual(resServerJs.statusCode, 403, "2d. Accès à /server.js bloqué avec 403");

        // 3.4 /test_*.mjs
        const resTestFile = await makeRequest(serverPort, '/test_calendar.mjs');
        assert.strictEqual(resTestFile.statusCode, 403, "2e. Accès à /test_*.mjs bloqué avec 403");

        // 3.5 /tests et /scripts
        const resTests = await makeRequest(serverPort, '/tests/fixtures/cours_poo.docx');
        assert.strictEqual(resTests.statusCode, 403, "2f. Accès à /tests/... bloqué avec 403");

        const resScripts = await makeRequest(serverPort, '/scripts/update_sw_assets.mjs');
        assert.strictEqual(resScripts.statusCode, 403, "2g. Accès à /scripts/... bloqué avec 403");

        // 3.6 /package*.json et /AGENTS.md
        const resPkg = await makeRequest(serverPort, '/package.json');
        assert.strictEqual(resPkg.statusCode, 403, "2h. Accès à /package.json bloqué avec 403");

        const resAgents = await makeRequest(serverPort, '/AGENTS.md');
        assert.strictEqual(resAgents.statusCode, 403, "2i. Accès à /AGENTS.md bloqué avec 403");

        console.log("✅ PASS: 2. Blocage des dossiers/fichiers système (.git, node_modules, server.js, tests, scripts, package.json, AGENTS.md)");

        // 4. Tentatives de Path Traversal
        const resTraversal1 = await makeRequest(serverPort, '/../server.js');
        assert.strictEqual(resTraversal1.statusCode, 403, "3a. Path traversal classique /../ bloqué avec 403");

        const resTraversal2 = await makeRequest(serverPort, '/..%2f..%2fWindows%2fwin.ini');
        assert.strictEqual(resTraversal2.statusCode, 403, "3b. Path traversal encodé URL bloqué avec 403");

        console.log("✅ PASS: 3. Path Traversal bloqué avec 403");

        // 5. Erreurs 404 sécurisées
        const res404 = await makeRequest(serverPort, '/fichier_qui_n_existe_pas_123.xyz');
        assert.strictEqual(res404.statusCode, 404, "4a. Code 404 pour ressource inexistante");
        assert(res404.headers['x-frame-options'] === 'DENY', "4b. Headers de sécurité présents sur 404");
        console.log("✅ PASS: 4. Erreurs 404 sécurisées");

        // 6. URL malformée
        const resMalformed = await makeRequest(serverPort, '/%c0%af');
        assert.strictEqual(resMalformed.statusCode, 400, "5a. Requête malformée interceptée avec 400");
        console.log("✅ PASS: 5. URL malformées protégées");

        console.log("\n🎉 TOUS LES TESTS DE SÉCURITÉ SERVEUR ONT RÉUSSI AUTOMATIQUEMENT !");
    } finally {
        // Arrêt propre du serveur à la fin du test
        serverProcess.kill('SIGTERM');
        serverProcess.kill();
        console.log("Serveur HTTP arrêté proprement.");
    }
}

run().catch(err => {
    console.error("❌ ÉCHEC DES TESTS SÉCURITÉ SERVEUR:", err);
    process.exit(1);
});
