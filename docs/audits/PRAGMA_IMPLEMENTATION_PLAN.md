# PRAGMA PMS — Plan de implementación (9 tareas)

**Basado en:** `PRAGMA_MASTER_AUDIT.md` (2026-11-24)  
**Fuente de código / deploy:** `pragma-pms-web-builder` @ `feat/pragma-web-builder`  
**Regla:** no iniciar código de una subtarea sin auditoría del componente afectado (ya cubierta en auditoría maestra + puntuales abajo).

---

## Orden de ejecución (dependencias técnicas)

| Orden | Tareas | Motivo |
|-------|--------|--------|
| 1 | **T4 + T5** | Logout completo + persistencia coherente |
| 2 | **T2** (bugs críticos) | Swap Promise.all + banner false-empty |
| 3 | **T8 + T7** | Estados con evidencia + recovery sobre la misma fuente |
| 4 | **T1** | Stay page + campos TRA + prefill; SIRE/TRA report = best-effort |
| 5 | **T2** (rediseño UI) | Donuts / simplificación tras datos confiables |
| 6 | **T3** | Verificación + gaps menores (ya mayormente OK) |
| 7 | **T6** | Media WebBuilder por secciones públicas |
| 8 | **T9** | Sección anfitrión / reputación (manual si no hay API) |
| 9 | Tests → prod → informes | Fases D–F |

Numeración original de tareas se conserva en docs y commits.

---

## T4 — Cierre de sesión

| Ítem | Detalle |
|------|---------|
| Archivos | `use-client-sign-out.ts`, `full-sign-out.ts`, `sidebar-user-menu.tsx`, `owner-account-menu.tsx` |
| Cambio | `useClientSignOut` debe llamar `performFullSignOut` (expira UAT + Clerk signOut) |
| DB | Ninguno |
| Riesgo | Bajo |
| Pruebas | Unit: UAT expire helpers; manual: logout → back → no dashboard |
| Aceptación | Tras “Cerrar sesión”, sin `__client_uat` usable; rutas privadas 307/401 a sign-in; sin datos sensibles vía Back |

## T5 — Persistencia

| Ítem | Detalle |
|------|---------|
| Archivos | Settle bridge, `establish-session`, `session-ready`, login forms (ya existen) |
| Cambio | No debilitar persistencia; alinear con T4. Verificar que reload/tab restore no contradiga logout |
| DB | Ninguno |
| Riesgo | Medio (regresión bounce) |
| Aceptación | Sesión Clerk válida → continuidad; logout voluntario → no continuidad |

## T2 — Panel (bugs primero)

| Ítem | Detalle |
|------|---------|
| Archivos | `command-center.service.ts`, `operations-center.compose.ts`, `panel/page.tsx`, `command-center-view.tsx` |
| Cambio A | Corregir orden desestructuración TTLock ↔ guest-reg |
| Cambio B | Contar propiedades **fuera** del soft-fail vacío; `showEmptyBanner` solo con count real 0; flag `degraded` si CC falló |
| Cambio C (UI) | Simplificar vista: KPIs donut (ocupación, entradas/salidas hoy, activas) con datos reales |
| DB | Ninguno |
| Riesgo | Medio (UI) |
| Aceptación | Con propiedades reales nunca banner “crea primera propiedad”; KPIs TTLock/guest-reg coherentes |

## T8 + T7 — Estados + recuperación

| Ítem | Detalle |
|------|---------|
| Archivos nuevos | `src/services/integrations/integration-health/*` (fuente única) |
| Reuse | TTLock status API, Airbnb auto-sync status, PriceLabs overview |
| Estados | CONNECTED / DEGRADED / DISCONNECTED / VERIFYING / NEEDS_ATTENTION con evidencia |
| UI | Badge PriceLabs (y hub) lee health unificado; botón “Recuperar” por integración + general controlado |
| DB | Opcional aditivo: tabla `IntegrationHealthEvent` solo si hace falta historial; preferir logs + campos existentes |
| Riesgo | No reiniciar syncs duplicados; idempotencia |
| Aceptación | PriceLabs operativo → no “Desconectado” falso; recovery no duplica operaciones |

## T1 — Guests + stay + normativa

| Ítem | Detalle |
|------|---------|
| Stay page | Nueva ruta pública `/stay/[token]` (o reutilizar token de registro post-COMPLETE) con HMAC/token no enumerable |
| Prefill | Pasar guestName/email/phone del booking al DTO de registro |
| Campos TRA | Migración aditiva Prisma: `cityOfResidence`, `cityOfOrigin`, `travelPurpose` (nullable); UI + validación |
| SIRE/TRA API | Si solo hay connection-test: documentar bloqueo externo; preparar payload builders |
| Sin email/WhatsApp web | Mantener `[WEB_BUILDER]` skip |
| Riesgo | Seguridad del token de stay |
| Aceptación | Post-book → registro → stay hub; sin enumeración por código; campos TRA capturados |

## T3 — Públicas

| Ítem | Verificación smoke prod + gaps proxy si aparecen |
| Aceptación | `/urbanovaloft` sin login; booking OK; admin protegido |

## T6 — Fotos WebBuilder

| Ítem | Extender hub: asignación por sección template (hero, gallery, rooms) sobre `web-media` existente |
| Aceptación | Cambios publicados visibles en pública |

## T9 — Anfitrión

| Ítem | Sección editorial urban-boutique; CMS fields en site content; testimonios manuales verificados |
| Airbnb reviews | Solo si integración autorizada existente; si no → manual + documentado |
| Aceptación | Portada anfitrión en pública; sin reseñas inventadas |

---

## Cambios de base de datos previstos

1. **Aditivos** en `ReservationGuest` (y/o reservation): campos TRA opcionales.  
2. Posible `GuestStayToken` o reuso de `GuestRegistrationToken` post-COMPLETE.  
3. **Prohibido:** drop de tablas, truncate, migrate reset en prod.

**Antes de migrate prod:** snapshot Neon purple-block + plan rollback documentado en `PRAGMA_PRODUCTION_DEPLOYMENT.md`.

---

## Criterios globales de aceptación

Ver sección 6 del prompt maestro. Entrega documental:

- `PRAGMA_MASTER_AUDIT.md` ✅  
- `PRAGMA_IMPLEMENTATION_PLAN.md` ✅ (este)  
- `PRAGMA_REGRESSION_REPORT.md`  
- `PRAGMA_PRODUCTION_DEPLOYMENT.md`  
- `PRAGMA_FINAL_REPORT.md`

---

## Plan de rollback aplicación

1. `vercel rollback` / re-alias al deployment Ready anterior conocido estable.  
2. No revertir datos de huéspedes.  
3. Si migración aditiva falló a medias: no destructive down; forward-fix.
