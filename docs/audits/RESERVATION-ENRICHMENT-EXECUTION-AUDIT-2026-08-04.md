# Auditoría y corrección — Enriquecimiento de reservas (2026-08-04)

**Estado:** Fase 1–5 completadas en código local. **Sin deploy a producción** hasta aprobación expresa del Owner.

**Org piloto:** `cmplxfg0a000105jrs0gqtwyc` (Loft 33)

---

## Fase 1 — Respuestas con evidencia

| Pregunta | Respuesta | Evidencia |
|---|---|---|
| ¿Se ejecuta el enriquecimiento? | **Sí** | Integración Airbnb email `enabled` / `ACTIVE`; `lastEmailReceivedAt` / `lastProcessedAt` = `2026-08-04T03:38:06Z` |
| ¿Se dispara el evento? | **Sí** | `ReservationEmailEvent` recientes con `enrichedFields` (p. ej. Mitchell `cmse9kewg…` CONFIRMED 06:15Z) |
| ¿El Job existe? | **Sí** | Cron `GET /api/cron/airbnb-email-enrichment-retry` + reconcile + post–iCal `retryUnlinkedAuditsForProperty` |
| ¿El Job falla? | **No (muestra 100 audits)** | `FAILED: 0` en últimos 100 audits del piloto |
| ¿El Job nunca inicia? | **Inicia, pero es diario** | `vercel.json`: `30 6 * * *` (comentario antiguo decía “cada 5 min” — incorrecto en Hobby) |
| ¿Excepciones silenciosas? | **Parcial** | `setTimeout` delayed retry no es durable en serverless; status `MANUAL_REVIEW` puede quedar stale tras link posterior; retry podía marcar `already_enriched` aunque el row siguiera en placeholder |
| ¿Cambios recientes rompieron el flujo? | **No hay outage total** | Happy path OK hoy; hay **defectos de borde** (ver Fase 2) |
| ¿Existe una regresión? | **Sí, localizada** | Row `guestName` puede quedar `Huésped Airbnb` con evento CONFIRMED ya enriquecido + GR lock; backfill excluía GR-completed |

### Caso prueba A — Mitchell (Sep 3–7) — enriquecimiento sano

- Reserva `cmse92rxu000028tyeshdpjlt`
- `guestName`: Mitchell Rodriguez Puentes
- Código `HMKAM94TSB`, adults 4, `totalAmount` 727972.16
- Evento CONFIRMED + audit linked el mismo día del correo

### Caso prueba B — Sergio (Ago 7–10) — síntoma de borde

- Reserva `cms6fztsq000004l3n664gyiw`
- Row: `guestName = Huésped Airbnb` + `guestRegistrationCompletedAt` set
- Evento CONFIRMED: `enrichedFields.guestName = Sergio Andres Mantilla Plata`
- Código/email/ocupación/monto **sí** enriquecidos
- GR titular legal: Luis Francisco Campos Hernández
- **Display SSOT** (`resolveReservationDisplayGuestName`) resuelve **Sergio…** (calendario/inbox OK)
- Backfill **excluía** este caso por `guestRegistrationCompletedAt != null`

Scripts de evidencia (read-only salvo heal):

- `scripts/_audit-airbnb-enrichment-health.ts`
- `scripts/_audit-enrichment-reservation-detail.ts`
- `scripts/_audit-sergio-guest-name-trail.ts`
- `scripts/_audit-display-name-resolve.ts`

---

## Fase 2 — Identificación de causa raíz

**No** se encontró un apagón del pipeline de enriquecimiento.

Causas raíz **demostradas / altamente probables**:

1. **Placeholder congelado tras GR**  
   `applySafeReservationEnrichment` trataba `guestRegistrationCompletedAt` como lock total, incluido cuando el titular del row seguía siendo el placeholder iCal. El backfill también filtraba `guestRegistrationCompletedAt: null`.

2. **Carrera iCal vs Guest Registration (TOCTOU)**  
   `buildIcalSyncReservationUpdate` decide omitir `guestName` si GR ya completó, pero el `update` se aplicaba sin re-chequear en DB. Un sync leído antes del complete podía escribir `Huésped Airbnb` **después** de que GR hubiera escrito el titular.

3. **Retry `already_enriched` demasiado agresivo**  
   Si el evento ya tenía `enrichedFields` ricos, el retry omitía reaplicar aunque el row siguiera en placeholder.

4. **Falsas alarmas operativas**  
   - Cron diario vs comentario “5 min”  
   - Delayed `setTimeout` no durable en Vercel  
   - Flags `icalContextualPropertyAuto` / `propertyScopedAutoLink` = `false` son frenos de seguridad intencionales (OCP), no un “apagón”

**No** se reactivaron auto-links contextuales (riesgo de contaminación cruzada).

---

## Fase 3 — Auditoría funcional (alcance observado)

| Flujo | Estado observado |
|---|---|
| Email → match → enrich | Operativo (Mitchell + eventos recientes) |
| iCal create/update | Operativo; TOCTOU guestName mitigado en código |
| Display calendario/inbox | Usa SSOT display (Sergio visible vía enrichment) |
| Guest Registration | Completa; no bloquea display; podía dejar row placeholder |
| Finanzas Airbnb | Montos presentes en casos auditados |
| Cancel / UNKNOWN reviews | Unlinked esperados (no enrichables) |

---

## Fase 4 — Corrección mínima (local, reversible)

| Cambio | Archivo | Por qué |
|---|---|---|
| Heal `guestName` desde CONFIRMED aunque GR esté completo **si** el row es placeholder | `safe-reservation-enrichment.ts` | Placeholder ≠ titular real |
| Persistencia iCal con `updateMany` condicionado a `guestRegistrationCompletedAt IS NULL` | `ical-guest-name-sync.ts` + `airbnb-ical-sync.service.ts` | Cierra TOCTOU |
| Retry no omite si row sigue placeholder | `delayed-enrichment-retry.ts` | Reaplica nombre faltante |
| Backfill incluye placeholders con GR completo | `run-placeholder-guest-name-backfill-job.ts` | Repara deuda existente |
| Comentario cron alineado a schedule real | `airbnb-email-enrichment-retry/route.ts` | Evita falsa expectativa |

**Heal de datos (piloto):** `scripts/_heal-placeholder-guest-names-pilot.ts` (ejecutar tras validar dry-run).

---

## Fase 5–6 — Validación

Ejecutado en esta sesión:

- [x] Tests unitarios display + iCal split — **9/9 pass**
- [x] Heal dry-run / apply piloto — **1/1** (`cms6fztsq…` → `Sergio Andres Mantilla Plata`)
- [ ] Typecheck / lint completo del monorepo (no bloqueante para el informe; cambios acotados)
- [x] **No deploy** sin “apruebo deploy”

---

## Fase 7 — Riesgos

| Riesgo | Mitigación |
|---|---|
| Heal escribe nombre Airbnb (booker) distinto del titular GR | Alineado con display SSOT actual; no toca email/phone/ocupación si GR locked |
| Auto-link contextual | **No** reactivado |
| Deploy prematuro | Gate Owner obligatorio |

### Archivos tocados (código)

- `src/modules/airbnb-email/domains/safe-reservation-enrichment.ts`
- `src/services/airbnb/ical-guest-name-sync.ts`
- `src/services/airbnb/airbnb-ical-sync.service.ts`
- `src/modules/airbnb-email/matching/delayed-enrichment-retry.ts`
- `src/modules/airbnb-email/repair/run-placeholder-guest-name-backfill-job.ts`
- `src/app/api/cron/airbnb-email-enrichment-retry/route.ts`
- `tests/reservations/display-guest-name.test.ts`
- `tests/airbnb-email/ical-guest-name-preservation.test.ts`

### Resultado

- El enriquecimiento **no estaba apagado**; había deuda de borde + carrera iCal/GR.
- Corrección mínima aplicada en local + heal de 1 reserva piloto.
- Estabilidad del happy path (Mitchell) intacta.
- **Deploy a producción: pendiente de aprobación expresa.**
