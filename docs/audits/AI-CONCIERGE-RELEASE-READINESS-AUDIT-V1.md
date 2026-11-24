# PRAGMA AI Concierge — Release Readiness Audit (Auditoría Final Pre-Producción)

**Versión:** 1.0
**Fecha:** 2026-07-17
**Prioridad:** CRÍTICA
**Alcance:** Producto completo (no una funcionalidad aislada)

---

## Estado General

### ✅ APROBADO PARA PRODUCCIÓN — *condicionado a validación de canal en vivo*

La plataforma (código, arquitectura, motor, herramientas, extensión, seguridad y regresiones) está **APROBADA**. El único elemento pendiente de evidencia es la conversación en vivo sobre WhatsApp Web / Airbnb Web con la extensión *unpacked* y sesión humana real (requiere acción del propietario). Todo lo verificable en local/CI está **PASS** y los dos hallazgos encontrados fueron corregidos y reauditados.

> Nota metodológica: esta auditoría asumió que el sistema contenía errores y buscó activamente romperlo. Se encontraron 2 hallazgos reales (1 crítico de seguridad, 1 de estabilidad). Ambos fueron corregidos con la alternativa de **menor impacto posible** y reauditados con éxito.

---

## Hallazgos

### HALLAZGO 1 — CRÍTICO (Seguridad / Aislamiento multi-tenant) — RESUELTO

**Síntoma:** El endpoint de autenticación de la extensión (`authorizeConciergeExtension`) derivaba el `organizationId` del scope directamente del header `x-concierge-org-id` enviado por el cliente.

**Causa raíz:** La organización (frontera de aislamiento multi-tenant) se tomaba de un valor controlado por el cliente y validado únicamente por un secreto compartido. Un portador del secreto podía enviar `x-concierge-user-id` de un usuario de la organización A junto con `x-concierge-org-id` de la organización B; las tools de lectura/escritura scopeaban sus queries por ese `organizationId` → **acceso/escritura cross-tenant**. Además, `resolveTenantContextByUserId` lanza excepción para usuarios inexistentes, pero `getEffectiveOrganizationIdForUser` la silenciaba, de modo que no había rechazo explícito de `userId` inválidos.

**Impacto:** Fuga de datos entre organizaciones y potencial ejecución de acciones en un tenant ajeno. Afecta a las 4 rutas del canal (`ingest`, `turn`, `commercial/book`, `health`).

**Alternativas evaluadas:**
1. Firmar el header org con HMAC (nuevo pipeline de firma → mayor impacto).
2. Atar el secreto a un `CONCIERGE_EXTENSION_USER_ID` fijo por env (cambio de configuración + rigidez).
3. **(ELEGIDA — menor impacto)** Ignorar el header spoofable y **derivar el `organizationId` de forma autoritativa** desde el registro del usuario en BD; rechazar (401) `userId` inexistente.

**Solución implementada (localizada en 1 archivo + 4 awaits):**
- `src/modules/ai-concierge/channel/auth.ts`: la función pasa a `async`, consulta `db.user.findUnique` por el `userId`, rechaza con 401 si no existe, y construye el scope con `organizationId = operator.organizationId` (autoritativo). El header `x-concierge-org-id` deja de usarse.
- Rutas actualizadas a `await authorizeConciergeExtension(request)`: `channel/ingest`, `channel/turn`, `commercial/book`, `health`.

**Reauditoría / evidencia** (`docs/audits/evidence/release-readiness-auth-isolation.json`):
```
allOk: true
- Header org spoofeado ignorado → resolvedOrg = org real del usuario (no el header)   OK
- userId inexistente → 401                                                             OK
- Secret inválido → 401                                                                OK
```

### HALLAZGO 2 — MEDIO (Estabilidad / Memoria) — RESUELTO

**Síntoma:** El `Map` de sesiones en memoria (`session-store.ts`) no tenía eviction ni TTL.

**Causa raíz:** En un proceso Node de larga vida, cada `organizationId::channel::threadId` nuevo agregaba una entrada permanente → crecimiento no acotado de memoria (riesgo de agotamiento/DoS con muchos hilos). Los demás stores en memoria ya estaban acotados (learning=200, tool-audits=200, métricas=contadores; `runs` por sesión ya cortado a 50).

**Impacto:** Estabilidad a largo plazo bajo alto volumen de conversaciones.

**Alternativas evaluadas:**
1. Persistir sesiones en BD (nuevo pipeline, fuera de alcance de esta fase).
2. TTL con timers (complejidad, timers colgantes).
3. **(ELEGIDA — menor impacto)** Cota FIFO del `Map` (`MAX_SESSIONS = 2000`) con eviction del más antiguo al crear una nueva sesión. Aditivo, sin cambio de comportamiento en operación normal.

**Solución implementada:** `src/modules/ai-concierge/channel/session-store.ts` — `evictIfNeeded()` invocado al crear sesión.

**Reauditoría:** typecheck PASS, tests 21/21 PASS, escenarios `allOk: true`.

---

## Riesgos (clasificados)

| Riesgo | Severidad | Estado | Mitigación |
|---|---|---|---|
| Cross-tenant vía header org spoofable | Crítico | RESUELTO | Org derivado de BD (Hallazgo 1) |
| Crecimiento no acotado de memoria | Medio | RESUELTO | Eviction FIFO (Hallazgo 2) |
| Sesiones no persistentes (se pierden al reiniciar) | Bajo | ACEPTADO (documentado) | Contexto se reconstruye desde canal; por diseño de la fase |
| `conversation.messages` sin recorte | Bajo | ACEPTADO | Acotado en la práctica; `getRecentMessages` limita ventana de contexto |
| Validación de canal en vivo (DOM real) pendiente | — | PENDIENTE | Checklist `AI-CONCIERGE-PHASE13-LIVE-CHANNEL-CHECKLIST.md` (requiere propietario) |
| L3/OpenAI no ejercitado en build actual | Info | POR DISEÑO | `needs_llm` escala/pide info; 0 tokens |

---

## Soluciones — Comparación antes/después

| Área | Antes | Después |
|---|---|---|
| Auth canal | `organizationId` = header cliente (spoofable); `userId` inválido no rechazado | `organizationId` = registro BD del usuario (autoritativo); `userId` inexistente → 401 |
| Session store | `Map` sin cota | `Map` con eviction FIFO (`MAX_SESSIONS=2000`) |

Ningún módulo congelado fue modificado. Sin duplicación de lógica ni pipelines nuevos.

---

## Evidencias

- **Typecheck:** `tsc --noEmit` → exit 0.
- **Build:** `next build --webpack` → Compiled successfully; 4 rutas concierge presentes (`/api/concierge/channel/ingest`, `/api/concierge/channel/turn`, `/api/concierge/commercial/book`, `/api/concierge/health`).
- **Tests:** 21/21 PASS (Fase 5 + Fase 6 + F7–F12).
- **Escenarios operativos** (`scripts/audit-ai-concierge-phase13-scenarios.ts`): `allOk: true`.
- **Aislamiento multi-tenant** (`scripts/_audit-phase13-auth-isolation-readonly.ts` → `docs/audits/evidence/release-readiness-auth-isolation.json`): `allOk: true`.
- **Seguridad tools:** intento de `delete_reservation_forever` → `denied` ("Tool desconocida").

### Flujo WhatsApp simulado (canal, extremo a extremo lógico)
```
Hola → needs_llm | Disponibilidad → needs_tools | Cotización → needs_tools |
Reserva → needs_tools | Pago → needs_tools | Guest Registration → needs_tools |
Código → needs_tools | Check-in → escalate | Check-out → deterministic |
Despedida → needs_llm     (usedLlm=false en TODOS)
```

---

## Regresiones

**NINGUNA.** Verificado por typecheck + build (107 páginas + rutas API generadas) + tests. Módulos confirmados sin cambios: PMS, Guest Registration, TTLock, Inbox AI, Facturación, QR Mobility, PRAGMA INTIENDAS, Integraciones, Multi-tenant. Los únicos archivos tocados pertenecen al módulo `ai-concierge` y a sus 4 rutas.

---

## Arquitectura (íntegra)

- **AI Concierge (cerebro):** dentro de PRAGMA. Extensión = solo canal, sin lógica de negocio.
- **Motor híbrido:** L1 determinístico → L2 intención → L3 (OpenAI) diferido.
- **Motor de herramientas:** lectura (Fase 6) + escritura (Fase 10) vía registry; nunca acceso directo a Prisma desde el agente.
- **Auditor de respuestas:** verifica el borrador contra hechos conocidos antes de permitir auto-send.
- **Adaptadores de canal:** Airbnb Web / WhatsApp Web (extensión). **Sin WebSocket**: la comunicación es HTTPS REST (documentado); no hay componente WebSocket que auditar.
- Sin duplicación, sin acoplamientos innecesarios, sin dependencias ocultas nuevas.

---

## Consumo IA

- **0 llamadas OpenAI, 0 tokens** en toda la batería (métricas: `openaiCalls: 0`, `openaiTokens: 0`).
- **NO usa OpenAI** para: WiFi, Código, Dirección, Parqueadero, Check-in, Check-out, Guest Registration, Disponibilidad, Cotización, Pagos, Reglas (todos resueltos por L1/L2 + tools; `usedLlm=false`).
- **Usaría OpenAI (L3)** solo en `needs_llm` (ambigüedad / fuera de biblioteca). En esta build L3 no está invocado: esos casos **escalan o piden información**, nunca inventan.

---

## Estabilidad

- **CPU/Memoria:** stores en memoria acotados (sesiones con eviction FIFO; learning/tool-audits=200; runs/sesión=50).
- **WebSocket:** N/A (arquitectura REST).
- **Extensión:** MutationObserver + polling, leader election multi-pestaña, retry, health check (auditado en Fase 13 extensión).
- **Multi-tenant:** aislamiento reforzado — organización derivada del servidor, no del cliente.

---

## Auto-send (seguridad de envío)

`mayAutoSend = autonomous AND deterministic AND auditor.verified AND complexity=low AND !alwaysEscalate AND replyExists`. Ningún camino `needs_tools`/`needs_llm`/`escalate` puede auto-enviar contenido no verificado. Confirmado por Escenario 4 (`mayAutoSend: false` en cancelar/descuento/reembolso/cambio).

---

## Criterio de Liberación — verificación

| Requisito | Estado |
|---|---|
| No existen regresiones | ✅ |
| Arquitectura íntegra | ✅ |
| Motor determinístico resuelve intenciones soportadas sin OpenAI | ✅ (0 tokens) |
| OpenAI solo cuando es estrictamente necesario | ✅ (diferido; escala) |
| Herramientas funcionan y no ejecutan acciones no autorizadas | ✅ |
| Hallazgos resueltos con la alternativa de menor impacto | ✅ (2/2) |
| Correcciones reauditadas con éxito | ✅ |
| Conversa correctamente en WhatsApp Web (DOM en vivo) | ⏳ requiere sesión humana |
| Conversa correctamente en Airbnb Web (DOM en vivo) | ⏳ requiere sesión humana |

---

## Autorización solicitada

Con la plataforma **APROBADA** en todos los criterios verificables por auditoría/CI, y con los 2 hallazgos corregidos y reauditados, se solicita autorización del propietario para:

1. **Migraciones de producción** — *no se requieren nuevas migraciones de esquema* para el módulo AI Concierge (stores en memoria; sin cambios Prisma). Confirmar antes de aplicar.
2. **Commit final de Release** — cambios acotados al módulo `ai-concierge` + 4 rutas.
3. **Deploy a Producción.**

Requisito previo a marcar el producto como *fully approved en canal real*: completar el checklist `AI-CONCIERGE-PHASE13-LIVE-CHANNEL-CHECKLIST.md` (WhatsApp/Airbnb en vivo). Hasta contar con autorización explícita del propietario, **no se realizan migraciones, commit de release ni deploy**.
