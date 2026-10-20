# RAPPORT D'INSPECTION COMPLÈTE DE L'OS (2026-10-20)
**Application** : Learning OS (`Coach_procrastination`)  
**Inspecteur** : Antigravity (Inspection en lecture seule, aucune modification du code source `src/`)  
**Date d'inspection** : 20 Octobre 2026  
**Environnement** : Node.js v26.7.0, Chromium Browser subagent, `http://127.0.0.1:8125/`

---

## 1. RÉSUMÉ HONNÊTE (10 lignes max)
L'application dispose d'une base technique solide : 58/58 suites de tests automatisés passent, aucune fuite de clé API, persistance IndexedDB robuste et module École/Académique très abouti. En revanche, le Coach en mode local (sans clé Gemini) ne traite pas les intentions de conversation : il renvoie un pavé statique de faits et ignore complètement les langues, la procrastination et la création d'événements par le chat. Plusieurs éléments d'interface sont purement décoratifs (bannière Musashi, lien externe Spotify, widgets Fitness en lecture seule sans saisie dédiée). La racine du dépôt est encombrée de 14 scripts Python/JS résiduels et d'un dossier `tests/` vide. Enfin, la documentation est obsolète par rapport aux moteurs réellement implémentés.

**Top 5 des problèmes les plus graves :**
1. **Coach Local aveugle aux intentions & domaines** : Sans Gemini, le Coach ne sait pas planifier d'événements, ne comprend pas les questions sur les langues ou la procrastination, et renvoie un résumé figé des cours/examens/tâches.
2. **Incohérence des sous-domaines de vie dans LifeView** : "Fitness & Bien-être" n'a aucun formulaire de saisie dans LifeView (repose uniquement sur le check-in) ; l'ambiance musicale n'est qu'un lien externe vers open.spotify.com.
3. **Pollution de la racine du dépôt** : 14 scripts de maintenance/mockup (`compute.py`, `fix.py`, `update_*.py`, etc.) traînent à la racine à côté de 59 fichiers de test non rangés dans le dossier `tests/` (qui est vide).
4. **Documentation obsolète et contradictoire** : `ARCHITECTURE.md` décrit un simple MVP V1.0 à base de fichiers JSON alors que le code utilise IndexedDB et des moteurs V2/V3 ; `docs/BUGS.md` indique l'absence de fallback local alors que `CoachLocalReply` existe.
5. **Absence d'interface d'ingestion RAG / Connaissances** : Les moteurs `KnowledgeEngine` et `DocumentExtractor` existent dans le code mais aucun écran ne permet à l'utilisatrice de déposer un PDF/cours pour enrichir le contexte du coach.

**Top 5 des points forts réels :**
1. **Module Académique / École remarquable** : Gestion complète des semestres, matières, épreuves, coefficients, calcul des moyennes exact, isolation parfaite entre données réelles et exemples.
2. **Excellente résilience des tests unitaires** : 58/58 fichiers de tests réussis sans régression, couvrant les règles métier complexes (PVD, écarts, conflits d'agenda, calculs de détermination).
3. **Sécurité et hygiène des données** : Zéro clé API dans le dépôt, filtrage XSS `escapeHtml` généralisé dans les vues, et exclusion locale Git (`.git/info/exclude`) respectée.
4. **Moteur de suivi des langues complet** : Multi-langues, détection des drapeaux, gestion des 4 types de ressources (lien, livre, appli, vidéo), calcul du temps et du vocabulaire.
5. **Fiabilité du stockage IndexedDB** : Survit aux rechargements F5, isolation propre des stores, fonction d'export/import JSON fonctionnelle.

---

## 2. TABLEAU PAR ÉCRAN (Éléments contrôlés)

| Écran | Élément / Action | Attendu | Constaté | Verdict | Gravité | Preuve |
| :--- | :--- | :--- | :--- | :---: | :---: | :--- |
| **Navigation** | Liens barre latérale (Bureau, Planning, École, Langues, Life, Projets, Coach) | Chaque lien affiche la vue correspondante et met en surbrillance l'item actif | Navigation fluide, vue affichée instantanément, classe `active` mise à jour | ✅ | - | Clics sur `.bureau-nav-item` vérifiés dans DOM |
| **Navigation** | Bouton Profil / Avatar en haut à droite | Ouvrir les paramètres ou le profil utilisateur | Ouvre la vue Portfolio (`PortfolioView`) avec titre "Mon Portfolio Officiel & Historique" | ⚠️ | Mineur | Libellé "Bonjour, Toi" / "Bonjour, Étudiant" sans écran de profil dédié |
| **Navigation** | Responsive Mobile (largeur 390px) | Menu burger ou barre adaptée, contenu lisible | La barre latérale se replie, contenu empilé en une colonne, cartes lisibles | ✅ | - | Émulation 390x844 vérifiée |
| **Bureau** | Bloc "Session en cours" | Affiche la session courante selon l'heure | Si aucune session en cours : affiche "Aucune session en cours" et proposition de démarrer | ✅ | - | Affichage dynamique dépendant des événements du jour |
| **Bureau** | Bloc "Prochains événements" | Liste les prochains cours/tâches du jour | Affiche les événements triés chronologiquement ; état vide propre | ✅ | - | Vérifié en état A (vide) et état B (avec cours) |
| **Bureau** | "Progrès langues" | Chiffres réels (séances, minutes) | Affiche le cumul réel par langue enregistrée, état vide explicite | ✅ | - | Dynamique, reflète les données de `LanguageEngine` |
| **Bureau** | "Raccourcis" | Boutons GitHub, YouTube, etc. | Liens externes fonctionnels dans un nouvel onglet | ⚠️ | Confort | Liens statiques en dur dans `DesktopView.js` |
| **Bureau** | Input "Le Coach" (`#desktop-ask-coach`) | Taper question + Entrée ouvre le chat avec la question | Ouvre la vue Coach avec le message déjà envoyé | ✅ | - | Redirection vers `chat` avec state transmis |
| **Planning** | Vue Semaine & grille horaire | Grille du lundi au dimanche, créneaux 8h-20h | Événements positionnés selon heure début/fin, couleurs par type | ✅ | - | Vérifié sur semaine courante |
| **Planning** | Ajouter événement (`#btn-add-event-planning`) | Modale d'ajout complète (titre, date, horaires, verrou) | Modale s'ouvre, champs validés, enregistre dans IndexedDB | ✅ | - | Création d'un événement "Cours de Maths" validée |
| **Planning** | Validation (fin avant début, titre vide) | Blocage avec message d'erreur | Alerte native ou message de validation, refus de soumission | ✅ | - | Testé avec heure fin < heure début |
| **Planning** | Import emploi du temps (`#btn-import-timetable`) | Lecture d'image/PDF/texte | Si pas de clé Gemini, message honnête indiquant qu'une clé est requise pour l'analyse IA | ✅ | - | Vérifié via test et modal d'import |
| **Calendrier** | Navigation mois préc./suiv. | Changement de mois, calcul jours exact | Mois 28/29/30/31 jours respectés, jour courant mis en surbrillance | ✅ | - | Clics sur `#btn-prev-month` et `#btn-next-month` |
| **Calendrier** | Filtres École / Langues / Vie | Masquage dynamique des catégories | Les pastilles d'événements se masquent/réaffichent sans rechargement | ✅ | - | Clics sur checkboxes filtres vérifiés |
| **École** | État vide initial | Message propre + boutons d'action | Affiche `#academic-empty-state` avec options "Ajouter matière" et "Exemple" | ✅ | - | Vérifié en état A |
| **École** | Semestre CRUD | Créer, modifier, supprimer un semestre | Création S1, modification de nom, confirmation de suppression | ✅ | - | Testé via `AcademicView` et modale |
| **École** | Matières CRUD | Créer, modifier, supprimer avec ECTS et code | Matières créées avec code, ECTS, affichage des cartes | ✅ | - | Testé et vérifié |
| **École** | Épreuves & Évaluations | Ajouter épreuve, date, coef, note max | Formulaire complet, pastille avec date et coef | ✅ | - | Testé avec CC et Partiel |
| **École** | Calculs des notes et moyennes | Moyenne pondérée par coef | Calcul mathématique exact : Somme(note*coef)/Somme(coef) | ✅ | - | Vérifié : calcul manuel = affichage UI |
| **École** | "Importer l'exemple" vs "Effacer l'exemple" | Effacer supprime UNIQUEMENT les données d'exemple | Seules les matières taggées `isExample: true` sont supprimées ; les matières manuelles restent | ✅ | - | Vérifié en état B et test `test_point_a_ecole_crud_and_clear.mjs` |
| **Focus** | Minuteur de focus | Décompte, pause, reprise, prolongation | Chronomètre fonctionnel, mise à jour temps réel | ✅ | - | Testé dans `FocusView` |
| **Focus** | Formulaire de fin de tâche | Statut, énergie, qualité, preuve (lien, texte, image) | Formulaire complet, aperçu de l'image, stockage dans `StudyRecord` | ✅ | - | Preuve texte et lien validées |
| **Bilan** | Check-in quotidien | Sommeil, énergie, blocages, évaluation | Soumission fonctionnelle, mise à jour de l'état du jour | ✅ | - | Saisie 7h sommeil / énergie basse enregistrée |
| **Bilan** | Réactivité énergie basse | Proposition d'allégement de planning | Détecté par le RiskEngine et proposition formulée | ✅ | - | Vérifié via `test_light_plan.mjs` |
| **Hebdo** | Bilan hebdomadaire | Statistiques réelles de séances et respect | Données issues de `WeeklyReviewEngine` et `DailySnapshotEngine` | ✅ | - | Si pas assez de jours, indique "pas assez de données" |
| **Langues** | Multi-langues & drapeaux | Ajout langue avec drapeau automatique | Japonais (🇯🇵), Anglais (🇬🇧), Espagnol (🇪🇸) auto-détectés | ✅ | - | Vérifié dans `LanguageView` et tests |
| **Langues** | Ressources associées | Lien, livre, appli, vidéo | CRUD complet des ressources, ouverture des liens externes | ✅ | - | Ajout et suppression testés |
| **Langues** | Suivi du travail | Minutes, séances, vocabulaire | Compteurs cumulés exacts, remontés au Bureau | ✅ | - | +30 min et +10 mots persistés |
| **Vie** | Habitudes | Création, toggle fait aujourd'hui, suppression | Coche toggle interactive, mise à jour visuelle immédiate | ✅ | - | "Méditation 10 min" créée et cochée |
| **Vie** | Objectifs & Jalons | Création objectif, pourcentage, complétion | Modal d'édition globale, affichage pourcentage | ✅ | - | "Courir un marathon" ajouté |
| **Vie** | Livres | Titre, total pages, pages lues | Modale d'ajout, mise à jour de la progression | ✅ | - | "Atomic Habits" ajouté |
| **Vie** | Bloc "Fitness & Bien-être" | Suivi hydratation, sommeil, énergie | Affiche uniquement les valeurs du check-in du jour ; AUCUN bouton de saisie directe | ⚠️ | Gênant | Cartes passives en lecture seule dans `LifeView.js` |
| **Vie** | Bloc "Ambiance Musicale" | Contrôles audio intégrés | Simple encart vert avec lien externe `https://open.spotify.com` | ⚠️ | Confort | Aucun player intégré, pure redirection |
| **Vie** | Citation "STAY FOCUSED" | Citation dynamique ou personnalisable | Citation statique en dur de Miyamoto Musashi avec photo Unsplash | ⚠️ | Mineur | Texte et image figés dans le code source |
| **Coach** | Chat sans clé Gemini | Réponses locales honnêtes tirées des données | Fallback local actif, mais renvoie un bloc factuel unique réordonné | ⚠️ | Bloquant | Ne répond pas directement à la question posée |
| **Coach** | Intention "Ajoute cours demain à 10h" | Ajout automatique de l'événement | Échec sans Gemini : l'intention n'est pas reconnue par `ChatIntentParser` (réservé aux devoirs/examens) | ❌ | Bloquant | L'événement n'est pas créé dans le planning |
| **Coach** | Question "Où j'en suis en anglais ?" | Situation du progrès en langues | Échec en local : `CoachLocalReply` ignore la table des langues | ❌ | Gênant | Renvoie la liste des cours/examens généraux |
| **Coach** | Question "Combien de livres j'ai lus ?" | Nombre total de livres terminés | Échec en local : ne mentionne que les livres délaissés depuis 5+ jours | ❌ | Gênant | Ne donne pas le total de livres lus |
| **Coach** | Question "Quel temps fait-il à Mars ?" | Réponse d'incompétence claire | Déverse le bloc factuel standard au lieu de dire "Je ne sais pas" | ❌ | Gênant | Manque de filtrage hors-domaine en local |
| **Portfolio** | Preuves et projets | Affichage des accomplissements réels | Affiche les projets, jalons et preuves de sessions d'étude | ✅ | - | Section preuves et projets fonctionnelle |
| **Portfolio** | Export JSON (`#btn-export-data`) | Téléchargement fichier JSON complet | Télécharge `learning_os_backup_*.json` contenant toutes les tables | ✅ | - | Vérifié : JSON valide et complet |
| **RAG / Doc** | Ingestion de documents de cours | Déposer un polycopié pour le RAG | Aucun écran ni bouton UI dans l'application pour charger un PDF/document de cours | ⛔ | Bloquant | Le code moteur existe (`KnowledgeEngine`) mais sans UI |

---

## 3. TABLEAU CRUD (Entité × Action)

| Entité | Créer (C) | Lire (R) | Modifier (U) | Supprimer (D) | Commentaire |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **Semestre** | ✅ | ✅ | ✅ | ✅ | Modale dédiée avec confirmation de suppression |
| **Matière** | ✅ | ✅ | ✅ | ✅ | Code, nom, ECTS, semestre de rattachement |
| **Épreuve / Évaluation** | ✅ | ✅ | ✅ | ✅ | Titre, coef, date, type, note max, note réelle |
| **Événement Planning** | ✅ | ✅ | ✅ | ✅ | Titre, type, horaires, récurrence, verrou |
| **Langue** | ✅ | ✅ | ✅ | ✅ | Nom, icône auto, niveau, objectif |
| **Ressource Langue** | ✅ | ✅ | ✅ | ✅ | Lien, livre, application, vidéo |
| **Suivi Langue** | ✅ | ✅ | ⚠️ | ❌ | Ajout cumulatif (minutes, vocabulaire) ; pas de modification/suppression d'une entrée historique |
| **Habitude (Life)** | ✅ | ✅ | ✅ | ✅ | Titre, toggle quotidien, suppression |
| **Objectif & Jalon (Life)** | ✅ | ✅ | ✅ | ✅ | Titre, deadline, pourcentage, suppression |
| **Livre (Life)** | ✅ | ✅ | ✅ | ✅ | Titre, pages totales, pages lues |
| **Tâche Personnelle (Life)** | ✅ | ✅ | ✅ | ✅ | Titre, date d'échéance, statut terminée |
| **Projet Personnel** | ✅ | ✅ | ✅ | ✅ | Nom, description, statut, calcul détermination |
| **Session Focus / Preuve** | ✅ | ✅ | ❌ | ❌ | Enregistré à la fin du focus ; non éditable après coup dans l'UI |
| **Check-in Quotidien** | ✅ | ✅ | ✅ | ❌ | Écrasable le jour même (re-soumission), pas de suppression |
| **Document de Cours (RAG)**| ❌ | ❌ | ❌ | ❌ | **Aucune interface utilisateur existante** |

---

## 4. FAUSSES INFORMATIONS & HALLUCINATIONS DÉTECTÉES
1. **Coach Local — Réponse identique quelle que soit la question** :
   - *Question* : `« Où j'en suis en anglais ? »`
   - *Réponse du coach* : `Aujourd'hui tu as cours : ... À venir : Partiel Algèbre ... Livres délaissés : ... As-tu un examen ou un devoir bientôt ?`
   - *Constat* : Le coach ne traite pas la question sur la langue et déverse des informations académiques sans rapport.
2. **Coach Local — Question hors-sujet** :
   - *Question* : `« Quel temps fait-il à Mars ? »`
   - *Réponse du coach* : Déverse le même résumé de cours et d'examens au lieu de répondre qu'il ne sait pas ou que c'est hors de son périmètre.
3. **Coach Local — Création d'événement non effectuée** :
   - *Question* : `« Ajoute un cours de maths demain à 10h »`
   - *Réponse du coach* : Déverse le résumé factuel existant. L'événement n'est absolument pas créé, sans message d'explication.
4. **Header Profil ("Bonjour, Étudiant")** :
   - L'affichage par défaut utilise "Étudiant" ou "Toi", sans possibilité directe dans un écran de configuration de changer son prénom.

---

## 5. TEXTES STATIQUES & ÉLÉMENTS DÉCORATIFS
1. **Citation Musashi dans `LifeView.js`** :
   `"Tu ne peux pas changer ton passé, mais tu peux détruire ton futur si tu restes bloqué dessus." — Miyamoto Musashi`.
   Cette citation est codée en dur (lignes 66-70) avec une image Unsplash figée. Elle ne change jamais.
2. **Bloc "Ambiance Musicale" dans `LifeView.js`** :
   Un conteneur stylisé aux couleurs de Spotify avec un bouton `<a href="https://open.spotify.com">`. C'est un lien hypertexte externe décoratif, sans contrôle multimédia, ni API Spotify, ni lecteur embarqué.
3. **Raccourcis dans `DesktopView.js`** :
   Boutons YouTube, Chrome, GitHub en dur avec des liens statiques.
4. **Widget Fitness dans `LifeView.js`** :
   Les mentions "💧 Hydratation : Non renseigné", "😴 Sommeil", "⚡ Énergie" sont de purs afficheurs passifs branchés sur le check-in du jour. Il n'y a aucun bouton "+" pour incrémenter un verre d'eau ou noter une séance de sport.

---

## 6. CE QUI EST INUTILE (Avis franc sur le code parasite)

| Fichier / Élément | Diagnostic & Rôle réel | Recommandation |
| :--- | :--- | :--- |
| `compute.py` (racine) | Script de 7 lignes encodant une chaîne de licence en Base32. Totalement hors-sujet. | **Supprimer immédiatement** |
| `fix.py` (racine) | Script de maintenance ponctuel ayant servi à remplacer des backticks échappés (`\`\``). Inutile en production. | **Supprimer** |
| `fix_tests.py` (racine) | Script ponctuel ayant servi à ajouter `process.exitCode = 1` dans les tests. Inutile en prod. | **Supprimer** |
| `run_all_tests.py` (racine) | Runner Python redondant avec npm/node. | **Supprimer** (ou remplacer par un script `package.json`) |
| `create_academic_mockup.py` | Générateur ponctuel de mockups HTML. Inutilisé par l'application. | **Supprimer** |
| `create_lang_mockup.py` | Générateur ponctuel de mockups HTML. Inutilisé par l'application. | **Supprimer** |
| `create_life_mockup.py` | Générateur ponctuel de mockups HTML. Inutilisé par l'application. | **Supprimer** |
| `update_academic.py` | Script ponctuel de réécriture de code. | **Supprimer** |
| `update_academic_view.py` | Script ponctuel de réécriture de code. | **Supprimer** |
| `update_desktop.py` | Script ponctuel de réécriture de code. | **Supprimer** |
| `update_english.py` | Script ponctuel de réécriture de code. | **Supprimer** |
| `update_mixed.py` | Script ponctuel de réécriture de code. | **Supprimer** |
| `mock_init.mjs` (racine) | Script de génération de données de test à la racine. | **Déplacer dans `tests/`** |
| `mock_timetable_gemini.mjs` | Faux mock de réponse Gemini pour l'emploi du temps. | **Déplacer dans `tests/`** |
| Dossier `tests/` (vide) | Dossier existant mais complètement vide alors que 59 fichiers `test_*.mjs` sont en vrac à la racine ! | **Garder et y regrouper tous les `test_*.mjs`** |
| `test_logic.js` (racine) | Test minimaliste obsolète de 746 octets. | **Supprimer ou fusionner** |
| Dossier `archive/` (`archive/v0/`) | Contient une ancienne version obsolète (`index.html` de 18 Ko). | **Supprimer** (l'historique Git conserve tout) |

---

## 7. CE QUI MANQUE DANS L'APPLICATION
1. **Interface utilisateur pour le RAG / Documents de cours** : Les moteurs `KnowledgeEngine`, `DocumentExtractor` et `KnowledgeRetriever` sont programmés dans `src/core/` et testés, mais il n'existe **aucun bouton dans l'interface** permettant à l'utilisatrice de téléverser un cours PDF ou des notes pour que le Coach les mémorise.
2. **Gestion conversationnelle des actions du quotidien** : Le coach ne sait pas ajouter une tâche personnelle, déplacer une séance, ou ajouter un cours via une commande naturelle en local.
3. **Intégration du domaine Langues dans le Coach** : Le coach local ignore les compétences et séances de langues.
4. **Widget d'action Fitness/Santé** : Possibilité d'incrémenter l'eau bue ou d'enregistrer une séance sportive directement dans l'onglet Vie sans devoir refaire tout le check-in du jour.
5. **Gestionnaire de profil** : Une vraie modale ou page permettant de configurer son prénom, son niveau d'études, et ses préférences.

---

## 8. ERREURS CONSOLE DÉDUPLIQUÉES

Pendant l'intégralité du cycle d'inspection (États A, B et C) :
- **Erreurs JavaScript (`console.error`)** : **0 erreur critique**. L'application démarre proprement et ne lève pas d'exception non gérée.
- **Avertissements (`console.warn`)** :
  1. `CoachAI: Échec du raisonnement LLM, fallback sur déterministe uniquement.` — Déclenché à chaque envoi de message dans le chat lorsqu'aucune clé Gemini n'est configurée (comportement attendu et géré par le fallback).
  2. `Service Worker registration failed` / non supporté — Déclenché dans certains contextes de navigation sans HTTPS ou avec sandbox stricte.

---

## 9. RÉSULTAT DES TESTS AUTOMATIQUES
- **Total des fichiers de test exécutés** : 58 fichiers `test_*.mjs` (hors `test_real_gemini.mjs` qui requiert une clé API réelle).
- **Résultat** : **58 / 58 RÉUSSIS (100% PASS)**
- **Durée totale d'exécution** : ~7,5 secondes.
- **Détail des suites clés** :
  - `test_point_a_ecole_crud_and_clear.mjs` : ✅ PASS (Isolation données réelles vs exemples validée)
  - `test_point_b_languages.mjs` : ✅ PASS (44 assertions validées)
  - `test_point_c_static_texts_and_empty_states.mjs` : ✅ PASS
  - `test_flexible_conflict.mjs` : ✅ PASS (Résolution des conflits d'agenda validée)
  - `test_ecart_1_daily_snapshot_trends.mjs` : ✅ PASS
  - `test_ecart_4_project_determination.mjs` : ✅ PASS
  - `test_coach_local_reply.mjs` : ✅ PASS

---

## 10. PROPOSITION DE PLAN DE CORRECTION

> **Rappel de la règle** : Rien n'est appliqué dans ce passage. Les correctifs sont listés pour décision conjointe.

### Priorité P0 (Bloquant pour l'expérience du Coach)
1. **Enrichir `CoachLocalReply` et `ChatIntentParser` pour traiter les commandes locales de base** :
   - Reconnaître les demandes d'ajout de cours ou de tâches dans le planning (`parsePlanningIntent`).
   - Connecter les données de `LanguageEngine` dans le contexte local du coach.
   - Répondre explicitement "Je ne dispose pas de cette information" en cas de question hors domaine au lieu de déverser le résumé standard.
   - *Fichiers concernés* : `src/ai/CoachLocalReply.js`, `src/ai/ChatIntentParser.js`, `src/ai/CoachAI.js`.
   - *Effort estimé* : **M** (Moyen).

### Priorité P1 (Gênant / Ergonomie & Complétude)
2. **Interface UI pour le KnowledgeEngine (RAG)** :
   - Ajouter un bouton d'import de document dans l'onglet École ou dans la modale d'une matière ("Déposer un cours / PDF / notes").
   - *Fichiers concernés* : `src/ui/AcademicView.js`, `src/core/KnowledgeEngine.js`.
   - *Effort estimé* : **M** (Moyen).
3. **Nettoyage et assainissement du dépôt Git** :
   - Supprimer les 12 scripts Python et temporaires à la racine (`compute.py`, `fix.py`, etc.).
   - Déplacer tous les fichiers `test_*.mjs` dans le sous-dossier `tests/` et créer un script npm standardisé `npm test`.
   - *Effort estimé* : **S** (Petit).
4. **Rendre interactif le widget Fitness & Bien-être dans `LifeView`** :
   - Permettre la saisie directe rapide de l'hydratation et du sport sans passer par l'ensemble du bilan.
   - *Fichiers concernés* : `src/ui/LifeView.js`.
   - *Effort estimé* : **S** (Petit).

### Priorité P2 (Confort & Clarté)
5. **Mise à jour de la documentation** :
   - Réécrire `ARCHITECTURE.md` pour refléter la Clean Architecture actuelle (moteurs IndexedDB, Coach, Langues).
   - Mettre à jour `docs/BUGS.md` et `docs/TODO.md`.
   - *Effort estimé* : **S** (Petit).
6. **Personnalisation du profil utilisateur** :
   - Ajouter un champ nom/prénom éditable dans le Portfolio pour remplacer "Étudiant" / "Toi".
   - *Fichiers concernés* : `src/ui/PortfolioView.js`, `src/ui/DesktopView.js`.
   - *Effort estimé* : **S** (Petit).

---

## 11. LIMITES DE CETTE INSPECTION
1. **Tests en conditions hors-ligne pures** : Le service worker a été inspecté et la persistance IndexedDB validée en local (127.0.0.1), mais une déconnexion matérielle de la carte réseau n'a pas été simulée pendant la session du sous-agent.
2. **Test du LLM réel Gemini** : Réalisé sans clé API conformément aux consignes strictes (aucune clé dans le code). Seul le comportement du fallback déterministe local a été évalué.
3. **Historique long terme (30+ jours)** : Les calculs de tendances et de régularité ont été vérifiés sur la base des algorithmes et des tests de simulation (`test_ecart_1_daily_snapshot_trends.mjs`), mais pas sur une base ayant réellement vécu 30 jours calendaires continus.
