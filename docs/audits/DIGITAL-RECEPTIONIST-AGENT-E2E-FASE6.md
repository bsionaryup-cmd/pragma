# Digital Receptionist Agent — Fase 6 E2E checklist

**Fecha:** 2026-07-31  
**Entorno:** staging / número Meta de prueba  
**TTLock real:** OFF en autónomo

## Guiones

| # | Caso | Esperado |
|---|------|----------|
| 1 | FAQ (“¿hay wifi?”) SUPERVISED | audit `agent_turn` + mensaje out draft; **sin** send cloud |
| 2 | Kill mid-flight | `canSend=false`; no `cloud_outbound_sent` |
| 3 | Webhook duplicado mismo `wamid` | `accepted: 0` segunda vez; un solo inbound |
| 4 | Firma inválida | HTTP 401 |
| 5 | Challenge verify token | GET hub challenge 200 |
| 6 | Escalado (“quiero hablar con alguien”) | conversation `ESCALATED` |
| 7 | create_reservation_draft | escalate / requiresHuman; **no** crea Reservation |
| 8 | Fuera de horario | perceive ok, no send |
| 9 | AUTONOMOUS + FAQ (canary) | send cloud + ledger SENT |
| 10 | Cron drain | `/api/cron/digital-receptionist-turns` procesa PENDING |

## Unit gates (CI)

```bash
npx tsx --test tests/platform/digital-receptionist-agent-cloud.test.ts
npx tsx --test tests/platform/digital-receptionist-v1.test.ts
```

## Criterios de aceptación Fase 6

- [x] Suite unitaria cloud + guardrails + gates
- [ ] Checklist Meta sandbox firmado por Owner (manual)
- [ ] Cero writes a TTLock / reservas core en E2E
