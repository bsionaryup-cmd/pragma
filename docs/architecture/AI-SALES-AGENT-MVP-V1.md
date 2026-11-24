# AI Sales Agent MVP V1 — ADR + Auditoría no-touch

**Fecha:** 2026-08-02  
**Deploy:** No automático — solo con “apruebo deploy”

## Decisión

Módulo **additive** `ai-sales-agent` para venta WhatsApp → Dropi (ERP).  
Cero e-commerce en PRAGMA. Un negocio piloto (Platform Owner).

## No tocar

- `digital-receptionist/**`, webhook `/api/webhooks/whatsapp` (hotel)
- TTLock, iCal, airbnb-email, reservation/calendar/finance services
- Opera CDP / Electron Airbnb

## Aislamiento WA

Webhook dedicado: `/api/webhooks/whatsapp-sales`  
Phone Number ID de ventas ≠ Recepcionista.

## Dropi API (doc Integrations)

| Acción | Método | Path | Header |
|--------|--------|------|--------|
| Productos | POST | `/products/index` | `dropi-integration-key` |
| Producto | GET | `/products/v2/{id}` | idem |
| Ciudades / dept | GET/POST | `/department`, `/trajectory/bycity` | idem |
| Crear orden | POST | `/orders/myorders` | idem |
| Orden por ID | GET | `/orders/myorders/{id}` | idem |

Base URL: `DROPI_API_BASE_URL` (default `https://api.dropi.co`).  
COD: `rate_type: "CON RECAUDO"`, `payment_method_id: 1`, `type: "FINAL_ORDER"`.

## Spike

Sin token Owner en CI: client + fixtures unitarias. Validación live = botón “Probar Dropi” en Owner tras pegar token.

## Criterio riesgo

Impacto PMS = **cero** si no se importan services de reservas/TTLock/iCal.
