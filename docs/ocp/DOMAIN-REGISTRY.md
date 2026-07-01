# OCP Domain Registry

**Last updated:** 2026-06-17  
**Protocol:** `docs/OCP-MASTER-EXECUTION-PROTOCOL.md`

Estado canónico de dominios certificables. Un dominio no avanza de estado sin los 18 puntos del entregable OCP.

---

## State machine

```
OPEN → IN_PROGRESS → CERTIFIED → FROZEN → CLOSED
```

| State | Meaning |
|-------|---------|
| **OPEN** | Identificado; sin baseline |
| **IN_PROGRESS** | Baseline registrado; trabajo activo |
| **CERTIFIED** | Fases A–H PASS; commit pendiente o hecho |
| **FROZEN** | Commit certificado; archivos protegidos |
| **CLOSED** | Replay + deploy aprobado + registro final |

---

## Domain inventory

| Domain | SSOT | State | Commit | Notes |
|--------|------|-------|--------|-------|
| **Financial revenue (read)** | `resolveFinanceReservationRevenueAmount` | FROZEN | _pending commit_ | OCP Phase 1 — see `docs/ocp/phases/PHASE-1-FINANCIAL-CONSISTENCY.md` |
| **Financial revenue (write)** | `applySafeReservationEnrichment` / `pickReservationAmount` | OPEN | — | Phase 6; fallbackGross 0/11 en pilot (medido Fase 1) |
| **Reservation holder** | `reservation.guestName` + enrichment policy | OPEN | — | OCP Phase 2 — código local, sin certificar |
| **Guest registration capacity** | `getGuestRegistrationMaxCapacity` | OPEN | — | OCP Phase 3 |
| **Reservation detail UI (finance display)** | Panel + enrichment service | OPEN | — | OCP Phase 5 |
| **Default messages** | `default-message-templates.ts` | OPEN | — | OCP Phase 4 |
| **Match / enrichment pipeline** | `applySafeReservationEnrichment` | FROZEN | `6cb5d90` | Dennis room-id fix |
| **iCal sync** | `airbnb-ical-sync.service.ts` | CLOSED | prior stabilization | Ver `docs/stabilization/` |
| **Performance / CPU** | stabilization RC | CLOSED | `3d256a3` | Ver perf reports |

---

## Gap analysis — consistency release vs OCP v1.0

Trabajo ejecutado bajo el protocolo anterior (pre-OCP) vs requisitos actuales:

| OCP requirement | Previous execution | Gap |
|-----------------|-------------------|-----|
| Baseline before edits | No registrado | **BLOCKER** para FROZEN/CLOSED |
| Per-domain commit (Fase J) | 0 commits; cambios unstaged | **BLOCKER** |
| 18-point deliverable per domain | Informe consolidado único | Split por dominio requerido |
| Deploy = owner approval only | Deploy automático ejecutado | Alinear política; prod ya tiene `dpl_2pZbjmFCpzqggu9rNVoLSD7C84Wb` |
| Benchmark before/after | No medido | Requerido para CERTIFIED |
| Rollback per phase | No documentado | Añadir SHA + archivos por dominio |
| Domain state registry | Declaración verbal | Este archivo |
| Observable behavior preserved | Sí, salvo reglas 6–7 explícitas | Documentar en comparación antes/después |

---

## Recommended closure order (retroactive OCP compliance)

1. **Financial revenue (read)** — baseline grep consumidores → commit → FROZEN  
2. **Reservation holder** — baseline + tests → commit → FROZEN  
3. **Guest registration capacity** — baseline + tests → commit → FROZEN  
4. **Reservation detail UI** — smoke + commit → FROZEN  
5. **Financial revenue (write)** — `scripts/_audit-fallback-gross-readonly.mjs` → decisión documentada → OPEN o patch mínimo  
6. **Default messages** — auditoría cerrada → CLOSED sin código si PASS  

---

## Protected files (pending FROZEN commits)

Cuando cada dominio llegue a FROZEN, listar aquí con SHA:

### Financial revenue (read) — pending

- `src/lib/finance/reservation-revenue-amount.ts` (SSOT — no tocar sin reopen)
- `src/services/finance/reservation-revenue-context.service.ts`
- Consumidores migrados en owner-dashboard, property, operational-feed, inbox-context

### Reservation holder — pending

- `src/services/guests/guest-registration.service.ts`
- `src/modules/airbnb-email/domains/safe-reservation-enrichment.ts` (read-only policy)

### Guest registration capacity — pending

- `src/lib/guest-registration/guest-registration-capacity.ts`
- `tests/guests/guest-registration-capacity.test.ts`
