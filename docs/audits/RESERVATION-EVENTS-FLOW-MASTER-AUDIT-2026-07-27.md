# Auditoría maestra — Flujo de eventos Reserva → GR → TTLock → Notificaciones

**Fecha:** 2026-07-27  
**Alcance:** Fases 1–2 (mapa SSOT). Sin inventar flujo paralelo.

## Veredicto de arquitectura

Existe **un único flujo de negocio post–Guest Registration**:

`finalizeGuestRegistration` → `settleGuestRegistrationCompletionComms` → TTLock → recepción → correo acceso huésped → reporte tenant.

Direct y Airbnb **convergen** en ese punto. Airbnb no dispara el correo de confirmación/invite de PRAGMA (por diseño).

## Mapa LIVE SSOT

| Evento | Origen | Disparador | Correos | Idempotencia |
|--------|--------|------------|---------|--------------|
| E1 Reserva Direct creada | `createReservation` | UI / wizard | Invite GR al huésped | `guestRegistrationInviteSentAt` + claim |
| E1b Hold liberado | `finalizeGuestRegistrationAfterHold` | Pago depósito | Reintenta invite | Misma que E1 |
| E2 Airbnb iCal | `airbnb-ical-sync` | Sync | Ninguno (auto) | Solo `ensureGuestRegistration` token |
| E2b Ingress Airbnb | `/guest-registration` + código | Huésped | — | Match único AIRBNB |
| E3 GR completado | `finalizeGuestRegistration` | Formulario GR | Pipeline E4–E7 | Completado + occupancy |
| E4 TTLock | `processReservationAccessAfterRegistration` | settle/run | — | Reusa credential sincronizado |
| E5 Recepción | `notifyAdminGuestRegistrationCompleted` | run comms | Ops contact | `guestRegistrationAdminNotifiedAt` |
| E6 Acceso huésped | `notifyAccessCodeEmailForCredential` | run comms | Guest (+ ops CC) | `deliveryStatus=SENT` |
| E7 Tenant | `notifyTenantDeliveryReport` | run comms | Account owner | Skip si ciclo previo ok |

## Dead / duplicate

| Ítem | Estado |
|------|--------|
| `onGuestRegistrationCompletedForTTLock` | DEAD (0 callers) |
| Concierge message templates | DEAD (migración) |
| `scheduleAccessCodeEmail` sin skip | DUPLICATE; SSOT usa `skipAccessCodeEmail: true` |
| Welcome Airbnb + delay 5 min | OPS fuera de PRAGMA (host/Airbnb); panel “Copiar mensaje” es asistencia manual |

## Reglas de negocio congeladas

- GR “completo” solo si `registeredGuests === occupancy` (adultos+niños).
- Código TTLock: tabla `access_credentials`, no columna en `Reservation`.
- UI: código oculto por defecto; leer desde DB, no API live TTLock.
- Correo acceso huésped: solo si `ttlockCodeId` presente (código real sincronizado).

## Gaps vs plan de producto (Fase 6)

| Destinatario | Antes | Objetivo plan |
|--------------|-------|---------------|
| Huésped confirmación Direct | Asunto “Registro…”, branding PRAGMA | Confirmación sin PRAGMA + CTA registro |
| Recepción | “Registro de huéspedes — prop (code)” | `Check-in registrado \| prop \| huésped` |
| Huésped acceso | “Registro confirmado y código…” | `Bienvenido — Tu código de acceso ya está disponible` |
| Tenant | `PRAGMA · Guest Registration…` | `Registro completado \| huésped \| prop` |

## Riesgo de cambios

Bajo: solo builders de asunto/HTML y copy Airbnb en panel. Orquestación, Prisma, Clerk, calendario y TTLock **sin cambio de control de flujo**.
