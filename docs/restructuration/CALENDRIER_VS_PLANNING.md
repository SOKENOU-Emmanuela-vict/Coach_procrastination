# Comparaison détaillée : Calendrier vs Planning

Ce document dresse l'état des lieux comparatif entre `src/ui/CalendarView.js` et `src/ui/PlanningView.js` avant la fusion unifiée dans Planning.

## 1. Fonctionnalités de CalendarView (actuelles)

1. **Vue Mensuelle (Grille de mois)** :
   - Grille 7 colonnes affichant tous les jours du mois (`DIM`, `LUN`, `MAR`, `MER`, `JEU`, `VEN`, `SAM`).
   - Calcul du décalage initial (`firstDayIndex`) et du nombre de jours (`daysInMonth`).
   - Mise en évidence visuelle du jour actuel (`todayStr`).
   - Affichage des événements sous forme de pastilles ("pills") colorées avec titre, plage horaire (`startTime` - `endTime`), et indicateur `+N autres` au-delà de 4 événements par case.

2. **Navigation temporelle (Mois / Année)** :
   - Boutons Précédent (`#btn-prev-month`) et Suivant (`#btn-next-month`).
   - Gestion des transitions d'années (décembre -> janvier et janvier -> décembre).
   - Titre dynamique : Nom du mois en français + année (ex. `OCTOBRE 2026`).

3. **Filtres d'affichage par univers** :
   - Toggles visuels interactifs :
     - **École** (`#filter-school` - couleur cyan `#00f2fe`)
     - **Vie** (`#filter-life` - couleur magenta `#f093fb`)
     - **Langues** (`#filter-lang` - couleur orange `#ff9800`)
   - Filtrage instantané des pastilles affichées dans les cases des jours.

4. **Création, modification et suppression depuis la vue** :
   - Bouton global d'ajout : `#btn-add-event-calendar` ouvrant `app.openEventEditor({ date: todayStr })`.
   - Boutons contextuels sur chaque événement :
     - Modifier (`.btn-edit-event`) ouvrant `app.openEventEditor(eventObj)`.
     - Supprimer (`.btn-delete-event`) appelant `app.deleteCalendarEvent(eventId)`.
   - Clic direct sur une case de jour pour ajouter un événement à cette date précise.

5. **Widgets d'échéances et d'activités (Bottom Panels)** :
   - **Colonne 1 : Échéances École** : liste des 4 prochaines évaluations (`assessments` avec date cible, titre, coefficient).
   - **Colonne 2 : Échéances Vie** : liste des 4 prochaines tâches de projets personnels (`projects.tasks` non terminées).
   - **Colonne 3 : Sessions Langue** : liste des 4 prochaines sessions de langue prévues avec boutons modifier et supprimer.

6. **Recherche textuelle** :
   - Champ de recherche textuelle d'événements.

---

## 2. Fonctionnalités de PlanningView (actuelles)

1. **Vue Hebdomadaire (Emploi du temps horaire)** :
   - Grille 7 jours (Lundi à Dimanche) avec axe horaire 07:00 à 22:00.
   - Positionnement précis en hauteur et top des blocs selon `startTime` et durée / `endTime`.
   - Distinction visuelle École (cours, td, révision) vs Vie vs Force-N.
   - Bouton de lancement de session Focus (`.btn-start-focus`) sur les blocs de cours.

2. **Panneau latéral de productivité** :
   - **Session actuelle** : détection de l'événement en cours selon l'heure courante avec bouton direct "Démarrer une session".
   - **Suite du programme** : événements restants pour la journée avec horaires.
   - **À venir** : contrôle continu et examens prévus dans les 14 prochains jours.

3. **Import puissant d'emploi du temps** :
   - Modale multi-voies `#timetable-modal` :
     - Coller un texte brut (analyse via `ScheduleIngestionEngine`).
     - Saisie manuelle interactive en grille (avec validation heure début/fin).
     - Fichiers tableurs / bureautiques (.csv, .xlsx, .docx).
     - Détection Gemini avec message clair d'orientation si aucune clé.

4. **CRUD Événements** :
   - Bouton `#btn-add-event-planning`.
   - Boutons Modifier (`.btn-edit-event`) et Supprimer (`.btn-delete-event`).

---

## 3. Matrice des écarts : Ce qui manque au Planning avant fusion

| Fonctionnalité de CalendarView | Présente dans PlanningView ? | Action requise pour la fusion |
|---|---|---|
| Sélecteur de mode de vue (Semaine / Mois) | ❌ Non | Ajouter un switch d'affichage `Semaine` / `Mois` dans la topbar |
| Vue Grille Mensuelle complète (cases par jour) | ❌ Non | Intégrer le rendu mensuel complet avec décalage de jours |
| Navigation Mois Précédent / Mois Suivant / Année | ❌ Non | Ajouter les contrôles de navigation temporelle mensuelle |
| Pastilles d'événements dans chaque jour | ❌ Non | Afficher les pastilles cliquables avec titre, heure, actions |
| Ajout d'événement sur un jour précis (clic sur le jour) | ❌ Non | Permettre le clic sur une case de jour pour pré-remplir la date |
| Filtres par catégorie (École, Vie, Langues) | ❌ Non | Ajouter les filtres d'affichage commutables |
| Panneaux d'échéances École, Vie et Sessions Langue | Partiel (uniquement À Venir 14j) | Intégrer les 3 colonnes récapitulatives en vue Mois |
| Navigation Hebdomadaire (Semaine précédente / suivante) | ❌ Non (figé sur semaine actuelle) | Ajouter les flèches semaine précédente / semaine suivante |

---

## 4. Plan de fusion dans PlanningView

1. Conserver l'état de vue courant (`this.viewMode = 'week' | 'month'`) avec persistance session.
2. Ajouter le sélecteur Semaine / Mois dans la barre supérieure de Planning.
3. Rendre la grille hebdomadaire quand `viewMode === 'week'`, et la grille mensuelle quand `viewMode === 'month'`.
4. En vue mois : intégrer les filtres d'affichage (École, Vie, Langue), la navigation entre les mois, l'affichage des pastilles avec modification/suppression, le clic sur un jour pour ajouter un événement, et les 3 widgets du bas (Échéances École, Échéances Vie, Sessions Langue).
5. En vue semaine : conserver la timeline horaire, le panneau latéral (Session actuelle, Suite, À venir), et l'import d'emploi du temps. L'import d'emploi du temps reste accessible et effectif quel que soit le mode de vue actif.
6. Assurer le support sans dépendance externe et le respect strict du design system CSS existant (sans nouveaux styles inline ni couleurs en dur).
