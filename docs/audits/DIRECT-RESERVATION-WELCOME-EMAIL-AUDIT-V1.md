# Auditoría — Correo de bienvenida automático (Reserva Directa)

Fecha: 2026-07-16  
Estado: **APROBADA PARA IMPLEMENTACIÓN**  
Alcance: solo Reservas Directas confirmadas / liberadas de hold

---

## Resultado

El envío automático **ya existe** en el flujo Direct. No hace falta un segundo pipeline ni una plantilla nueva.

La brecha real es **idempotencia + historial + providerId**, no el disparador.

---

## Flujo Direct auditado

| Paso | Dónde | Hallazgo |
|------|-------|----------|
| Creación | `createReservation` (`reservation.service.ts`) | Solo permite `BookingPlatform.DIRECT` |
| Estado “confirmada” | `deriveReservationStatusFromDates` | Futura → `CONFIRMED`; sin hold de pago el envío corre al crear |
| Hold de pago | `activateReservationPaymentHold` si `totalAmount > 0` | **No** envía bienvenida hasta liberar hold |
| Liberación hold | `finalizeGuestRegistrationAfterHold` | Tras depósito: `ensure` + `sendGuestRegistrationEmailForReservation` |
| Huésped / email | `Reservation.guestEmail` al crear | Fuente del destinatario |
| Link GR | `ensureGuestRegistrationForReservation` + token ACTIVE | Reutilizado |
| Envío | `guest-registration-email.service.ts` → `sendEmail` / Resend | Plantilla invite existente |
| Airbnb / iCal | `airbnb-ical-sync.service.ts` | Solo `ensure…`; **no** envía bienvenida |

---

## Evento más seguro

1. **Sin hold** (`totalAmount === 0`): tras crear + `ensure` del token (ya cableado).
2. **Con hold**: al liberar hold / depósito satisfecho (ya cableado).

No usar iCal sync, ni edición de reserva, ni confirmaciones OTA.

---

## Reutilizable hoy

| Pieza | Estado |
|-------|--------|
| `sendEmail` / Resend / `EMAIL_FROM` | Sí |
| Plantilla invite existente | Sí (sin plantilla nueva) |
| Guest Registration Link | Sí |
| Branding `pragmaEmailHeaderHtml` / footer | Parcial — invite aún no lo usa; se alinea sin cambiar copy |
| Historial anti-dupe invite | **No** |
| Claim concurrente (`__SENDING__`) | **No** (sí existe en admin notify) |

---

## Riesgos

| Riesgo | Severidad | Mitigación propuesta |
|--------|-----------|----------------------|
| Doble envío (create + hold / doble clic / reintento) | Alta | Claim + `inviteSentAt` + log (patrón admin) |
| Auto-envío fuera de Direct | Media | Gate explícito `platform === DIRECT` en auto |
| Reenviar manual roto | Media | `force: true` en acción de reenvío |
| Migración schema | Baja | Campos espejo del admin notify; sin tocar otros dominios |

**No se identificó riesgo arquitectónico que detenga la implementación.**

---

## Diseño (Fase 2)

1. Campos en `Reservation`: `guestRegistrationInviteSentAt`, `guestRegistrationInviteError`, `guestRegistrationInviteLog`.
2. Endurecer `sendGuestRegistrationEmailForReservation` con claim/idempotencia.
3. Auto solo Direct + estado elegible + email válido.
4. Manual resend con `force`.
5. Envolver HTML existente con branding PRAGMA (mismo contenido).
6. No tocar GR core, TTLock, QR, INTIENDAS, Airbnb inbound, facturación.
