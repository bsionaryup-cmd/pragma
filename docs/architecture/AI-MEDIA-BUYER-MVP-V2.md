# AI Media Buyer MVP V2 — ADR

**Fecha:** 2026-08-02  
**Deploy:** No automático — solo con “apruebo deploy”

## Decisión

Módulo additive `ai-media-buyer`: recibe handoffs del Product Researcher, genera estrategia/copies/hooks vía OpenAI, crea campañas Meta (CTWA → WhatsApp Sales) **PAUSED** por defecto. Optimiza solo con allowlist + caps.

## No tocar

- PMS core, RD, Sales Agent loop (solo destination phone para CTWA)

## Seguridad

- Nunca delete campañas
- `maxDailyBudget` hard cap
- `autoPublish` / `autoOptimize` default OFF
- Audit log de acciones

## Flujo

Handoff PENDING → claim → LLM strategy → Meta Marketing API → insights cron → recs / optimize allowlist.
