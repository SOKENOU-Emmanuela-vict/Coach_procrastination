import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SW_PATH = path.join(ROOT_DIR, 'sw.js');

function walkFiles(dir, filterFn = () => true) {
    const results = [];
    if (!fs.existsSync(dir)) return results;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            results.push(...walkFiles(fullPath, filterFn));
        } else if (entry.isFile() && filterFn(fullPath)) {
            results.push(fullPath);
        }
    }
    return results;
}

function toSwRelPath(absPath) {
    return './' + path.relative(ROOT_DIR, absPath).replace(/\\/g, '/');
}

export function collectPrecacheAssets(rootDir = ROOT_DIR) {
    const assets = new Set(['./', './index.html']);

    // 1. data/*.json (dont data/manifest.json)
    for (const f of walkFiles(path.join(rootDir, 'data'), (p) => p.endsWith('.json'))) {
        assets.add('./' + path.relative(rootDir, f).replace(/\\/g, '/'));
    }

    // 2. Tous les fichiers .js et .css de src/
    for (const f of walkFiles(path.join(rootDir, 'src'), (p) => p.endsWith('.js') || p.endsWith('.css'))) {
        assets.add('./' + path.relative(rootDir, f).replace(/\\/g, '/'));
    }

    // 3. Bibliothèques légères nécessaires au démarrage : vendor/gsap et vendor/bootstrap-icons (css + polices)
    const startupVendorFiles = [
        path.join(rootDir, 'vendor', 'gsap', 'gsap.min.js'),
        ...walkFiles(path.join(rootDir, 'vendor', 'bootstrap-icons'), (p) => {
            const ext = path.extname(p).toLowerCase();
            return ext === '.css' || ext === '.woff2' || ext === '.woff' || ext === '.ttf';
        })
    ];
    for (const f of startupVendorFiles) {
        if (fs.existsSync(f)) {
            assets.add('./' + path.relative(rootDir, f).replace(/\\/g, '/'));
        }
    }

    // 4. Tous les fichiers de assets/
    for (const f of walkFiles(path.join(rootDir, 'assets'))) {
        assets.add('./' + path.relative(rootDir, f).replace(/\\/g, '/'));
    }

    // Tri déterministe ('./' et './index.html' en tête, puis ordre alphabétique)
    const head = ['./', './index.html'];
    const rest = [...assets].filter((a) => !head.includes(a)).sort((a, b) => a.localeCompare(b));
    return [...head, ...rest];
}

function incrementCacheName(currentName) {
    const m = currentName.match(/^(.*-v)(\d+)\.(\d+)$/);
    if (!m) return 'learning-os-v2.1';
    const prefix = m[1];
    const major = Number(m[2]);
    const minor = Number(m[3]) + 1;
    return `${prefix}${major}.${minor}`;
}

function main() {
    const forceBump = process.argv.includes('--bump');
    const swContent = fs.readFileSync(SW_PATH, 'utf8');

    const cacheMatch = swContent.match(/const\s+CACHE_NAME\s*=\s*'([^']+)';/);
    const currentCacheName = cacheMatch ? cacheMatch[1] : 'learning-os-v2.0';

    const listMatch = swContent.match(/const\s+ASSETS_TO_CACHE\s*=\s*\[([\s\S]*?)\];/);
    let previousAssets = [];
    if (listMatch) {
        previousAssets = [...listMatch[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
    }

    const nextAssets = collectPrecacheAssets(ROOT_DIR);
    const listChanged = JSON.stringify(previousAssets) !== JSON.stringify(nextAssets);
    const nextCacheName = (listChanged || forceBump) ? incrementCacheName(currentCacheName) : currentCacheName;

    const formattedList = nextAssets.map((a) => `  '${a}'`).join(',\n');
    let updatedSw = swContent
        .replace(/const\s+CACHE_NAME\s*=\s*'[^']+';/, `const CACHE_NAME = '${nextCacheName}';`)
        .replace(/const\s+ASSETS_TO_CACHE\s*=\s*\[[\s\S]*?\];/, `const ASSETS_TO_CACHE = [\n${formattedList}\n];`);

    fs.writeFileSync(SW_PATH, updatedSw, 'utf8');
    console.log(`sw.js mis à jour : CACHE_NAME=${nextCacheName}, ${nextAssets.length} ressources précachées (modifié=${listChanged || forceBump}).`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    main();
}
