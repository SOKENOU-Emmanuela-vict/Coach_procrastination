# Installer Learning OS comme application (PC & Android)

Learning OS est une **Progressive Web App (PWA)** complète : elle s'installe directement depuis ton navigateur sur ordinateur (Windows, Mac, Linux) et sur smartphone Android, s'ouvre dans sa propre fenêtre sans barre d'adresse, et fonctionne même **hors-ligne**.

---

## 1. Sur PC (Google Chrome ou Microsoft Edge)

1. Ouvre l'URL de ton application hébergée (Firebase Hosting, ex. `https://ton-projet.web.app`) dans **Chrome** ou **Edge**.
2. Regarde à droite dans la **barre d'adresse** :
   - **Dans Chrome** : clique sur l'icône d'installation *(écran avec une flèche vers le bas)*, puis confirme en cliquant sur **Installer**.
   - **Dans Edge** : clique sur l'icône **Applications disponibles** *(carrés avec un `+`)* à droite de la barre d'adresse, ou ouvre le menu `⋯` → **Applications** → **Installer ce site en tant qu'application**.
3. **Résultat** :
   - Learning OS s'ouvre dans sa propre fenêtre autonome.
   - Son icône (**Toque Académique** vert-teal `#183d3d`) apparaît dans le menu Démarrer / Applications, et tu peux l'épingler à la barre des tâches.

---

## 2. Sur téléphone Android (Google Chrome)

1. Ouvre l'URL de ton application dans **Google Chrome** sur Android.
2. Attends 2 à 3 secondes que la page et le Service Worker se chargent.
3. Appuie sur le menu **`⋮`** *(trois points verticaux en haut à droite)*.
4. Choisis **Installer l'application** *(ou **Ajouter à l'écran d'accueil** → **Installer** si proposé)*.
5. Confirme en appuyant sur **Installer**.
6. **Résultat** :
   - Android génère automatiquement un raccourci/WebAPK autonome avec l'icône adaptative (**Toque Académique**, découpe circulaire/carré arrondi propre).
   - L'application se lance en plein écran (barre d'état teintée vert-teal `#183d3d`) et reste utilisable **même en mode avion / hors-ligne**.

> **Note concernant l'APK natif avec rappels locaux :**
> L'installation PWA décrite ci-dessus te donne déjà l'application sur téléphone dès la Partie A. Les rappels natifs programmés hors-ligne (`@capacitor/local-notifications`) et l'`.apk` compilé automatiquement arriveront à la **Partie C**.

---

## 3. Sur iPhone / iPad (Safari) — optionnel

1. Ouvre l'application dans **Safari**.
2. Appuie sur le bouton **Partager** *(carré avec flèche vers le haut)*.
3. Choisis **Sur l'écran d'accueil**, puis appuie sur **Ajouter**.

---

## 4. Critères techniques vérifiés automatiquement

Le test [test_pwa_installability_a4.mjs](../test_pwa_installability_a4.mjs) valide dans un vrai navigateur Chromium :
- Manifeste `manifest.webmanifest` détecté et sans erreur (`display: standalone`, `start_url: ./`, `scope: ./`).
- **0 erreur d'installabilité** signalée par le moteur Chromium (`Page.getInstallabilityErrors`).
- Toutes les icônes (`192×192`, `512×512`, et version `maskable`) chargées et décodées.
- Service Worker actif pré-cachant les 116 ressources critiques et permettant un redémarrage 100 % hors-ligne sans erreur console.
