# Billing / Payments — PRAGMA PMS (SaaS subscriptions)

## Scope

Wompi is the **centralized** payment processor for **PRAGMA SaaS subscriptions only**.

It must **not** be used for:

- Reservation / guest payments
- OTA or Airbnb-like flows
- Deposits or booking operational charges

Hospitality finance (`/finance`, `PaymentStatus` on reservations) remains separate.

## Ownership model

| Actor | Capabilities |
|-------|----------------|
| **Platform Super Admin Owner** | Wompi credentials, sandbox/production, webhooks, global revenue, failed payments, tenant billing overrides |
| **Tenant ADMIN** | Own subscription, pay, retry, invoices, cancel |
| **Tenant RECEPTIONIST** | No billing access |

Wompi credentials live under one internal org (`PRAGMA Platform (Wompi)`) or env vars — never per-tenant PSP accounts.

## Architecture

```
src/modules/billing/          # Domain + Wompi adapter + webhooks
src/services/billing/         # Facades (backward compatible imports)
src/services/platform/        # Owner dashboard + billing infra
```

Policy constants: `src/modules/billing/permissions/billing-access-policy.ts`

## Environment (sandbox first)

```env
WOMPI_PUBLIC_KEY=pub_test_...
WOMPI_PRIVATE_KEY=prv_test_...
WOMPI_EVENTS_SECRET=...
WOMPI_INTEGRITY_SECRET=...
WOMPI_ENV=test          # test | sandbox | production
WOMPI_BASE_URL=https://sandbox.wompi.co/v1
WOMPI_WEBHOOK_URL=https://your-app.com/api/payments/wompi/webhook
```

Secrets are server-only. Production switch = change `WOMPI_ENV` + keys only.

## Webhooks

| Endpoint | Notes |
|----------|--------|
| `POST /api/payments/wompi/webhook` | Canonical |
| `POST /api/webhooks/wompi` | Legacy alias |

Security: `x-event-checksum`, events secret, idempotency, rate limit, timestamp validation (strict in production).

## Tenant flow

1. Sign-up → org + `BillingAccount` **TRIAL** (7 days)
2. Onboarding → property slots for pricing
3. Trial end → **PAST_DUE** + open invoice + 7-day grace
4. Grace end → **LOCKED** (`billing-guard` blocks ops except `/settings/billing`)
5. Pay at **Configuración → Facturación** → Wompi checkout → webhook → **ACTIVE**

## Owner flow

- **Owner Dashboard** (`/owner-dashboard`) — MRR, subscriptions, revenue, clients
- **Billing infra** (`/owner-dashboard/billing`) — Wompi credentials, webhook monitor, failed payments
- APIs: `/api/owner/billing/webhooks`, `/api/owner/billing/failed-payments`

## Cron

`GET /api/cron/billing-renewal` with `Authorization: Bearer CRON_SECRET` — daily lifecycle reconciliation.

## Activation

```bash
npm run db:migrate:deploy
npx prisma generate
npm run test:billing
```

Register webhook URL in Wompi dashboard (sandbox).

## States

**Subscription:** `TRIAL` → `ACTIVE` → `PAST_DUE` → `LOCKED` | `CANCELED`

**Invoice:** `OPEN` → `PAID` | `FAILED` | `VOID`

**Payment (ledger):** `PENDING` → `APPROVED` | `DECLINED` | `FAILED`
