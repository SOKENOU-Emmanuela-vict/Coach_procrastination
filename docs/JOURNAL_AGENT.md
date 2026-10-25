# Journal Agent — Learning OS

| Date | Tâche | Statut |
|---|---|---|
| 2026-10-25 | Phase 0.7 — Retrait de `AGENTS.md` de `.git/info/exclude`, ajout de `AGENTS.md` au suivi Git et création du journal | fait |
| 2026-10-25 | Phase 0.1 — `package.json` minimal sans `"type": "module"`, versions exactes en `devDependencies`, `server.js` + `test_security_server.mjs` vérifiés | fait |
| 2026-10-25 | Phase 0.3 — `vendor/` portable (`scripts/setup_vendors.mjs`), licences, `vendor/README.md`, suppression de `scripts/verify_gsap.mjs`, des dossiers vides `src/coach/` et `src/ui/components/`, puis de `node_modules/` | fait |
| 2026-10-25 | Phase 0.2 — Conservation de `metadata.pageStart`/`pageEnd` et découpage PDF paginé dans `KnowledgeEngine` + chargement autonome `vendor/` dans `DocumentExtractor` | fait |
| 2026-10-25 | Phase 0.5 — Génération des fixtures (`scripts/make_fixtures.mjs` -> `tests/fixtures/`) et suite de tests dédiée T1 (`test_v1_t1_documents.mjs`) sans `node_modules` | fait |
| 2026-10-25 | Phase 0.4 — Service Worker `sw.js` (106 ressources précachées via `scripts/update_sw_assets.mjs`, réseau d'abord + cache dynamique `vendor/`), test `test_sw_precache.mjs` et vérification Chrome hors-ligne / mise à jour en ligne | fait |
| 2026-10-25 | Chantier V1 (T2, T3, T4) — En attente du contenu de `ORDRE_V1_IMPORT_DOCUMENTS_COACH.md` | suite |
