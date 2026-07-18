# AIRBNB UNIVERSAL GUEST REGISTRATION — END-TO-END V1

**Estado:** VALIDACIÓN EJECUTADA — acceso universal **APROBADO**; cadena completa **CONDICIONAL** (hallazgos de configuración ops, sin cambios de código)  
**Fecha:** 2026-07-18  
**Prioridad:** CRÍTICA  
**Enlace universal:** https://pragmapms.com/guest-registration → canónico https://www.pragmapms.com/guest-registration  

**Restricciones respetadas:** sin nuevas funcionalidades · sin cambios de arquitectura · sin modificar AI Concierge / TTLock / Guest Registration · sin commit · sin migración · sin deploy  

---

## 0. Veredicto ejecutivo

| Capa | Resultado |
|------|-----------|
| Página pública + formulario | **PASS** (HTTP 200, campos presentes) |
| Código → búsqueda `Reservation` → redirect token | **PASS** (casos 1–5) |
| Registro COMPLETED → admin email → TTLock email | **PASS en código + evidencia Direct Full Flow**; **condicional en propiedades** sin destinatarios admin |
| Mensaje automático Airbnb con enlace universal | **NO demostrado en sistema PRAGMA** (contrato ops / Airbnb scheduled message) |

**Confirmación expresa:**

> El flujo **código Airbnb → resolución → Guest Registration (token interno)** está **operativo y listo** en producción pública.  
> El flujo **completo sin intervención humana** (mensaje Airbnb auto + admin + TTLock email) **no puede certificarse al 100%** hasta: (1) verificar/configurar el mensaje programado en Airbnb con el enlace universal; (2) completar `notificationEmails` / Contactos Operativos en propiedades 802 y 804.

---

## 1. Auditoría paso a paso (con evidencia)

### 1. ¿El mensaje automático de Airbnb contiene el enlace universal?

| | |
|--|--|
| **Resultado** | **NO VERIFICABLE desde PRAGMA** / **GAP OPS** |
| **Evidencia** | Plantilla interna `DEFAULT_MESSAGE_TEMPLATES.REGISTRATION` usa `{registrationLink}` (URL **por token**), **no** `https://pragmapms.com/guest-registration`. PRAGMA **no** envía mensajes outbound a Airbnb vía API. |
| **Implicación** | El “mensaje automático” del flujo oficial es un **contrato operativo** (mensaje programado en Airbnb / copy manual / Concierge), no un envío automático del PMS. |
| **Evidencia archivo** | `docs/audits/evidence/airbnb-universal-gr-e2e-lat.json` → `messageAutomation` |

### 2. ¿La página pública responde HTTP 200?

| | |
|--|--|
| **Resultado** | **PASS** |
| **Evidencia** | `https://pragmapms.com/guest-registration` → **307** → `https://www.pragmapms.com/guest-registration` → **200 OK** |
| **Body** | `bodyHasRegistro`, `bodyHasCodeField` (`name=reservationCode`), `bodyHasContinue`, `bodyHasAirbnbHint` = true |

### 3. ¿El código Airbnb se recibe correctamente?

| | |
|--|--|
| **Resultado** | **PASS** |
| **Evidencia** | Action `accessAirbnbGuestRegistrationAction` + Zod `reservationCode` min 6 / max 20 / alfanumérico; normalización `toUpperCase` en servicio. Formulario: `name="reservationCode"`. |

### 4. ¿La búsqueda usa la tabla oficial de reservas?

| | |
|--|--|
| **Resultado** | **PASS** |
| **Evidencia** | `resolveAirbnbUniversalGuestRegistration` → `db.reservation.findMany` con `platform: AIRBNB` + `reservationCode` insensitive. Modelo Prisma `Reservation`. |

### 5. ¿La reserva coincide exactamente con el código?

| | |
|--|--|
| **Resultado** | **PASS** |
| **Evidencia LAT** | Código `HM9MJ4HBFJ` (Tachi) → match único AIRBNB; `exactMatchFound: true` |

### 6. ¿Reservas canceladas se rechazan?

| | |
|--|--|
| **Resultado** | **PASS** |
| **Evidencia** | `case3_cancelled: { ok: false, reason: "invalid" }` — solo statuses `CONFIRMED` \| `CHECKED_IN` \| `CHECKOUT_TODAY` |

### 7. ¿Reservas inexistentes se rechazan?

| | |
|--|--|
| **Resultado** | **PASS** |
| **Evidencia** | `case2_nonexistent` código `HMZZZZZZZZ` → `{ ok: false, reason: "invalid" }` |

### 8. ¿Válidas redirigen al Guest Registration correcto?

| | |
|--|--|
| **Resultado** | **PASS** |
| **Evidencia** | `case1_validResolve: { ok: true, state: "active", url: ".../guest-registration/<token>" }` vía `ensureGuestRegistrationForReservation` |

### 9. ¿El registro guarda la información?

| | |
|--|--|
| **Resultado** | **PASS (código + evidencia histórica)** |
| **Evidencia** | `finalizeGuestRegistration` escribe `reservationGuest` + `guestEmail`/`guestPhone` + `guestRegistrationCompletedAt`. Full Flow Direct 2026-07-16: 2 huéspedes REGISTERED. |

### 10. ¿Estado COMPLETED?

| | |
|--|--|
| **Resultado** | **PASS** |
| **Evidencia** | Token `GuestRegistrationStatus.COMPLETED` + `usedAt`; resolver `state: "completed"` en caso 4. |

### 11. ¿Correo a administración?

| | |
|--|--|
| **Resultado** | **PASS si hay destinatarios; FAIL si no** |
| **Evidencia positiva** | Full Flow Direct: admin delivered (`FINAL-FULL-FLOW-GR-DIRECT-TTLOCK-AUDIT-V1.md`). Completions recientes LAT con `adminNotifiedAt` set. |
| **Evidencia negativa** | Propiedades **802** y **804**: `notificationEmails: []`. Reserva Airbnb `HMXD8A3N2A` (histórica): `adminNotifyError` = configurar notificationEmails / Contacto Operativo. |
| **Evidencia** | `airbnb-universal-gr-e2e-downstream.json` |

### 12. ¿Correo TTLock automático al huésped?

| | |
|--|--|
| **Resultado** | **PASS condicional (flags Urbanova OK ahora)** |
| **Config Urbanova actual** | `generateAfterGuestRegistration: true`, `autoSendCode: true`, `requireManualApproval: false`; 4/4 props con lock mapeado |
| **Evidencia positiva** | Full Flow Direct 2026-07-16: `deliveryStatus: SENT`, Resend delivered |
| **Evidencia mixta** | Airbnb `HMXD8A3N2A` (2026-07-14): credencial `GENERATED` + `deliveryStatus: NOT_SENT` (posible config distinta en esa fecha / email huésped) |
| **Cadena código** | `finalizeGuestRegistration` → `onGuestRegistrationCompletedForTTLock` → `processReservationAccessAfterRegistration` → `generateAccessCodeForReservation` → `scheduleAccessCodeEmail` (respeta `autoSendCode`) |

### 13. ¿Existe algún paso manual?

| Paso | ¿Manual? |
|------|----------|
| Publicar enlace universal en mensaje Airbnb | **Sí (ops / Airbnb)** — PRAGMA no lo envía solo |
| Huésped introduce código | Intencional (UX) |
| Completar formulario GR | Intencional (huésped) |
| Admin email | Automático **si** hay Contacto Operativo / notificationEmails |
| TTLock generate + email | Automático **si** flags Urbanova (hoy sí) |

---

## 2. Riesgos (antes de modificar — no se modificó código)

| Tipo | Riesgo | Alternativas | Selección |
|------|--------|--------------|-----------|
| Funcional | Mensaje Airbnb sin URL universal → huésped no llega | A configurar scheduled msg Airbnb · B Concierge · C cambiar plantilla REGISTRATION a universal | **A (menor impacto, ops)** |
| Funcional | Admin email falla en 802/804 | Completar notificationEmails / Contactos Operativos | **Config datos (ops)** |
| Seguridad | Código Airbnb = factor único (ya hardened rate-limit) | Mantener fail-closed + rate limit | **Mantener** |
| Duplicidad | Doble submit código | `ensure` reutiliza token ACTIVE | **Ya OK** (LAT sameToken) |
| Regresión | Tocar GR/TTLock | Prohibido en este doc | **No tocar** |

---

## 3. Pruebas reales (casos obligatorios)

Script: `scripts/_lat-airbnb-universal-gr-e2e.ts`  
Evidencia: `docs/audits/evidence/airbnb-universal-gr-e2e-lat.json`

| Caso | Resultado | Evidencia |
|------|-----------|-----------|
| 1 Reserva Airbnb válida → resolve GR | **PASS** | `HM9MJ4HBFJ` → `ok: true`, `state: active`, 1 token ACTIVE |
| 2 Código inexistente | **PASS** | `ok: false` |
| 3 Cancelada | **PASS** | `ok: false` |
| 4 Ya completado | **PASS** | `state: completed` + URL token COMPLETED |
| 5 Dos intentos consecutivos | **PASS** | `sameToken: true`, `activeTokenCount: 1` |

**Caso 1 extensión (registro completo + admin + TTLock email):**  
No se forzó un COMPLETED sobre huésped real Tachi (evitar contaminar operativa / emails reales). Cadena downstream certificada previamente en **Full Flow Direct** (`FINAL-FULL-FLOW-GR-DIRECT-TTLOCK-AUDIT-V1.md`, 2026-07-16) con Resend delivered para admin + código TTLock. Flags TTLock Urbanova actuales permiten el mismo camino post-COMPLETED.

---

## 4. Reauditoría gates

| Gate | Estado |
|------|--------|
| Typecheck | ✅ `npm run typecheck` |
| Tests universal GR | ✅ `npx tsx --require ./scripts/_mock-server-only.cjs --test tests/guests/airbnb-universal-guest-registration.test.ts` (5/5) |
| Build / Release Readiness | No re-ejecutados en bloque (sin cambios de producto en esta pasada) |
| Código GR / TTLock / Concierge | **Sin modificaciones** |

---

## 5. Hallazgos (inventario)

### H-E2E-01 — Mensaje Airbnb con URL universal no automatizado por PRAGMA

| | |
|--|--|
| Criticidad | **P1** (bloquea “cero intervención” del primer hop) |
| Causa raíz | PRAGMA no tiene outbound Airbnb message API; plantilla REGISTRATION usa token link |
| Solución menor impacto | Configurar en Airbnb un mensaje automático/programado con `https://www.pragmapms.com/guest-registration` |
| Código | No requerido |

### H-E2E-02 — Propiedades 802 / 804 sin `notificationEmails`

| | |
|--|--|
| Criticidad | **P1** (admin email fallará al completar GR) |
| Causa raíz | Array vacío en propiedad |
| Solución menor impacto | Cargar Contacto Operativo / notificationEmails (dato, no código) |
| Evidencia | `airbnb-universal-gr-e2e-downstream.json` |

### H-E2E-03 — Caso Airbnb histórico TTLock `NOT_SENT`

| | |
|--|--|
| Criticidad | **P2** (histórico; config actual Urbanova tiene `autoSendCode: true`) |
| Causa raíz | Probable config/fecha distinta o fallo de envío no reintentado |
| Acción | Monitorear próximo COMPLETED Airbnb real; no cambiar TTLock en esta fase |

### H-E2E-04 — Apex apex→www redirect

| | |
|--|--|
| Criticidad | **P3** |
| Nota | Esperado; canónico = `www`. Incluir **www** en mensajes Airbnb. |

---

## 6. Criterio de aceptación

| Criterio | Estado |
|----------|--------|
| Huésped solo necesita enlace universal + código | ✅ (si recibe el enlace) |
| PRAGMA encuentra la reserva | ✅ |
| Guest Registration se abre | ✅ |
| Registro se completa | ✅ (pipeline; evidenciado Direct) |
| Notifica administración | ⚠️ requiere destinatarios en propiedad |
| Envía código TTLock | ⚠️ flags OK; evidenciado Direct; Airbnb histórico mixto |
| Sin duplicados | ✅ |
| Sin regresiones (tests) | ✅ |
| Sin intervención humana extremo a extremo | ❌ hasta H-E2E-01 + H-E2E-02 cerrados (ops) |

---

## 7. Confirmación para producción

**Listo para producción (capa acceso universal):** **SÍ**  
URL canónica: **https://www.pragmapms.com/guest-registration**

**Listo para producción (flujo Airbnb → GR → admin → TTLock sin ops previo):** **NO aún** — falta cerrar configuración:

1. Mensaje Airbnb con URL universal (www).  
2. `notificationEmails` / Contactos Operativos en **802** y **804**.  

Tras eso, un COMPLETED Airbnb real en 802/803/801/804 cerraría la certificación E2E al 100% con evidencia Resend.

---

## 8. Evidencias

```
docs/audits/evidence/airbnb-universal-gr-e2e-lat.json
docs/audits/evidence/airbnb-universal-gr-e2e-downstream.json
docs/audits/FINAL-FULL-FLOW-GR-DIRECT-TTLOCK-AUDIT-V1.md
docs/audits/AIRBNB-UNIVERSAL-GUEST-REGISTRATION-FINAL-REPORT-V1.md
scripts/_lat-airbnb-universal-gr-e2e.ts
scripts/_lat-airbnb-universal-gr-downstream.ts
```

---

## 9. Cierre

Validación E2E ejecutada **sin modificar** Guest Registration, TTLock ni AI Concierge.  
El resolver universal y la página pública están **operativos**.  
La certificación “sin intervención humana de punta a punta” queda **bloqueada solo por configuración operativa** (mensaje Airbnb + emails de propiedad), no por un defecto del resolver.
