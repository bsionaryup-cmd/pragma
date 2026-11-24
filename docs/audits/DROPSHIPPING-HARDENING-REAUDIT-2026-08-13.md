# Dropshipping hardening reaudit — 2026-08-13

**Estado objetivo:** READY FOR CREDENTIALS  
**Deploy:** 2026-08-13 · `dpl_6ASXihCT4EPQc4wnHfpqAr4Q2zjW` → https://www.pragmapms.com  
**Inspect:** https://vercel.com/pragma-s-projects/pragma-pms/6ASXihCT4EPQc4wnHfpqAr4Q2zjW

## Cambios

1. **Orquestador determinístico** — `src/services/platform/dropshipping/orders/orchestrator.ts`  
   Sales ya no llama `dropi.createOrder` directamente; tool `submit_order_intent` (alias `dropi_create_order`) emite intent.
2. **Idempotencia P0** — `shopOrderId = aisales-${orderLogId}` (sin `Date.now()`); unique index; resume active ledger / return success.
3. **Estados** — enum `AiSalesOrderStatus` + transiciones en `order-states.ts`.
4. **Dropi adapter** — `dropshipping/dropi/dropi.service.ts` sobre `integrations/dropi`.
5. **AI central** — `src/services/platform/ai/openai-chat.ts` usado por Sales / Researcher / Media Buyer.
6. **Owner hub** — `/owner-dashboard/dropshipping/*` (Resumen, Productos, Marketing, Ventas, Pedidos, Automatizaciones, Analítica, Configuración). Rutas legacy redirigen.
7. **Cron** — `ai-sales-agent-turns` también drena `FAILED_RETRYABLE`.
8. **RD** — auditado y **no tocado** (`docs/audits/DIGITAL-RECEPTIONIST-VS-DROPSHIPPING-2026-08-13.md`).

## Cadena

```
Meta/Researcher → Media Buyer → CTWA WhatsApp Sales
→ Sales Agent → submit_order_intent → Orchestrator
→ DropiService → Dropi → AiSalesOrderLog → confirmación
```

## Checklist

- [x] Marketing preservado (researcher + media buyer)
- [x] Sales preservado (ingress/webhook/loop)
- [x] Orchestrator + idempotencia + estados
- [x] AI client centralizado (dropshipping agents)
- [x] Dashboard consolidado Owner-only
- [x] Sin secretos reales en código
- [x] Sin deploy
- [x] PMS / RD no modificados

## Reauditoría incremental (misma fecha)

- Researcher y Owner “Probar Dropi” usan `DropiService` (ya no el client HTTP directo).
- `getOrderStatus` = alias de `getOrder` (Dropi no documenta cancel/status separado; no se inventó endpoint).
- Neon: create ledger + shopOrderId en un write; happy-path PENDING→SUBMITTING en un write; hub carga configs+orders en paralelo.
- Validación de intent extraída a código determinístico testeable (`order-intent.ts`).
- Hub Dropi puede mostrar ERROR si el ledger reciente tiene 401/403 (sin ping extra).

## Pendiente post-aprobación

Pegar credenciales reales solo en Owner UI (cifradas): OpenAI, Meta, WhatsApp Sales, Dropi. Luego prueba controlada live. **Deploy: no.**
