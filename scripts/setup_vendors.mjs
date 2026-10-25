import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const NODE_MODULES = path.join(ROOT_DIR, 'node_modules');

if (!fs.existsSync(NODE_MODULES)) {
    console.error('Erreur : dossier node_modules/ introuvable.');
    console.error('Exécutez temporairement "npm install" avant de régénérer vendor/, puis supprimez node_modules/.');
    process.exit(1);
}

const VENDOR_TARGETS = [
    {
        pkg: 'mammoth',
        destDir: 'vendor/mammoth',
        files: [
            { src: 'mammoth.browser.min.js', dest: 'mammoth.browser.min.js' },
            { src: 'LICENSE', dest: 'LICENSE' }
        ]
    },
    {
        pkg: 'pdfjs-dist',
        destDir: 'vendor/pdfjs',
        files: [
            { src: 'legacy/build/pdf.min.js', dest: 'pdf.min.js' },
            { src: 'legacy/build/pdf.worker.min.js', dest: 'pdf.worker.min.js' },
            { src: 'LICENSE', dest: 'LICENSE' }
        ]
    },
    {
        pkg: 'xlsx',
        destDir: 'vendor/sheetjs',
        files: [
            { src: 'dist/xlsx.mini.min.js', dest: 'xlsx.mini.min.js' },
            { src: 'LICENSE', dest: 'LICENSE' }
        ]
    }
];

const now = new Date();

for (const target of VENDOR_TARGETS) {
    const pkgDir = path.join(NODE_MODULES, target.pkg);
    const pkgJsonPath = path.join(pkgDir, 'package.json');
    if (!fs.existsSync(pkgJsonPath)) {
        throw new Error(`Paquet manquant dans node_modules : ${target.pkg}`);
    }
    const pkgMeta = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
    const outDir = path.join(ROOT_DIR, target.destDir);
    fs.mkdirSync(outDir, { recursive: true });

    console.log(`[${target.pkg}@${pkgMeta.version}] -> ${target.destDir}/`);
    for (const f of target.files) {
        const srcPath = path.join(pkgDir, f.src);
        const destPath = path.join(outDir, f.dest);
        if (!fs.existsSync(srcPath)) {
            throw new Error(`Fichier source introuvable : ${path.relative(ROOT_DIR, srcPath)}`);
        }
        fs.copyFileSync(srcPath, destPath);
        fs.utimesSync(destPath, now, now);
        const sizeKo = (fs.statSync(destPath).size / 1024).toFixed(1);
        console.log(`  - ${f.dest} (${sizeKo} Ko)`);
    }
}

console.log('Bibliothèques vendor régénérées avec succès.');
