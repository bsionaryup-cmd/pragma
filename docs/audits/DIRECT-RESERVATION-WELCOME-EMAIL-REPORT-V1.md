# Informe — Correo de bienvenida automático (Reserva Directa)

Fecha: 2026-07-16  
Estado: **IMPLEMENTADO Y VALIDADO**  
Auditoría previa: `docs/audits/DIRECT-RESERVATION-WELCOME-EMAIL-AUDIT-V1.md`

---

## Resultado de la auditoría previa

El disparador ya existía:

- `createReservation` (Direct, sin hold) → ensure GR + send invite  
- `finalizeGuestRegistrationAfterHold` (tras depósito) → ensure GR + send invite  
- Airbnb/iCal → solo ensure token (sin bienvenida)

Brecha: sin idempotencia, sin historial, sin `providerId`, branding invite incompleto.

---

## Componentes reutilizados

| Pieza | Uso |
|-------|-----|
| `sendEmail` / Resend / `EMAIL_FROM` | Transporte |
| Plantilla invite existente | Mismo copy y CTA |
| `ensureGuestRegistrationForReservation` | Link GR |
| Patrón claim `__SENDING__` (admin notify) | Anti-duplicados |
| `pragmaEmailHeaderHtml` / footer | Branding PRAGMA |

**No** se creó un segundo pipeline ni plantillas nuevas.

---

## Componentes modificados / añadidos

| Archivo | Rol |
|---------|-----|
| `prisma/schema.prisma` + migración `20260716160000_…` | `inviteSentAt` / `inviteError` / `inviteLog` |
| `src/lib/guest-registration/guest-registration-invite-email-log.ts` | Parser + marker + validación email |
| `src/services/guests/guest-registration-email.service.ts` | Claim, historial, gate Direct, branding |
| `src/services/reservations/reservation.service.ts` | Auto `triggeredBy: "auto"` + gate Direct explícito |
| `src/services/reservations/reservation-hold.service.ts` | Bienvenida solo si `platform === DIRECT` |
| `src/features/guests/actions/guest-registration.actions.ts` | Reenvío manual con `force: true` |
| `tests/guests/guest-registration-invite-email-log.test.ts` | Unit |
| `scripts/validate-direct-welcome-email.ts` | Validación real |

---

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|--------|------------|
| Doble envío / concurrencia | Claim `__SENDING__` + `inviteSentAt` |
| Envío fuera de Direct | Skip auto si `platform !== DIRECT` |
| Hold pendiente | Skip auto si `holdExpiresAt` |
| Sin / email inválido | No claim; retorno error |
| Reenvío manual | `force: true` limpia sentAt y reclama |
| Error temporal Resend | `inviteError` queda; auto puede reintentar (sentAt null) |

---

## Evidencia de pruebas

### Unit

`npx tsx --test tests/guests/guest-registration-invite-email-log.test.ts` → **pass**

### Real (Resend)

```
mode: real
from: PRAGMA PMS <noreply@pragmapms.com>
to: magvillafuerte@gmail.com
reservationId: cmrngl4jg0000g4tyzkow28nn
providerId: 1b86e372-f1db-4b06-85aa-28df7612bcde
send#1: ok (auto)
send#2: skipped — "Correo de bienvenida ya enviado"
log: status=success, triggeredBy=auto, providerId presente
cleanup: CANCELLED
```

Script:

`npx tsx --require ./scripts/preload-stub-server-only.cjs scripts/validate-direct-welcome-email.ts --cleanup`

---

## Auditoría posterior

| Check | Resultado |
|-------|-----------|
| Typecheck | OK |
| Nuevo pipeline de correo | No |
| Impacto Guest Registration core | Solo ensure + invite email |
| Impacto QR Mobility / INTIENDAS / TTLock / Airbnb inbound | Ninguno |
| Anti-duplicados | Validado |
| Reenvío manual | Conservado con `force` |
| Multi-tenant | Intacta (mismo alcance de reserva) |

---

## Criterio de aceptación

| Criterio | Cumple |
|----------|--------|
| Bienvenida automática al confirmar Direct (sin hold / post-hold) | Sí |
| Guest Registration Link correcto | Sí |
| Sin duplicados | Sí |
| Infra existente reutilizada | Sí |
| Sin regresiones de dominio | Sí |
| Historial + providerId + success | Sí |
