# Design System Learning OS (Architecture en 2 Couches)

## 1. Architecture
Le design system sépare strictement la structure technique et l'ambiance visuelle :
- **Couche 1 (Base Commune - `main.css`)** : Grille de 4/8 px (`--space-1` à `--space-10`), échelle typographique (`--text-xs` à `--text-2xl`), polices système locales (`--font-sans`, `--font-serif`, `--font-mono`), hauteurs tactiles (≥ 42 px) et structure des composants (`.btn`, `.form-input`, `.card`, `.badge`, `.data-table`, `.tabs`, `.alert`, `.modal-box`).
- **Couche 2 (Univers - `univers-*.css`)** : Pilotée par l'attribut HTML `data-univers="bureau|ecole|vie|langues"`. Chaque univers redéfinit les variables de palette (`--bg-page`, `--bg-surface`, `--text-primary`, `--accent-primary`), la police des titres (`--font-heading`), les rayons (`--card-radius`, `--btn-radius`) et les ombres.

## 2. Ambiances Définies
- `data-univers="bureau"` : Style Notion clair, quasi blanc, minimaliste, boutons bleu ardoise, rayons stricts 5–6 px, ombres très subtiles.
- `data-univers="ecole"` : Ambiance académique et sérieuse, fond papier/ivoire, encre vert bouteille / bleu nuit, titres à empattements (serif), tableaux façon relevé de notes, accents bordeaux pour échéances.
- `data-univers="vie"` : Ambiance douce et apaisante, tons naturels (sauge, sable, terre cuite), formes arrondies (10–14 px), cartes aérées, micro-interactions douces.
- `data-univers="langues"` : Ambiance éditoriale & voyage, typographie expressive, cartes façon fiches de vocabulaire, accents différenciés par langue.

## 3. Guide d'Ajout d'un Nouvel Univers
Pour ajouter un univers (ex. `univers-sport.css`) :
1. Créer `src/ui/styles/univers-sport.css` et déclarer les variables sous le sélecteur `[data-univers="sport"]` (et sa variante `[data-theme="dark"]`).
2. Définir les variables clés : `--bg-page`, `--bg-surface`, `--text-primary`, `--accent-primary`, `--card-radius`, `--btn-radius`.
3. Ajouter `@import './univers-sport.css';` dans `src/ui/styles/main.css`.
4. Appliquer `data-univers="sport"` sur le conteneur principal de la vue concernée.
