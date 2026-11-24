# PRAGMA PMS — Informe de regresión

**Fecha:** 2026-11-24  
**Baseline app prod pre-deploy:** `pragma-f22ol8t69`  
**PITR marker Neon:** `2026-11-24T08:42:22Z` (antes de migrate prod)

---

## Pruebas automatizadas ejecutadas

| Suite | Resultado |
|-------|-----------|
| `tests/auth/full-sign-out-uat.test.ts` | PASS |
| `tests/integrations/integration-health.test.ts` (22) | PASS |
| `tests/dashboard/operations-center-compose.test.ts` | PASS |
| `tests/web-builder/web-reservation-code.test.ts` | PASS |
| `tsc --noEmit` | 1 error preexistente en `public-app-url-staging.test.ts` (NODE_ENV readonly) — no introducido |

## Controles anti-regresión verificados en código

| Control | Evidencia |
|---------|-----------|
| Logout limpia UAT | `useClientSignOut` → `performFullSignOut` |
| Banner vacío falso | `reliablePropertyCount === 0` (no soft-fail 0) |
| TTLock/guest-reg swap | Orden Promise.all corregido |
| Stay no enumerable | Token ≥16; lookup solo por token |
| Público stay | `/stay/(.*)` en proxy |
| WEB_BUILDER sin email | Inalterado (`[WEB_BUILDER]` skip) |
| Soft-fail panel | Conservado + count independiente |

## Migraciones

| Entorno | Estado |
|---------|--------|
| Staging dawn-union | Aplicadas hostProfile + TRA fields |
| Prod purple-block | Aplicadas (aditivas) |

## Pendiente de smoke en prod post-deploy

- Panel con propiedades reales (sin banner falso)
- Logout + Back
- `/urbanovaloft` público
- `/stay/{token}` tras registro
- PriceLabs health badge coherente
- Integraciones “Recuperar conexiones”
