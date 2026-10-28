/**
 * test_correctif_y1_server_key_security.mjs
 * Test dédié pour le Correctif Y1 - Point 4 :
 * - Validation stricte du Host sur /api/config/key (127.0.0.1 ou localhost uniquement)
 * - Validation stricte de l'Origin sur /api/config/key si présent (origine locale uniquement)
 * - Refus avec 403 Forbidden pour tout Host ou Origin non local
 */

import http from 'http';
import { spawn } from 'child_process';

let passed = 0;
let total = 0;

function assert(condition, message) {
    total++;
    if (!condition) {
        console.error(`❌ FAIL: ${message}`);
        throw new Error(message);
    }
    passed++;
    console.log(`✅ PASS: ${message}`);
}

console.log("=== TESTS CORRECTIF Y1 - POINT 4 : SÉCURISATION /api/config/key (Host & Origin) ===");

function makeCustomRequest(port, path, headers = {}) {
    return new Promise((resolve, reject) => {
        const req = http.request({
            hostname: '127.0.0.1',
            port: port,
            path: path,
            method: 'GET',
            headers: headers
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
    // 1. Démarrer une instance autonome de server.js sur un port libre
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
        setTimeout(() => reject(new Error("Timeout démarrage serveur")), 5000)
    );

    try {
        await Promise.race([portPromise, timeoutPromise]);
        console.log(`Serveur de test démarré sur port ${serverPort}`);

        // A. Host légitime 127.0.0.1
        const resHost127 = await makeCustomRequest(serverPort, '/api/config/key', {
            'Host': `127.0.0.1:${serverPort}`
        });
        assert(resHost127.statusCode === 200, "1a. Host 127.0.0.1 autorisé (200 OK)");

        // B. Host légitime localhost
        const resHostLocalhost = await makeCustomRequest(serverPort, '/api/config/key', {
            'Host': `localhost:${serverPort}`
        });
        assert(resHostLocalhost.statusCode === 200, "1b. Host localhost autorisé (200 OK)");

        // C. Host hostile (attaquant externe)
        const resHostEvil = await makeCustomRequest(serverPort, '/api/config/key', {
            'Host': `evil-attacker.com`
        });
        assert(resHostEvil.statusCode === 403, "2a. Host externe evil-attacker.com bloqué (403 Forbidden)");

        // D. Host IP réseau local / externe
        const resHostLan = await makeCustomRequest(serverPort, '/api/config/key', {
            'Host': `192.168.1.100:${serverPort}`
        });
        assert(resHostLan.statusCode === 403, "2b. Host non localhost (192.168.1.100) bloqué (403 Forbidden)");

        // E. Origin légitime 127.0.0.1
        const resOrigin127 = await makeCustomRequest(serverPort, '/api/config/key', {
            'Host': `127.0.0.1:${serverPort}`,
            'Origin': `http://127.0.0.1:${serverPort}`
        });
        assert(resOrigin127.statusCode === 200, "3a. Origin http://127.0.0.1 autorisée (200 OK)");

        // F. Origin légitime localhost
        const resOriginLocalhost = await makeCustomRequest(serverPort, '/api/config/key', {
            'Host': `localhost:${serverPort}`,
            'Origin': `http://localhost:${serverPort}`
        });
        assert(resOriginLocalhost.statusCode === 200, "3b. Origin http://localhost autorisée (200 OK)");

        // G. Origin hostile externe (attaque CSRF/DNS Rebinding)
        const resOriginEvil = await makeCustomRequest(serverPort, '/api/config/key', {
            'Host': `127.0.0.1:${serverPort}`,
            'Origin': `https://malicious-site.com`
        });
        assert(resOriginEvil.statusCode === 403, "4a. Origin externe https://malicious-site.com bloquée (403 Forbidden)");

        // H. Origin 'null' (iframe bac à sable / sandbox)
        const resOriginNull = await makeCustomRequest(serverPort, '/api/config/key', {
            'Host': `127.0.0.1:${serverPort}`,
            'Origin': `null`
        });
        assert(resOriginNull.statusCode === 403, "4b. Origin 'null' bloquée (403 Forbidden)");

        // I. Origin malformée
        const resOriginBad = await makeCustomRequest(serverPort, '/api/config/key', {
            'Host': `127.0.0.1:${serverPort}`,
            'Origin': `javascript:void(0)`
        });
        assert(resOriginBad.statusCode === 403, "4c. Origin invalide bloquée (403 Forbidden)");

        console.log(`\n🎉 BILAN POINT 4 : ${passed}/${total} TESTS PASSÉS !`);
    } finally {
        serverProcess.kill('SIGTERM');
    }
}

run().catch(err => {
    console.error("❌ ERREUR :", err);
    process.exit(1);
});
