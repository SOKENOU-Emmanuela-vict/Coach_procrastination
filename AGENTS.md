# Protocole de travail & Ordres de mission

Ce document définit les règles et le protocole d'intervention stricts pour ce projet.

---

## 📍 Dossier de travail
- **Emplacement unique** : `C:\Users\HP\OneDrive\Desktop\Projet\Coach_procrastination`
- **Règle absolue** : Aucune copie de fichiers ou de code ailleurs.

---

## 🔄 AVANT chaque mission / intervention
1. Exécuter `git status` et `git pull`.
2. S'il y a des changements non commités, **les commiter à part d'abord** avant d'entamer les modifications demandées.

---

## 🎯 Format type des missions
Lorsqu'un ordre de mission est communiqué, il suit généralement cette structure :
- **ORDRE DE MISSION n°X** : `<titre court>`
- **OBJECTIF** : `<une phrase>`
- **À FAIRE** :
  1. `<tâche précise, fichiers concernés>`
  2. ...

---

## 🚫 INTERDIT FORMELLEMENT
- **Aucune clé API** dans le code.
- **Aucune donnée inventée** (pas de mocks non justifiés ou de fausses données hors cadre de test).
- **Aucune tâche planifiée** (pas de timers/cron persistants non demandés).
- **Aucun push forcé** (`git push --force`).
- **Aucun reset destructif** (`git reset --hard`).

---

## ✅ CRITÈRES DE RÉUSSITE
- Comportement observable validé (ex. « le bouton X ajoute un Y visible dans l'écran Z »).
- **Tous les tests doivent être verts** (`test_real_gemini` exclu).
- **Un test automatisé dédié par tâche**.

---

## 🚀 APRÈS chaque intervention
1. **Un commit par tâche** avec un message clair et descriptif.
2. `git push`.
3. **Fournir un résumé de CE passage uniquement** :
   - Numéros / identifiants des commits créés.
   - Ce qui reste éventuellement à faire.
