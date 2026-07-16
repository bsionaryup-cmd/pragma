# Auditoría de Incidencia — Bienvenida no enviada (Reservas Directas)

Fecha: **2026-07-16**  
Estado: **CAUSA RAÍZ CONFIRMADA → CORRECCIÓN MÍNIMA APLICABLE**  
Evidencia: `docs/audits/evidence/welcome-email-incident-root-cause.json`

---

## Fase 1 — Reproducción

### Caso real reportado (producción / Neon)

| Campo | Valor |
|-------|-------|
| Reserva | `cmrnm2qbv000e04l7f17j5nih` |
| Tipo | **DIRECT** |
| Estado | **CONFIRMED** |
| Huésped | Urba 33 |
| Correo | `urbanovaloft@gmail.com` (válido) |
| Propiedad | 803 — Loft 2P Vista Premium |
| totalAmount | **196510** |
| paymentStatus | PENDING |
| holdExpiresAt | **2026-07-16T15:05:34.240Z** (activo) |
| inviteSentAt | **null** |
| inviteLog | **[]** |
| Token GR | **null** |
| createdAt | 2026-07-16T14:35:34.219Z |

**Reproducible: SÍ**

### Reproducción controlada

| Escenario | Resultado |
|-----------|-----------|
| Direct + hold (`totalAmount > 0`) | Auto-send → `skipped: Reserva en hold de pago; bienvenida diferida` |
| Direct + `totalAmount = 0` | Auto-send → `success` + providerId |

---

## Fase 2 — Disparador

En `createReservation` (`reservation.service.ts`):

```
requiresPaymentHold = totalAmount > 0

if (requiresPaymentHold)
  → activateReservationPaymentHold()   // NO ensure, NO send
else if (Direct + elegible)
  → ensureGuestRegistration + send welcome
```

Para la reserva Urba 33: se tomó el **branch de hold**.  
No se ejecutó ensure ni send en el create.

El envío diferido solo ocurre en `finalizeGuestRegistrationAfterHold` tras depósito (`releaseReservationHoldIfDepositMet`). Sin pago, **nunca** se envía.

---

## Fase 3 — Historial

| Campo | Valor incidente |
|-------|-----------------|
| guestRegistrationInviteSentAt | null |
| Log | vacío |
| Error | null |
| providerId | inexistente |
| triggeredBy | — |

**Interrupción:** el flujo **ni siquiera entra** al servicio de envío en el create.

---

## Fase 4 — Resend

No se invocó `sendEmail` para esta reserva en el create.  
Sin providerId / delivered / rechazo — porque no hubo request.

---

## Fase 5 — Reglas de negocio

| Check | Urba 33 |
|-------|---------|
| DIRECT | Sí |
| No Airbnb / iCal / sync | Sí |
| Confirmada | Sí |
| No cancelada | Sí |
| Correo válido | Sí |
| Ya marcada como enviada | No |

Cumple la regla de negocio para envío. El sistema **no** envía por diseño actual del hold.

---

## Fase 6 — Causa raíz

### Causa exacta

La bienvenida automática en create **solo corre cuando `totalAmount === 0`**.  
Si `totalAmount > 0` (caso normal del wizard UI), se activa hold de pago y la bienvenida queda **diferida hasta el depósito**.

Las auditorías previas usaron siempre `totalAmount: 0` → PASS falso respecto al flujo UI real.

### Componente

- Primario: `src/services/reservations/reservation.service.ts` (`createReservation` L619–640)
- Secundario (refuerzo): `guest-registration-email.service.ts` skip si `holdExpiresAt` (L281–287)

### Impacto

- **Alta:** casi todas las Reservas Directas reales tienen monto > 0 → no reciben bienvenida al confirmar.
- Airbnb / iCal no afectados (no usan este path).

### Riesgo de corrección

Bajo si se envía **antes** de activar el hold: reutiliza ensure + send existentes; el post-hold queda como reintento idempotente.

---

## Decisión

Corrección mínima autorizada (Fase 7):

1. En `createReservation`, ejecutar ensure + send de bienvenida Direct **antes** de `activateReservationPaymentHold`.
2. No crear pipelines nuevos.
3. Mantener anti-duplicados y post-hold como safety net.
