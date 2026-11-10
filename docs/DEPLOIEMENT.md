# Guide de Déploiement Firebase Hosting — Learning OS (100 % Gratuit)

Ce guide explique pas à pas comment mettre **Learning OS** en ligne en HTTPS grâce au forfait **Firebase Spark (0 € à vie, aucune carte bancaire requise)**.

---

## 🔒 Rappel sur la gratuité (Forfait Spark)

- Aucune carte bancaire n'est nécessaire ni ne doit être saisie.
- Si Firebase te propose un jour de passer au forfait **Blaze** *(paiement à l'usage)*, **annule / refuse** : tout Learning OS est conçu pour tourner exclusivement sur le forfait gratuit **Spark** :
  - **Hébergement (Firebase Hosting)** : HTTPS inclus, domaine `.web.app` gratuit.
  - **Authentification** (Partie B) : E-mail + mot de passe inclus gratuitement.
  - **Base de données Cloud Firestore** (Partie B) : 1 Go de stockage, 50 000 lectures / jour, 20 000 écritures / jour, 20 000 suppressions / jour, 10 Go de transfert / mois *(plafonds stricts avec arrêt automatique sans jamais facturer)*.

---

## Étape 1 — Créer le projet Firebase (dans ton navigateur)

1. Connecte-toi sur [https://console.firebase.google.com/](https://console.firebase.google.com/) avec ton compte Google.
2. Clique sur **Créer un projet** *(ou Ajouter un projet)*, donne-lui un nom clair *(ex. `learning-os-perso`)*.
3. À l'étape Google Analytics, tu peux le **désactiver** *(plus simple et plus respectueux de ta vie privée)*, puis clique sur **Créer le projet**.
4. Une fois le tableau de bord ouvert, vérifie en bas à gauche que l'offre affichée est bien **Spark (Sans frais)**.

---

## Étape 2 — Installer l'outil en ligne de commande (`firebase-tools`)

Ouvre un terminal (PowerShell) dans le dossier du projet :
```powershell
cd C:\Users\HP\OneDrive\Desktop\Projet\Coach_procrastination
```

Installe Firebase CLI globalement *(une seule fois sur ton PC, Node.js est déjà installé)* :
```powershell
npm install -g firebase-tools
```

Vérifie l'installation :
```powershell
firebase --version
```

---

## Étape 3 — Se connecter à ton compte Firebase (`firebase login`)

Dans le même terminal :
```powershell
firebase login
```
Une fenêtre de navigateur s'ouvre pour t'authentifier avec le même compte Google qu'à l'étape 1. Confirme l'autorisation.

---

## Étape 4 — Associer ce dossier à ton projet (`firebase init hosting`)

Le fichier `firebase.json` (règles de sécurité CSP, `Cache-Control: no-cache`, rewrite SPA, dossier propre `www/`) est **déjà configuré** dans ce dépôt.

Lance dans le terminal :
```powershell
firebase init hosting
```

Réponds avec attention aux questions suivantes :
1. **Please select an option:** → Choisis **Use an existing project** et sélectionne le projet créé à l'étape 1.
2. **What do you want to use as your public directory?** → Tape **`www`**.
3. **Configure as a single-page app (rewrite all urls to /index.html)?** → **`N`** *(Non)*, car c'est déjà réglé dans notre `firebase.json`.
4. **Set up automatic builds and deploys with GitHub?** → **`N`** *(Non, facultatif)*.
5. **File `firebase.json` already exists. Overwrite?** → Réponds **`N`** *(Non — très important pour conserver les en-têtes de sécurité et le predeploy)*.
6. Si un message demande s'il faut écraser `www/index.html` → Réponds **`N`** *(Non)*.

> **Astuce rapide :** tu peux aussi exécuter simplement `firebase use --add`, choisir ton projet et taper `default` comme alias — cela crée uniquement `.firebaserc` sans risquer d'écraser `firebase.json`.

---

## Étape 5 — Déployer l'application en ligne (`firebase deploy`)

Avant chaque déploiement, `firebase.json` exécute automatiquement `node scripts/build_www.mjs`, qui assemble un dossier `www/` propre contenant uniquement le code utile de l'app (`index.html`, `manifest.webmanifest`, `sw.js`, `src/`, `vendor/`, `assets/`, `data/`) — **jamais** `api_key.txt`, `.git`, `server.js`, `tests/` ou `docs/`.

Pour publier :
```powershell
firebase deploy --only hosting
```

À la fin, le terminal affiche ton URL HTTPS permanente, par exemple :
`Hosting URL: https://ton-projet.web.app`

---

## Étape 6 — Installer sur PC et téléphone Android

Une fois ton URL HTTPS en ligne, suis le guide d'installation :
👉 **[docs/INSTALLATION_APP.md](./INSTALLATION_APP.md)**

> **Note sur ta clé Gemini en ligne :** `api_key.txt` n'est jamais envoyé sur Firebase. Sur chaque nouvel appareil (PC ou Android), ouvre l'onglet **Coach** et colle ta clé Gemini dans le panneau dédié : elle reste stockée localement dans ce navigateur uniquement.

---

## Étape 7 — Récupérer ta configuration Web pour activer la Synchronisation (Partie B)

Lorsque ton projet Firebase est prêt et déployé, récupère sa configuration Web afin que je puisse brancher la synchronisation dans la **Partie B** :

1. Dans la console Firebase, clique sur la roue dentée **⚙️ Paramètres du projet** (en haut à gauche).
2. Descends à la section **Vos applications** → clique sur l'icône **`</>`** *(Web)*.
3. Donne un surnom *(ex. `Learning OS Web`)* et clique sur **Enregistrer l'application** *(inutile de recocher Hosting)*.
4. Copie le bloc `firebaseConfig` affiché à l'écran (`apiKey`, `authDomain`, `projectId`, `storageBucket`, `messagingSenderId`, `appId`) et transmets-le-moi.

### 🔐 Bonne pratique sécurité (recommandée)
Contrairement aux secrets serveur, la `apiKey` Web de Firebase est publique par conception (la vraie protection vient des règles de sécurité Firestore qu'on écrira en B0). Toutefois, pour éviter qu'un tiers ne l'utilise depuis un autre site, pense à restreindre cette clé dans [Google Cloud Console → APIs et services → Identifiants](https://console.cloud.google.com/apis/credentials) aux seuls référents HTTP de ton app (`https://ton-projet.web.app/*`, `https://ton-projet.firebaseapp.com/*`, `http://localhost/*`, `http://127.0.0.1/*`).
