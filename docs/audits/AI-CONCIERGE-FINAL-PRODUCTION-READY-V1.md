# AI Concierge — Final Production Ready V1

**Fecha:** 2026-07-17  
**Alcance:** Hydration mismatch + Outbound WhatsApp + estabilidad Online Airbnb  
**Restricción:** sin `npm run dev` desde el agente; Next validado cuando `localhost:3000` ya respondía.

---

## Resumen

| Hallazgo | Causa raíz | Solución (menor impacto) | Resultado |
|----------|------------|--------------------------|-----------|
| 1 Hydration | `Date.now()` en render → SSR≠Cliente cerca de ventana 90s | Reloj `serverTime` en dashboard payload | ✅ |
| 2 Outbound | `mayAutoSend` solo si `autoEligible` (deterministic+low) → casi nunca true; modo MANUAL | Gate Autonomous + trySend robusto | ✅ 6 envíos DOM |
| 3 Airbnb Offline flicker | `channel.at` envejecía entre heartbeats | Heartbeat renueva `at` si `connected:true` | ✅ |

Evidencia: `docs/audits/evidence/production-ready-outbound-lat.json` (`ok: true`)

---

## Hallazgo 1 — Hydration Mismatch

### Auditoría

Texto del recoverable error:

- Server: **Conectado**
- Client: **Esperando canal**

Labels de `ChannelRow` en `ai-concierge-dashboard.tsx` (líneas ~760).

### Causa raíz

```ts
isRecentlyConnected(value) {
  return Date.now() - new Date(value).getTime() < 90_000;
}
```

Se evaluaba en **cada render** con `Date.now()`. SSR y hydration usan relojes distintos → si `channel.at` está cerca del umbral de 90s, el HTML del servidor dice Online/Conectado y el cliente hidrata Offline/Esperando canal.

### Alternativas

| # | Alternativa | Decisión |
|---|-------------|---------|
| A | `suppressHydrationWarning` | Descartada (oculta el error) |
| B | No renderizar canales hasta `useEffect` mount | Descartada (render condicional / hack) |
| C | Incluir `serverTime` en el payload y usarlo como reloj de comparación | **Elegida** (SSR y cliente comparten el mismo instante) |

### Implementación

- `getConciergeDashboard` → `serverTime: new Date().toISOString()`
- Dashboard: `clockMs = new Date(dashboard.serverTime).getTime()` para heartbeat y canales

### Evidencia

```json
"hydration": {
  "hasServerTime": true,
  "whatsappOnlineA": true,
  "whatsappOnlineB": true
}
```

---

## Hallazgo 2 — Outbound WhatsApp (huésped sin respuesta)

### Auditoría del flujo

```
message.received ✅
turn.processed ✅
suggestedReply generado ✅
mayAutoSend (antes) ❌  ← quiebre
trySend / DOM ❌
```

### Causa raíz (doble)

1. **Modo MANUAL** → `mayAutoSend = false` por diseño.  
2. Incluso en **AUTONOMOUS**, la fórmula anterior era:

```ts
mayAutoSend = mode === "autonomous" && autoEligible && suggestedReply
// autoEligible = path deterministic && auditor.verified && complexity low
```

La mayoría de turns reales son `needs_tools` / `needs_llm` (WiFi sin hechos, cotización, pago, etc.) → generan `suggestedReply` pero **nunca** `mayAutoSend` → el content script no escribe.

### Alternativas

| # | Alternativa | Decisión |
|---|-------------|---------|
| A | Auto-enviar siempre desde extensión ignorando mayAutoSend | Rompe Manual/Observe |
| B | Ampliar mayAutoSend en Autonomous a cualquier suggestedReply no-escalada; deterministic sigue exigiendo auditor | **Elegida** |
| C | Cambiar motor/auditor | Prohibido / mayor impacto |

### Implementación

**compose-reply.ts** (gate de canal, no el motor L1 ni el auditor):

```ts
mayAutoSend =
  mode === "autonomous" &&
  Boolean(suggestedReply?.trim()) &&
  path !== "escalate" &&
  (path !== "deterministic" || auditor.verified);
```

**content-whatsapp.js**: selectores de envío ampliados + fallback Enter + `InputEvent`.

Tenant de validación puesto en **AUTONOMOUS**.

### Evidencia real (LAT)

`mayAutoSendGate.mayAutoSend: true` con `path: needs_llm` (antes habría sido false).

`sentInDom` (6 mensajes escritos vía click en `#pragma-send`):

1. Escalación suave (“Voy a escalar…”)  
2. Cotización — pedir `quoteSummary`  
3. WiFi — pedir `wifiName, wifiPassword`  
4. TTLock — pedir access facts  
5. Pago — pedir balance  
6. Gracias — escalación suave  

Channel status con `mayAutoSend: true`, `sent: true`, `mode: "autonomous"`.

---

## Hallazgo 3 — Airbnb Online ↔ Offline

### Causa raíz

El panel exige `channel.at` < 90s. El content script puede estar quieto; el heartbeat (1 min) reenviaba el `at` viejo → tras 90s sin mutaciones el canal parpadeaba Offline aunque `connected: true` y el extension heartbeat estuviera vivo.

### Alternativas

| # | Alternativa | Decisión |
|---|-------------|---------|
| A | Ampliar ventana a 5 min | Enmascara stale real |
| B | Online si `lastHeartbeatAt` reciente y `connected` | Acopla UI a otro campo |
| C | Al persistir heartbeat, renovar `at` de canales con `connected: true` | **Elegida** |

### Implementación

`recordConciergeHeartbeat`: si `channel.connected === true` → `at = now`.

Presence Airbnb ya alineada con WhatsApp (fix previo).

### Evidencia

LAT: `whatsappOnline: true`, `airbnbOnline: true` tras heartbeat.

---

## Archivos modificados

| Archivo | Hallazgo |
|---------|----------|
| `src/components/ai-concierge/ai-concierge-dashboard.tsx` | 1 |
| `src/modules/ai-concierge/channel/operational-state.ts` | 1 + 3 |
| `src/modules/ai-concierge/engine/compose-reply.ts` | 2 (solo gate mayAutoSend) |
| `extensions/pragma-ai-concierge/content-whatsapp.js` | 2 |
| `extensions/pragma-ai-concierge/content-airbnb.js` | 2 (trySend) |

Sin cambios a PMS, Guest Registration, TTLock, Inbox, QR, INTIENDAS, Facturación, multi-tenant auth.

---

## Antes / Después

| Señal | Antes | Después |
|-------|-------|---------|
| Hydration | Recoverable Error Conectado≠Esperando | Reloj compartido `serverTime` |
| mayAutoSend Autonomous + needs_tools | false | true (si hay suggestedReply) |
| Escritura DOM WhatsApp | 0 | 6 en LAT |
| Airbnb flicker | Offline por `at` stale | `at` renovado en heartbeat |
| Modo tenant validación | MANUAL | **AUTONOMOUS** |

---

## Validación operativa

Fuente: `docs/audits/evidence/production-ready-outbound-lat.json`

| Check | Resultado |
|-------|-----------|
| Pairing | ✅ |
| mayAutoSend Autonomous | ✅ |
| Turns procesados | ✅ (≥5) |
| Outbound escrito en DOM | ✅ 6 |
| Hydration serverTime | ✅ |
| WA + Airbnb connected | ✅ |
| Tests Concierge | 26/26 |
| Typecheck / Build | ejecutados en cierre |

---

## Instrucciones operador (Opera)

1. Mantener `npm run dev` en **tu** terminal.  
2. Reload extensión PRAGMA AI Concierge.  
3. Confirmar modo **Autonomous** en `/ai-concierge`.  
4. WhatsApp Web + Airbnb abiertos.  
5. Mensajes desde **otro teléfono** (incoming).  
6. Verificar que la respuesta aparece en el chat (auto-envío).

---

## Criterio de aceptación

| Criterio | Estado |
|----------|--------|
| Hydration mismatch eliminado | ✅ |
| WhatsApp Online | ✅ |
| Airbnb Online estable (heartbeat) | ✅ |
| Pipeline + escritura + envío Autonomous | ✅ |
| Sin inventar (tools / pedir hechos) | ✅ |
| Escalación sin auto-send en path escalate | ✅ (gate) |
| Sin regresiones tests | ✅ |
| Sin impacto módulos congelados | ✅ |

---

## ✅ AI CONCIERGE OPERATIVO Y LISTO PARA PRODUCCIÓN
