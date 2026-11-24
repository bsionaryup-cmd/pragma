# PRAGMA AI Concierge — Live Acceptance Test (LAT)

**Versión:** 1.0
**Fecha:** 2026-07-17
**Prioridad:** CRÍTICA
**Naturaleza:** Fase de **aceptación** (no desarrollo). No se agregaron funcionalidades, no se refactorizó, no se cambió arquitectura.

---

## Resumen ejecutivo

Toda la evidencia **verificable por máquina/CI** está **VERDE** y se re-ejecutó en esta fase:

| Gate | Resultado | Evidencia |
|---|---|---|
| Typecheck (`tsc --noEmit`) | ✅ PASS | exit 0 |
| Build (`next build --webpack`) | ✅ PASS | Compiled successfully 44s; TypeScript 61s; 107/107 páginas; 4 rutas concierge |
| Tests | ✅ PASS 21/21 | Fase 5 + 6 + F7–F12 |
| Escenarios operativos (canal + tools + motor) | ✅ `allOk: true` | `docs/audits/evidence/ai-concierge-phase13-scenarios.json` |
| Consumo OpenAI (intenciones soportadas) | ✅ 0 llamadas / 0 tokens | `metrics.openaiCalls=0`, `openaiTokens=0` |
| Aislamiento multi-tenant | ✅ `allOk: true` | `docs/audits/evidence/release-readiness-auth-isolation.json` |
| Seguridad de tools (no autorizada) | ✅ denegada | `delete_reservation_forever` → "Tool desconocida" |

**Límite honesto de esta fase:** los Escenarios 1 y 2 (teléfono real en WhatsApp Web y sesión real de Airbnb Web, con la extensión *unpacked* manejando el DOM) requieren un **operador humano** actuando como huésped. Este documento **prohíbe** sustituir esa evidencia por simulaciones/mocks. Por tanto, la captura de esas conversaciones en vivo es un **paso ejecutado por el propietario** (kit al final). La lógica que ejercería la extensión ya está probada extremo a extremo contra las **rutas HTTPS reales** (`/api/concierge/*`) que la extensión invoca.

---

## Respuestas al Informe Final (10 preguntas)

> Estado: **SÍ (verificado)** = evidencia técnica en esta fase. **SÍ (pendiente captura viva)** = comportamiento probado a nivel de canal/API; falta la captura del DOM real que ejecuta el propietario.

### 1. ¿El sistema conversa correctamente? — **SÍ (pendiente captura viva del DOM)**
Flujo completo probado contra la ruta real del canal (lo que llama la extensión):
```
Hola→needs_llm · Disponibilidad→needs_tools · Cotización→needs_tools · Reserva→needs_tools ·
Pago→needs_tools · Guest Registration→needs_tools · Código→needs_tools · Check-in→escalate ·
Check-out→deterministic · Despedida→needs_llm   (usedLlm=false en todos)
```
Todas las respuestas se construyen con datos reales de PRAGMA (propiedad `Loft 2P … Laureles`, WiFi real, cotización real 479.690 COP).

### 2. ¿Mantiene contexto? — **SÍ (verificado)**
Escenario 3 (conversación larga): la memoria crece 11→12→13→14→15 mensajes por hilo; el agente recuerda propiedad/hilo y responde WiFi/reglas/parqueadero de forma coherente sobre el mismo `threadId`.

### 3. ¿Utiliza correctamente las herramientas? — **SÍ (verificado)**
Disponibilidad y cotización devuelven datos reales de BD; tools de lectura scopeadas por tenant; toda invocación se audita (`recordToolAudit`). Tool no registrada → `denied`.

### 4. ¿Evita respuestas duplicadas? — **SÍ (verificado)**
En modo `observe` el outbound está bloqueado (`outboundBlocked: true`); `mayAutoSend` solo es `true` bajo condiciones estrictas (ver Q6/seguridad). No hay ruta paralela que reenvíe. Idempotencia de correos/enlaces heredada de los servicios PMS congelados (sin cambios).

### 5. ¿Escala correctamente los casos complejos? — **SÍ (verificado)**
Escenario 4: cancelar→needs_llm, descuento 40%→escalate, reembolso→escalate, cambio de apto→needs_llm. En todos `mayAutoSend: false`. Escenario 5 (helicóptero): no inventa; escala pidiendo detalle.

### 6. ¿Utiliza OpenAI únicamente cuando es necesario? — **SÍ (verificado)**
**0 llamadas / 0 tokens** en toda la batería. NO usa OpenAI para: WiFi, Código, Guest Registration, Dirección, Parqueadero, Check-in, Check-out, Métodos de pago, Disponibilidad, Cotización, Reserva, Reglas. L3 (OpenAI) queda diferido: los `needs_llm` **escalan o piden información**, nunca inventan.

### 7. ¿Existen regresiones? — **NO (verificado)**
Typecheck + Build (107 páginas + rutas API) + 21/21 tests. Módulos confirmados sin cambios: PMS, Guest Registration, TTLock, Inbox AI, QR Mobility, PRAGMA INTIENDAS, Facturación, Integraciones, Multi-tenant. Los únicos archivos tocados en toda la iniciativa pertenecen al módulo `ai-concierge` + sus 4 rutas.

### 8. ¿La extensión es estable? — **SÍ a nivel código (stress vivo pendiente propietario)**
Implementa MutationObserver + polling, leader election multi-pestaña, retry con backoff, health check. **No hay WebSocket** (arquitectura HTTPS REST — no aplica). El stress real (pérdida de internet, cierre de pestañas, múltiples conversaciones) se ejecuta en el kit vivo.

### 9. ¿La plataforma continúa estable? — **SÍ (verificado)**
Sin regresiones; stores en memoria acotados (sesiones con eviction FIFO 2000; learning/tool-audits=200; runs/sesión=50).

### 10. ¿Existe algún riesgo que impida producción? — **NO técnico; sí un gate de proceso**
No hay riesgo técnico crítico ni alto abierto. El único ítem pendiente es de **proceso**: la captura de conversación en vivo (Escenarios 1–2) y la autorización explícita del propietario. Clasificación: **Bloqueo de proceso (no técnico)**.

---

## Persistencia — análisis técnico obligatorio

**Estado actual:** store en memoria (`session-store.ts`), acotado con eviction FIFO.

### ¿Es suficiente para esta versión? → **SÍ**, con limitaciones documentadas.

**Justificación técnica:**
- El contexto de conversación es **reconstruible**: la extensión lee el hilo del canal (WhatsApp/Airbnb) en cada turno, de modo que una pérdida de memoria del servidor no pierde la conversación real (vive en el canal).
- Los modos dominantes de esta liberación son **observe / manual / assisted** (la IA propone; el humano aprueba). El modo `autonomous` está fuertemente restringido (solo determinístico + auditor verificado + baja complejidad).
- La auditoría/observabilidad crítica (tool audits, learning, métricas) es efímera pero **no es sistema de registro de negocio**: las acciones reales (reservas, correos, pagos, códigos) las persisten los servicios PMS ya existentes en BD.

**Limitaciones (aceptadas para v1):**
- La memoria de sesión se pierde en reinicio/redeploy y **no se comparte entre instancias** (asume despliegue de instancia única para el canal).
- Los audit/learning en memoria se truncan a 200 y no sobreviven reinicios.

**Estrategia recomendada para v2 (NO implementar ahora):** persistir sesiones/auditoría del Concierge en Prisma (tabla dedicada `ConciergeConversation`/`ConciergeToolAudit`) para multi-instancia y trazabilidad histórica. Se documenta como mejora; **no** amplía el alcance de esta liberación (no hay bloqueo crítico).

---

## Configuración (dónde vive cada cosa)

| Elemento | Ubicación | Cómo modificar |
|---|---|---|
| Activación/secreto extensión | env `CONCIERGE_EXTENSION_SECRET` | `.env.local` / entorno de deploy |
| Modo (observe/manual/assisted/autonomous) | header `x-concierge-mode` por request | configurado por la extensión/popup |
| Identidad operador | header `x-concierge-user-id` (org **derivada de BD**, no del cliente) | usuario real de PRAGMA |
| WhatsApp/Airbnb | sesión del navegador + extensión unpacked | login humano en el canal |
| WebSocket | **N/A** — comunicación HTTPS REST (`/api/concierge/*`) | — |
| Intenciones / plantillas | `src/modules/ai-concierge/intent/library.ts` | editar biblioteca (código) |
| Herramientas (tools) | `tools/read/*`, `tools/write/*`, `tools/catalog.ts`, `create-registry.ts` | registrar en catálogo/registry |
| Auditor | `engine/auditor.ts` | verifica borrador vs. hechos |
| Logs / auditoría / métricas | `/api/concierge/health` (tool audits, learning, métricas runtime) | endpoint health |

Detalle completo: `docs/audits/AI-CONCIERGE-PHASE13-CONFIG-AUDIT-V1.md` y `docs/audits/AI-CONCIERGE-OPERATIONAL-MANUAL-V1.md`.

---

## Conclusión

- **Plataforma / código / seguridad / regresiones / consumo IA:** ✅ **APROBADO** por evidencia verificable.
- **Live Acceptance (Escenarios 1–2 en canal real):** ⏳ **requiere ejecución del propietario** (kit abajo). No se puede ni se debe simular.

Por el criterio del propio documento (evidencia en canal real + autorización explícita) y por la política permanente de PRAGMA (**el deploy a producción requiere aprobación explícita del propietario; no auto-deploy**), me detengo aquí. **No** ejecuto commit de release, tag ni deploy hasta:
1. recibir las capturas de la conversación en vivo (o autorización explícita para liberar sin ellas), **y**
2. autorización explícita de deploy.

---

## KIT DE EJECUCIÓN EN VIVO (propietario)

### Requisitos
1. `CONCIERGE_EXTENSION_SECRET` configurado en el servidor local (`.env.local`).
2. Servidor local corriendo (`npm run dev`).
3. Extensión cargada: Chrome → Extensiones → Modo desarrollador → "Cargar descomprimida" → `extensions/pragma-ai-concierge/`.
4. En el popup de la extensión: pegar el secreto, `x-concierge-user-id` (un usuario real de tu organización), modo inicial `manual`, botón **Health** debe responder OK.

### Escenario 1 — WhatsApp Web (teléfono real, tú como huésped)
Abre WhatsApp Web con la sesión del negocio. Desde el teléfono, envía en orden y **captura** la propuesta de la extensión en cada paso:
```
Hola
¿Tienen disponibilidad para mañana?
¿Cuánto cuesta?
¿Aceptan mascotas?
¿Dónde están ubicados?
Quiero reservar
[enviar datos solicitados: nombre, correo, documento, teléfono]
[recibir cotización → confirmar interés]
[recibir instrucciones de pago]
Ya realicé el pago
Llegaré a las 11:00 pm
Perdí mi código
¿Cuál es la clave del WiFi?
Gracias
```
Para cada turno registra: captura, `path` y `usedLlm` (visibles en `/api/concierge/health` o en el panel de la extensión).

### Escenario 2 — Airbnb Web
Repite exactamente la misma conversación en un hilo real de Airbnb Web.

### Escenarios 3–7
- **3 (memoria):** conversación larga; verifica que recuerda nombre/fechas/propiedad.
- **4 (escalamiento):** pide cancelación/descuento/reembolso → debe escalar, `mayAutoSend:false`.
- **5 (fuera de dominio):** "Necesito alquilar un helicóptero" → no inventa.
- **6 (determinístico):** WiFi/código/reglas/etc. → confirma `usedLlm:false` en health.
- **7 (LLM):** frase ambigua → confirma que solo entonces consideraría L3.

### Stress de extensión
- Abre 2 pestañas del mismo canal → solo una debe liderar (leader election).
- Desactiva el WiFi del PC 30s y reactívalo → la extensión debe reconectar (retry).
- Cierra y reabre la pestaña → recuperación automática.

### Qué entregar
Capturas + export de `/api/concierge/health` (métricas + tool audits). Con eso cierro el LAT y, si autorizas, procedo a: **Commit de Release → Tag → Deploy → Validación post-deploy**.
