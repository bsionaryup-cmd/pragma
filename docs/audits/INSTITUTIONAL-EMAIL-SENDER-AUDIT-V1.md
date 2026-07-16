# Auditoría Fase 1 — Remitente institucional

Fecha: 2026-07-16  
Alcance: localizar todas las referencias al remitente de correo saliente.

## Hallazgo clave

**Único punto de envío saliente en código PRAGMA:** `src/lib/email/send-email.ts` → `resolveEmailFromAddress()` → campo `from` de Resend.

Consumidores de `sendEmail()` (heredan remitente automáticamente):

| Módulo | Archivo |
|--------|---------|
| Guest Registration (huésped) | `src/services/guests/guest-registration-email.service.ts` |
| Guest Registration (admin) | `src/services/guests/guest-registration-admin-notification.service.ts` |
| Facturación (recibo) | `src/modules/billing/services/billing-receipt-email.service.ts` |

## Referencias al remitente / dominio

| Archivo | Tipo | Uso actual |
|---------|------|------------|
| `src/lib/email/send-email.ts` | **Remitente** | `EMAIL_FROM` o fallback `PRAGMA Facturación <PRAGMA_BILLING_EMAIL \| facturacion@pragma.co>` |
| `.env` / `.env.local` | Config | `EMAIL_FROM="PRAGMA Facturación <facturacion@pragma.co>"` |
| `.env.example` | Docs | Mismos valores legacy |
| `tests/billing/send-email.test.ts` | Test | Espera fallback vía `PRAGMA_BILLING_EMAIL` |
| `scripts/audit-resend-infrastructure.mjs` | Script | Duplica lógica legacy de resolve |

## No son remitentes (contactos / UI / placeholders)

| Archivo | Valor | Rol |
|---------|-------|-----|
| `src/modules/billing/domain/bank-transfer.ts` | `PRAGMA_BILLING_EMAIL` / `facturacion@pragma.co` | Contacto para comprobantes de pago |
| `src/modules/billing/services/billing-invoice-document.service.ts` | `cliente@pragma.co` | Placeholder cliente en PDF |
| `src/modules/billing/services/billing-receipt-email.service.ts` | `PRAGMA_BILLING_EMAIL` | **Destinatario** fallback, no `from` |
| `src/features/billing/components/billing-dashboard.tsx` | `soporte@pragma.co` | Link mailto soporte |

## Fuera de alcance (no usan sendEmail de PRAGMA)

- Password reset / MFA / verificación: Clerk
- Invitaciones de equipo: Clerk
- Inbound Airbnb: Resend receiving (dirección inbound distinta)

## Riesgo arquitectónico

**Ninguno.** Cambio acotado a resolución de `from`. No hay segundo pipeline.
