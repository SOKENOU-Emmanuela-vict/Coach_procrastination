import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

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

function readPngDims(buf) {
    if (buf.length < 24) return null;
    if (buf.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') return null;
    return {
        width: buf.readUInt32BE(16),
        height: buf.readUInt32BE(20)
    };
}

console.log('=== TESTS A1 : MANIFESTE PWA, ICÔNES & INDEX.HTML ===\n');

// 1. manifest.webmanifest existe et est un JSON valide
const manifestPath = path.join(ROOT, 'manifest.webmanifest');
assert(fs.existsSync(manifestPath), '1. manifest.webmanifest existe à la racine');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

// 2. Propriétés obligatoires du manifeste
assert(manifest.name === 'Learning OS', '2a. manifest.name === "Learning OS"');
assert(typeof manifest.short_name === 'string' && manifest.short_name.length > 0, '2b. manifest.short_name présent');
assert(typeof manifest.description === 'string' && manifest.description.length > 15, '2c. manifest.description présente en français');
assert(manifest.start_url === './', '2d. manifest.start_url === "./"');
assert(manifest.scope === './', '2e. manifest.scope === "./"');
assert(manifest.display === 'standalone', '2f. manifest.display === "standalone"');
assert(manifest.lang === 'fr', '2g. manifest.lang === "fr"');
assert(manifest.theme_color === '#183d3d', '2h. manifest.theme_color issu du design system (#183d3d)');
assert(manifest.background_color === '#fbf9f4', '2i. manifest.background_color issu du design system (#fbf9f4)');

// 3. Icônes 192, 512 et maskable présentes et aux dimensions exactes
assert(Array.isArray(manifest.icons) && manifest.icons.length >= 3, '3a. manifest.icons contient au moins 3 icônes');
const has192Any = manifest.icons.some(i => i.sizes === '192x192' && i.purpose === 'any');
const has512Any = manifest.icons.some(i => i.sizes === '512x512' && i.purpose === 'any');
const hasMaskable = manifest.icons.some(i => i.purpose === 'maskable' && (i.sizes === '512x512' || i.sizes === '192x192'));
assert(has192Any && has512Any && hasMaskable, '3b. Icônes 192x192 (any), 512x512 (any) et maskable séparées déclarées');

for (const icon of manifest.icons) {
    const iconFile = path.join(ROOT, icon.src);
    assert(fs.existsSync(iconFile), `4. Icône présente sur disque: ${icon.src}`);
    const dims = readPngDims(fs.readFileSync(iconFile));
    const [w, h] = icon.sizes.split('x').map(Number);
    assert(dims && dims.width === w && dims.height === h, `5. PNG valide aux dimensions exactes (${icon.sizes}): ${icon.src}`);
}

// 4. index.html mis à jour sans toucher data/manifest.json
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
assert(html.includes('<link rel="manifest" href="manifest.webmanifest">'), '6a. index.html référence manifest.webmanifest');
assert(!html.includes('href="data/manifest.json"'), '6b. index.html ne référence plus data/manifest.json comme manifeste');
assert(html.includes('<meta name="theme-color" content="#183d3d">'), '6c. index.html contient <meta name="theme-color">');
assert(html.includes('rel="apple-touch-icon"') && fs.existsSync(path.join(ROOT, 'assets/icons/apple-touch-icon.png')), '6d. index.html contient apple-touch-icon valide');

const dataManifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'manifest.json'), 'utf8'));
assert(dataManifest.bootcampVersion === '1.0' && dataManifest.schemaVersion === '1.0', '7. data/manifest.json laissé strictement intact');

// 5. sw.js contient manifest.webmanifest et toutes les icônes
const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
assert(sw.includes("'./manifest.webmanifest'"), '8a. sw.js précache ./manifest.webmanifest');
assert(sw.includes("'./assets/icons/icon-192.png'") && sw.includes("'./assets/icons/icon-512.png'") && sw.includes("'./assets/icons/icon-maskable-512.png'"), '8b. sw.js précache toutes les icônes PWA');

console.log(`\n=== RÉSULTAT A1 : ${passed}/${total} ASSERTIONS PASSÉES ===`);
