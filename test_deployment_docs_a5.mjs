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

console.log('=== TESTS A5 : DOCUMENTATION DÉPLOIEMENT & INSTALLATION ===\n');

const deployDocPath = path.join(ROOT, 'docs', 'DEPLOIEMENT.md');
const installDocPath = path.join(ROOT, 'docs', 'INSTALLATION_APP.md');

check(fs.existsSync(deployDocPath), '1. docs/DEPLOIEMENT.md existe');
check(fs.existsSync(installDocPath), '2. docs/INSTALLATION_APP.md existe');

const deployDoc = fs.readFileSync(deployDocPath, 'utf8');
const installDoc = fs.readFileSync(installDocPath, 'utf8');

const requiredDeployCmds = [
    'npm install -g firebase-tools',
    'firebase login',
    'firebase init hosting',
    'firebase deploy',
    'Spark',
    'carte bancaire',
    'www',
    'firebase.json',
    'Google Cloud Console'
];

for (const token of requiredDeployCmds) {
    check(deployDoc.includes(token), `3. docs/DEPLOIEMENT.md mentionne "${token}"`);
}

check(installDoc.includes('Chrome') && installDoc.includes('Edge'), '4a. docs/INSTALLATION_APP.md couvre Chrome & Edge sur PC');
check(installDoc.includes('Android') && installDoc.includes('Ajouter à l\'écran d\'accueil'), '4b. docs/INSTALLATION_APP.md couvre Android');

// Vérification absence de clé secrète dans les docs
const hasSecrets = /AIza[0-9A-Za-z-_]{30,}|AQ\.[0-9A-Za-z-_]{30,}|sk-[0-9A-Za-z-_]{20,}/.test(deployDoc + installDoc);
check(!hasSecrets, '5. Aucune clé secrète dans la documentation');

console.log(`\n=== RÉSULTAT A5 : ${passed}/${total} ASSERTIONS PASSÉES ===`);
