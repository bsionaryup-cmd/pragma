# AI Sales Agent — Runbook Owner (MVP)

## Qué hace

Anuncio → WhatsApp (número ventas) → Agente vende con datos Dropi → pide envío → crea pedido COD en Dropi.

## Manual (tú)

1. **WABA número de ventas** (distinto del Recepcionista).  
2. Meta webhook: `https://www.pragmapms.com/api/webhooks/whatsapp-sales`  
   Verify token = el que guardes en Owner → AI Sales Agent.  
3. Dropi → Mis Integraciones → token → pegar en Owner.  
4. OpenAI API key en Owner.  
5. Vercel (opcional): `AI_SALES_ENCRYPTION_KEY` (si no, usa misma fuente que TTLock crypto).  
6. Owner → **AI Sales Agent** → guardar → Probar conexiones → **Encender**.  
7. Ads Meta/TikTok → click-to-WhatsApp a ese número.

## Encender / Apagar

- **Encender** = `enabled=true`, kill OFF.  
- **Apagar** = kill ON o enabled=false (corte inmediato de envíos/pedidos).

## Dónde ver trabajo

- Owner: estado OpenAI/WA/Dropi, últimos errores, últimos pedidos.  
- WhatsApp: chat del lead.  
- Dropi: pedido creado.

## No uses

- Webhook del Recepcionista (`/api/webhooks/whatsapp`) para ads.  
- Inventar precios en el prompt (el agente debe llamar Dropi).
