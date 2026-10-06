# BUGS & PROBLEMES CONNUS

## 🐞 BUGS V1 (À corriger en priorité)
- [ ] Le LLM peut parfois suggérer des dates de révision obsolètes (partiellement corrigé en retirant les contraintes strictes du LLM, mais à surveiller si le modèle hallucine des champs).
- [ ] La vue Portfolio (Desktop) pourrait nécessiter un refactoring pour être totalement "responsive" et accessible sur de plus petits écrans.
- [ ] Les conflits d'agenda ne sont pas toujours bloquants si l'import d'emploi du temps chevauche des événements manuellement créés.

## 🛠 LIMITATIONS TECHNIQUES
- [ ] Dépense de tokens LLM : Aucun fallback local (modèle SLM) pour le Coach si quota API épuisé.
- [ ] RAG / Knowledge Engine : La sémantique de récupération est basique (recherche par mot-clé pour le moment), nécessiterait des embeddings vectoriels.
