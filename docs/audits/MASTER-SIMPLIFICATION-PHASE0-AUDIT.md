# PRAGMA PMS — Plan Maestro Simplificación — Fase 0 Audit

**Date:** 2026-07-26  
**Status:** COMPLETE — execution may proceed  
**Constraint:** No production data mutations; calendar/auth/multi-tenant/finance calcs intact.

## Execution order (impact-driven, not phase number)

| Order | Phase | Reason |
|-------|-------|--------|
| 1 | **2 AI Concierge** | Self-contained; consumes inbox-ai; writes Task. Remove first. |
| 2 | **1 Inbox + Bandeja** | `/inbox` + `/novedades` + inbox-ai. Keep `reservation_activity*`. |
| 3 | **5 Tasks UI** | After Concierge (no more `db.task.create`). Keep `AirbnbEmailTask`. |
| 4 | **3 Reservations UI** | Remove `/reservations` nav/pages; add calendar guest/code search. |
| 5 | **4 Hoy** | Redesign panel; retarget links to `/calendar`. |
| 6 | **6 Finanzas UI** | Surface create forms; no calc changes. |
| 7 | **7 Propiedades** | Remove default messages UI; fix accommodationType mapping. |
| 8 | **8–10** | Dead code, tests, final audit, READY. |

## Must KEEP (SSOT)

- `Reservation` model + calendar + finance attribution
- Clerk auth / proxy / multi-tenant
- TTLock, iCal, PriceLabs, Wompi, SIRE, TRA, guest registration
- `AirbnbEmailTask` (email pipeline)
- Finance calc libs under `src/lib/finance/**` and finance services

## Must DELETE (product surfaces)

- Inbox legacy + Bandeja `/novedades` + Inbox AI drafts
- AI Concierge extension + modules + APIs + Prisma concierge/assistant tables
- Tasks module UI (+ optional `Task` model after call-site cleanup)
- `/reservations` list UI (not reservation data)
- Default/quick message settings UI (Phase 7)
- Dead flags `INBOX_ENABLED` / `TASKS_ENABLED` (never wired)

## Evidence sources

Explore audits 2026-07-26: Inbox, Concierge, Tasks/Reservations/Hoy/Messages, Finance/Nav.
