# PRAGMA PMS — Auditoría maestra

**Fecha:** 2026-11-24  
**Worktree de producción:** `c:\Users\R160\Desktop\pragma-pms-web-builder`  
**Rama:** `feat/pragma-web-builder` @ `40f7447`  
**Producción activa:** `https://www.pragmapms.com` → deployment `pragma-f22ol8t69` (Ready, ~3h)  
**Worktree local divergente:** `pragma-pms` @ `cursor/apify-prospecting-engine` (`b49583d`) — no es fuente de deploy

---

## 1. Arquitectura encontrada

| Capa | Evidencia |
|------|-----------|
| Framework | Next.js App Router + TypeScript |
| Auth | Clerk (`src/proxy.ts`, settle-session, incomplete-session bridge) |
| ORM / DB | Prisma → PostgreSQL (Neon). Prod: purple-block; staging worktree: dawn-union |
| Deploy | Vercel project `pragma-s-projects/pragma-pms` |
| PMS core | Panel, calendario, propiedades, reservas, smart-access, facturación, integraciones |
| Web pública | `/urbanovaloft`, `/w/[slug]`, APIs `/api/web-builder/*` |
| Guests | `ReservationGuest`, `GuestRegistrationToken`, flujo Airbnb + WEB BUILDER |
| Integraciones | Airbnb iCal/email, PriceLabs, TTLock, SIRE (stub), TRAA (stub), Wompi, WhatsApp |

**Nota normativa:** no existe módulo **CIRE** en el repo. Colombia usa **SIRE** (Migración Colombia, extranjeros) y **TRA/TRAA** (MINCIT, todos los huéspedes). Las referencias a “CIRE” en el alcance se tratan como SIRE.

---

## 2. Estado real del proyecto (pre-intervención)

### Ya resuelto en sesiones recientes (prod)

- Soft-fail Operations Center / Command Center bajo impersonación Owner.
- TTLock read-only mientras se impersona.
- WEB BUILDER booking → `guestRegistrationUrl` sin email/WhatsApp.
- Nav Master Simplification: Bandeja/Reservas/Tareas ocultos; redirects legacy → `/panel` o `/calendar`.
- iCal: no poll agresivo si no hay URL activa; filtro AND + `activeIcalUrlOnPropertyFilter`.

### Gaps confirmados vs las 9 tareas

| Tarea | Estado auditado | Problema confirmado |
|-------|-----------------|---------------------|
| 1 Guest + stay | Parcial | Redirect + multi-guest OK. **Falta página privada de estadía.** Form sin prefill de contacto booking. TRA/SIRE = stubs de conexión, sin transmisión de huéspedes. Campos TRA faltantes en schema (ciudad residencia/procedencia, motivo, etc.). |
| 2 Panel Hoy | Parcial / bug | Banner “sin propiedades” con `totalPropertyCount === 0` desde soft-fail vacío. **Swap confirmado** en `Promise.all`: TTLock count ↔ pending guest registration. UI densa, sin donuts operativos limpios. |
| 3 Páginas públicas | Mayormente OK | `/urbanovaloft`, `/w/[slug]`, booking APIs públicas en proxy. Preview autenticado. |
| 4 Logout | Gap | Menús usan `useClientSignOut` **sin** `performFullSignOut` → residual `__client_uat` puede reactivar settle-bridge. |
| 5 Persistencia | Parcial | Settle APIs + bridge existen; contradicción con T4 si UAT no se limpia en logout. |
| 6 WebBuilder fotos | Parcial | `web-media.service` + hub (URL/ZIP/reorder/hero/cover). Falta UX completa “administrar todas las imágenes de la página pública” por sección editorial. |
| 7 Recuperación | Gap | Health/status fragmentado por integración; sin supervisión unificada ni botón admin de recovery general. |
| 8 Estados integración | Gap | PriceLabs “Saludable” ≈ org `CONNECTED`, no evidencia de sync por listing. Sin estados DEGRADADO/VERIFICANDO unificados. |
| 9 Anfitrión | Gap | Template urban-boutique: `aboutText` no se renderiza; sin sección editorial ni reseñas. |

---

## 3. Causas raíz (solo confirmadas)

1. **False empty properties (T2):** `panel/page.tsx` usa `snapshot.commandCenter.totalPropertyCount === 0`. Ante fallo de command-center, `createEmptyCommandCenterData()` fija `totalPropertyCount: 0` → banner falso aunque existan propiedades.
2. **KPIs TTLock / guest-reg invertidos (T2):** en `command-center.service.ts` el slot Promise.all de `db.tTLockIntegration.count` se desestructura como `pendingGuestRegistration` y el de `db.reservation.count` (guest reg) como `ttlockConnected`.
3. **Logout incompleto (T4/T5):** `performFullSignOut` existe y limpia UAT; menús no lo invocan.
4. **Stay page ausente (T1):** no hay ruta tokenizada de “mi estadía”; solo registro y éxito estático.
5. **TRA/SIRE incompletos (T1):** servicios de prueba de conexión; sin pipeline de reporte. Schema de huésped no cubre campos TRA Resolución 409 (ciudad residencia/procedencia, motivo, etc.).
6. **Estados PriceLabs (T8):** UI de salud organizacional no distingue sync degradado por propiedad.

---

## 4. Dependencias entre tareas

```
T4 Logout ──┐
             ├──► continuidad de sesión coherente (bloquea falsos positivos de auth en QA)
T5 Persist ─┘
T8 Status ──► T7 Recovery (misma fuente de estado)
T3 Public ──► T1 Stay page + T6 Media + T9 Host (misma superficie pública)
T2 Panel ─── independiente de web pública; depende de scope/tenant estable
```

---

## 5. Riesgos

| Riesgo | Mitigación |
|--------|------------|
| Migraciones destructivas / pérdida de reservas | Solo migraciones aditivas; backup Neon antes de migrate prod |
| Debilitar Clerk para “arreglar” públicas | Ampliar allowlist proxy; no desactivar Clerk global |
| Stay page enumerable por código | Token criptográfico + rate limit; nunca lookup solo por `reservationCode` |
| Doble sistema de health | Un módulo `integration-health` compartido T7+T8 |
| Worktree local ≠ prod | Implementar y desplegar **solo** desde `pragma-pms-web-builder` |
| Soft-fail ocultando errores reales | Banner/degraded flag explícito; logs; no mentir “0 propiedades” |

---

## 6. Archivos involucrados (núcleo)

- Auth: `src/lib/auth/full-sign-out.ts`, `use-client-sign-out.ts`, `clerk-incomplete-session-bridge.ts`, `proxy.ts`, menús sidebar/owner
- Panel: `operations-center.compose.ts`, `command-center.service.ts`, `command-center-view.tsx`, `panel/page.tsx`, `first-property-banner.tsx`
- Guests: `guest-registration.service.ts`, `web-booking.service.ts`, `guest-registration/[token]/page.tsx`, schema Prisma `ReservationGuest`
- Público: `urbanovaloft/page.tsx`, `w/[slug]/page.tsx`, `urban-boutique-site.tsx`, `serialize-public-site.ts`
- Media: `web-media.service.ts`, `web-builder-hub.tsx`
- Integraciones: `integrations/pricelabs/*`, `ttlock/*`, `airbnb/*`, `sire/*`, `traa/*`

---

## 7. Requisitos normativos (SIRE / TRA) — investigación oficial

Fuentes: Migración Colombia (SIRE ABC), TRA MINCIT Res. 409/2022 manual PMS, FAQs tramincit.

| Sistema | Quién | Campos clave |
|---------|-------|--------------|
| **TRA** | Nacionales y extranjeros | tipo/número ID, nombres, apellidos, ciudad residencia, ciudad procedencia, motivo, check-in/out, tipo acomodación, costo, habitación, establecimiento, RNT, acompañantes |
| **SIRE** | Solo extranjeros | tipo movimiento in/out, fecha, documento, nombre, nacionalidad, país origen/destino, DOB, dirección CO, visa/permiso |

**Estado en PRAGMA hoy:** formulario guest tiene nombre, documento, email, phone, nationality, DOB. **Faltan** campos TRA (ciudades, motivo). Transmisión API: **no implementada** (solo connection test).

---

## 8. Pruebas existentes (muestra)

- `tests/web-builder/*`, `tests/airbnb-email/*`, nav-simplification, public-app-url-staging
- Staging E2E: `scripts/staging/e2e-web-builder-booking.ts`
- Worktree con cambios locales sin commit en error.tsx, sign-in, owner-login, e2e script

---

## 9. Recomendaciones de intervención

1. No reconstruir WebBuilder ni auth: cablear `performFullSignOut`, corregir Promise.all, banner independiente del soft-fail.
2. Stay page: reutilizar patrón token de `GuestRegistrationToken` (token hermano o extensión de status COMPLETED → hub de estadía).
3. TRA/SIRE: ampliar schema aditivamente + UI campos; transmisión API como fase posterior documentada si faltan credenciales prod.
4. Health unificado: DTO de estado con evidencia (última sync OK, auth, error).
5. Host: sección editorial en urban-boutique + campos en site content / WebBuilder, sin scrapear Airbnb ilegalmente.

**Hipótesis no confirmadas (excluidas como “problemas”):** fallos Neon en prod, PriceLabs API down, Clerk outage.
