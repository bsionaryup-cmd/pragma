# Auditoría + corrección — Calendario + Guest Registration HTTP

**Fecha:** 2026-08-04 (auditoría) · actualizado 2026-08-05 (cierre de plan)  
**Estado:** GR HTTPS **CORREGIDO** · Calendario **DIAGNOSTICADO** + remediación iCal (import + cron horario)  
**Deploy:** código GR HTTPS + cron horario requieren estar en prod (ver deploy previo / “apruebo deploy”)

---

## Independencia de incidentes

| Incidente | Relacionado con el otro? |
|-----------|---------------------------|
| Guest Registration HTTP | **No** — cliente WhatsApp Airbnb / origen browser |
| Calendario CONFIRMED invisible | **No** — pipeline de query distinto; no hay exclude CONFIRMED |

---

## Incidente 2 — Guest Registration HTTP

### Causa raíz (evidencia)

**Archivo:** `src/features/reservations/components/reservation-detail-panel.tsx`  
**Función:** handler WhatsApp share (Airbnb)  
**Bug:** usaba `window.location.origin` → si el staff abría `http://www.pragmapms.com`, el link copiado era `http://…/guest-registration` → Android `ERR_CLEARTEXT_NOT_PERMITTED`.

**No era:** `buildGuestRegistrationUrl` / `getPublicAppUrl()` (SSOT email/token ya fuerza HTTPS canonical).

### Corrección aplicada

| Archivo | Cambio |
|---------|--------|
| `src/lib/app-url.ts` | `ensureHttpsPublicOrigin`, `getAirbnbUniversalGuestRegistrationUrl` |
| `reservation-detail-panel.tsx` | Airbnb share → helper HTTPS canonical (localhost http solo en local) |
| `src/lib/brand-email.ts` | siteUrl vía `ensureHttpsPublicOrigin` |
| `src/lib/seo.ts` | siteUrl vía `ensureHttpsPublicOrigin` |
| `tests/guests/guest-registration-https-url.test.ts` | 6 tests |

### Validación

- `npx tsx --test tests/guests/guest-registration-https-url.test.ts` → **6/6 pass** (revalidado 2026-08-05)

### Ops restante (Owner)

- Confirmar Vercel `NEXT_PUBLIC_APP_URL` / `APP_URL` = `https://www.pragmapms.com`
- Tras deploy: regenerar/copiar link Airbnb WhatsApp y abrir en Android

---

## Incidente 1 — Calendario CONFIRMED no visible

### Auditoría (sin modificar filtros)

**Query calendario** (`getCalendarData`): `status notIn CANCELLED` + `withVisibleReservationsFilter` (orphan Airbnb). **CONFIRMED no está excluido.**

Scripts read-only:

- `scripts/_audit-calendar-missing-reservation.ts`
- `scripts/_audit-calendar-confirmed-vs-query.ts`
- `scripts/_audit-airbnb-confirmed-system-reflect.ts` / `_audit-airbnb-ical-feed-vs-db.ts`

### Evidencia DB (Neon, 2026-08-04)

- Últimos **20 CONFIRMED** escaneados → **0** ocultos por orphan / property INACTIVE / viewport
- **No hay evidencia para cambiar** `notOrphanAirbnbImportFilter`

### Causa real del caso piloto (post-diagnóstico)

Hueco **iCal**: reserva Airbnb `Reserved` **2026-09-03→09-07** (Comuna 13) existía en el feed vivo pero **no en DB** tras el último sync diario. No era un CONFIRMED “filtrado” en calendario.

Detalle y remediación: [`AIRBNB-CONFIRMED-SYSTEM-REFLECT-AUDIT-2026-08-04.md`](./AIRBNB-CONFIRMED-SYSTEM-REFLECT-AUDIT-2026-08-04.md)

| Acción | Resultado |
|--------|-----------|
| Import sync propiedad | Reserva `cmse92rxu000028tyeshdpjlt`, `visibleInCalendarQuery: true` |
| `vercel.json` cron `/api/cron/airbnb-ical-sync` | `20 * * * *` (horario) — prevención de lag diario |
| Orphan filter | **Sin cambios** (gate de evidencia cumplido: no era orphan) |

---

## Riesgos

| Cambio | Riesgo |
|--------|--------|
| GR HTTPS helpers | Bajo — localhost preservado |
| brand-email / seo HTTPS | Bajo — solo upgrade scheme |
| Cron iCal horario | Bajo — más invocaciones; no cambia reglas de visibilidad |
| Sin cambio filtros calendario | N/A |

## Regresiones

- No se tocó RD, TTLock, orphan filter, AI agents.
- Tests GR HTTPS verdes.
- SSOT email/token (`buildGuestRegistrationUrl`) intacto.

## Criterios de aceptación (plan)

| Criterio | Estado |
|----------|--------|
| Links GR Airbnb WhatsApp solo HTTPS canonical | **PASS** |
| SSOT email/token intacto | **PASS** |
| Calendario: causa con evidencia + fix quirúrgico (import + cron), sin quitar orphan filter | **PASS** |
| Sin refactors / sin tocar RD/TTLock/AI | **PASS** |
| Deploy solo con “apruebo deploy” | Gate Owner |

## Deploy

Código y cron ya pueden estar en prod según deploys posteriores al 2026-08-04; si el Owner duda, re-deploy con **apruebo deploy**.
