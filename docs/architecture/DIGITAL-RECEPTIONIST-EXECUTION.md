# Recepcionista Digital — Documento de Ejecución
## Loft 33 · Agente WhatsApp Cloud API

**Estado:** ACTUALIZADO 2026-07-31 (Cloud API path)  
**Tenant:** Loft 33 (`PILOT_PMS_ORGANIZATION_ID`)  
**Deploy Vercel:** NO automático — solo con “apruebo deploy”

### Canal de producción

- **WhatsApp:** Meta Cloud API → `/api/webhooks/whatsapp` → cola de turnos → agente (LLM + fallback determinista).
- **Legacy:** `desktop/recepcionista-digital` (Opera CDP) — no SaaS.
- **Airbnb:** Electron opcional; fuera del path WA Cloud.

Ver ADRs y runbook:

- `docs/architecture/ADR-001-whatsapp-cloud-api.md`
- `docs/architecture/DIGITAL-RECEPTIONIST-AGENT-RUNBOOK.md`

### Significado llave en mano

El Owner **Enciende** o **Apaga**.  
Secrets Meta / OpenAI viven en Vercel env, no en el PC del host.

### Perfil de fábrica Loft 33

- WhatsApp ON (Cloud), skills FAQ/GR/portal/escalate
- Phase F: sin TTLock send / create reservation autónomo
- Encender = AUTONOMOUS + kill OFF (canary gradual en runbook)
- Apagar = kill ON

### Apagado

- Botón Apagar en Owner, o kill / status OFF
