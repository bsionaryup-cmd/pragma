# Recepcionista Digital Agent — Guía de arranque (paso a paso)

**Fecha:** 2026-07-31  
**Modo seguro inicial:** SUPERVISED (borrador / sin envío autónomo)  
**Canal:** WhatsApp Cloud API (Meta) — no Opera CDP

## Estado de seguridad (gates)

El agente **no envía** WhatsApp a menos que coincidan TODOS:

1. Env Meta configurado (`WHATSAPP_CLOUD_*`)
2. Owner: canal WhatsApp ON
3. Owner: Encender (status SUPERVISED o AUTONOMOUS) + kill OFF
4. En SUPERVISED: `canSend=false` → solo draft en DB/audit (seguro para probar)
5. En AUTONOMOUS: además LLM/fallback decide `mode=send` + ledger claim

Sin credenciales Meta el webhook falla cerrado (sin envíos).

---

## Paso 1 — Base de datos

```bash
npx prisma migrate deploy
```

Migración crítica: `20260731120000_digital_receptionist_agent_cloud`.

## Paso 2 — Variables en Vercel (Production)

| Variable | Uso |
|----------|-----|
| `WHATSAPP_CLOUD_ACCESS_TOKEN` | Token Graph API |
| `WHATSAPP_CLOUD_PHONE_NUMBER_ID` | ID del número WABA |
| `WHATSAPP_CLOUD_VERIFY_TOKEN` | Token que inventes para el challenge |
| `WHATSAPP_CLOUD_APP_SECRET` | App Secret (firma `X-Hub-Signature-256`) |
| `WHATSAPP_CLOUD_ORGANIZATION_ID` | ID org Loft 33 en PRAGMA |
| `OPENAI_API_KEY` | Motor LLM (si falta → fallback determinista) |
| `DIGITAL_RECEPTIONIST_AGENT_ENGINE` | `llm` recomendado; `deterministic` = sin OpenAI |
| `CRON_SECRET` | Ya usado por otros crons |

Redeploy o “Redeploy” tras guardar env.

## Paso 3 — Meta Developer / WABA

1. App Meta → WhatsApp → Configuration  
2. Callback URL: `https://www.pragmapms.com/api/webhooks/whatsapp`  
3. Verify token = el mismo `WHATSAPP_CLOUD_VERIFY_TOKEN`  
4. Suscribir `messages`  
5. Número de prueba (sandbox) primero

## Paso 4 — Owner PRAGMA

1. Entra a **Owner → Recepcionista Digital**  
2. Org Loft 33  
3. Canal **WhatsApp** ON  
4. Skills: FAQ, leer mensajes, GR/portal, escalate (create reservation / TTLock OFF)  
5. **Encender** y deja **SUPERVISED** (o usa el flujo Encender y confirma modo supervisado si la UI lo ofrece)  
6. Kill OFF solo cuando quieras que perciba; en SUPERVISED igual **no envía** solo

## Paso 5 — Primera prueba segura

1. Desde el número de prueba Meta, escribe al número WABA: `Hola, ¿tienen wifi?`  
2. En DB / audit busca `cloud_inbound` y `agent_turn`  
3. Esperado SUPERVISED: mensaje `out` guardado como draft, **sin** `cloud_outbound_sent`  
4. Si algo falla: **Apagar** en Owner (kill inmediato)

## Paso 6 — Canary autónomo (solo tras 5 OK)

1. Owner → modo **AUTONOMOUS**  
2. Skills solo FAQ + links primeros 2–3 días  
3. Vigilar audit `cloud_outbound_sent` y costos Meta/OpenAI  
4. Ante duda: **Apagar**

## No uses

- `desktop/recepcionista-digital` (Opera) para prod  
- AUTONOMOUS + create reservation / TTLock en fase canary  
- `WHATSAPP_CLOUD_SKIP_SIGNATURE=1` en producción

## Runbook / ADRs

- `docs/architecture/DIGITAL-RECEPTIONIST-AGENT-RUNBOOK.md`  
- `docs/audits/DIGITAL-RECEPTIONIST-AGENT-E2E-FASE6.md`
