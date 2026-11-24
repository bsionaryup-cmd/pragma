# Architecture — Dropshipping order orchestrator

**Fecha:** 2026-08-13

## Decisión

La creación de pedidos Dropi **no** la ejecuta el LLM. Sales emite un **order intent**; un orquestador determinístico valida, aplica idempotencia y llama al adapter Dropi.

## Flujo

```
WhatsApp Sales webhook
  → ai-sales-agent (conversación + tools de producto)
  → submit_order_intent
  → dropshipping/orders/orchestrator
  → DropiService → Dropi API
  → AiSalesOrderLog (estados controlados)
```

## Idempotencia

- Ledger row `AiSalesOrderLog.id` se crea primero.
- `shopOrderId = aisales-${orderLogId}` (estable; nunca `Date.now()`).
- Si ya hay `SUBMITTED`/`CONFIRMED` para la conversación → no re-POST.
- Si hay fila activa (`PENDING`…`FAILED_RETRYABLE`) → se reanuda la misma fila.
- Retries vía cron en `FAILED_RETRYABLE` + `runAfter`.

## No tocar

Digital Receptionist, reservas, TTLock, iCal, finance, guest registration.
