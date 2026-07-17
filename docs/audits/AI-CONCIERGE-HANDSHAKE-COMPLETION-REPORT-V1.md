# AI Concierge — Handshake Completion Report V1

**Fecha:** 2026-07-17  
**Dominio:** AI Concierge (extensión + APIs de link/heartbeat)  
**Alcance:** Cierre definitivo del handshake (Detectada → Registro → Heartbeat → Canales ONLINE)  
**Módulos congelados:** sin cambios (Guest Registration, TTLock, Inbox AI, QR, INTIENDAS, Facturación, Integraciones certificadas)

---

## 1. Auditoría (respuestas verificables)

### 1. ¿Qué significa exactamente “Sin registro”?

En el panel no es un enum de “no emparejada”. Es el fallback de `formatTime(null)` cuando `activeLink.lastHeartbeatAt` es `null`:

```124:125:src/components/ai-concierge/ai-concierge-dashboard.tsx
function formatTime(value: string | null | undefined): string {
  if (!value) return "Sin registro";
```

UI observada: **Detectada · v1.0.0 · Sin registro** = extensión descubierta + link ACTIVE con `version`, pero **sin heartbeat persistido**.

### 2. Flujo esperado

```
Opera → Extensión (DISCOVER)
  → POST /api/concierge/link/session (Clerk)
  → PAIR o SESSION (externally_connectable)
  → POST /api/concierge/link/complete (si pairing)
  → setSession + POST /api/concierge/heartbeat
  → content scripts (WA/Airbnb) → channelStatus
  → panel: Conectada + canales Online
```

### 3. ¿En qué paso quedó detenido? (evidencia)

| Paso | Estado pre-fix | Evidencia |
|------|------------------|-----------|
| Instalación / SW / Detectada | OK | Manifest + discovery |
| Registro (`link/complete`) | OK | DB `status=ACTIVE`, audit `extension.linked` @ 09:28:14Z |
| Heartbeat | **FALLABA** | `lastHeartbeatAt: null` en links ACTIVE recientes |
| Canales Online | Bloqueado por heartbeat | `channelStatus` null/vacío |

Evidencia DB pre-fix (`docs/audits/evidence/handshake-db-state.json`):

- Link `cmroqj50u000vyctyxqk1on2n`: ACTIVE, v1.0.0, `pairedAt` 09:28:12, **`lastHeartbeatAt: null`**
- `extension.linked` success el mismo minuto

### 4. Evento Detectada → Conectada

`Conectada` = `isRecentlyConnected(activeLink.lastHeartbeatAt)` (ventana 90s).  
El evento que cambia el estado es un **POST `/api/concierge/heartbeat` 200** que escribe `lastHeartbeatAt`.

### 5–8. ¿La extensión envía registro? ¿PRAGMA recibe/acepta? ¿Rechazo?

- **Registro:** sí. `complete` aceptó el pairing (ACTIVE + audit).
- **Heartbeat:** la extensión lo invocaba tras el pair, pero el backend **rechazaba con 401**.
- Evidencia de rechazo reproducible (`docs/audits/evidence/handshake-auth-diagnose.json`):

```json
{
  "linkedByActive": true,
  "orgMatch": true,
  "userMatch": true,
  "linkedByOrgMatch": false,
  "localVerifyOk": true,
  "http": { "status": 401, "body": "{\"error\":\"Unauthorized\"}" }
}
```

Detalle crítico del operador `bsionaryup@gmail.com`:

- `User.organizationId = null` (platform owner)
- Empareja bajo **tenant efectivo / impersonación** → link.organizationId poblado
- Heartbeat **no lleva cookies de Clerk/impersonación**
- `authorizeConciergeExtension` exigía `link.linkedBy.organizationId === payload.organizationId` → **siempre 401**

### 9–10. Heartbeat enviado / recibido

| Antes | Después |
|-------|---------|
| Extensión intentaba; API 401; DB sin `lastHeartbeatAt` | API 200; DB con heartbeat reciente |

Post-fix (`docs/audits/evidence/handshake-heartbeat-after-fix.json` + LAT):

- HTTP 200 `{ "ok": true, ... }`
- `lastHeartbeatAt` poblado

### 11. Errores reales encontrados

1. **401 Unauthorized** en heartbeat por check incorrecto de `User.organizationId` (causa raíz del “Sin registro”).
2. **500 Prisma** `Unknown argument channelStatus` mientras el Client de Prisma del `npm run dev` estaba desfasado tras la migración (corregido con `prisma generate` + restart).
3. **ngrok** (`NEXT_PUBLIC_APP_URL`) respondía **404** (túnel caído). El panel operativo en esta sesión fue `http://localhost:3000`. Mitigación en extensión: header `ngrok-skip-browser-warning` para cuando el túnel vuelva.

No se encontraron errores en Service Worker de sintaxis (`node --check` OK).

---

## 2. Causa raíz

**Causa raíz única del bloqueo “Detectada / Sin registro”:**

`authorizeConciergeExtension` validaba el tenant contra `User.organizationId` del vinculador.  
Los platform owners emparejan con org efectiva (impersonación), pero el heartbeat de la extensión solo presenta el Bearer firmado. Esa validación rechazaba de forma permanente un link ya ACTIVE.

Secundario (enmascarado tras el 401): Prisma Client sin `channelStatus` en el proceso de desarrollo → 500 al persistir canales.

---

## 3. Alternativas y selección (menor impacto)

| Alternativa | Impacto | Decisión |
|-------------|---------|----------|
| A. Forzar `User.organizationId` en DB para owners | Datos / multi-tenant frágil | Descartada |
| B. Releer impersonación en heartbeat | Impossible sin cookies Clerk en SW | Descartada |
| C. Confiar en binding del token + fila `ConciergeExtensionLink` | 1 check en auth; arquitectura intacta | **Elegida** |
| D. Rediseñar pairing / UX | Fuera de alcance | Descartada |

Hardening menor en extensión (mismo objetivo handshake):

- Fallar PAIR/SESSION si heartbeat no es OK (evita falso “vinculada”)
- Sesión en `storage.session` + `storage.local`
- Header ngrok skip
- Alarm de heartbeat al arrancar el SW

---

## 4. Cambios realizados

| Archivo | Cambio |
|---------|--------|
| `src/modules/ai-concierge/channel/auth.ts` | Eliminado gate `linkedBy.organizationId`; tenant = token + link ACTIVE |
| `extensions/pragma-ai-concierge/background.js` | Heartbeat obligatorio en pair/session; dual storage; ngrok header; ensure alarm |
| `tests/ai-concierge/native-integration.test.ts` | Asserts de hardening |
| Prisma Client | `npx prisma generate` + restart de `npm run dev` |

**Sin** cambios a PMS / Guest Registration / TTLock / Inbox / QR / INTIENDAS / Facturación.

---

## 5. Validación real (no mock)

### LAT extensión (Chromium + unpacked)

Evidencia: `docs/audits/evidence/handshake-completion-lat.json`

| Check | Resultado |
|-------|-----------|
| Extensión detectada | true |
| Pairing completed (owner con `organizationId: null`) | true |
| ACTIVE link | true |
| Heartbeat automático post-pair (`lastHealth.status: 200`) | true |
| Conectada (`heartbeatAgeMs: 180`) | true |
| WhatsApp Online (tabs reales + content scripts) | true |
| Airbnb Online | true |

`priorChannelKeys: ["airbnb_web","whatsapp_web"]` confirma reporte de content scripts **antes** del heartbeat forzado.

### Link operativo del operador (org Urbanova)

Tras el fix, link `cmroqj50u000vyctyxqk1on2n`:

- `lastHeartbeatAt` reciente
- `recentlyConnected: true` → panel **Conectada**

### Reauditoría de calidad

| Gate | Resultado |
|------|-----------|
| Typecheck | PASS |
| Build | PASS (exit 0) |
| Tests AI Concierge | **26/26 PASS** (con preload `server-only`) |
| `node --check` extension JS | PASS |
| LAT handshake | PASS |

---

## 6. Comparación Antes / Después

| Señal | Antes | Después |
|-------|-------|---------|
| Extensión | Detectada | Detectada |
| Registro | ACTIVE sin heartbeat útil | ACTIVE + heartbeat OK |
| Panel heartbeat | Sin registro | Conectada (≤90s) |
| Heartbeat HTTP | 401 | 200 |
| WhatsApp / Airbnb | Offline / Esperando canal | Online (LAT con tabs reales) |
| Owner `organizationId: null` | Handshake roto | Handshake OK |

---

## 7. Instrucción operativa (Opera del operador)

Para ver el mismo estado ONLINE en el panel de Opera:

1. En `opera://extensions` → **Reload** de PRAGMA AI Concierge (cargar `background.js` actualizado).
2. Abrir PRAGMA en **`http://localhost:3000/ai-concierge`** (el túnel ngrok configurado estaba 404 en esta auditoría).
3. Pulsar reconectar / dejar el auto-link.
4. Abrir pestañas **WhatsApp Web** y **Airbnb inbox** en el mismo Opera.

Sin esas pestañas, la extensión permanece **Conectada** pero los canales quedan Offline (diseño actual: Online = content script + `channelStatus.connected` reciente).

---

## 8. Seguridad / multi-tenant

- El Bearer sigue firmado con `CONCIERGE_EXTENSION_SECRET`, TTL corto, bound a `linkId` + `organizationId` + `userId` + `deviceHash`.
- Org ACTIVE + user ACTIVE + device hash se siguen exigiendo.
- No se introdujeron headers de tenant controlados por el cliente.
- No se abrió superficie a módulos congelados.

---

## 9. Criterio de cierre

| Criterio | Estado |
|----------|--------|
| Extensión registrada | ✅ |
| Heartbeat operativo | ✅ |
| Estado Conectada | ✅ |
| WhatsApp Online | ✅ (LAT real) |
| Airbnb Online | ✅ (LAT real) |
| Comunicación bidireccional de canal (status → PRAGMA) | ✅ |
| Sin errores de causa raíz en backend auth | ✅ |
| Sin regresiones tests/build/typecheck | ✅ |
| Sin impacto módulos congelados | ✅ |

La plataforma queda lista para iniciar pruebas funcionales de conversación sobre WhatsApp Web y Airbnb Web **sin nuevas implementaciones para establecer la conexión de canales**.

---

## ✅ HANDSHAKE COMPLETADO
