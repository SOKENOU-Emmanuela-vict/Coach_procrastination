import http from 'http';
import assert from 'assert';

console.log("=== TEST DE SÉCURITÉ : SERVEUR HTTP (Path Traversal & En-têtes CSP) ===");

function makeRequest(path) {
    return new Promise((resolve, reject) => {
        const req = http.request({
            hostname: '127.0.0.1',
            port: 8125,
            path: path,
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
    // 1. Requête légitime sur index.html
    const resLegit = await makeRequest('/index.html');
    assert.strictEqual(resLegit.statusCode, 200, "1a. Fichier légitime servi avec code 200");
    assert.strictEqual(resLegit.headers['x-content-type-options'], 'nosniff', "1b. En-tête X-Content-Type-Options: nosniff présent");
    assert.strictEqual(resLegit.headers['x-frame-options'], 'DENY', "1c. En-tête X-Frame-Options: DENY présent");
    assert(resLegit.headers['content-security-policy']?.includes("default-src 'self'"), "1d. Content-Security-Policy présent");
    assert(resLegit.headers['referrer-policy']?.includes("strict-origin"), "1e. Referrer-Policy présent");
    console.log("✅ PASS: 1. Requête légitime et en-têtes de sécurité conformes");

    // 2. Tentative de Directory / Path Traversal
    const resTraversal1 = await makeRequest('/../server.js');
    assert.strictEqual(resTraversal1.statusCode, 403, "2a. Path traversal classique /../ bloqué avec 403");
    assert(resTraversal1.headers['x-content-type-options'] === 'nosniff', "2b. En-têtes de sécurité présents même sur 403");

    const resTraversal2 = await makeRequest('/..%2f..%2fWindows%2fwin.ini');
    assert.strictEqual(resTraversal2.statusCode, 403, "2c. Path traversal encodé URL bloqué avec 403");
    console.log("✅ PASS: 2. Attaques par Directory / Path Traversal neutralisées");

    // 3. Fichier inexistant (404 avec headers)
    const res404 = await makeRequest('/fichier_qui_n_existe_pas_123.xyz');
    assert.strictEqual(res404.statusCode, 404, "3a. Code 404 pour ressource inexistante");
    assert(res404.headers['x-frame-options'] === 'DENY', "3b. Headers de sécurité présents sur 404");
    console.log("✅ PASS: 3. Erreurs 404 sécurisées");

    // 4. URL malformée
    const resMalformed = await makeRequest('/%c0%af');
    assert.strictEqual(resMalformed.statusCode, 400, "4a. Requête malformée interceptée avec 400");
    console.log("✅ PASS: 4. URL malformées protégées");

    console.log("\n🎉 TOUS LES TESTS DE SÉCURITÉ SERVEUR ONT RÉUSSI !");
}

run().catch(err => {
    console.error("❌ ÉCHEC DES TESTS SÉCURITÉ SERVEUR:", err);
    process.exit(1);
});
