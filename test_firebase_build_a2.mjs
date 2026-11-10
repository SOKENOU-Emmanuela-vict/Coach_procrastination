import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildWww } from './scripts/build_www.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
let passed = 0;
let total = 0;

function assert(cond, msg) {
    total++;
    if (!cond) {
        console.error(`❌ FAIL: ${msg}`);
        process.exit(1);
    }
    passed++;
    console.log(`✅ PASS: ${msg}`);
}

console.log('=== TESTS A2 : BUILD WWW & CONFIGURATION FIREBASE HOSTING ===\n');

// 1. Validation de firebase.json
const fbPath = path.join(ROOT, 'firebase.json');
assert(fs.existsSync(fbPath), '1a. firebase.json existe à la racine');
const fb = JSON.parse(fs.readFileSync(fbPath, 'utf8'));
assert(fb.hosting && fb.hosting.public === 'www', '1b. hosting.public === "www"');
assert(Array.isArray(fb.hosting.rewrites) && fb.hosting.rewrites.some(r => r.source === '**' && r.destination === '/index.html'), '1c. rewrites SPA vers /index.html configuré');

// 2. En-têtes de sécurité et Cache-Control
const headers = fb.hosting.headers || [];
const globalRule = headers.find(h => h.source === '**');
assert(Boolean(globalRule), '2a. Règle d’en-têtes globale "**" présente');
const hdrMap = Object.fromEntries((globalRule.headers || []).map(h => [h.key, h.value]));
assert(hdrMap['X-Content-Type-Options'] === 'nosniff', '2b. X-Content-Type-Options: nosniff');
assert(hdrMap['X-Frame-Options'] === 'DENY', '2c. X-Frame-Options: DENY');
assert(hdrMap['Referrer-Policy'] && hdrMap['Referrer-Policy'].includes('strict-origin'), '2d. Referrer-Policy présent');
assert(hdrMap['Permissions-Policy'] && hdrMap['Permissions-Policy'].includes('camera=()'), '2e. Permissions-Policy présent');
assert(
    hdrMap['Content-Security-Policy'] &&
    hdrMap['Content-Security-Policy'].includes("default-src 'self'") &&
    hdrMap['Content-Security-Policy'].includes('generativelanguage.googleapis.com') &&
    hdrMap['Content-Security-Policy'].includes("frame-ancestors 'none'"),
    '2f. CSP équivalente à server.js présente'
);

const swCacheRule = headers.find(h => h.source === '/sw.js');
const indexCacheRule = headers.find(h => h.source === '/index.html');
assert(
    swCacheRule && swCacheRule.headers.some(h => h.key === 'Cache-Control' && h.value.includes('no-cache')),
    '2g. Cache-Control no-cache pour /sw.js'
);
assert(
    indexCacheRule && indexCacheRule.headers.some(h => h.key === 'Cache-Control' && h.value.includes('no-cache')),
    '2h. Cache-Control no-cache pour /index.html'
);

// 3. Construction propre du dossier www/ (suppression d'un éventuel résidu obsolète)
const wwwDir = path.join(ROOT, 'www');
fs.mkdirSync(wwwDir, { recursive: true });
fs.writeFileSync(path.join(wwwDir, 'stale_old_file.txt'), 'obsolete', 'utf8');

const buildRes = buildWww(ROOT, wwwDir);
assert(buildRes.files > 100, `3a. build_www copie l'application (${buildRes.files} fichiers)`);
assert(!fs.existsSync(path.join(wwwDir, 'stale_old_file.txt')), '3b. build_www nettoie proprement les anciens fichiers');

// 4. Vérification des inclusions obligatoires et des exclusions strictes
const mustExist = ['index.html', 'manifest.webmanifest', 'sw.js', 'src', 'vendor', 'assets', 'data'];
for (const entry of mustExist) {
    assert(fs.existsSync(path.join(wwwDir, entry)), `4. Présent dans www/: ${entry}`);
}

const forbidden = [
    'tests', 'scripts', 'docs', 'server.js', '.git', '.github',
    'package.json', 'package-lock.json', 'api_key.txt', '.env',
    'firebase.json', 'node_modules', 'AGENTS.md', 'test_calendar.mjs'
];
for (const bad of forbidden) {
    assert(!fs.existsSync(path.join(wwwDir, bad)), `5. Exclu strictement de www/: ${bad}`);
}

// 5. Cohérence totale entre sw.js ASSETS_TO_CACHE et le contenu réel de www/
const swCode = fs.readFileSync(path.join(wwwDir, 'sw.js'), 'utf8');
const listMatch = swCode.match(/const\s+ASSETS_TO_CACHE\s*=\s*\[([\s\S]*?)\];/);
const assets = [...listMatch[1].matchAll(/'([^']+)'/g)].map(m => m[1]);
const missingInWww = assets.filter(rel => rel !== './' && !fs.existsSync(path.join(wwwDir, rel)));
assert(missingInWww.length === 0, `6. Toutes les ${assets.length} ressources de sw.js sont présentes dans www/`);

console.log(`\n=== RÉSULTAT A2 : ${passed}/${total} ASSERTIONS PASSÉES ===`);
