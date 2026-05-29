# PRAGMA — Push / deploy checklist

Usar antes del **primer push** de este Release Candidate y tras cada deploy.

## Base de datos

```bash
npm run db:migrate:deploy
npx prisma migrate status   # debe: Database schema is up to date
```

Confirmar que `DATABASE_URL` apunta al entorno correcto (Neon branch prod vs dev).  
Las migraciones del RC incluyen, entre otras:

- `20260524120000_add_property_type_loft`
- `20260525120000_billing_plan_scale`
- `20260525140000_support_and_guest_payment_links`
- `20260525180000_sales_console`

## Variables obligatorias en producción

| Variable | Uso |
|----------|-----|
| `DATABASE_URL` | Postgres (pooler recomendado) |
| `CRON_SECRET` | Todos los `/api/cron/*` |
| Clerk keys + `CLERK_WEBHOOK_SECRET` | Auth |
| Wompi SaaS (`WOMPI_*`) | Suscripción PRAGMA |
| Wompi por tenant | Integraciones → Wompi (cifrado en BD) |

## Cron jobs (programar en Vercel u host)

| Ruta | Frecuencia sugerida |
|------|---------------------|
| `GET /api/cron/guest-payment-reconcile` | Cada 10–15 min |
| `GET /api/cron/billing-renewal` | Diario |
| `GET /api/cron/airbnb-ical-sync` | Según volumen iCal |
| `GET /api/cron/airbnb-email-enrichment-retry` | Cada 5 min |
| `GET /api/cron/pricelabs-sync` | Según plan |
| `GET /api/cron/ttlock-sync` | Según plan |

Auth: `Authorization: Bearer <CRON_SECRET>` o `?secret=<CRON_SECRET>`.

## Webhook Wompi

- **SaaS:** `POST /api/payments/wompi/webhook` — referencias `pragma-*`
- **Huésped (tenant):** mismo endpoint — referencias `guest-*`, firma con `eventsSecret` del tenant

Registrar la URL canónica en el dashboard Wompi (sandbox primero).

## QA local antes de push

```bash
npm run verify:release
npm run build
```

Smoke manual recomendado (staging):

1. Login ADMIN → crear Payment Link → emitir
2. Login RECEPTIONIST → `/finance` debe → `/unauthorized`
3. Support bubble → ticket con contexto
4. Webhook Wompi sandbox → estado PAID en link + reserva

## Sales Console (owner-only)

- UI: `/owner-dashboard/sales`
- Oferta pública: `/offer/{token}`
- Migración: `20260525180000_sales_console`
- Arquitectura: `docs/POST-LAUNCH-SALES-CONSOLE.md`

## Dos rieles de pago

| Riel | Quién paga | Wompi | Referencia |
|------|------------|-------|------------|
| SaaS | Tenant a PRAGMA | Platform keys / org interna | `pragma-{invoiceId}` |
| Guest | Huésped al anfitrión | Credenciales del tenant | `guest-{linkId}` |

No mezclar credenciales ni webhooks entre ambos.
