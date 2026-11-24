# Recepcionista Digital Agent — Runbook de producción (Fase 7)

**Estado:** Listo para canary tras migrate + env Meta + E2E  
**Deploy:** Solo con “apruebo deploy”

## Preflight

1. `npx prisma migrate deploy` (migración `20260731120000_digital_receptionist_agent_cloud`)
2. Vercel env:
   - `WHATSAPP_CLOUD_ACCESS_TOKEN`
   - `WHATSAPP_CLOUD_PHONE_NUMBER_ID`
   - `WHATSAPP_CLOUD_VERIFY_TOKEN`
   - `WHATSAPP_CLOUD_APP_SECRET`
   - `WHATSAPP_CLOUD_ORGANIZATION_ID` = Loft 33 org id
   - `OPENAI_API_KEY`
   - `DIGITAL_RECEPTIONIST_AGENT_ENGINE=llm` (o `deterministic` para fallback only)
3. Meta App: callback `https://www.pragmapms.com/api/webhooks/whatsapp`
4. Owner: canal WhatsApp ON, Encender SUPERVISED primero
5. Cron (opcional): `/api/cron/digital-receptionist-turns` cada 5 min

## Canary (7 días)

| Día | Modo | Skills |
|-----|------|--------|
| 1–2 | SUPERVISED | FAQ, escalate, GR/portal links (draft) |
| 3–5 | AUTONOMOUS | FAQ + links only |
| 6–7 | AUTONOMOUS | + availability consult; create_reservation sigue Phase F / escalate |

## Kill switch

Owner **Apagar** o `killSwitch=true` → `canSend=false` inmediato.  
Los turnos pueden percibir pero no envían cloud.

## Deprecar CDP

- `desktop/recepcionista-digital` = **legacy**. No es path SaaS.
- No pedir Opera al host para WhatsApp prod.
- Airbnb Electron permanece opcional y separado.

## Incidentes

| Síntoma | Acción |
|---------|--------|
| Firma inválida | Revisar APP_SECRET / raw body |
| No responde | Cron drain + audit `agent_turn` |
| Alucinación código | Guardrails + Phase F; escalar |
| Costo LLM | Bajar a `deterministic` o modelo mini |

## Aceptación canary

- 7 días sin P0
- Handoff / tool-error bajo umbral Owner
- Cero writes TTLock/reserva core no autorizados
