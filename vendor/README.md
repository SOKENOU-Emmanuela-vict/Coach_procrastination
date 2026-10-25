# Bibliothèques locales (`vendor/`)

L'application fonctionne sans bundler et hors-ligne : toutes les bibliothèques tierces exécutées par le navigateur (et utilisées par les tests locaux sans `node_modules/`) sont versionnées sous forme minifiée dans ce dossier.

> **Important :** Le dossier `node_modules/` n'est pas conservé sur le disque (afin d'éviter la synchronisation OneDrive de milliers de fichiers). Ne lancez `npm install` que ponctuellement pour régénérer ou mettre à jour une bibliothèque, puis supprimez `node_modules/`.

## Inventaire des bibliothèques

| Bibliothèque | Version exacte | Licence | Fichier(s) dans `vendor/` | Source d'origine | Commande de régénération |
|---|---|---|---|---|---|
| **mammoth** | `1.13.0` | BSD-2-Clause (`vendor/mammoth/LICENSE`) | `vendor/mammoth/mammoth.browser.min.js` | `node_modules/mammoth/mammoth.browser.min.js` | `npm install && node scripts/setup_vendors.mjs` |
| **pdfjs-dist** | `3.11.174` | Apache-2.0 (`vendor/pdfjs/LICENSE`) | `vendor/pdfjs/pdf.min.js`<br>`vendor/pdfjs/pdf.worker.min.js` | `node_modules/pdfjs-dist/legacy/build/pdf.min.js`<br>`node_modules/pdfjs-dist/legacy/build/pdf.worker.min.js` | `npm install && node scripts/setup_vendors.mjs` |
| **xlsx** (SheetJS CE) | `0.18.5` | Apache-2.0 (`vendor/sheetjs/LICENSE`) | `vendor/sheetjs/xlsx.mini.min.js` | `node_modules/xlsx/dist/xlsx.mini.min.js` | `npm install && node scripts/setup_vendors.mjs` |
| **gsap** | `3.15.0` | GreenSock Standard « No Charge » (`vendor/gsap/LICENSE.txt`) | `vendor/gsap/gsap.min.js` | Archive officielle GSAP `3.15.0` (`gsap.min.js`) | `node scripts/setup_vendor.mjs` (dossier assuré, binaire GSAP `3.15.0` conservé) |
| **bootstrap-icons** | `1.11.1` | MIT (`vendor/bootstrap-icons/LICENSE`) | `vendor/bootstrap-icons/bootstrap-icons.min.css`<br>`vendor/bootstrap-icons/fonts/bootstrap-icons.woff2` | `bootstrap-icons@1.11.1` (`font/bootstrap-icons.min.css` + `font/fonts/bootstrap-icons.woff2`) | `node scripts/setup_vendor.mjs` |

## Procédure complète de mise à jour (`mammoth`, `pdfjs-dist`, `xlsx`)

```powershell
npm install
node scripts/setup_vendors.mjs
Remove-Item -Recurse -Force node_modules
```
