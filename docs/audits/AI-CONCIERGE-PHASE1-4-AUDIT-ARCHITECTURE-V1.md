# PRAGMA AI Concierge — Fases 1–4: Auditoría, Arquitectura, Riesgos y Seguridad

**Estado:** AUDITORÍA COMPLETADA — PENDIENTE APROBACIÓN EXPLÍCITA PARA FASE 5  
**Fecha:** 2026-07-17  
**Documento origen:** Ejecución v1.0 (APROBADO PARA PLANIFICACIÓN Y AUDITORÍA)  
**Alcance:** Solo lectura / diseño. **Sin modificación de código de producto. Sin deploy.**

---

## Veredicto ejecutivo

PRAGMA **ya tiene** una base sólida de PMS multi-tenant, Inbox AI (borrador humano), ingestión Airbnb por email, Guest Registration, pagos, TTLock y auditoría fragmentada.

PRAGMA **no tiene** aún:

- runtime de agente con tools;
- conector outbound Airbnb / WhatsApp;
- modelo canónico de conversación;
- ledger unificado de acciones del agente;
- política formal de auto/escalado;
- extensión de navegador.

La arquitectura recomendada es de **menor impacto**: un módulo nuevo `ai-concierge` dentro de PRAGMA que **reutiliza servicios existentes vía wrappers tipo server-action**, con la extensión como **canal tonto**. No tocar INTIENDAS, QR Mobility, facturación SaaS ni pipelines de correo huésped ya congelados, salvo consumo read-only / tools autorizados.

**Gate:** no avanzar a Fase 5 (implementación) sin aprobación explícita de este informe.

---

# FASE 1 — Auditoría Integral del Sistema

## 1.1 Mapa de dominios existentes

| Dominio | Ubicación principal | Reutilizable para Concierge |
|---------|---------------------|----------------------------|
| Reservas Directas | `src/services/reservations/` | Sí (create/update/search) |
| Calendario / ocupación | `src/services/calendar/` | Sí (read) |
| Conflictos / overlap | `src/services/reservations/reservation-conflicts.ts` | Sí (vía wrapper scoped) |
| Cotización estancia | PriceLabs + `daily-pricing.ts` + clipboard quote | **Parcial** — falta facade unificada |
| Guest Registration | `src/services/guests/` | Sí |
| Pagos huésped | `src/services/payments/` | Sí (read + crear link; no reconciliar arbitrario) |
| TTLock / acceso | `src/services/integrations/ttlock/` | Sí |
| Propiedad / WiFi / reglas | `src/services/properties/` + `operational-contacts.ts` | Sí (con redacción de secretos) |
| Tareas | `src/services/tasks/` | Parcial (create limitado a MAINTENANCE) |
| Novedades / inbox ops | `src/services/novedades/` | Sí (contexto + UI supervisión) |
| Inbox AI (borrador) | `src/services/inbox-ai/` | **Núcleo a evolucionar** |
| Airbnb email inbound | `src/modules/airbnb-email/` | Sí (entrada de eventos) |
| Email outbound (Resend) | `src/lib/email/send-email.ts` | Sí (herramientas email ya existentes) |
| PriceLabs | `src/integrations/pricelabs/` | Sí (tarifas) |
| Facturación SaaS | `src/modules/billing/` | **No** como tool de concierge huésped |
| INTIENDAS / Retail Intel | `src/domains/retail*` | **Fuera de alcance** |
| QR Mobility | `src/modules/qr-mobility/` | **Fuera de alcance** |
| Sales / Prospecting OpenAI | `src/modules/sales-console/enrichment/` | Solo patrón de cliente OpenAI |

## 1.2 Inteligencia existente (no agente)

### Inbox AI — borrador asistido (humano envía)

| Componente | Path |
|------------|------|
| Generación OpenAI | `inbox-ai-generation.service.ts` (`gpt-4o-mini`, sin tools) |
| Contexto grounded | `inbox-context.engine.ts` |
| Intents determinísticos | `inbox-intent.service.ts` |
| Orquestación + persistencia | `inbox-ai-draft.service.ts` |
| UI | `novedades-ai-draft-panel.tsx` — *“No se envía automáticamente”* |
| Auditoría | `InboxAiDraft` + `InboxAiDraftAuditEvent` |

### Sales enrichment OpenAI

Cliente Chat Completions separado; no aplica a operaciones hoteleras.

### “AI” determinístico

Retail Intelligence, scoring de prospecting: **sin LLM**.

## 1.3 Canales actuales vs requeridos

| Canal | Estado actual | Gap para Concierge |
|-------|---------------|-------------------|
| Airbnb mensajes | Solo **inbound** vía email Resend | Sin API/outbound; extensión requerida para leer/escribir UI Airbnb |
| WhatsApp | `wa.me` / texto preparado | Sin WA Business API; extensión WhatsApp Web como conector |
| Email huésped (bienvenida, admin, TTLock) | Pipelines Resend maduros | **No reimplementar**; tools pueden invocar servicios existentes |
| Extensión navegador | **No existe** | Nuevo repo/paquete; cero lógica de negocio |
| Booking / IG / Telegram | No | Futuros conectores |

## 1.4 Modelo de conversación actual

Fragmentado entre:

- `ReservationCommunication`
- `ReservationActivity` / `ReservationActivityPending`
- feed Novedades
- `EmailIngestionAudit`
- drafts Inbox AI

**Gap crítico:** no hay entidades canónicas `Conversation` / `Message` con canal, dirección, delivery, idempotencia outbound.

## 1.5 Auth, multi-tenant, permisos

- Clerk + `User` local (`src/lib/auth.ts`)
- `TenantDataScope` (`requireTenantDataScope`, property/reservation scope)
- Permisos por dominio (`reservations:*`, `finance:write`, `access:manage`, …)
- Server actions = frontera de seguridad típica

**Para el agente:** cada tool debe reutilizar esa frontera (equivalente a action), nunca Prisma directo ni bypass de scope.

## 1.6 Auditoría existente (patrones a reutilizar)

| Sistema | Fortaleza |
|---------|-----------|
| `InboxAiDraftAuditEvent` | Prototipo generate/edit/copy |
| `EmailIngestionAudit` | Idempotencia inbound |
| `PaymentAuditLog` | Dinero |
| `AccessEvent` | TTLock |
| `PlatformAuditLog` | Acciones privilegiadas |
| Invite/admin notification logs JSON | Emails GR |

**Gap:** no hay ledger correlacionado `inbound → decisión → tool → aprobación → envío → resultado`.

## 1.7 Mapa capacidad → servicio (tools candidatas)

| Tool (visión) | Servicio reutilizable | Riesgo |
|---------------|----------------------|--------|
| Buscar / obtener reserva | `reservation.service` | Bajo (read) |
| Calendario | `calendar.service` | Bajo |
| Disponibilidad | `reservation-conflicts` + wrapper scoped | Medio — falta search multi-property |
| Cotizar | PriceLabs + daily-pricing | Medio — falta facade |
| Crear / actualizar Direct | `reservation.service` + actions | Alto |
| Guest Registration send/status | `guest-registration*.service` | Medio |
| Link / balance pago | `guest-payment-link` / balance | Alto (mutación) |
| Confirmar pago | Solo provider/webhook o manual `finance:write` | Crítico |
| TTLock get/generate/resend | `ttlock-access` + email service | Alto |
| WiFi / reglas / dirección | `property.service` filtrado | Medio (secretos) |
| Contactos operativos | `operational-contacts.ts` | Bajo |
| Crear tarea / incidencia | `task.service` (ampliar tipos) | Medio |
| Facturación SaaS / INTIENDAS / QR | — | **Prohibido** |

## 1.8 Componentes NO reutilizables como cerebro

- Extensión (aún inexistente): solo I/O de canal.
- Sales enrichment prompts.
- Retail AI engine / INTIENDAS.
- Cron E2E de notificaciones (bloqueado en prod).

---

# FASE 2 — Arquitectura propuesta (menor impacto)

## 2.1 Alternativas evaluadas

| Opción | Descripción | Impacto | Decisión |
|--------|-------------|---------|---------|
| **A** | Módulo `ai-concierge` en monorepo + tools wrapping services + extensión thin | Bajo–medio | **Elegida** |
| B | Microservicio agente externo | Alto (auth, datos, ops) | Descartada |
| C | Lógica en extensión + llamadas ad hoc a APIs | Viola principio “PRAGMA es el cerebro” | Descartada |
| D | Autonomía total desde día 1 sobre Inbox AI | Riesgo alto / sin política | Descartada |

## 2.2 Diagrama lógico

```
[Airbnb Web / WhatsApp Web]
        │
        ▼
[Browser Extension — connector only]
  detect · read · send context · write reply · allowed UI actions
        │  HTTPS autenticado (org + device + channel session)
        ▼
[PRAGMA API: /api/concierge/channel/*]
        │
        ▼
[Concierge Orchestrator]
  policy · mode (manual|assisted|autonomous) · redaction · run state
        │
        ├──▶ LLM (solo razonamiento + selección de tools)
        │
        ├──▶ Tool Registry (wrappers de servicios PMS existentes)
        │
        ├──▶ Approval / Escalation (Task + Novedades UI)
        │
        └──▶ Audit Ledger (AgentRun / Step / ToolInvocation)
```

## 2.3 Capas

1. **Channel Connector (extensión)** — sin negocio; firma requests; idempotency key de mensaje.
2. **Ingest Adapter** — normaliza a `ConversationMessage` canónico.
3. **Orchestrator** — state machine por modo; nunca DB directa.
4. **Tool Registry** — cada tool = contrato Zod + permission + tenant scope + audit.
5. **Policy Engine** — allow / deny / require_approval / escalate.
6. **Response Composer** — grounded solo en tool results + knownFacts (reusar `InboxAiContext`).
7. **Supervision UI** — extensión de Novedades (evolucionar Inbox AI panel).

## 2.4 Evolución desde Inbox AI (no reemplazo disruptivo)

| Fase producto | Comportamiento |
|---------------|----------------|
| Manual | Orchestrator propone draft (como hoy) + tool traces visibles; humano envía vía extensión o copy |
| Asistido | Auto-respuesta solo intents allowlisted + confidence + tools read-only |
| Autónomo | Mutaciones permitidas solo con policy + auditoría; resto escala |

## 2.5 Nuevos artefactos de datos (propuestos; no implementados)

- `ConciergeConversation`, `ConciergeMessage`
- `ConciergeAgentRun`, `ConciergeAgentStep`, `ConciergeToolInvocation`
- `ConciergeApprovalRequest`, `ConciergePolicyDecision`
- `ConciergeChannelSession` (extensión ↔ org)

Migraciones **solo tras** aprobación Fase 5 módulo 0 (foundation).

## 2.6 Orden de módulos de implementación (cuando se autorice Fase 5)

1. **M0 Foundation:** modelos run/audit + tool registry read-only + policy stub  
2. **M1 Context:** unificar conversación mínima + bridge desde Novedades/Airbnb email  
3. **M2 Read tools:** reserva, propiedad filtrada, GR status, pago balance, acceso status, calendario  
4. **M3 Draft+Manual mode:** evolucionar Inbox AI → run con tools  
5. **M4 Extension Airbnb (read+propose)**  
6. **M5 Assisted send** (allowlist)  
7. **M6 Quote + availability facade**  
8. **M7 Direct booking + payment link tools** (con approval)  
9. **M8 TTLock / GR send tools** (con approval / anti-dupe existente)  
10. **M9 WhatsApp Web connector**  
11. **M10 Autonomous mode** (último)

Un módulo a la vez. Reauditoría tras cada uno.

---

# FASE 3 — Evaluación de Riesgos

| ID | Tipo | Riesgo | Causa | Impacto | Prob. | Mitigación |
|----|------|--------|-------|---------|-------|------------|
| R1 | Seguridad | Cross-tenant leakage | Tool sin `assert*InScope` | Crítico | Media | Wrappers obligatorios = action boundary; tests de scope |
| R2 | Seguridad | Exfiltración PII/códigos a LLM | Context actual ya envía WiFi/códigos | Alto | Alta | Redaction policy pre-LLM; fields allowlist por intent |
| R3 | Operativo | Spam / correos duplicados | Tool reenvía sin anti-dupe | Alto | Media | Reusar claim/`inviteSentAt`/`deliveryStatus`; nunca bypass |
| R4 | Funcional | Alucinación precios/disponibilidad | LLM sin tools o tools inventados | Crítico | Media | Prohibir respuesta sin tool result; escalate si missingFacts |
| R5 | Técnico | Extensión frágil (DOM Airbnb) | UI Airbnb cambia | Alto | Alta | Connector versionado; fail-closed; modo manual fallback |
| R6 | Legal | Mensajes autónomos sin supervisión | Modo autónomo prematuro | Alto | Media | Default Manual; Assisted opt-in por org/conversación |
| R7 | Seguridad | Mutaciones destructivas | Tool delete/refund | Crítico | Baja | Deny list permanente (delete reserva, borrar huésped, refund) |
| R8 | Mantenimiento | Duplicar lógica de negocio | Tools con Prisma directo | Alto | Media | Solo wrappers de servicios; review gate |
| R9 | Operativo | Condiciones de carrera envío | Doble click extensión + agent | Alto | Media | Idempotency key por `channelMessageId` |
| R10 | Técnico | Costo/latencia OpenAI | Loops de tools | Medio | Media | Max steps; timeouts; budget por org |
| R11 | Funcional | Cotización incorrecta | Facade incompleta | Alto | Media | No auto-cotizar hasta M6 certificado |
| R12 | Integridad | Romper pipelines email freeze | Cambios en GR/TTLock email | Alto | Baja | Tools llaman APIs existentes; no tocar send paths |
| R13 | Legal | ToS Airbnb / automatización | Scraping/envío vía UI | Alto | Media | Extensión = asistencia operador; ToS review; rate limits |
| R14 | Seguridad | Prompt injection desde huésped | Mensaje malicioso | Alto | Alta | Tools allowlist; no ejecutar instrucciones del usuario como system; sanitize |

---

# FASE 4 — Validación de Seguridad (arquitectura)

Demostración **por diseño** (aún sin código nuevo) de que la arquitectura **no requiere** modificar:

| Sistema | ¿Roto por diseño propuesto? | Justificación |
|---------|----------------------------|---------------|
| PMS core | No | Tools envuelven services; no cambian reglas |
| Guest Registration | No | Reusa servicios + anti-dupe; sin nuevo pipeline email |
| TTLock | No | Reusa generate/notify; respeta `deliveryStatus` |
| QR Mobility | No | Fuera de tool registry |
| INTIENDAS | No | Fuera de tool registry |
| Facturación SaaS | No | Fuera de tool registry |
| Integraciones OAuth | No | Solo status read al inicio |
| Multi-tenant | No | Scope obligatorio en cada tool |
| Comunicaciones auto huésped | No | Freeze respetado; Concierge no reabre disparadores ocultos |

**Condición de stop:** si un módulo propuesto exige cambiar la semántica de envío auto de bienvenida/admin/TTLock o facturación SaaS → **detener** y rediseñar.

**Riesgos residuales aceptables solo con mitigación:** R2 (redaction), R5 (extensión), R6/R13 (modo + legal).

---

## Criterio para cerrar planificación

| Entregable | Estado |
|------------|--------|
| Auditoría sistema (Fase 1) | Completa |
| Arquitectura menor impacto (Fase 2) | Completa — Opción A |
| Matriz de riesgos (Fase 3) | Completa |
| Validación seguridad por diseño (Fase 4) | Completa — sin stop blockers de arquitectura |
| Implementación (Fase 5+) | **Bloqueada** hasta aprobación explícita |
| Deploy | **Prohibido** |

---

## Decisión solicitada al propietario

Para avanzar a **Fase 5 · Módulo 0 (Foundation)**, confirmar explícitamente:

1. Aceptación de arquitectura Opción A.  
2. Orden de módulos M0→M10.  
3. Modo inicial = **Manual** únicamente.  
4. Extensión fuera del monorepo o dentro de `apps/concierge-extension` (preferencia).  
5. Proveedor LLM inicial = OpenAI (reutilizar patrón Inbox AI) vs abstracción multi-provider.

**Sin esa aprobación, no se escribe código de producto.**
