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
    'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; font-src 'self' https://cdn.jsdelivr.net; img-src 'self' data: https: blob:; connect-src 'self' https://generativelanguage.googleapis.com https://aiplatform.googleapis.com; frame-ancestors 'none';"
};

const server = http.createServer((request, response) => {
    // 1. Extraction et décodage du chemin sans query string
    let rawPath = (request.url || '/').split('?')[0];
    let decodedPath = '';
    try {
        decodedPath = decodeURIComponent(rawPath);
    } catch (e) {
        response.writeHead(400, { 'Content-Type': 'text/plain', ...SECURITY_HEADERS });
        response.end('400 Bad Request: URL malformée', 'utf-8');
        return;
    }

    if (decodedPath === '/' || decodedPath === '') {
        decodedPath = '/index.html';
    }

    // 2. Résolution sécurisée du chemin canonique
    const safePath = path.resolve(ROOT_DIR, '.' + decodedPath);

    // 3. Prévention stricte du Directory Traversal (Path Traversal)
    if (!safePath.startsWith(ROOT_DIR)) {
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

server.listen(8125, '127.0.0.1', () => {
    console.log('Server running at http://127.0.0.1:8125/');
});
