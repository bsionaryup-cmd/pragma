# AI Concierge — P0 Mensajes Duplicados WhatsApp

**Documento:** `docs/audits/AI-CONCIERGE-DUPLICATE-MESSAGE-P0-V1.md`  
**Fecha:** 2026-07-17  
**Prioridad:** P0  
**Canal:** WhatsApp Web  
**Acción inmediata:** tenant Urbanova quedó en **MANUAL** (no Autonomous) tras la validación.

---

## Veredicto

## ✅ DUPLICIDAD ELIMINADA Y AI CONCIERGE APTO PARA PRODUCCIÓN

Evidencia: `docs/audits/evidence/duplicate-message-p0-lat.json` (`pass: true`)

| Control | Resultado |
|---------|-----------|
| 1 guest message → 1 Turn | ✅ `turnCount: 1` |
| 1 Turn → 1 click Enviar | ✅ `clicksAfterSoak: 1` |
| Soak 60 s sin reenvíos | ✅ `noExtraDuringSoak: true` |
| Mode post-LAT | ✅ `MANUAL` |

---

## 1. Auditoría forense (un mensaje)

Escenario storm (reproduce producción): el botón Enviar **hace click real** pero **no** crea `.message-out` → `waitForOutgoing` falla (igual que selector-drift en WA real).

### Preguntas obligatorias

| # | Pregunta | Evidencia |
|---|----------|-----------|
| 1 | ¿MutationObserver detecta el mismo mensaje varias veces? | Sí. Debounce 200 ms + poll 3 s re-disparan `tick()` mientras el nodo guest sigue en el DOM. |
| 2 | ¿El mismo nodo dispara múltiples eventos? | Sí. Cada mutación del composer/panel re-notifica; el nodo `.message-in` no cambia. |
| 3 | ¿Dedup en extensión? | Había fingerprint por `threadId::externalMessageId`, pero **se quemaba solo tras verify OK** y el id DOM podía derivar. |
| 4 | ¿Backend recibe múltiples requests? | **Antes del fix:** sí → N× `message.received` + N× `turn.processed`. **Después:** 2 claims (provider+texto) / 1 turn. |
| 5 | ¿Múltiples Turns? | **Antes:** 12 turns / 60 s. **Después:** 1 turn id `cmrow723d00hwd8tyvpvzw41g`. |
| 6 | ¿Múltiples respuestas generadas? | **Antes:** sí (un compose por turn). **Después:** una. |
| 7 | ¿`trySend` varias veces? | **Antes:** `pendingOutbound` re-clickeaba cada tick. **Después:** 1 click (`clickLog` length 1). |
| 8 | ¿Watcher/heartbeat re-dispara envío? | Observer + poll 3 s reentraban a `tick`; heartbeat **no** envía. |
| 9 | ¿Marcado como enviado? | `outboundDispatchFingerprints` + `lastFingerprint` / `lastTextFingerprint` en content script; claim idempotente en backend. |
| 10 | ¿Idempotencia? | Backend: `claimConciergeExternalMessage` (existía). **Hueco:** no cubría drift de `data-id`. Extensión: no marcaba dispatch al hacer `click()`. |

---

## 2. Causa raíz (punto exacto)

Cadena P0:

1. `mayAutoSend` + `trySend` → `send.click()` **entrega el mensaje en WA real**.
2. `waitForOutgoing` falla (clases DOM distintas) → `sent = false`.
3. **`pendingOutbound`** reintentaba `trySend` en **cada** tick del MutationObserver/poll **sin** haber consumido el fingerprint.
4. Resultado: **un click por segundo** al mismo huésped.

Secundario: reentrada a `CONCIERGE_TURN` cuando el fingerprint local no era estable → múltiples turns.

---

## 3. Impacto

| Archivo | Cambio | Riesgo |
|---------|--------|--------|
| `extensions/pragma-ai-concierge/content-whatsapp.js` | Eliminar storm `pendingOutbound`; marcar dispatch al click; reserva optimista; dedupe por texto | Bajo (solo canal WA) |
| `src/app/api/concierge/channel/turn/route.ts` | Claim dual: `externalMessageId` + `tmsg:` hash(thread+texto) | Bajo (solo Concierge turn) |

Módulos congelados: no modificados.

---

## 4. Alternativas

| # | Alternativa | Impacto | Riesgo | Decisión |
|---|-------------|---------|--------|----------|
| A | Desactivar Autonomous globalmente | Alto (pierde producto) | Bajo | Descartada (mitigación temporal sí: MANUAL) |
| B | Reescribir detector WA con API privada | Alto | Alto | Descartada |
| C | Idempotencia dispatch + claim texto + sin retry cross-tick | Mínimo | Bajo | **Seleccionada** |

---

## 5. Solución implementada

1. **Al ejecutar `click()`/`Enter`:** añadir fingerprint a `outboundDispatchFingerprints` — **nunca** volver a despachar.
2. **Consumir** `lastFingerprint` / `lastTextFingerprint` justo tras turn OK (antes de verify).
3. **Reserva** en `processingFingerprints` antes de cualquier `await`.
4. **Retry same-tick** solo si **no** hubo click (botón ausente).
5. **Backend:** claim por id proveedor **y** por `sha256(channel|threadId|guestMessage)`.
6. Tenant dejado en **MANUAL** tras LAT.

---

## 6. Antes / Después

| Métrica | Antes (storm) | Después (LAT P0) |
|---------|---------------|------------------|
| Clicks Enviar / 60 s | Docenas | **1** |
| `turn.processed` | 12 | **1** |
| `message.received` | 12 | **2** (dual claim) |
| Huésped bombardeado | Sí | No |

---

## 7. Validación

Script: `scripts/_lat-duplicate-message-p0.ts`  
Evidencia: `docs/audits/evidence/duplicate-message-p0-lat.json`

```
target: "Hola [mrow6zuo]"
turnCount: 1
clicksAfterSoak: 1
soakMs: 60000
pass: true
```

Modo org tras prueba: **MANUAL** (`enabled: true`, `paused: false`).

**Operador:** recargar extensión en Opera. Validar en **Manual/Assisted** hasta confirmar en producción. Autonomous solo cuando el operador lo reactive conscientemente.

---

## 8. Reauditoría

| Chequeo | Resultado |
|---------|-----------|
| Typecheck | PASS |
| `npm run build` | PASS |
| `npm run verify:release` | PASS (37/37) |
| Syntax extensión | PASS |
| Regresiones módulos congelados | Ninguna |

---

## ✅ DUPLICIDAD ELIMINADA Y AI CONCIERGE APTO PARA PRODUCCIÓN
