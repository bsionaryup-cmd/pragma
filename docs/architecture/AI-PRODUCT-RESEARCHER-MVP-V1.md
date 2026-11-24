# AI Product Researcher MVP V1 — ADR

**Fecha:** 2026-08-02  
**Deploy:** No automático — solo con “apruebo deploy”

## Decisión

Módulo additive `ai-product-researcher`: encuentra productos ganadores con datos (Meta Ads Library, Google Trends, Dropi, señales manuales) + OpenAI scoring. **No vende. No crea campañas.**

## No tocar

- Recepcionista Digital, webhook hotel WA
- TTLock, iCal, airbnb-email, reservas/calendario/finanzas
- Loop del AI Sales Agent

## Fuentes V1

| Fuente | Comportamiento |
|--------|----------------|
| Meta Ads Library | Graph `ads_archive` si hay token; fail soft |
| Google Trends | Integración equivalente HTTP; fail soft |
| Dropi | Validar precio/stock (cliente existente) |
| TikTok/IG/FB | Solo notas/URLs manuales Owner |

## Handoff

Score ≥ umbral (default 85) + `autoHandoff` → `AiAgentHandoff` → Media Buyer.

## Riesgo PMS

Cero si no hay imports a reservation/ttlock/ical/RD.
