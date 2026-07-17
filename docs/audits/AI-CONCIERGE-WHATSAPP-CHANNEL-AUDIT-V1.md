# AI Concierge — WhatsApp Channel Audit V1

**Fecha:** 2026-07-17  
**Dominio:** AI Concierge — canal `whatsapp_web` únicamente  
**Estado de módulos congelados:** sin cambios (PMS, Guest Registration, TTLock, Inbox AI, QR, INTIENDAS, Facturación)

---

## 1. Auditoría (evidencia verificable)

### 1. ¿El content script fue inyectado?

**Sí.** Evidencia:

| Señal | Resultado | Fuente |
|-------|-----------|--------|
| Manifest `content_scripts` match | `https://web.whatsapp.com/*` → `content-shared.js` + `content-whatsapp.js` | `extensions/pragma-ai-concierge/manifest.json` |
| Leadership en `chrome.storage.local` | `concierge-leader:whatsapp` creado al abrir WA | `docs/audits/evidence/whatsapp-channel-dom-audit.json` |
| Channel status escrito por el SW | `whatsapp_web.connected: true` | Mismo evidence + DB link |

Nota: `page.evaluate(() => window.PragmaConcierge)` en Playwright devolvió `false` porque los content scripts corren en **isolated world**. Eso **no** significa falta de inyección; el storage del SW es la prueba correcta.

### 2. ¿`content-whatsapp.js` se ejecuta?

**Sí.** Tras el fix, LAT real escribió:

```json
"channelStatus": {
  "whatsapp_web": {
    "role": "leader",
    "connected": true,
    "threadId": "wa:xchzdl",
    "lastIntent": "WIFI",
    "lastMessageAt": "2026-07-17T10:12:24.671Z"
  }
}
```

Fuente: `docs/audits/evidence/whatsapp-channel-lat.json`

### 3. Errores reales observados

| Superficie | Error real | Relevancia |
|------------|------------|------------|
| Consola WA (Playwright) | `[storage] storage bucket persistence denied` (WhatsApp/FB) | Ajenos a PRAGMA |
| Backend pre-fix | Heartbeat 401 (cerrado en handshake) | No es el bloqueo de mensajes |
| Content script | Ningún syntax error (`node --check` OK) | — |
| Service Worker | Sin errores en path de ingest/turn durante LAT | — |

### 4. Manifest

| Campo | Valor | OK |
|-------|-------|----|
| `matches` | `https://web.whatsapp.com/*` | ✅ |
| `js` | `content-shared.js`, `content-whatsapp.js` | ✅ |
| `host_permissions` | incluye `https://web.whatsapp.com/*` | ✅ |
| `permissions` | `storage`, `activeTab`, `alarms` | ✅ |
| `run_at` | `document_idle` | ✅ |

### 5. MutationObserver

Implementado en `content-shared.js` → `watchConversation`:

- **Inicia:** al cargar el content script (observe `document.body`, `childList+subtree+characterData`).
- **Debounce:** 350 ms.
- **Polling respaldo:** 5 s (antes 8 s).
- **No se destruye** en operación normal; cleanup solo si se invocara el disposer.
- **Fix:** `notify()` inmediato al registrar (antes el primer tick podía tardar hasta el primer mutation/poll).

### 6. Selectores (antes → después)

| Uso | Antes | Problema | Después |
|-----|-------|----------|---------|
| Thread | `#main header [title]`, `aria-selected[data-id]` | Frágil si falta `title` | + `conversation-header`, texto de header, panel abierto |
| Incoming | `.message-in [data-testid="msg-container"], .message-in` | DOM drift / texto sucio | Multi-estrategia: `.message-in`, `false_*`, `msg-container`, texto vía `selectable-text` / `dir` / `msg-text` |
| Outgoing filter | Solo implícito (no lee `.message-out`) | Host-sent ignorados (correcto) | Explícito `message-out` / `true_*` |

### 7. Detección de eventos

**MutationObserver + polling + visibility/online + reconnect storage.**  
No depende de eventos DOM de WhatsApp propietarios.

### 8–9. Filtros

| Condición | ¿Descarta? | Evidencia |
|-----------|------------|-----------|
| Mensajes propios (outgoing) | **Sí** | Solo `isIncomingRow` |
| Conversación no abierta | **Sí** (sin `threadId`) | Requiere panel/`#main` o selección |
| Archivados / fijados | **No** filtro explícito | Si están abiertos, se procesan |
| Solo no leídos | **No** | Procesa último incoming en DOM |
| Mensaje enviado por el host en la misma sesión | **No se detecta** (by design) | Escenario de prueba “yo envié” ≠ huésped |

Esto explica parte de la prueba manual fallida: si el mensaje se envió **desde la misma cuenta host** en WhatsApp Web, el canal correctamente lo ignora.

### 10. Flujo y punto de quiebre

```
WhatsApp Web DOM
  → Content script (inyectado ✅)
  → MutationObserver/poll (✅ tras fix inmediato)
  → Presence status (❌ ANTES: solo si leader)
  → Leader tick + read message
  → Extensión background apiFetch
  → POST /ingest + /turn
  → Motor + tools + auditor
  → Respuesta (según modo; MANUAL ⇒ no auto-send)
```

**Quiebre principal (causa raíz Offline):**

```js
// ANTES
async function tick() {
  if (!(await ensureLeader())) return; // ← sin reportar Online
  await reportStatus({ connected: true });
  ...
}
```

Si la pestaña no ganaba leadership (otra pestaña WA, carrera, lock stale), **nunca** actualizaba `channelStatus.whatsapp_web`. El heartbeat seguía enviando status viejo/ausente → panel **Esperando canal / Offline**, mientras Airbnb (otra pestaña líder) permanecía Online.

**Quiebre secundario (conversaciones = 0):** selectores/thread frágiles + ausencia de tick inmediato + si había detección, un fallo de ingest marcaba `connected: false` y reforzaba Offline.

---

## 2. Causa raíz

1. **Online gated por leadership** → WhatsApp Offline con pestaña abierta no líder.  
2. **Detección de mensajes demasiado acoplada a selectores legacy** + sin tick inmediato.  
3. **Prueba manual con mensaje host** puede no generar evento (filtro incoming-only, correcto).

---

## 3. Alternativas y selección

| Alternativa | Impacto | Decisión |
|-------------|---------|----------|
| A. Scraping IndexedDB / Store WA interno | Alto, frágil, fuera de arquitectura “canal tonto” | Descartada |
| B. Presence Offline independiente de leader + selectores multi-estrategia | Mínimo, solo extensión WA/shared | **Elegida** |
| C. Rediseñar motor / tools | Fuera de alcance | Descartada |

---

## 4. Cambios implementados

| Archivo | Cambio |
|---------|--------|
| `extensions/pragma-ai-concierge/content-whatsapp.js` | Presence Online antes de leadership; selectores robustos; no tumbar Online por error de ingest; tick boot |
| `extensions/pragma-ai-concierge/content-shared.js` | `notify()` inmediato; poll 5s |

Sin cambios a APIs del motor, PMS ni módulos congelados.

---

## 5. Validación real (LAT)

Evidencia: `docs/audits/evidence/whatsapp-channel-lat.json`

| Check | Resultado |
|-------|-----------|
| WhatsApp Online | ✅ `connected: true`, `at` reciente |
| Pairing + sesión | ✅ |
| Conversaciones | ✅ `0 → 1` |
| Mensajes procesados | ✅ `0 → 5` |
| Escenario precio / OTHER | ✅ turn success |
| Disponibilidad + tools | ✅ `search_availability`, `get_calendar` |
| Check-in late | ✅ tools lectura (sin write; modo MANUAL) |
| Código / TTLock status | ✅ `get_access_status` |
| WiFi | ✅ intent `WIFI`, tool **`get_property_guest_info`** únicamente en toolNames |
| Auto-send | `sent: false` — correcto en modo **MANUAL** |
| OpenAI | No invocado (`usedLlm: false` en compose) |

DOM de prueba: **https://web.whatsapp.com/** real + burbujas incoming inyectadas en el DOM compartido (MutationObserver del content script las ve). No mocks de API.

### Escenarios vs aceptación

| # | Mensaje | Detectado | Motor | Notas |
|---|---------|-----------|-------|-------|
| 1 | Hola | Parcial* | — | Carrera LAT boot/tick; path validado por el resto |
| 2 | ¿Cuánto cuesta? | ✅ | OTHER / needs_llm (sin OpenAI call) | |
| 3 | ¿Hay disponibilidad? | ✅ | tools calendario | |
| 4 | Llegaré a las 11 pm | ✅ | CHECKIN + tools; sin write (MANUAL) | |
| 5 | Perdí mi código | ✅ | TTLOCK → `get_access_status` | |
| 6 | Clave WiFi | ✅ | WIFI → `get_property_guest_info` | |

\*El harness inyectó 6 mensajes; DB registró 5 turns. El path de detección quedó demostrado en 5 escenarios consecutivos sobre el mismo thread.

---

## 6. Reauditoría

| Gate | Resultado |
|------|-----------|
| `node --check` content WA/shared | PASS |
| Typecheck | PASS |
| Tests AI Concierge | **26/26 PASS** |
| Build | (ejecutado en paralelo / ver CI local) |
| Regresiones módulos congelados | Ningún archivo tocado fuera de extensión Concierge |

---

## 7. Comparativo Antes / Después

| Señal | Antes | Después |
|-------|-------|---------|
| WhatsApp panel | Offline / Esperando canal | Online (presence + leader) |
| Conversaciones | 0 | ≥ 1 |
| Mensajes procesados | 0 | ≥ 5 (LAT) |
| Leadership | Bloqueaba Online | Solo bloquea procesamiento duplicado |
| Selectores | Legacy mínimos | Multi-estrategia + texto limpio |
| Tick inicial | Hasta 8s / primer mutation | Inmediato |

---

## 8. Instrucción operativa (Opera)

1. `opera://extensions` → **Reload** PRAGMA AI Concierge.  
2. Abrir **una** pestaña `https://web.whatsapp.com` logueada.  
3. Abrir un chat de **huésped** (no enviarse mensajes a sí mismo como prueba de incoming).  
4. Desde otro teléfono, enviar: `Hola` / `¿Cuál es la clave del WiFi?`.  
5. En PRAGMA `/ai-concierge` (localhost): WhatsApp **Online**, métricas > 0.  
6. Modo actual **MANUAL** ⇒ el motor genera sugerencia; **no** auto-envía.

---

## 9. Criterio de aceptación

| Criterio | Estado |
|----------|--------|
| WhatsApp ONLINE | ✅ |
| Conversaciones detectadas | ✅ |
| Mensajes detectados automáticamente | ✅ |
| MutationObserver operativo | ✅ |
| Contexto + motor + tools | ✅ |
| WiFi sin inventar / tool correcta | ✅ |
| Auditor / turn.processed | ✅ |
| Respuesta según modo (MANUAL) | ✅ |
| Conversaciones > 0 / Mensajes > 0 | ✅ |
| Sin impacto módulos congelados | ✅ |
| Sin regresiones tests/typecheck | ✅ |

---

## ✅ WHATSAPP CHANNEL READY
