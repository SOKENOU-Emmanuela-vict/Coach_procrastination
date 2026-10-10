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
    '.ico': 'image/x-icon'
};

const server = http.createServer((request, response) => {
    let filePath = '.' + request.url;
    if (filePath == './') {
        filePath = './index.html';
    }

    // enlever la query string
    filePath = filePath.split('?')[0];

    const extname = String(path.extname(filePath)).toLowerCase();
    const contentType = mimeTypes[extname] || 'application/octet-stream';

    fs.readFile(filePath, (error, content) => {
        if (error) {
            if(error.code == 'ENOENT') {
                response.writeHead(404, { 'Content-Type': 'text/plain' });
                response.end('404 Not Found', 'utf-8');
            } else {
                response.writeHead(500);
                response.end('Sorry, check with the site admin for error: '+error.code+' ..\n');
            }
        } else {
            // no-cache : le navigateur revalide toujours les modules (pas de mélange d'anciennes et de nouvelles versions)
            response.writeHead(200, { 'Content-Type': contentType, 'Cache-Control': 'no-cache' });
            response.end(content, 'utf-8');
        }
    });
});

server.listen(8125, '127.0.0.1', () => {
    console.log('Server running at http://127.0.0.1:8125/');
});
