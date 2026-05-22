# Billing / Payments — PRAGMA PMS

## Auditoría (Fase 1)

| Componente | Estado |
|------------|--------|
| Suscripción SaaS (`BillingAccount`, `BillingInvoice`) | Operativo |
| Lock por impago (`billing-guard`) | Operativo |
| Finanzas `/finance` | Separado (no PSP) |
| Wompi checkout | Listo con credenciales |
| Payment ledger | Migración `20260521180000_payment_ledger` |

## Arquitectura

`src/modules/billing/` — Provider Strategy (Wompi primero; Stripe/MP/PayU registrables).

Facades sin romper imports:

- `src/services/billing/billing.service.ts`
- `src/services/billing/wompi.service.ts`

## Variables de entorno

Ver `.env.example`. Webhook canónico: `/api/payments/wompi/webhook`.

## Activación

```bash
npm run db:migrate:deploy
npx prisma generate
npm run test:billing
```

Pegar credenciales Wompi y registrar webhook URL en dashboard Wompi.

## Pago de suscripción (flujo)

1. Admin visita **Configuración → Facturación** (`/settings/billing`).
2. Si hay factura **OPEN** o **FAILED**, pulsa **Pagar suscripción con Wompi**.
3. Redirección al checkout Wompi (payment link, uso único).
4. Wompi notifica `POST /api/payments/wompi/webhook` con `x-event-checksum`.
5. Webhook reconcilia: factura **PAID**, cuenta **ACTIVE**, `currentPeriodEnd` +1 mes.

Al vencer el período (trial o mensual), el sistema genera factura abierta y pasa a **PAST_DUE** (7 días de gracia antes de **LOCKED**).

## Cron de renovación

`GET /api/cron/billing-renewal` con `Authorization: Bearer CRON_SECRET` (o `?secret=`).

Recomendado: ejecución diaria en Vercel Cron para crear facturas de renovación sin depender de que alguien abra Facturación.
