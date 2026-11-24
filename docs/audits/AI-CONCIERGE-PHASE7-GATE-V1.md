# AI Concierge — Fase 7 Gate (Extensión)

**Fecha:** 2026-07-17  
**Master:** v1.2 ejecución continua  
**Precondición:** Fase 6 commit `13ee3bd`

## Alcance F7
Extensión + API de canal: detectar, leer, comunicar. **Sin responder / sin escribir en chat.**

## Diseño menor impacto
- Extensión MV3 vanilla en `extensions/pragma-ai-concierge/` (sin nuevas deps npm)
- API `POST /api/concierge/channel/*` con Bearer `CONCIERGE_EXTENSION_SECRET`
- Scope vía headers `x-concierge-org-id` / `x-concierge-user-id`
- Memoria de conversación in-memory (sin migración Prisma)

## Riesgos
| Riesgo | Mitigación |
|--------|------------|
| Auth débil | Secret requerido; 401 sin él |
| DOM frágil Airbnb/WA | Fail-closed; solo lectura F7 |
| Side-effects PMS | Ingest no muta reservas |

Continúa automáticamente a F8–F12 en el mismo ciclo si reauditoría PASS.
