# AI Concierge — Fase 13 Parte 1: Auditoría de Configuración

**Fecha:** 2026-07-17  
**Estado:** Completa (solo documentación / lectura de código)

---

## 1. Configuración general

| Capa | Dónde vive | Ejemplos |
|------|------------|----------|
| Entorno proceso | `.env` / `.env.local` (nunca commitear secretos) | `DATABASE_URL`, `CONCIERGE_EXTENSION_SECRET`, `OPENAI_API_KEY`, `RESEND_API_KEY` |
| App URL | `.env.local` | `NEXT_PUBLIC_APP_URL`, `APP_URL` |
| Org / propiedad | Postgres (`Organization`, `Property`) | WiFi, reglas, contactos operativos, tarifas base |
| Usuario | Clerk + tabla `User` | `userId` para scope de tools |
| Extensión | `chrome.storage.sync` | `apiBase`, `secret`, `orgId`, `userId`, `mode` |
| Sesiones canal | Memoria proceso (`session-store.ts`) | Conversaciones por `org::channel::threadId` — **no persistente** entre reinicios |

---

## 2. AI Concierge

| Pregunta | Respuesta |
|----------|-----------|
| Dónde se configura | Código en `src/modules/ai-concierge/**` + secret env + headers de extensión |
| Cómo se activa | `npm run dev` + secret definido + extensión cargada y autenticada |
| Cómo se desactiva | Quitar extensión / modo `observe` / borrar `CONCIERGE_EXTENSION_SECRET` (API 503) |
| Modos | Header `x-concierge-mode` o popup extensión: `observe` \| `manual` \| `assisted` \| `autonomous` |
| Dónde se almacena el modo | `chrome.storage.sync.mode` (cliente) + header por request |
| Persistencia conversación | In-memory Map (pérdida al reiniciar Node) — migración Prisma **bloqueada** hasta auth prod |

---

## 3. Extensión

| Tema | Detalle |
|------|---------|
| Ubicación | `extensions/pragma-ai-concierge/` |
| Instalar | Chrome → Extensiones → Developer mode → Load unpacked → esa carpeta |
| Actualizar | Recargar el botón Reload en `chrome://extensions` |
| Conectar | Popup: API base (`http://127.0.0.1:3000`), secret, orgId, userId |
| Autenticar | `Authorization: Bearer <CONCIERGE_EXTENSION_SECRET>` |
| ¿Conectada? | Popup → “Probar conexión” o panel → Health → `GET /api/concierge/health` |
| Reiniciar | Reload extensión + refresh pestaña WA/Airbnb |
| Logs | `chrome://extensions` → Service worker → Inspect; Consola de la pestaña del chat |

---

## 4. WhatsApp

| Tema | Detalle |
|------|---------|
| Configuración | No hay número en PRAGMA: usa la sesión de **WhatsApp Web del operador** |
| Número | El vinculado a la cuenta WA Web abierta en el navegador |
| Selección / cambio | Cambiar cuenta en WhatsApp Web (cerrar sesión / escanear QR) |
| Autenticar | QR en `https://web.whatsapp.com` |
| Sesión activa | Extensión marca ONLINE si health/ingest OK; si WA pide QR de nuevo, re-autenticar |
| Pérdida | Content script deja de leer mensajes; health API puede seguir OK |
| Recuperación | Reabrir WA Web, reescanear QR, Reload extensión |

---

## 5. Airbnb

| Tema | Detalle |
|------|---------|
| Conversación | Content script lee nodos tipo message en el inbox DOM |
| Reserva / anuncio / huésped | Hoy: `threadId` = path URL; `propertyId`/`reservationId` opcionales en payload si el operador los conoce. Matching automático fino = mejora futura |
| DOM cambia | Selectores múltiples + MutationObserver; si falla, panel sin mensaje (fail-closed, no inventa) |
| Recuperación | Actualizar selectores en `content-airbnb.js` + Reload extensión |

---

## 6. “WebSocket”

**Estado real:** no hay WebSocket. Transporte = **HTTPS REST**.

| Tema | Detalle |
|------|---------|
| Dónde | `POST /api/concierge/channel/ingest\|turn`, `GET /api/concierge/health` |
| Conectar | Extensión `background.js` → `fetch` con Bearer |
| Validar | Health endpoint |
| Reconectar | Retry ×3 con backoff en `background.js` |
| Fallos | Panel OFFLINE; storage `conciergeLastHealth` |

Justificación menor impacto: App Router Next.js sin servidor WS dedicado; HTTP suficiente para F7–13.

---

## 7. Motor de intenciones

| Tema | Path |
|------|------|
| Definiciones / plantillas | `src/modules/ai-concierge/intent/library.ts` |
| Detector L1 | `intent/detect.ts` |
| Agregar intención | Añadir a `CONCIERGE_INTENTS` + `DEFINITIONS` + regla regex |
| Desactivar | `alwaysEscalate: true` o quitar regla |
| Probar | `npx tsx --test tests/ai-concierge/*.test.ts` + scripts audit |

---

## 8. Biblioteca de respuestas

Plantillas `{{variables}}` en `intent/library.ts` (`renderIntentTemplate`).  
Versionado: control de código Git (no CMS).  
Reuso: misma plantilla para todos los tenants; hechos vienen de Property/tools.

---

## 9. Tools

### Lectura (`enabledFromPhase: 6`)

| Tool | Input clave | Output |
|------|-------------|--------|
| search_reservations | query?, propertyId? | lista |
| get_reservation | reservationId | detalle |
| get_property_guest_info | propertyId | wifi, reglas, dirección… |
| get_guest_registration_status | reservationId | status + url |
| get_access_status | reservationId | código/estado |
| search_availability | propertyId, fechas | available + summary |
| get_calendar | from, to, propertyId? | reservas rango |
| get_operational_contacts | propertyId | contactos |
| get_payment_balance | reservationId | saldo |
| list_payment_links | reservationId | links |
| calculate_stay_quote | propertyId, fechas | quote base |

### Escritura (`10` / `11`)

| Tool | Fase | Efecto |
|------|------|--------|
| register_arrival_time | 10 | Nota interna |
| create_operational_task | 10 | Task |
| send_guest_registration_invite | 10 | Email GR |
| resend_access_code_email | 10 | Notify TTLock email |
| create_direct_reservation | 11 | Reserva Direct + GR |

Permisos: scope `TenantDataScope` vía headers + `assert*InScope`.  
Dependencias: Prisma scoped, servicios GR/TTLock existentes.

---

## 10. Auditor

`engine/auditor.ts` + `compose-reply.ts`:

- Verifica que el draft contiene hechos requeridos.
- Rechaza placeholders `{{var}}` sin resolver.
- Si falla → escala / no auto-send.
- Tools: `recordToolAudit` buffer en memoria.
- Runs: guardados en session-store in-memory.
