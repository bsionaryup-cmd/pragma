# PRAGMA PMS — Consolidación total en `main` (informe final)

**Fecha:** 2026-11-24  
**Commit definitivo `origin/main`:** ver tip al final de sesión (`9134574` + protocolo docs)  
**Producción:** `dpl_8maq9t5KyhfM6Eh6FZfaF8xaZzuQ` → https://www.pragmapms.com

---

## 1. Ramas inspeccionadas

- `origin/main`, `origin/feat/pragma-web-builder`
- `origin/cursor/apify-prospecting-engine` (+ 61 commits exclusivos)
- `backup/web-builder-wip-20261124-044611`, `backup/apify-wip-20261124-044611`
- `backup/apify-stashes-ref-20261124-045702`
- Worktrees: `pragma-pms`, `pragma-pms-web-builder`, `pragma-pms-tarifas-deploy`
- Stashes en apify (3 entradas documentadas)

## 2. Funcionalidades recuperadas por origen

| Origen | Incorporado a main |
|--------|--------------------|
| Web Builder / main | URBAN BOUTIQUE, `/urbanovaloft`, `/w/[slug]`, booking WEB, media, host profile, panel donuts, ops-center, integration-health, TRA fields |
| Apify | Stay Portal (token + UX), TTLock operational access, occupancy manual, login unificado `/login`, Master Simplification (sin bandeja/reservas/tareas en nav), HTTPS guest links, PriceLabs customizations, auth/logout polish |
| Unión | Nav con **WEB BUILDER** + simplificación; proxy con rutas públicas unidas; schema Prisma aditivo |

## 3. Conflictos

46 conflictos resueltos en `integrate/total-consolidation-20261124` **sin** ours/theirs global. Decisiones clave: Stay Portal Apify + bridge legacy GR token; ops-center/panel de main; nav con webBuilder; proxy unión; schema unión.

## 4. Consolidadas

Una sola línea: `origin/main` contiene WEB BUILDER + Stay Portal + TTLock ops + panel + auth unificado.

## 5. Pruebas

| Check | Resultado |
|-------|-----------|
| `tsc --noEmit` (sin `.next` stale) | PASS |
| ESLint navigation (error crítico) | PASS (warnings menores) |
| Unit tests (49: health, nav, stay-url, TTLock ops, occupancy) | PASS 49/49 |
| `prisma validate` | PASS |
| `npm run build` | PASS |
| Smoke www `/urbanovaloft` | 200 |
| Smoke `/stay/invalid…` | Portal no disponible (token inválido — correcto) |
| `/web-builder` | 307 → `/login` (protegido — correcto) |
| `/login` | 200 |

## 6. GitHub

`origin/main` = tip consolidado.  
`feat/pragma-web-builder` alineada.  
Ramas `backup/*` y `cursor/apify-prospecting-engine` conservadas.

## 7. Cursor / local

**Carpeta principal:** `C:\Users\R160\Desktop\pragma-pms` → rama **`main`**, sync con `origin/main`.  
Worktree web-builder conservado temporalmente en el mismo commit.

## 8. Vercel

Deploy desde checkout `main`: `dpl_8maq9t5KyhfM6Eh6FZfaF8xaZzuQ` aliased a www.  
**Pendiente manual en dashboard Vercel:** conectar repo GitHub y fijar **Production Branch = `main`** para auto-deploy (hoy el flujo operativo es CLI desde `main`).

## 9. Commit definitivo

Tip de consolidación: merge `99482d0` + stay bridge + tip docs protocolo (consultar `git log -1 origin/main`).

## 10. Worktrees / respaldos

Conservar ≥ 30 días: backups remotos, worktrees históricos, rama apify.  
No eliminar hasta verificación operativa del owner.

## 11. ¿Quedan funcionalidades válidas fuera de main?

**No intencionalmente.** Apify está mergeada. Stashes antiguos (3) documentados — revisar si contienen WIP no commiteado histórico; el tip apify ya incluía el WIP backup.

### Stay “Enlace / Portal no disponible”

- Token **inválido** → mensaje de no disponible (**esperado**, anti-enumeración).
- Token de **guest-registration completado** → bridge a `StayPortalToken`.
- Acceso legítimo: `/stay` con código+flujo Apify, o URL con token de portal.

Protocolo: `docs/architecture/PRAGMA-SSOT-PROTOCOL.md`
