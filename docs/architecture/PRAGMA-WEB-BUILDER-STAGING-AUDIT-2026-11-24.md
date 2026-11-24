# PRAGMA PMS — Auditoría WEB BUILDER + correcciones (staging)

**Fecha:** 2026-11-24  
**Worktree:** `c:\Users\R160\Desktop\pragma-pms-web-builder` · `feat/pragma-web-builder`  
**Entorno de datos:** Neon staging `ep-dawn-union-bebo02dx-pooler…` (`PRAGMA_WEB_BUILDER_STAGING=1`)  
**Producción:** sin deploy, sin merge, sin publish, sin migraciones nuevas  

---

## 1. Estado inicial

| Ítem | Evidencia |
|------|-----------|
| Staging assert | `npm run staging:assert` → `ok: true`, host dawn-union |
| Migración WEB BUILDER | `20260823120000_pragma_web_builder` presente |
| Piloto `urbanovaloft` | 4 unidades 801–804, `icalUrl: null`, org `stg_web_builder_org_001` |
| Sitio al inicio de sesión | Había quedado `PUBLISHED` por E2E previos |
| Gap funcional | Reserva web **no** generaba `reservationCode` ni URL de registro; UI no redirigía |
| Gap iCal | Auto-sync del dashboard seguía haciendo polling/cleanup con `linkedCount === 0` |
| Gap UX error | `(dashboard)/error.tsx` empujaba `npm run dev:clean` también ante errores RSC de producción |

---

## 2. Problemas encontrados + causa raíz

| # | Problema | Causa raíz |
|---|----------|------------|
| P1 | Tras reservar en web no hay registro de huéspedes | `createWebDirectReservation` no llamaba `ensureGuestRegistrationForReservation` ni devolvía URL |
| P2 | Canal web podía disparar email post-pago | `finalizeGuestRegistrationAfterHold` enviaba email si había `guestEmail` |
| P3 | Sin código de reserva web | Create DIRECT web no seteaba `reservationCode` |
| P4 | UI no redirigía al formulario | `urban-boutique-site.tsx` solo mostraba mensaje |
| P5 | Instrucciones de registro genéricas / texto Airbnb | Página `/guest-registration/[token]` no diferenciaba DIRECT web |
| P6 | iCal vacío seguía generando tráfico de sync | `AirbnbAutoSync` hacía cleanup + seguía el interval |
| P7 | Conteo “sync stale” con `icalUrl: { not: null }` | Incluía strings vacíos; no usaba `activeIcalUrlOnPropertyFilter` |
| P8 | «Algo salió mal» engañoso | (a) Error RSC de `/panel` bajo impersonación (soft-fail previo); (b) mensaje de recovery orientado a `dev:clean`; (c) `npm run dev` en worktree `pragma-pms` ≠ staging web-builder en `:3005` |
| P9 | E2E race falso negativo | Race usaba quote de otra duración → ambos fallaban por mismatch de total |

---

## 3. Archivos modificados / añadidos

- `src/services/web-builder/web-booking.service.ts`
- `src/lib/web-builder/web-reservation-code.ts` *(nuevo)*
- `src/modules/web-builder/templates/urban-boutique/urban-boutique-site.tsx`
- `src/services/reservations/reservation-hold.service.ts`
- `src/services/guests/guest-registration.service.ts`
- `src/app/guest-registration/[token]/page.tsx`
- `src/components/airbnb/airbnb-auto-sync.tsx`
- `src/services/dashboard/command-center.service.ts`
- `src/app/(dashboard)/error.tsx`
- `src/lib/app-url.ts` (staging localhost :3005)
- `scripts/staging/e2e-web-builder-booking.ts`
- `tests/web-builder/web-reservation-code.test.ts` *(nuevo)*
- Scripts one-shot: `_audit-urbanova-once.ts`, `_probe-guest-reg-once.ts`, `_smoke-availability.json`
- Informe: este archivo

*(También en el worktree, de corridas previas del mismo día: soft-fail ops-center / TTLock impersonation — ya desplegados a www en turno anterior; **esta ejecución no redesplegó**.)*

---

## 4. Cambios realizados

1. **Reserva web → registro:** genera `WBxxxxxxxx`, asegura token, retorna `guestRegistrationUrl`; UI hace `location.assign`.
2. **Sin email/WhatsApp web:** post-hold salta email si `internalNotes` contiene `[WEB_BUILDER]`.
3. **UI registro:** pasos claros + mensaje específico DIRECT; token inválido no asume solo Airbnb.
4. **iCal:** sin URLs activas → cleanup one-shot y **stop polling**.
5. **Command center:** filtro iCal activo real.
6. **error.tsx:** distingue digest/prod vs local; botón a `/panel`; no insiste solo en `dev:clean`.
7. **E2E staging:** valida código + token; restaura sitio a **DRAFT**; race con quote correcto.

**Migraciones:** ninguna nueva. Usada la existente `20260823120000_pragma_web_builder`.

---

## 5. Pruebas ejecutadas y resultados

| Prueba | Resultado | Evidencia |
|--------|-----------|-----------|
| `staging:assert` | **PASS** | host dawn-union |
| Unit `tests/web-builder/*.test.ts` + related | **PASS** | 36/36 |
| `staging:e2e` | **PASS** | `reservationCode` WB…, `guestRegistrationPersisted: true`, double-book blocked, raceWins=1/raceSafe, `siteStatusAfterE2E: DRAFT` |
| Lookup registro token real | **PASS** | `lookupState: valid`, platform DIRECT, foreign `invalid` |
| Público `/urbanovaloft` con DRAFT | **PASS** | HTTP 404 (no filtrar contenido no publicado) |
| `/w/urbanovaloft` DRAFT | **PASS** | HTTP 404 |
| `/w/.../preview` sin auth | **PASS** | 307 → `/sign-in` |
| API availability en DRAFT | **PASS** | `{ ok:true, available:[], reason:"site_not_found" }` |
| `/guest-registration/invalid…` | **PASS** | HTTP 200 (UI “link no disponible”) |
| `/panel` sin sesión | **PASS** | 307 → sign-in |
| Servidor `staging:dev` :3005 | **PASS** | Ready; sigue corriendo |
| Publicación piloto | **NOT DONE (by design)** | DRAFT mantenido |
| UI browser autenticada (preview design, completar registro + TTLock code) | **NOT TESTED** | Requiere sesión Clerk + flujo TTLock de unidad |
| Airbnb import real | **NOT TESTED** | Prohibido tocar reservas reales; gates iCal auditados en código |
| Onboarding loops / TS warnings completos | **WARN / parcial** | Sin reescritura; no se halló loop obvio en lectura rápida |
| Deploy producción | **NOT RUN** | Prohibido en este brief |

---

## 6. Criterios E2E del brief (resumen)

| Escenario | Status |
|-----------|--------|
| Carga página pública | **PASS** (404 esperado en DRAFT) |
| Vista previa | **PASS** (auth gate) |
| Disponibilidad | **PASS** (servicio + API; vacío en DRAFT) |
| Reserva web | **PASS** (E2E staging) |
| Código reserva | **PASS** |
| Registro huésped | **PASS** (token + lookup) |
| Redirección | **PASS** (código UI; E2E URL) |
| Código acceso TTLock | **NOT TESTED** (depende de cerradura/registro completo) |
| Calendario PMS | **PASS** (query org + reserva) |
| Doble reserva / solapes | **PASS** |
| Cancelación | **PASS** |
| Multi-tenant | **PASS** (org staging + property org check) |
| Navegación / recarga staging | **PASS** (servidor estable :3005) |
| Auth sesión | **PASS** (redirects Clerk) |
| Airbnb preservado | **WARN** (sin sync real; guards verificados) |

---

## 7. «Algo salió mal» — diagnóstico verificado

1. **No es “la terminal se cerró” por sí sola** cuando el server sigue vivo: en esta máquina coexisten `pragma-pms` (`npm run dev`) y `pragma-pms-web-builder` (`staging:dev` :3005).
2. En **producción**, el mismo copy genérico aparecía por **throw RSC en `/panel`** (mensaje redactado → rama “Algo salió mal”). Mitigado antes con soft-fail feed/finance/smart-access + TTLock read-only bajo impersonación.
3. **Corrección UX:** `error.tsx` ya no empuja `dev:clean` como respuesta por defecto en prod; muestra digest y rutas de recuperación.
4. Para WEB BUILDER staging usar **`npm run staging:dev`** (puerto 3005), no el `dev` del otro worktree.

---

## 8. Riesgos / pendientes

| Riesgo | Nivel | Nota |
|--------|-------|------|
| Next aún lista `.env.local` en staging:dev | WARN | `DATABASE_URL` se fuerza con override + assert; vigilar otras claves Clerk |
| `guestRegistrationUrl` apuntaba a :3000 | **FIXED** | `getPublicAppUrl` ahora honra APP_URL cuando `PRAGMA_WEB_BUILDER_STAGING=1` |
| Unidades `isPublished: true` con site DRAFT | WARN | Booking público bloqueado por site DRAFT; al publicar site quedarían listos |
| Código de acceso end-to-end | WARN | No ejecutado sin TTLock staging conectado |
| Operativa prod urbanovaloft PUBLISHED | WARN | Fuera de alcance; no tocar |

---

## 9. Estado final

- **Staging:** estable en `:3005`, assert OK, E2E PASS, piloto **DRAFT**.  
- **WEB BUILDER:** booking + isolation + guest registration redirect implementados y probados en staging.  
- **Producción:** no modificada en esta corrida.  
- **Migraciones nuevas:** 0.
