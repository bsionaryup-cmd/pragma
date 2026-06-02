# ePayco — Payment Links (tenant)

Integración de pasarela ePayco para cobros a huéspedes vía **Payment Links**, en paralelo a Wompi.

## Credenciales (dashboard ePayco)

| Campo PRAGMA | Origen ePayco |
|--------------|---------------|
| Llave pública | Integraciones → API Keys |
| Llave privada | Integraciones → API Keys |
| P_KEY | Confirmación de pagos (firma `x_signature`) |
| Cust ID cliente | ID comercio (opcional si coincide con llave pública) |

## URLs en PRAGMA

| Uso | Ruta |
|-----|------|
| Configuración tenant | `/integrations/epayco` |
| Checkout huésped | `/pay/epayco/[linkId]` |
| Webhook confirmación | `POST/GET /api/webhooks/epayco` |
| Sesión checkout (JSON) | `GET /api/payments/epayco/session/[linkId]` |

En el dashboard ePayco, registrar la **URL de confirmación**:

`https://<tu-dominio>/api/webhooks/epayco`

## Flujo

1. Staff emite Payment Link → PRAGMA elige **ePayco** si está marcado como preferido (o si Wompi no está configurado).
2. Huésped abre `/pay/epayco/{linkId}` → checkout OnPage (script `checkout.epayco.co`).
3. ePayco confirma a `/api/webhooks/epayco` → reconciliación ledger + estado `PAID`.

Referencia de factura: `guest-{linkId}` (misma convención que Wompi).

## Migración

```bash
npm run db:migrate:deploy
```

Migración: `20260602130000_epayco_integration`

## Prueba de conexión

Panel ePayco → **Probar conexión** (login Apify `https://apify.epayco.co/login`).

## Dos rieles ePayco

| Riel | Quién configura | Org interna | Referencia |
|------|-----------------|-------------|------------|
| SaaS (suscripción) | Owner → `/owner-dashboard/billing` | `PRAGMA Platform (Epayco)` | `pragma-{invoiceId}` |
| Guest (Payment Links) | Tenant → `/integrations/epayco` | Org del tenant | `guest-{linkId}` |

Checkout suscripción: `/pay/epayco/billing/[invoiceId]`
