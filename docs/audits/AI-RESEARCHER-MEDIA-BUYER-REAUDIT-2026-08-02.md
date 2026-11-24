# Reauditoría Product Researcher + Media Buyer — 2026-08-02

## Matriz no-touch

| Área | Estado |
|------|--------|
| RD + `/api/webhooks/whatsapp` | Intactos |
| AI Sales Agent loop | Intacta (CTWA destination documentado) |
| TTLock / iCal / reservas / finanzas | Sin toques |

## Additive

- `ai-product-researcher`, `ai-media-buyer`, `AiAgentHandoff`
- Crons `/api/cron/ai-product-researcher`, `/api/cron/ai-media-buyer`
- Owner pages + nav links

## Seguridad

- Secrets cifrados (`platform-secrets-crypto`)
- Campañas Meta PAUSED por defecto; nunca delete; budget clamp
- Kill switches independientes

## Tests

`tests/platform/ai-product-researcher-media-buyer.test.ts`

## Deploy

**Bloqueado** hasta “apruebo deploy”.
