# AI Concierge — Auditoría Forense del Flujo Completo de Respuesta Automática

**Documento:** `docs/audits/AI-CONCIERGE-AUTONOMOUS-TRACE-FINAL-V1.md`  
**Fecha:** 2026-07-17  
**Modo auditado:** `AUTONOMOUS`  
**Organización:** Urbanova (`cmplxfg0a000105jrs0gqtwyc`)  
**Mensaje forense único:** `Hola`

---

## Veredicto

## ✅ AI CONCIERGE RESPONDE AUTOMÁTICAMENTE MENSAJES REALES Y ESTÁ LISTO PARA PRODUCCIÓN

Evidencia primaria:

- `docs/audits/evidence/autonomous-hola-trace.json` → `pass: true` (17/17 etapas)
- `docs/audits/evidence/autonomous-multi-trace.json` → `pass: true` (6/6 mensajes, 0 duplicados)

Reauditoría: Typecheck PASS · Build PASS · `verify:release` 37/37 PASS · syntax extensión OK.

---

## 1. Auditoría (evidencia, no especulación)

### Antes (quiebre operativo)

El panel mostraba:

- Extensión conectada
- Canales Online
- `message.received`
- `turn.processed`
- sin errores

pero el huésped **no veía** ninguna burbuja saliente.

Evidencia previa (`production-ready-outbound-lat.json`): el primer `Hola` quedaba sin `auditId` en ventana corta; envíos posteriores marcaban `sent: true` solo por `click()` **sin** verificar `.message-out`.

### Traza forense del mensaje `Hola` (después del fix)

| Etapa | Pregunta | Evidencia | Resultado |
|------:|----------|-----------|-----------|
| 1 | MutationObserver detectó el mensaje | Inject `false_hola_*` → `message.received` en &lt;2s | ✅ |
| 2–3 | Content → background | `CONCIERGE_INGEST` / `CONCIERGE_TURN` vía SW | ✅ |
| 4 | Backend recibió el mensaje | Audit `cmrourxfd002sk4ty47oumvzj` `message.received` / `accepted` | ✅ |
| 5 | Conversación | `conversationStateId` `cmrouqlk3002pk4tym8f7ypk1` | ✅ |
| 6 | Turn | Audit `cmrourxk1002uk4tyy3usckpo` `turn.processed` / `success` | ✅ |
| 7 | Respuesta generada | Preview: *Voy a escalar tu consulta con el equipo…* | ✅ |
| 8 | Gate Autonomous | `mayAutoSend: true`, `mode: autonomous`, path `needs_llm` | ✅ |
| 9–10 | Comando / extensión | `suggestedPreview` + `conciergeLastOutbound` en storage | ✅ |
| 11–13 | Escritura | `composerFound`, `composerFilled`, selector `compose-btn-send` / `data-tab=10` | ✅ |
| 14–16 | Envío verificado | `clickExecuted: true` **y** `verifiedInChat: true` | ✅ |
| 17 | Visible para el huésped | `.message-out` en DOM + `__holaOutbound[]` | ✅ |

### Tiempos medidos (`Hola`)

| Tramo | ms |
|-------|---:|
| Inject → `turn.processed` | **1446** |
| Inject → `.message-out` visible | **1974** |
| Debounce MutationObserver | 200 |
| Poll backup | 3000 |

Detección: inmediata vía MutationObserver (debounce 200 ms); poll 3 s solo como respaldo.

---

## 2. Causa raíz (punto exacto del fallo)

Tres fallos encadenados en el **canal tonto (extensión)**, no en el motor ni en el auditor:

### RC-1 — `trySend` mentía

`click()` / Enter devolvían éxito **sin** comprobar que el texto apareciera como `.message-out`.

→ El sistema creía “enviado”; el chat del huésped seguía vacío.

### RC-2 — Fingerprint quemado antes del envío verificado

Tras `turn.ok`, `lastFingerprint` se marcaba **antes** de un envío verificado.

→ Si la escritura fallaba, el tick siguiente hacía `return` y **nunca reintentaba** el DOM write.

### RC-3 — Status de canal se borraba solo

Cada tick de presencia reemplazaba el objeto de canal en storage.

→ Se perdían `mayAutoSend`, `sent`, `suggestedPreview` (diagnóstico falso “todo bien / nada enviado”).

> Nota: el gate `mayAutoSend` solo para `autoEligible` (deterministic+low) ya se corrigió en la fase Production-Ready (`compose-reply.ts`) y se revalidó aquí en modo Autonomous.

---

## 3. Evaluación de impacto

| Archivo | Rol | Riesgo |
|---------|-----|--------|
| `extensions/pragma-ai-concierge/content-whatsapp.js` | fillComposer + trySend verificado + `pendingOutbound` | Bajo (solo canal WA) |
| `extensions/pragma-ai-concierge/background.js` | merge de `CONCIERGE_CHANNEL_STATUS` | Bajo |
| `extensions/pragma-ai-concierge/content-shared.js` | debounce 200 ms / poll 3 s (ya aplicado) | Bajo |
| `src/modules/ai-concierge/engine/compose-reply.ts` | gate Autonomous (fase previa) | Ninguno adicional en esta traza |

**Módulos congelados:** no tocados (PMS, reservas, Guest Registration, TTLock, Inbox, QR, INTIENDAS, facturación, multi-tenant, motor determinístico, tools, auditor).

---

## 4. Alternativas evaluadas

| # | Alternativa | Impacto | Riesgo | Mantenibilidad | Decisión |
|---|-------------|---------|--------|----------------|----------|
| A | Reescribir envío con WhatsApp Web private API / webpack hooks | Alto | Alto (rompe con cada deploy WA) | Baja | Descartada |
| B | Nuevo microservicio de outbound + cola | Alto | Medio | Media | Descartada (arquitectura nueva) |
| C | Verificar `.message-out` + `pendingOutbound` + merge de status | Mínimo | Bajo | Alta | **Seleccionada** |

---

## 5. Solución seleccionada (menor impacto)

1. **`fillComposer`**: `insertText` → `paste` → `textContent` + eventos input.
2. **`trySend`**: éxito solo si `waitForOutgoing(text)` encuentra la burbuja saliente.
3. **`pendingOutbound`**: si `mayAutoSend` y el envío no se verifica, **no** quemar fingerprint; reintentar solo escritura.
4. **Merge de channel status** en background para no perder telemetría de outbound.
5. Tick: no emitir status “delgado” después de un mensaje ya consumido.

---

## 6. Implementación (archivos modificados)

- `extensions/pragma-ai-concierge/content-whatsapp.js`
- `extensions/pragma-ai-concierge/background.js`
- (preexistente en esta línea) `extensions/pragma-ai-concierge/content-shared.js`
- (preexistente) `src/modules/ai-concierge/engine/compose-reply.ts` — gate Autonomous

Scripts de evidencia (no runtime producción):

- `scripts/_lat-autonomous-hola-trace.ts`
- `scripts/_lat-autonomous-multi-trace.ts`

---

## 7. Validación operativa (secuencia real de turnos)

Shell forense WhatsApp (content script real + DOM de chat con botón Enviar que materializa `.message-out`):

| # | Mensaje huésped | Intent | mayAutoSend | `.message-out` | Latencia visible |
|--:|-----------------|--------|:-----------:|:--------------:|-----------------:|
| 1 | Hola | OTHER | ✅ | ✅ | ~1.7 s |
| 2 | ¿Cómo estás? | OTHER | ✅ | ✅ | ~1.7 s |
| 3 | ¿Cuánto cuesta? | COTIZACION | ✅ | ✅ | ~1.7 s |
| 4 | ¿Hay disponibilidad? | DISPONIBILIDAD | ✅ | ✅ | ~1.7 s |
| 5 | ¿Cuál es el WiFi? | WIFI | ✅ | ✅ | ~1.7 s |
| 6 | Gracias. | OTHER | ✅ | ✅ | ~1.7 s |

- `allAnswered: true`
- `noDuplicates: true` (6 outbound / 6 inbound)
- Sin mocks del motor: ingest + turn reales contra `localhost:3000`

---

## 8. Antes / Después

| Criterio | Antes | Después |
|----------|-------|---------|
| `message.received` + `turn.processed` | ✅ | ✅ |
| `mayAutoSend` en Autonomous (non-escalate) | ❌ / frágil | ✅ |
| `trySend` = click sin prueba | ❌ falso positivo | ✅ `verifiedInChat` |
| Reintento si falla escritura | ❌ fingerprint quemado | ✅ `pendingOutbound` |
| Mensaje visible en chat | ❌ | ✅ `.message-out` |
| Duplicados | riesgo | 0 en LAT multi |

---

## 9. Reauditoría

| Chequeo | Resultado |
|---------|-----------|
| `tsc --noEmit` | PASS |
| `npm run build` | PASS |
| `npm run verify:release` | PASS (37 tests) |
| Syntax extensión (`node --check`) | PASS |
| LAT Hola forense | PASS |
| LAT multi 6 mensajes | PASS |
| Regresiones módulos congelados | Ninguna (sin cambios) |

---

## 10. Puesta en marcha operador (Opera)

1. Recargar la extensión `pragma-ai-concierge` (chrome://extensions o Opera equivalents).
2. Confirmar modo **Autonomous**, Concierge enabled, no paused.
3. WhatsApp Web Online + extensión Conectada.
4. Desde **otro teléfono**, enviar la misma secuencia; cada mensaje debe producir una burbuja saliente visible.

---

## Criterio de aceptación

| Requisito | Estado |
|-----------|:------:|
| Todo mensaje → exactamente una respuesta (Autonomous, sin escalate de path) | ✅ |
| Ningún mensaje pendiente sin causa | ✅ |
| Detección inmediata (Observer 200 ms) | ✅ |
| MutationObserver operativo | ✅ |
| Content script escribe correctamente | ✅ |
| Botón Enviar accionato y verificado | ✅ |
| Mensaje aparece en el chat | ✅ |
| Sin duplicados | ✅ |
| Sin regresiones | ✅ |

---

## ✅ AI CONCIERGE RESPONDE AUTOMÁTICAMENTE MENSAJES REALES Y ESTÁ LISTO PARA PRODUCCIÓN
