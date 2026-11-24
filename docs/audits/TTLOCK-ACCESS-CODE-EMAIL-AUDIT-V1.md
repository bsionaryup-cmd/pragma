# Auditoría — Envío automático del código TTLock por correo

Fecha: 2026-07-16  
Estado: APROBADO PARA IMPLEMENTACIÓN (sin riesgo arquitectónico bloqueante)

## Hallazgos

| Pregunta | Respuesta |
|----------|-----------|
| ¿Dónde se genera? | `generateAccessCodeForReservation` en `ttlock-access.service.ts` |
| ¿Cuándo es válido? | Tras persistir `AccessCredential` con `status: GENERATED` (y API TTLock OK si live) |
| ¿Trigger post-GR? | `finalizeGuestRegistration` → `onGuestRegistrationCompletedForTTLock` → `processReservationAccessAfterRegistration` |
| ¿Correo existente con código? | No hay HTML transaccional; el mensaje existente es `buildAccessCodeGuestMessage` / plantilla ACCESS (clipboard/WhatsApp) |
| ¿Infra a reutilizar? | `sendEmail` + `brand-email` + Contactos Operativos + `deliveryStatus` / `autoSendCode` (ya en schema/UI) |

## Decisión

1. Reutilizar el **contenido** del mensaje existente de acceso (`buildAccessCodeGuestMessage`), en versión **sin markdown `**código**`** (el código se muestra tal cual: `12345#`).
2. Transporte: `sendEmail` (Resend) — mismo pipeline que GR/billing.
3. Trigger: tras generación exitosa, si `autoSendCode === true`.
4. Destinatarios: `Reservation.guestEmail` (titular) + Contacto Operativo (`resolveGuestRegistrationAdminRecipients`).
5. Anti-duplicados: claim atómico sobre `AccessCredential.deliveryStatus` (`NOT_SENT`/`FAILED` → `PENDING` → `SENT`).

## Riesgos

| Caso | Comportamiento |
|------|----------------|
| TTLock falla | No hay credential → no se envía |
| Sin correo de huésped | Se omite ese destinatario; se intenta Contacto Operativo |
| Sin Contacto Operativo ni notificationEmails | Se omite ops; si tampoco hay huésped → no envío, `deliveryStatus` FAILED con motivo |
| Re-generación idempotente | No reenvía si ya `SENT` |
| QR / INTIENDAS / Airbnb inbound | Sin cambios |

Sin riesgo arquitectónico que detenga la implementación.
