# PRAGMA PMS — Informe final de intervención

**Fecha:** 2026-11-24  
**Worktree:** `pragma-pms-web-builder` · rama `feat/pragma-web-builder`  
**Producción:** https://www.pragmapms.com  
**Deployment:** `dpl_7FWqfgxZBMgauRwCfRqKQ6ZWR5Du` (`pragma-54k76lb6e`)  
**Rollback app:** re-alias a `pragma-f22ol8t69`  
**PITR Neon marker:** `2026-11-24T08:42:22Z` (antes de migraciones aditivas)

---

## 1. Qué se auditó

Arquitectura Next/Clerk/Prisma/Neon/Vercel; panel/ops-center; guest registration + WEB BUILDER booking; proxy/públicas; logout/settle; PriceLabs/TTLock/Airbnb/SIRE/TRAA; WebBuilder media; urban-boutique; requisitos TRA/SIRE oficiales.

Documentos: `PRAGMA_MASTER_AUDIT.md`, `PRAGMA_IMPLEMENTATION_PLAN.md`.

## 2–3. Problemas y causas raíz

| Hallazgo | Causa raíz |
|----------|------------|
| Banner “sin propiedades” falso | Soft-fail de command-center → `totalPropertyCount: 0` |
| KPIs TTLock / guest-reg incoherentes | Swap en desestructuración `Promise.all` |
| Logout incompleto | Menús no usaban `performFullSignOut` (UAT residual) |
| Sin página de estadía | Solo registro; no hub post-COMPLETE |
| PriceLabs “desconectado” engañoso | Salud ≈ status org, no evidencia de sync |
| CIRE | No existe en Colombia/repo → SIRE + TRA |
| SIRE/TRA transmisión | Solo connection-test stubs |

## 4. Archivos modificados (núcleo)

Auth: `use-client-sign-out.ts`, `full-sign-out.ts` (reuse)  
Panel: `operations-center.compose.ts`, `command-center.service.ts`, `panel/page.tsx`, `operations-donut-strip.tsx`, `command-center-view.tsx`  
Guests: `guest-stay.service.ts`, `app/stay/[token]/page.tsx`, `guest-registration.*`, schema TRA  
Integraciones: `integration-health/*`, actions, section, PriceLabs badge  
Web/Host: urban-boutique host section, `hostProfile`, web-builder hub media category  
Proxy: `/stay/(.*)`  
Docs: `docs/audits/PRAGMA_*.md`  
Migrations: hostProfile + TRA guest fields (aditivas)

## 5. Componentes reutilizados

Clerk settle/bridge, `performFullSignOut`, guest registration tokens, soft-fail compose, web-media, PriceLabs/TTLock/Airbnb sync existentes, urban-boutique template, `[WEB_BUILDER]` email skip.

## 6. Funcionalidades implementadas por tarea

| # | Resultado |
|---|-----------|
| T1 | Stay page tokenizada; redirect post-registro; prefill booking; campos TRA titular; **sin** API SIRE/TRA (bloque externo) |
| T2 | Banner fiable; swap KPIs; donuts ocupación/entradas/salidas/activas |
| T3 | Públicas OK; `/stay` público; panel sigue protegido |
| T4 | Logout completo con expiración UAT |
| T5 | Persistencia Clerk intacta; coherente con T4 |
| T6 | Media hub: categoría al subir URL; hero/cover existentes |
| T7 | Recovery unificado + botón admin (idempotente / cooldown) |
| T8 | Estados CONNECTED/DEGRADED/… con evidencia; PriceLabs badge corregido |
| T9 | Sección anfitrión/about + CMS `hostProfile` (sin reseñas inventadas) |

## 7–9. Pruebas

**Pasaron:** 30 unit tests (auth invariants, integration-health×22, ops-center, web-reservation-code).  
**tsc:** 1 error preexistente (`NODE_ENV` en test staging).  
**Smoke prod:**  
- `/urbanovaloft` → 200 (dpl_7FW…)  
- `/stay/invalid…` → 200 “Enlace no disponible”  
- `/panel` → 307 → `/sign-in` (Clerk signed-out)  

**No ejercidos en vivo contra proveedor:** recovery TTLock/PriceLabs real; logout multi-pestaña manual; E2E booking→registro→stay end-to-end en prod.

## 10. Integraciones verificadas

| Integración | Evidencia |
|-------------|-----------|
| PriceLabs mapping | Unit tests + código badge |
| TTLock / Airbnb iCal / SIRE / TRAA mapping | Unit tests |
| Operación real post-deploy | **No re-verificada** contra APIs externas en esta corrida |

## 11. Cambios en producción

- Código `dpl_7FWqfgxZBMgauRwCfRqKQ6ZWR5Du` aliased a www  
- Migraciones aditivas en purple-block aplicadas

## 12. Pendientes / bloqueos externos

1. Transmisión automática SIRE (Migración) y TRA (MINCIT) — faltan credenciales/pipeline de reporte (hoy solo test de conexión).  
2. Reseñas Airbnb automatizadas — sin mecanismo autorizado; usar testimonios manuales en WebBuilder.  
3. QA manual Owner: logout+Back, panel con impersonación, “Recuperar conexiones”, completar hostProfile editorial.  
4. Worktree local `pragma-pms` sigue divergente — no es fuente de deploy.

## 13. Versión desplegada

`dpl_7FWqfgxZBMgauRwCfRqKQ6ZWR5Du` → https://www.pragmapms.com

## 14. Rollback

```bash
npx vercel alias set https://pragma-f22ol8t69-pragma-s-projects.vercel.app www.pragmapms.com
npx vercel alias set https://pragma-f22ol8t69-pragma-s-projects.vercel.app pragmapms.com
```

Datos: Neon PITR desde `2026-11-24T08:42:22Z` si hiciera falta (columnas aditivas son compatibles hacia atrás).
