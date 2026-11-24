# PRAGMA PMS — Recuperación y sincronización total

**Fecha:** 2026-11-24  
**Repo:** `https://github.com/bsionaryup-cmd/pragma.git`

---

## 1. Problema que existía

Había **tres estados vivos** desalineados:

| Superficie | Estado previo |
|------------|---------------|
| Cursor local `pragma-pms` | Rama `cursor/apify-prospecting-engine` + WIP grande sin commit |
| Worktree `pragma-pms-web-builder` | `feat/pragma-web-builder` @ `40f7447` + **~97 archivos WIP** (plan maestro) |
| GitHub `main` | `40f7447` (WEB BUILDER commitado) **sin** el WIP del plan maestro |
| Producción www | Deploy CLI desde working tree web-builder (**código no en GitHub**) |

Por eso: local ≠ prod (sin WEB BUILDER / sin donuts) y prod ≠ GitHub.

---

## 2. Rama más completa (funcional)

| Criterio | Ganador |
|----------|---------|
| **Producción actual + WEB BUILDER + Panel/donuts + stay token + integration-health** | `feat/pragma-web-builder` / ahora **`main` @ `56babbe`** |
| Stay Portal UX pulido, TTLock decrypt/operational, occupancy manual, PriceLabs customizations, cleanup módulos | `cursor/apify-prospecting-engine` @ `7857b62` (**NO fusionado** a main) |

**Decisión:** `main` = versión oficial de producción (WEB BUILDER + intervención).  
**Apify** se conserva intacta; merge automático **detenido** por solapamientos masivos (`changed in both` en decenas de archivos).

---

## 3–4. Cambios recuperados e integrados

### Recuperados (backup + commit)

- `backup/web-builder-wip-20261124-044611` → `56babbe` (100 files)
- `backup/apify-wip-20261124-044611` → incluido en `cursor/apify-prospecting-engine` @ `7857b62`

### Integrados a oficial

- FF `feat/pragma-web-builder` → `main` (`40f7447` → `56babbe`)
- Push: `origin/main`, `origin/feat/pragma-web-builder`, ambas ramas `backup/*`, `origin/cursor/apify-prospecting-engine`

### NO integrados (decisión pendiente del owner)

Todo lo único de apify (stay-portal redesign, TTLock operational access, occupancy edit, etc.) — requiere cherry-pick/PR revisado, no merge a ciegas.

---

## 5. Conflictos

- Merge tree apify → main: **múltiples `changed in both`** (proxy, auth, guests, reservations, panel, …).
- **No se ejecutó merge** de apify a main.

---

## 6. Estado GitHub (post-sync)

| Ref | SHA |
|-----|-----|
| `origin/main` | `56babbe` |
| `origin/feat/pragma-web-builder` | `56babbe` |
| `origin/cursor/apify-prospecting-engine` | `7857b62` |
| `origin/backup/web-builder-wip-20261124-044611` | `56babbe` |
| `origin/backup/apify-wip-20261124-044611` | (tip apify backup) |

`main` ↔ `feat/pragma-web-builder`: **0 / 0** (idénticos).

---

## 7. Estado local

| Worktree | Rama | Uso |
|----------|------|-----|
| `pragma-pms-web-builder` | `feat/pragma-web-builder` @ `56babbe` | **SSOT desarrollo / deploy** |
| `pragma-pms` | `cursor/apify-prospecting-engine` @ `7857b62` | Conservar trabajo apify |
| `pragma-pms-tarifas-deploy` | `deploy/tarifas-ux-2026-07-29` | Histórico; no tocar |

---

## 8. Estado producción

- Proyecto Vercel: `pragma-pms`
- Alias: `www.pragmapms.com` / `pragmapms.com`
- Deploys recientes vía **Vercel CLI** desde worktree (no necesariamente git integration).
- Redeploy post-commit para alinear binario con `56babbe` (ver log de sesión).

---

## 9. Pruebas ejecutadas

| Check | Resultado |
|-------|-----------|
| `tsc --noEmit` | PASS |
| ESLint (panel/donuts/compose/stay/sign-out) | PASS (exit 0) |
| Unit tests (33: health, nav, stay-url, web code, auth) | PASS 33/33 |
| `prisma validate` | PASS |
| `npm run build` | PASS |
| Neon fingerprints | purple-block (local), dawn-union (staging) — sin migraciones destructivas |
| Smoke www `/urbanovaloft`, `/stay/...` | Verificar en sesión de deploy |

---

## 10. Qué conservar / eliminar después

| Recurso | Recomendación |
|---------|---------------|
| Worktree `pragma-pms-web-builder` | **Conservar** — SSOT |
| Worktree `pragma-pms` (apify) | **Conservar** hasta cherry-picks |
| Worktree `tarifas-deploy` | Conservar o archivar tras confirmación |
| Ramas `backup/*` | **Conservar ≥ 30 días** |
| `feat/pragma-web-builder` | Puede quedar alineada a main o cerrarse tras PR formal |
| Merge apify → main | **Solo con PR y plan de conflictos** |

### Opciones pendientes (requieren tu decisión)

**A.** Cherry-pick selectivo apify → main (stay-portal UX, TTLock operational, occupancy).  
**B.** Dejar apify como rama de laboratorio.  
**C.** Configurar Vercel Production Branch = `main` (git-connected) para dejar de depender solo del CLI.

---

## Reglas cumplidas

- Sin `reset --hard`, `clean`, force push, ni borrado de worktrees/ramas.
- Historial conservado (FF + backups).
- Apify no fusionado automáticamente.
- Sin migraciones destructivas ni cambios de datos.
