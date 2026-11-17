import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
let passed = 0;
let total = 0;

function check(cond, msg) {
    total++;
    if (!cond) {
        console.error(`❌ FAIL: ${msg}`);
        process.exit(1);
    }
    passed++;
    console.log(`✅ PASS: ${msg}`);
}

console.log('=== TEST : CONFIGURATION APPLICATION WINDOWS & ANDROID (CAPACITOR + APK) ===\n');

// 1. Lanceur Windows Desktop
const batPath = path.join(ROOT, 'Lancer_Learning_OS.bat');
check(fs.existsSync(batPath), '1a. Lancer_Learning_OS.bat existe à la racine');
const batContent = fs.readFileSync(batPath, 'utf8');
check(batContent.includes('--app=http://127.0.0.1:8125/'), '1b. Lancer_Learning_OS.bat configure le mode application autonome sans barre d\'URL');
check(batContent.includes('node server.js'), '1c. Lancer_Learning_OS.bat démarre le serveur local si nécessaire');

// 2. Configuration Capacitor
const capPath = path.join(ROOT, 'capacitor.config.json');
check(fs.existsSync(capPath), '2a. capacitor.config.json existe');
const cap = JSON.parse(fs.readFileSync(capPath, 'utf8'));
check(cap.appName === 'Learning OS', '2b. appName === "Learning OS"');
check(cap.appId === 'com.learningos.app', '2c. appId === "com.learningos.app"');
check(cap.webDir === 'www', '2d. webDir === "www"');

// 3. Workflow GitHub Actions pour compilation APK
const wfPath = path.join(ROOT, '.github', 'workflows', 'build-apk.yml');
check(fs.existsSync(wfPath), '3a. .github/workflows/build-apk.yml existe');
const wf = fs.readFileSync(wfPath, 'utf8');
check(wf.includes('temurin') && wf.includes('17'), '3b. Setup Java JDK 17 configuré');
check(wf.includes('scripts/build_www.mjs'), '3c. Compilation du dossier www/ intégrée');
check(wf.includes('assembleDebug'), '3d. Commande Gradle assembleDebug présente');
check(wf.includes('Learning-OS-Android-APK'), '3e. Artifact Learning-OS-Android-APK téléchargeable configuré');

// 4. Projet Android natif & Icônes
const stringsXml = fs.readFileSync(path.join(ROOT, 'android', 'app', 'src', 'main', 'res', 'values', 'strings.xml'), 'utf8');
check(stringsXml.includes('<string name="app_name">Learning OS</string>'), '4a. strings.xml nomme l\'application "Learning OS"');

const bgXml = fs.readFileSync(path.join(ROOT, 'android', 'app', 'src', 'main', 'res', 'values', 'ic_launcher_background.xml'), 'utf8');
check(bgXml.includes('#183d3d'), '4b. Fond de l\'icône Android configuré avec le vert-teal officiel #183d3d');

const densities = ['mipmap-mdpi', 'mipmap-hdpi', 'mipmap-xhdpi', 'mipmap-xxhdpi', 'mipmap-xxxhdpi'];
for (const d of densities) {
    const iconPath = path.join(ROOT, 'android', 'app', 'src', 'main', 'res', d, 'ic_launcher.png');
    const fgPath = path.join(ROOT, 'android', 'app', 'src', 'main', 'res', d, 'ic_launcher_foreground.png');
    check(fs.existsSync(iconPath) && fs.existsSync(fgPath), `5. Icônes présentes dans android/.../${d}`);
}

// 5. Dépendances dans package.json
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
check(
    (pkg.devDependencies && pkg.devDependencies['@capacitor/core'] && pkg.devDependencies['@capacitor/android']) ||
    (pkg.dependencies && pkg.dependencies['@capacitor/core'] && pkg.dependencies['@capacitor/android']),
    '6. Dépendances Capacitor présentes dans package.json'
);

console.log(`\n=== RÉSULTAT CONFIG APP : ${passed}/${total} ASSERTIONS PASSÉES ===`);
