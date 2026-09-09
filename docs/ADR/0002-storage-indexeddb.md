# ADR 0002 : Migration vers IndexedDB pour la persistance en production

**Date** : 2026-09-09

## Contexte
L'architecture initiale documentée dans l'ADR-0001 utilisait `StorageProvider` implémenté par `LocalStorageProvider` et `MemoryProvider`. 
Au fur et à mesure du développement du Learning OS, les besoins en stockage ont dépassé les capacités et la robustesse offertes par `localStorage`.

## Décision
L'application de production utilise désormais `IndexedDBProvider` comme implémentation principale de l'interface `StorageProvider`.
`MemoryProvider` reste strictement utilisé et conservé pour l'architecture de tests.
`LocalStorageProvider` est désormais considéré comme obsolète.

## Justification
- `IndexedDB` permet un stockage asynchrone, plus large et plus structuré pour les données complexes du Learning OS (historique complet des sessions, événements académiques, cache du graphe de compétences).
- Le code de production (`Bootstrap.js`) inclut déjà un script de migration automatique des anciennes données de `localStorage` vers `IndexedDB` et initialise exclusivement `IndexedDBProvider`.

## Conséquences
- L'interface `StorageProvider` est validée comme une abstraction réussie, permettant ce changement sans casser la logique métier (Engines).
- `LocalStorageProvider.js` n'est plus nécessaire dans le code de production et est supprimé pour éviter la dette technique et la confusion.
