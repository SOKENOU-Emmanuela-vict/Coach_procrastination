const http = require('http');
const fs = require('fs');
const path = require('path');

const mimeTypes = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpg',
    '.svg': 'image/svg+xml',
    '.webmanifest': 'application/manifest+json',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2'
};

const ROOT_DIR = path.resolve(__dirname);

const SECURITY_HEADERS = {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data: https: blob:; connect-src 'self' https://generativelanguage.googleapis.com https://aiplatform.googleapis.com; frame-ancestors 'none';"
};

const server = http.createServer((request, response) => {
    // 1. Extraction et décodage du chemin sans query string
    const rawUrl = request.url || '/';
    const rawPath = rawUrl.split('?')[0];
    let decodedPath = '';
    try {
        decodedPath = decodeURIComponent(rawPath);
    } catch (e) {
        response.writeHead(400, { 'Content-Type': 'text/plain', ...SECURITY_HEADERS });
        response.end('400 Bad Request: URL malformée', 'utf-8');
        return;
    }

    // 2. Détection précoce de Path Traversal avec '..'
    if (rawPath.includes('..') || decodedPath.includes('..')) {
        response.writeHead(403, { 'Content-Type': 'text/plain', ...SECURITY_HEADERS });
        response.end('403 Forbidden: Accès non autorisé', 'utf-8');
        return;
    }

    if (decodedPath === '/' || decodedPath === '') {
        decodedPath = '/index.html';
    }

    // 3. Résolution sécurisée du chemin canonique
    const safePath = path.resolve(ROOT_DIR, '.' + decodedPath);

    // 4. Prévention stricte de sortie du dossier racine
    const rel = path.relative(ROOT_DIR, safePath);
    if (rel.startsWith('..') || path.isAbsolute(rel) || !safePath.startsWith(ROOT_DIR)) {
        response.writeHead(403, { 'Content-Type': 'text/plain', ...SECURITY_HEADERS });
        response.end('403 Forbidden: Accès non autorisé', 'utf-8');
        return;
    }

    // 5. Blocage strict des dossiers et fichiers sensibles ou protégés
    const relNorm = rel.replace(/\\/g, '/').toLowerCase();
    const isForbidden =
        relNorm === '.git' || relNorm.startsWith('.git/') ||
        relNorm === 'node_modules' || relNorm.startsWith('node_modules/') ||
        relNorm === 'tests' || relNorm.startsWith('tests/') ||
        relNorm === 'scripts' || relNorm.startsWith('scripts/') ||
        relNorm === 'docs' || relNorm.startsWith('docs/') ||
        relNorm === 'server.js' ||
        relNorm === 'agents.md' ||
        (relNorm.startsWith('test_') && relNorm.endsWith('.mjs')) ||
        (relNorm.startsWith('package') && relNorm.endsWith('.json')) ||
        relNorm.split('/').some(segment => segment.startsWith('.'));

    if (isForbidden) {
        response.writeHead(403, { 'Content-Type': 'text/plain', ...SECURITY_HEADERS });
        response.end('403 Forbidden: Accès non autorisé', 'utf-8');
        return;
    }

    const extname = String(path.extname(safePath)).toLowerCase();
    const contentType = mimeTypes[extname] || 'application/octet-stream';

    fs.readFile(safePath, (error, content) => {
        if (error) {
            if (error.code === 'ENOENT' || error.code === 'EISDIR') {
                response.writeHead(404, { 'Content-Type': 'text/plain', ...SECURITY_HEADERS });
                response.end('404 Not Found', 'utf-8');
            } else {
                response.writeHead(500, { 'Content-Type': 'text/plain', ...SECURITY_HEADERS });
                response.end('500 Internal Server Error: ' + error.code, 'utf-8');
            }
        } else {
            response.writeHead(200, {
                'Content-Type': contentType,
                'Cache-Control': 'no-cache',
                ...SECURITY_HEADERS
            });
            response.end(content, 'utf-8');
        }
    });
});

const PORT = process.env.PORT !== undefined ? parseInt(process.env.PORT, 10) : 8125;
server.listen(PORT, '127.0.0.1', () => {
    const actualPort = server.address().port;
    console.log(`Server running at http://127.0.0.1:${actualPort}/`);
});

module.exports = server;
