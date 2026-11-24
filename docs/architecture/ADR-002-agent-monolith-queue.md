# ADR-002 — Monolito modular + cola de turnos

**Estado:** Aceptado  
**Fecha:** 2026-07-31  

## Decisión

El agente vive **dentro de PRAGMA** (mismo Prisma, policy, Owner).  
Webhook responde rápido → persiste inbound → encola turno → procesa con `after()` (patrón retail outbox) + cron safety net.

No microservicio separado en día 1.

## Consecuencias

- Módulo `orchestrator/process-turn.ts` es la unidad de trabajo
- Timeouts Vercel mitigados: webhook ≠ LLM sync largo
- Workers externos solo si la cola lo exige más adelante

## Alternativas rechazadas

| Opción | Motivo |
|--------|--------|
| LLM sync en el webhook | Timeouts / cold start |
| Microservicio agente día 1 | Duplicar auth/Prisma/ops |
