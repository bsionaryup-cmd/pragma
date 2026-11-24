# Digital Receptionist vs Dropshipping — isolation audit

**Fecha:** 2026-08-13  
**Acción:** AUDIT ONLY — **NO ELIMINAR** código de Recepcionista Digital.

## Veredicto

`Digital Receptionist` / Recepcionista Digital es el **agente hotelero PMS** (WhatsApp Cloud para huéspedes, reservas, TTLock, FAQ, stay portal).  
**No** es parte del sistema Dropshipping y **no** debe consolidarse ni eliminarse en esta ejecución.

## Inventario (hotel / PMS)

| Área | Paths | Consumidores |
|------|-------|--------------|
| Services | `src/services/platform/digital-receptionist/**` | Cron turns, webhooks, Owner UI |
| Webhook | `/api/webhooks/whatsapp` | Meta Cloud API hotel number |
| Cron | `/api/cron/digital-receptionist-turns` | Vercel |
| Owner UI | `/owner-dashboard/recepcionista-digital`, `owner-digital-receptionist-view.tsx` | Platform Owner |
| Desktop | `desktop/recepcionista-digital/**` | Legacy WA Web / portable |
| Prisma | `DigitalReceptionist*` models | Org-scoped hotel threads |
| Env | `WHATSAPP_CLOUD_*`, `OPENAI_API_KEY`, `DIGITAL_RECEPTIONIST_*` | Hotel channel + LLM |

## Inventario (Dropshipping — separado)

| Área | Paths |
|------|-------|
| Sales | `src/services/platform/ai-sales-agent/**`, `/api/webhooks/whatsapp-sales` |
| Marketing | `ai-product-researcher`, `ai-media-buyer` |
| Orchestrator | `src/services/platform/dropshipping/**` |
| Owner hub | `/owner-dashboard/dropshipping/**` |

## Dependencias cruzadas

- **Ninguna importación** de `digital-receptionist` desde `ai-sales-agent` / `dropshipping` (intencional).
- WhatsApp phone numbers **distintos** (ADR + runbooks).
- OpenAI: RD usa env `OPENAI_API_KEY`; Dropshipping usa secretos Owner cifrados + cliente central `src/services/platform/ai/openai-chat.ts` (RD no migrado en esta fase para no tocar PMS).

## Impacto de eliminación

Eliminar RD rompería: inbox hotelero, guest messaging, stay links, TTLock code tools, desktop agent, org configs.  
**Prohibido.**

## Conclusión

Mantener Recepcionista Digital intacto. Dropshipping se consolida bajo Owner → Dropshipping sin absorber RD.
