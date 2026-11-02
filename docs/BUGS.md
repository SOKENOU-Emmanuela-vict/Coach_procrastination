# BUGS, TROUS DE GESTION & LIMITES TECHNIQUES CONNUES

Ce document recense les trous fonctionnels audités, les anomalies et les limites de l'architecture.

---

## 🛠 AUDIT W2 : TROUS DE CRÉATION, MODIFICATION ET SUPPRESSION (TRAITÉ)
L'audit complet des entités manipulables a été effectué lors de l'ordre de mission W2 :
1. **Langues** :
   - *Création / Modification* : Nom, niveau, objectif, ressources (liens, manuels, applis, vidéos), plan d'apprentissage (séances/semaine, durée, jours).
   - *Suivi (Tracking)* : Séances faites, minutes étudiées, mots de vocabulaire — incrément rapide (+1, +30m, +10), saisie manuelle et remise à zéro avec confirmation.
   - *Suppression* : Suppression unitaire de ressource et suppression de langue complète avec message d'avertissement explicite sur les données supprimées.
2. **Focus & Séances d'étude (StudyRecords)** :
   - *Historique* : Liste des séances passées visible directement sur la vue Focus (date, durée, statut, note, difficulté, réflexion).
   - *Modification* : Note de qualité (1 à 5), difficulté (🟢/🟡/🔴) et commentaire modifiables a posteriori.
   - *Suppression de preuve* : Possibilité de supprimer une capture d'écran / preuve sans supprimer la séance associée.
   - *Suppression de séance* : Suppression définitive de la séance d'étude avec confirmation.
3. **Bilan du jour (Check-in)** :
   - *Modification* : Le check-in validé peut être rouvert et réédité (énergie, sommeil, bilan, blocages).
   - *Suppression* : Bouton de suppression du bilan d'un jour précis (`deleteCheckIn`) avec confirmation.
4. **Vie quotidienne & Bien-être** :
   - *Hydratation* : Saisie rapide (+1 verre / 250ml), saisie au verre ou litre, effaçable en un clic.
   - *Sommeil* : Saisie directe des heures et de la qualité, effaçable.
   - *Énergie* : Sélecteur direct 1 à 5 en un clic (avec libellés Basse / Moyenne / Haute), effaçable.
   - *Sport / Activité physique* : Saisie rapide de l'activité du jour avec durée en minutes, modifiable et effaçable.
   - *Bilan* : Raccourci vers le bilan complet ou effacement.
5. **Autres entités de l'application** :
   - Planning (Événements) : Création, modification globale (`global-item-editor-modal`), suppression avec confirmation.
   - École (Matières, Évaluations, Notes) : Création, édition, suppression unitaire, et vidage complet avec confirmation.
   - Projets, Objectifs, Habitudes, Livres : Tous modifiables et supprimables via `global-item-editor-modal`.
   - Documents de cours (RAG) : Importation PDF/DOCX/TXT/XLSX et suppression / purge documentaire.

---

## 🐞 ANOMALIES & LIMITES FONCTIONNELLES
1. **Restauration de sauvegarde volumineuse** :
   - L'import d'une archive contenant des dizaines de captures d'écran en base64 de haute résolution peut augmenter la taille du stockage IndexedDB au-delà de 50 Mo. La redimension automatique à ≤ 256 px pour les avatars évite ce problème sur les profils.
2. **Résolution des conflits d'emploi du temps complexe** :
   - Lorsqu'un emploi du temps importé chevauche des disponibilités manuelles très fragmentées, PlanningAI priorise les cours fixes mais ne suggère pas toujours le déplacement le plus court pour les créneaux libres.
3. **Persistance multi-onglets simultanés** :
   - Si l'application est ouverte dans deux onglets simultanément et que des modifications divergentes sont effectuées, le dernier onglet écrivant dans IndexedDB écrase les clés sans notification inter-onglets (BroadcastChannel non implémenté).

---

## ⚡ LIMITES TECHNIQUES (LLM & INFRASTRUCTURE)
1. **API Gemini & Quotas** :
   - En mode hors-ligne ou si le quota Google AI Studio est dépassé (HTTP 429), le Coach bascule sur le moteur local déterministe (`CoachLocalReply`). Les réponses restent pertinentes pour les actions courantes mais ne disposent pas de l'analyse en langage naturel approfondie.
2. **Recherche sémantique RAG** :
   - La recherche de chunks documentaires utilise un scoring lexical normalisé (BM25 / TF-IDF light). Elle ne supporte pas encore les embeddings neuronaux vectoriels locaux (ex: Transformers.js).
3. **Notifications natives** :
   - Les notifications de fin de Focus nécessitent l'autorisation du navigateur (`Notification.requestPermission`). Si l'utilisateur refuse, seul le carillon sonore Web Audio est joué.
