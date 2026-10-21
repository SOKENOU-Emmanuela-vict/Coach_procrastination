# État des Lieux Visuel — Learning OS (Avant Refonte U1)

Date : 21 octobre 2026  
Branche : `main`  
Auteur : Antigravity AI Pair Programmer (pour Emma & Claude)

---

## 1. Inventaire des Écrans et Vues

L'application comprend 12 vues principales gérées par le routeur (`src/core/Router.js`) et affichées dans `#app-root` :

| Nom écran | Vue technique | Ambience cible | Rôle principal |
| :--- | :--- | :--- | :--- |
| **Bureau** | `DesktopView.js` | `bureau` (Notion-like) | Hub d'accueil : session en cours, raccourcis, météo/date, coach insight, résumé rapide. |
| **Planning** | `PlanningView.js` | `bureau` (dense) | Emploi du temps du jour, sessions, habitudes, imports EDT. |
| **École** | `AcademicView.js` | `ecole` (académique) | Cursus, semestres, matières, évaluations, notes, crédits ECTS. |
| **Langues** | `LanguageView.js` | `langues` (éditorial) | Fiches de langues, vocabulaire, ressources d'apprentissage, immersion. |
| **Vie** | `LifeView.js` | `vie` (doux / sauge) | Habitudes de vie, sommeil, bien-être, respiration, objectifs personnels. |
| **Coach** | `CoachChatView.js` | Neutre / conversationnel | Chat interactif avec le coach, bulles de dialogue, historique. |
| **Calendrier** | `CalendarView.js` | `bureau` (dense) | Vue mensuelle/hebdomadaire, événements, créneaux de disponibilité, conflits. |
| **Portfolio** | `PortfolioView.js` | `bureau` | Historique de travail, projets, livres, preuves, export backup & impression PDF. |
| **Focus** | `FocusView.js` | Épuré / sans distraction | Minuteur Pomodoro / focus, tâche courante, bilan immédiat. |
| **Bilan** | `BilanView.js` | `bureau` | Bilan quotidien du soir, métriques d'apprentissage, journal. |
| **Hebdo** | `WeeklyView.js` | `bureau` | Bilan de fin de semaine, analyse de productivité et de charge. |
| **Dashboard** | `DashboardView.js` | `bureau` | Tableau de bord analytique et santé du système. |

---

## 2. Inventaire des Composants Partagés

1. **Barre latérale (Sidebar)** :
   - Présente dans presque toutes les vues via duplication HTML (`.bureau-sidebar`), largeur fixe de 250px.
   - Entrées de navigation : `data-view="desktop"`, `data-view="planning"`, `data-view="academic"`, `data-view="languages"`, `data-view="life"`, `data-view="chat"`.
   - Défaut : non repliable en mobile, consomme 65% de la largeur d'un écran 390px.
2. **Modale d'édition globale** :
   - `#global-item-editor-modal` dans `index.html` : projet, livre, tâche, habitude, compétence, matière, évaluation.
   - Style actuel : fond bleu pétrole `#152b36`, bordure cyan néon `#00f2fe`, ombre lourde.
3. **Modale d'événement** :
   - `EventModal.js` : création / édition d'événements du calendrier.
4. **Boutons** :
   - Hétérogénéité extrême : boutons cyan néon (`#00f2fe`), boutons bleus bootstrap (`#0ea5e9`), boutons rouge vif (`#ef4444`), bordures arrondies 5px, 8px, 15px ou 25px selon les fichiers.
5. **Formulaires & Champs** :
   - Inputs et selects avec fonds sombres codés en dur (`#0f2027`, `#1e293b`), bordures cyan ou grises, libellés de petite taille (12px) et contrastes souvent sous le seuil WCAG AA 4,5:1.
6. **Cartes & Conteneurs** :
   - Mélange de `.bureau-card`, `.glass-panel` (backdrop-filter) et de conteneurs avec bordures ou dégradés inline.

---

## 3. Décompte Exact des Attributs `style="..."` (Inline Styles)

Un décompte automatisé sur l'ensemble des fichiers `src/ui/*.js` relève **1 108 attributs inline `style="..."`** :

| Fichier | Nombre de `style="..."` | Priorité de refonte |
| :--- | :---: | :--- |
| `AcademicView.js` | 149 | **U1-5 (Écran pilote)** |
| `PortfolioView.js` | 142 | U2 (Étape 9) |
| `LanguageView.js` | 138 | U2 (Étape 4) |
| `PlanningView.js` | 124 | U2 (Étape 1) |
| `DesktopView.js` | 110 | **U1-5 (Écran pilote)** |
| `CalendarView.js` | 103 | U2 (Étape 2) |
| `LifeView.js` | 85 | U2 (Étape 5) |
| `CoachChatView.js` | 73 | U2 (Étape 6) |
| `WeeklyView.js` | 52 | U2 (Étape 8) |
| `FocusView.js` | 39 | U2 (Étape 7) |
| `BilanView.js` | 33 | U2 (Étape 8) |
| `EventModal.js` | 32 | U2 (Étape 1) |
| `DashboardView.js` | 28 | U2 (Étape 8) |
| **TOTAL** | **1 108** | |

*Note pour U1-5* : Les deux écrans pilotes (`DesktopView.js` et `AcademicView.js`) totalisent **259 styles inline** qui seront intégralement migrés vers des classes CSS de leur univers respectif (`data-univers="bureau"` et `data-univers="ecole"`).

---

## 4. Analyse des Couleurs, Polices et Rayons Actuels

### Couleurs
- **Cyber / Sombre** : Fond radial `#0f172a` vers `#0a0f1c`, cartes `#151e2f`, texte `#f8fafc` / `#94a3b8`.
- **Accents actuels** : Cyan néon `#00f2fe` et `#0ea5e9`, Violet `#8b5cf6`, Rose néon `#f43f5e`, Jaune `#facc15`.
- **Défaut** : Palette typique "IA / Dashboard Cyberpunk" générique, saturée et fatigante pour un usage quotidien de travail.

### Polices
- Appel externe interdit dans `main.css` : `@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');`.
- Dépendance CDN externe pour Bootstrap Icons : `<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.1/font/bootstrap-icons.css">` qui cause l'affichage de rectangles vides hors-ligne ou sous CSP stricte.
- Aucune police à empattements (serif) pour l'ambiance académique demandée par Emma.

### Rayons (Border Radius)
- Incohérence totale : `border-radius: 5px`, `8px`, `10px`, `12px`, `15px`, `16px`, `20px`, `25px`, `9999px` distribués au hasard dans les styles inline.
- Aucune échelle standard (ex. `4px`, `8px`, `12px`, `16px`).

---

## 5. Diagnostic des Problèmes et Incohérences Visuelles

1. **Rupture Responsive Mobile (390px)** :
   - La sidebar de 250px ne disparaît pas et ne se replie pas. Sur un écran de 390px de large, la zone de travail est réduite à 140px, écrasant les boutons, les titres et les tableaux.
2. **"Look IA" omniprésent** :
   - Fond bleu nuit uniforme avec lueurs radiales, bordures cyan néon (`#00f2fe`), modales aux contours lumineux.
   - Glassmorphism non maîtrisé avec `backdrop-filter: blur(12px)` qui ralentit les rendus et nuit au contraste.
   - Emojis décoratifs disséminés dans tous les boutons et titres sans valeur informative.
3. **Absence d'ambiance différenciée** :
   - Malgré les classes `theme-cyber` ou `theme-light`, l'application manque de personnalité : l'École ressemble à un panneau d'administration froid au lieu d'un espace de travail académique élégant (style cahier d'études / papier & encre).
4. **Dépendances réseau bloquantes** :
   - En mode hors-ligne ou sous CSP rigoureuse, les polices Google Fonts et les icônes Bootstrap Icons ne se chargent pas, provoquant des carrés de substitution (glyphes cassés).

---

## 6. Galerie des Captures "AVANT" (1440px et 390px)

Toutes les captures ci-dessous sont générées dans le dossier `docs/ui-redesign/` :

| Écran | Capture Desktop (1440px) | Capture Mobile (390px) |
| :--- | :--- | :--- |
| **Bureau** | ![Bureau 1440](bureau_avant_1440.png) | ![Bureau 390](bureau_avant_390.png) |
| **Planning** | ![Planning 1440](planning_avant_1440.png) | ![Planning 390](planning_avant_390.png) |
| **École** | ![École 1440](ecole_avant_1440.png) | ![École 390](ecole_avant_390.png) |
| **Langues** | ![Langues 1440](langues_avant_1440.png) | ![Langues 390](langues_avant_390.png) |
| **Vie** | ![Vie 1440](vie_avant_1440.png) | ![Vie 390](vie_avant_390.png) |
| **Coach** | ![Coach 1440](coach_avant_1440.png) | ![Coach 390](coach_avant_390.png) |
| **Calendrier** | ![Calendrier 1440](calendrier_avant_1440.png) | ![Calendrier 390](calendrier_avant_390.png) |
| **Portfolio** | ![Portfolio 1440](portfolio_avant_1440.png) | ![Portfolio 390](portfolio_avant_390.png) |
| **Focus** | ![Focus 1440](focus_avant_1440.png) | ![Focus 390](focus_avant_390.png) |
| **Bilan** | ![Bilan 1440](bilan_avant_1440.png) | ![Bilan 390](bilan_avant_390.png) |
| **Hebdo** | ![Hebdo 1440](hebdo_avant_1440.png) | ![Hebdo 390](hebdo_avant_390.png) |
| **Dashboard** | ![Dashboard 1440](dashboard_avant_1440.png) | ![Dashboard 390](dashboard_avant_390.png) |

---

## 7. Direction Validée pour la Refonte (U1)

1. **Suppression immédiate de tout appel externe** :
   - Polices système modernes (`-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`) et pile serif élégante pour l'École (`Charter, "Bitstream Charter", "Sitka Text", Cambria, Georgia, serif`).
2. **GSAP en local** dans `vendor/gsap/gsap.min.js`, sans CDN, compatible PWA et hors-ligne.
3. **Architecture à 2 couches** :
   - Couche 1 : Base commune (`src/ui/styles/main.css`) pour la grille (4/8px), les boutons de base, les modales, la navigation.
   - Couche 2 : Univers par attribut `data-univers="bureau|ecole|vie|langues"` pilotant couleurs, typographie de titre, cartes et densités.
4. **Pilotes U1-5** : Bureau (style Notion clair, calme, épuré) et École (style académique papier et encre), avec élimination complète de leurs 259 styles inline.
