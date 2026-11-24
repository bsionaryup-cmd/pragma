# Auditoría Integral de Regresión — PRAGMA PMS + Recepcionista Digital

**Fecha:** 2026-07-31  
**Alcance:** Post-integración Agente WA Cloud API / Recepcionista Digital  
**Deploy durante esta auditoría:** **PROHIBIDO / NO EJECUTADO**  
**Método:** estático (imports/diff/schema) + automatizado (tsc/prisma/build/tests) + aislamiento RD.  
**UI E2E manual (click-through prod):** no ejecutado en esta corrida → marcado **UNVERIFIED**.

---

## Veredicto ejecutivo

| Pregunta | Respuesta |
|----------|-----------|
| ¿RD permanece desacoplado del núcleo PMS? | **SÍ**, con acoplamientos blandos controlados (ver Fase 7) |
| ¿Existen regresiones P0 atribuibles a RD? | **No detectadas** en estático/tests |
| ¿Existen hallazgos P1? | **Sí (3)** — ver riesgos |
| ¿Criterio de aprobación completo (todas críticas PASS + sin P0/P1)? | **NO CUMPLE** — hay P1 + módulos críticos **UNVERIFIED** sin E2E manual |
| ¿Se puede seguir desarrollando features RD? | **NO** hasta cerrar P1 y matriz E2E crítica, per brief |

### Criterio de aprobación del brief

> Apto solo si no hay P0/P1 y calendario, reservas, finanzas, correos, GR, TTLock, iCal, auth y sync = PASS.

**Estado:** **NO APTO** para declarar cierre de auditoría / nuevas features RD.  
**Estado técnico del código RD:** build verde; aislamiento aceptable; listo para E2E manual supervisado.

---

## Fase 1 — Auditoría arquitectónica

### Estructura RD (additive)

- `src/services/platform/digital-receptionist/**` (22 archivos)
- `src/integrations/whatsapp-cloud/`
- `src/app/api/digital-receptionist/runtime/`
- `src/app/api/webhooks/whatsapp/`
- `src/app/api/owner/digital-receptionist/**`
- `src/app/api/cron/digital-receptionist-turns/`
- Owner UI: `owner-dashboard/recepcionista-digital` + `owner-digital-receptionist-view.tsx`

### Imports hacia RD fuera del árbol

Solo:

- `owner-digital-receptionist-view.tsx` (types)
- `owner-dashboard/recepcionista-digital/page.tsx` (list orgs)
- `proxy.ts` (matcher runtime self-auth)
- `lib/db.ts` (delegates Prisma)
- `owner-shell-header.tsx` (nav link)

**No** hay imports RD desde calendario, reservas, finanzas, TTLock, iCal, airbnb-email, PriceLabs, billing.

### Hallazgos arquitectónicos

| ID | Hallazgo | Severidad |
|----|----------|-----------|
| A1 | Working tree mezcla RD + auth unify + email-safety + PriceLabs + TTLock `adjustAccessWindow` + GR capacity | **P1** (superficie de regresión no atribuible solo a RD) |
| A2 | Runtime API Clerk-bypassed (`isSelfAuthedApi`) | P1 seguridad operativa |
| A3 | Cron RD cada 5m; auth solo si `CRON_SECRET` set | P1 si secret ausente en algún env |
| A4 | `ensureGuestRegistrationForReservation` / stay-portal ensure desde decision path | P1 side-effect |
| A5 | ESLint errores en Owner RD view + prefer-const rules | P2 |

No se encontraron: imports rotos hacia RD, servicios core reemplazados por RD, FKs que cascade-delete Reservation.

---

## Fase 2 — Build

| Check | Resultado | Evidencia |
|-------|-----------|-----------|
| `prisma validate` | **PASS** | schema valid |
| `prisma generate` | **PASS** | client 7.8.0 |
| `tsc --noEmit` | **PASS** | exit 0 (~65s) |
| `npm run build` | **PASS** | exit 0; ruta `/owner-dashboard/recepcionista-digital` presente |
| ESLint (superficie RD) | **FAIL** | 3 errors (set-state-in-effect, prefer-const×2), 2 warnings unused |

**Dependencias circulares:** no detectadas en grafo RD.  
**Warnings críticos de build Next:** ninguno en la corrida local.

---

## Fase 3 — Funcional (evidencia automatizada vs UI)

Leyenda: **PASS** = verificado con test/build/diff; **UNVERIFIED** = requiere E2E manual; **N/A-RD** = RD no toca el módulo según imports.

| Módulo | Estado | Evidencia / nota |
|--------|--------|------------------|
| Dashboard KPIs/gráficas | UNVERIFIED | Sin smoke UI |
| Calendario CRUD/DnD | UNVERIFIED | Diff menor `calendar-day-price.tsx` (+/− price); no E2E |
| Reservas CRUD | UNVERIFIED | Diff UI activity timeline/detail; sin E2E |
| Finanzas SSOT | UNVERIFIED | Sin tests finance en esta corrida |
| Propiedades | UNVERIFIED | Sin diff RD |
| Limpiezas | UNVERIFIED | |
| Registro huéspedes | PASS* | tests capacity + email-safety; *diff email skip sintéticos |
| TTLock | UNVERIFIED* | Diff añade `adjustAccessWindowForReservation`; no import desde RD; *regresión posible por co-cambio |
| Correos / Resend | PASS* | tests send-email + email-safety; cambio prod detection |
| iCal | N/A-RD / UNVERIFIED | Sin import RD; sin E2E |
| PriceLabs | UNVERIFIED | Diff grande `pricelabs/service.ts` co-tree |
| Wompi | UNVERIFIED | |
| Clerk / Auth | PASS* | tests auth paths; unify login en tree |
| Owner / Admin / Recepción UI | UNVERIFIED | |
| Inbox / Concierge IA | N/A-RD | Concierge docs archived; RD es módulo aparte |
| Recepcionista Digital | PASS (unit) | 70 tests platform+billing+guests+auth related pass |

\*PASS de tests unitarios, no E2E de producto.

### Suite ejecutada (70/70 PASS)

```
tests/platform/digital-receptionist-*.test.ts
tests/billing/send-email.test.ts
tests/guests/email-safety.test.ts
tests/guests/resolve-guest-registration-capacity.test.ts
tests/access/access-code-guest-message.test.ts
tests/auth/*.test.ts
```

---

## Fase 4 — Base de datos

| Ítem | Resultado |
|------|-----------|
| Migración `20260731120000_digital_receptionist_agent_cloud` | Additive (conversations, messages, turn_jobs, config columns) |
| FK → Reservation | **No** (solo `reservationId` string opcional sin relation) |
| Cascade Property → Knowledge | Borra KB al borrar property; no borra property desde RD |
| Índices org/channel/thread | Presentes |
| Soft delete core | No alterado por RD |

---

## Fase 5 — Seguridad

| Control | Estado |
|---------|--------|
| Owner APIs RD | Detrás rutas owner |
| Webhook WA | Firma HMAC; fail-closed sin secret |
| Runtime Bearer | Self-auth; riesgo leak token |
| Cron | Bearer CRON_SECRET si definido |
| RBAC core | No modificado por RD imports |
| XSS/SQLi vía Prisma | RD usa Prisma parametrizado |

---

## Fase 6 — Performance

| Ítem | Nota |
|------|------|
| Cron cada 5m | Drain drain ≤25 jobs |
| LLM turn | Timeout 25s; max 4 tool steps |
| N+1 | Context builder hace queries por turno — aceptable a escala piloto |
| Owner view setState-in-effect | ESLint flag P2 |

---

## Fase 7 — Aislamiento Recepcionista Digital (crítico)

| Requisito | Resultado |
|-----------|-----------|
| NO reemplaza servicios existentes | PASS |
| NO muta reservas create/update/delete | PASS |
| NO importa TTLock / iCal / billing / airbnb-email / PriceLabs | PASS |
| NO sobrescribe plantillas email core | PASS |
| NO cambia calendario/finanzas por import | PASS |
| Side-effect GR/stay-portal ensure | **FAIL parcial** — acoplamiento blando P1 |
| Capa independiente | **SÍ** (árbol propio + webhook + owner) |

**Confirmación explícita:** el Recepcionista Digital **permanece desacoplado del núcleo** para mutaciones de negocio críticas. Existen **acoplamientos que conviene endurecer** (no necesariamente “eliminar”): (1) mint de tokens GR/portal solo en skills explícitos, no en todo `decide`; (2) no ampliar tools a writes PMS sin Phase gates.

---

## Fase 8 — E2E escenarios

| Escenario | Estado |
|-----------|--------|
| 1 Directa → email → GR → TTLock → finanzas | **UNVERIFIED** |
| 2 Airbnb iCal → GR → TTLock | **UNVERIFIED** |
| 3 Modificar reserva | **UNVERIFIED** |
| 4 Cancelar reserva | **UNVERIFIED** |
| 5 RD consulta / draft / link / no afectar core | Unit PASS; Meta live **UNVERIFIED** (sin `WHATSAPP_CLOUD_*`) |

---

## Fase 9 — Matriz de regresión (resumen)

Ver canvas + tabla ampliada abajo. Impacto: desviaciones posibles por **co-cambios** del working tree, no por hard-coupling RD.

### Riesgos clasificados

| ID | Severidad | Descripción | Acción correctiva |
|----|-----------|-------------|-------------------|
| R1 | P1 | Working tree mezcla cambios no-RD (auth, email, PL, TTLock) | Separar PRs / auditar cada dominio antes de más features RD |
| R2 | P1 | `resolveLinks`/ensure GR en cada plan con reserva | Llamar ensure solo en skill GR/portal |
| R3 | P1 | Runtime + cron self-public | Documentar rotación token; exigir CRON_SECRET en prod |
| R4 | P2 | ESLint Owner RD + prefer-const | Fix lint (sin deploy hasta OK auditoría) |
| R5 | P2 | E2E manual no corrido | Checklist operativo Owner en staging |
| R6 | P3 | Comentario stale “Never writes GR” en context | Actualizar comentario |

### Plan de corrección (orden)

1. Congelar features RD (cumplido por brief).  
2. Fix P1 R2 (ensure solo on-demand) — cambio mínimo, sin deploy hasta re-audit.  
3. Verificar `CRON_SECRET` en Vercel prod.  
4. Ejecutar E2E manual Escenarios 1–4 en staging/prod supervisado.  
5. Separar/revertir o certificar co-cambios PriceLabs/TTLock/auth.  
6. Re-ejecutar Fase 2 ESLint → PASS.  
7. Solo entonces: nuevas features RD + deploy con “apruebo deploy”.

---

## Entregables

| Entregable | Path |
|------------|------|
| Este informe | `docs/audits/REGRESSION-AUDIT-RD-INTEGRAL-2026-07-31.md` |
| Guía arranque WA (previa) | `docs/architecture/DIGITAL-RECEPTIONIST-AGENT-START-GUIDE.md` |
| Canvas matriz | `canvases/rd-regression-audit.canvas.tsx` |

**No deploy** efectuado como parte de esta auditoría.
