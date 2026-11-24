# Digital Receptionist Agent — Fase 1 Auditoría SSOT

**Fecha:** 2026-07-31  
**Alcance:** Baseline previo al rediseño WhatsApp Cloud API + Agente LLM  
**Deploy:** No autorizado en esta fase (solo inventario)

## Veredicto

| Criterio prod (Plan Maestro) | Estado |
|------------------------------|--------|
| Canal WhatsApp oficial (Cloud API) | **GAP** — solo Opera CDP / WA Web |
| Agente conversacional tool-calling | **GAP** — cerebro determinista (regex + templates) |
| Cola de turnos asíncrona | **GAP** — poll desde desktop |
| Memoria / KB / audit / ledger | **OK** — reutilizar |
| Policy / kill / hours / Phase F | **OK** — reutilizar y evolucionar |
| Owner Encender/Apagar | **OK** |
| Escala miles de conversaciones | **NO GO** con arquitectura actual |

**Conclusión Fase 1:** Inventario cerrado. Path CDP = legacy. Target = Cloud API + monolito modular + cola + LLM con fallback determinista.

## Inventario actual

| Pieza | Path | Rol | Destino |
|-------|------|-----|---------|
| Config / power / token | `digital-receptionist.service.ts` | Owner + runtime Bearer | Reutilizar |
| Policy gates | `digital-receptionist.policy.ts` | canPerceive/canSend | Reutilizar |
| Brain regex | `digital-receptionist.brain.ts` | Shadow planner sync | Fallback only |
| Decision + skills | `skills/*` | Prod path actual | Tools / fallback |
| Context | `context/build-reception-context.ts` | Match reserva | Reutilizar |
| Rules | `rules/rule-engine.ts` | No inventar códigos | Guardrails post-LLM |
| Knowledge + facts | `knowledge/knowledge.service.ts` | FAQ + thread memory | Reutilizar |
| Runtime API | `api/digital-receptionist/runtime/...` | Desktop bridges | Legacy compatible |
| Opera CDP WA | `desktop/recepcionista-digital` | Manos WA Web | **Deprecar prod** |
| Electron Airbnb | `desktop/pragma-recepcionista-app` | Manos Airbnb web | Fuera de WA Cloud |

## Phase F (escrituras bloqueadas en AUTONOMOUS)

- `sendAccessCode`, `createReservation`, `sendPaymentLink`, `modifyReservation`

## Prisma existente

- `DigitalReceptionistConfig`, `AuditEvent`, `OutboundLedger`, `KnowledgeEntry`, `ThreadFact`

## Gaps a cerrar (Fases 3–7)

1. Modelos Conversation / Message / TurnJob  
2. `integrations/whatsapp-cloud` + webhook firmado  
3. Orchestrator + LLM tools + prompt versioning  
4. Cola `after()` + cron safety net  
5. Owner: estado WABA, transcripts, deprecar copy Opera  
6. E2E + runbook canary  

## No tocar

- TTLock generate/revoke/email staff  
- Guest Registration invite/completion/comms  
- iCal, PriceLabs, billing, airbnb-email inbound  
- Stay Portal `wa.me` links (distinto del agente)

## Criterios de aceptación Fase 1

- [x] Doc SSOT con gaps Cloud API + LLM + cola  
- [x] Matriz reutilizar / eliminar / no tocar  
- [x] Lista tool-ready: GR ensure, stay portal URL, context builder, KB, ledger, policy  
