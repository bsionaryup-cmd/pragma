# OCP Baseline — TTLock Operational Access

**Date:** 2026-08-14  
**Domain:** TTLock operational/ad-hoc access codes  
**State before change:** OPEN  
**Branch:** `cursor/apify-prospecting-engine`  
**HEAD:** `06d88c3`

## Objective

Add property-scoped TTLock passcodes for cleaners, maintenance staff, owners, or
other temporary visitors without requiring or modifying a reservation, Guest
Registration, Stay Portal, or reservation email workflow.

## Protected existing behavior

- Reservation passcodes remain owned by
  `generateAccessCodeForReservation`.
- Guest Registration continues to call
  `processReservationAccessAfterRegistration`.
- A passcode is never persisted as generated unless TTLock returns a real
  `keyboardPwdId`.
- Existing reservation credentials, messages, delivery, and checkout purge
  remain unchanged.
- Tenant scope and `access:manage` authorization remain mandatory.

## Baseline measurements

| Check | Result |
|---|---|
| `npm run typecheck` | PASS |
| TTLock integrity + guest-message tests | 5/5 PASS |
| Operational credential model | Not present |
| Operational create/list/revoke UI | Not present |
| Reservation-independent passcode service | Not present |

## Existing scoped working-tree changes

The repository already had unrelated/uncommitted changes before this phase.
In particular, these target-adjacent files were modified and must be preserved:

- `prisma/schema.prisma`: Digital Receptionist models and
  `AccessEventType.WINDOW_ADJUSTED`.
- `src/services/integrations/ttlock/ttlock-access.service.ts`: reservation
  access-window adjustment.
- `src/features/smart-access/actions/smart-access.actions.ts`: reservation
  access-window action.
- `src/features/smart-access/components/smart-access-dashboard.tsx`: reservation
  access-window UI.

This phase is additive and must not revert or rewrite those changes.

## Initial architecture decision

Use a separate operational credential model and service. Reuse only the
existing TTLock API client, session resolution, lock mapping, encryption, and
tenant authorization primitives. Do not make `AccessCredential.reservationId`
optional and do not relax Guest Registration checks.

