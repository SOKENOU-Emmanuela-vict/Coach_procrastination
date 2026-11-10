import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const ROOT_FILES_TO_COPY = ['index.html', 'manifest.webmanifest', 'sw.js'];
const DIRS_TO_COPY = ['src', 'vendor', 'assets', 'data'];

function isForbiddenArtifact(name) {
    const lower = name.toLowerCase();
    return (
        lower === '.git' ||
        lower === '.ds_store' ||
        lower === 'thumbs.db' ||
        lower === 'api_key.txt' ||
        lower.startsWith('.env') ||
        lower.endsWith('.key')
    );
}

function copyDirRecursive(srcDir, destDir, stats) {
    if (!fs.existsSync(srcDir)) return;
    fs.mkdirSync(destDir, { recursive: true });
    for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
        if (isForbiddenArtifact(entry.name)) continue;
        const srcPath = path.join(srcDir, entry.name);
        const destPath = path.join(destDir, entry.name);
        if (entry.isDirectory()) {
            copyDirRecursive(srcPath, destPath, stats);
        } else if (entry.isFile()) {
            fs.copyFileSync(srcPath, destPath);
            stats.files++;
        }
    }
}

/**
 * Construit le dossier propre www/ destiné à Firebase Hosting et Capacitor.
 * Exclut strictement tests/, scripts/, docs/, server.js, .git, package*.json, api_key.txt, etc.
 */
export function buildWww(rootDir = ROOT_DIR, outDir = path.join(rootDir, 'www')) {
    if (fs.existsSync(outDir)) {
        fs.rmSync(outDir, { recursive: true, force: true });
    }
    fs.mkdirSync(outDir, { recursive: true });

    const stats = { files: 0, dirs: [] };

    for (const file of ROOT_FILES_TO_COPY) {
        const srcFile = path.join(rootDir, file);
        if (!fs.existsSync(srcFile)) {
            throw new Error(`Fichier requis manquant pour build_www: ${file}`);
        }
        fs.copyFileSync(srcFile, path.join(outDir, file));
        stats.files++;
    }

    for (const dir of DIRS_TO_COPY) {
        const srcDir = path.join(rootDir, dir);
        if (!fs.existsSync(srcDir)) {
            throw new Error(`Dossier requis manquant pour build_www: ${dir}`);
        }
        copyDirRecursive(srcDir, path.join(outDir, dir), stats);
        stats.dirs.push(dir);
    }

    return { outDir, ...stats };
}

if (
    process.argv[1] &&
    (path.resolve(process.argv[1]) === fileURLToPath(import.meta.url) ||
        fs.realpathSync(path.resolve(process.argv[1])) === fs.realpathSync(fileURLToPath(import.meta.url)))
) {
    const result = buildWww();
    console.log(`✅ Dossier www construit : ${result.files} fichiers copiés dans ${path.relative(ROOT_DIR, result.outDir) || 'www'}`);
}
