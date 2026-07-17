# AI Concierge — Checklist Validación Live (WhatsApp / Airbnb)

**Uso:** el propietario actúa como cliente. El operador abre el canal Web.

## Preparación (5 min)

1. En `.env.local` (local only):
   ```
   CONCIERGE_EXTENSION_SECRET=<elige-un-secreto-largo>
   ```
2. Reiniciar `npm run dev` (puerto 3000) **después** de agregar el secreto.
3. Chrome → Load unpacked → `extensions/pragma-ai-concierge`.
4. Popup:
   - API: `http://127.0.0.1:3000`
   - Secret: el mismo
   - User ID del tenant piloto (obligatorio; la org se deriva en servidor, no del popup)
   - Mode: `manual` (luego `assisted` / `autonomous`)
5. “Probar conexión” / Health → debe responder JSON (no página de login).  
   Si ves HTML de sign-in: el proxy no está dejando pasar `/api/concierge` (debe estar en `isSelfAuthedApi`).
6. Abrir WhatsApp Web **o** Airbnb inbox en esa misma Chrome.

## Escenario WhatsApp (cliente = tú)

Enviar en orden y verificar panel Concierge:

1. Hola  
2. Disponibilidad (fechas)  
3. Cotización  
4. Quiero reservar  
5. Pago  
6. Guest registration  
7. Código / check-in / check-out  
8. Gracias  

**Pass si:** sugerencias coherentes con datos PRAGMA; FAQs sin pedir OpenAI; reembolso/descuento escalan.

## Escenario Airbnb

Repetir el mismo guion en un hilo de mensajes Airbnb.

## Conversación larga

≥8 turnos; el panel debe mantener hilo (mismo `threadId`).

## Casos fuera de alcance

- Cancelar / descuento / reembolso / cambiar apto → **escala**, `mayAutoSend=false`.

## Absurdo

- “Alquilar helicóptero” → no inventa precio/disponibilidad.

## Evidencia a capturar

- Screenshot panel + chat  
- Respuesta Health (métricas)  
- Adjuntar a `docs/audits/evidence/phase13-live/` (crear al capturar)

## Nota

La evidencia automatizada del cerebro está en `ai-concierge-phase13-scenarios.json`.  
Esta checklist completa el criterio “conversa en WA/Airbnb Web” con sesión humana real.

## Hallazgo LAT (2026-07-17) — RESUELTO

`/api/concierge/*` estaba protegido por Clerk en `src/proxy.ts`. La extensión (Bearer propio) recibía redirect a sign-in.  
Fix mínimo: agregar `/api/concierge(.*)` a `isSelfAuthedApi`. Reprobado: health sin secreto → JSON `503`, no HTML.
