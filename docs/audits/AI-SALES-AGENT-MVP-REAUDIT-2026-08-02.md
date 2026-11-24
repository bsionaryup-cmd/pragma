# Reauditoría AI Sales Agent MVP — 2026-08-02

## Alcance

Módulo additive WhatsApp ventas → Dropi. Deploy **no** incluido (requiere “apruebo deploy”).

## Matriz no-touch

| Área | Estado |
|------|--------|
| `/api/webhooks/whatsapp` (RD hotel) | Intacta — sales usa `/api/webhooks/whatsapp-sales` |
| `digital-receptionist/**` services | Sin imports desde ai-sales-agent |
| TTLock / iCal / airbnb-email | Sin toques |
| Reservation / calendar / finance services | Sin toques |
| Owner nav | Solo link additive a AI Sales Agent |

## Seguridad

- Secrets AES-GCM (`AI_SALES_ENCRYPTION_KEY` → fallback TTLOCK/CLERK)
- GET `/api/owner/ai-sales-agent` solo flags `has*` + IDs públicos
- Webhook firma fail-closed (`AI_SALES_WA_SKIP_SIGNATURE=1` solo lab)
- Rate limit simple por `wa_id`
- `dropi_create_order` gated por stage CLOSE/SHIPPING

## Tests

- `tests/platform/ai-sales-agent.test.ts` — crypto, WA verify, Dropi fixtures, stage gate

## Go-live (Owner)

Ver `docs/architecture/AI-SALES-AGENT-OPS-RUNBOOK.md`.

## Veredicto

**PASS** para merge/código additive. **Deploy pendiente** de aprobación explícita Owner.
