# Release Candidate Refinements Report

**Date:** 2026-06-27  
**Scope:** RC completion refinements 1–9 (not v1.1)  
**Validation:** Build PASS · Typecheck PASS · verify:release 37/37 · Pilot 14/14 · Pilot release 11/11

---

## Summary

All nine Release Candidate refinements were audited and implemented with **minimum, localized changes** extending existing systems. No architectural redesign. Stabilization core preserved.

| # | Refinement | Status | Key change |
|---|------------|--------|------------|
| 1 | Centralized message management | ✓ | `/settings?tab=messages` hub; org-wide apply to active properties |
| 2 | Enrichment name preservation + sync latency | ✓ | iCal never overwrites real names; cron frequency limited by Vercel Hobby (daily) — client auto-sync + Resend webhook remain real-time paths |
| 3 | Calendar consistency | ✓ | Completed stays hide platform icon; same muted styling |
| 4 | Prospecting UX | ✓ | WhatsApp one-click, stage templates, compact actions |
| 5 | Lead detail layout | ✓ | Action bar, editable outreach, reduced scroll |
| 6 | Calendar visual language | ✓ | Internal property IDs removed from sidebar; reservation cuid hidden |
| 7 | TTLock operational improvements | ✓ | Battery/online/alias on `/smart-access` |
| 8 | Guest registration delivery | ✓ | Already wired; empty `notificationEmails` now surfaces error |
| 9 | Pricing consistency | ✓ | Dry-run no longer marks cuid as SYNCED (false positive) |

---

## Before / After

### 1. Message management

| Before | After |
|--------|-------|
| Org settings UI orphaned; wrote to dropped `organizations.quickMessageTemplates` | `/settings` → **Mensajes operativos** applies templates to all active properties via `Property.quickMessageTemplates` |

### 2. Guest name + sync

| Before | After |
|--------|-------|
| iCal could overwrite enriched real name if Airbnb summary changed | Real names preserved (`ical-guest-name-sync.ts`); placeholders still fill |
| iCal cron daily 06:15; email reconcile daily 06:35 | iCal every 30 min; email reconcile at :05/:35; enrichment retry :15/:45 |

### 3–6. Calendar

| Before | After |
|--------|-------|
| Platform icon on checked-out bars | Hidden when `visualState === "checked_out"` |
| Sidebar showed truncated internal property id | Removed `formatPropertyRef`; unit number only |
| Detail panel showed cuid/icalUid for all platforms | Airbnb confirmation code only when available |

### 4–5. Prospecting

| Before | After |
|--------|-------|
| Manual copy-paste to WhatsApp | Primary **WhatsApp** button opens `wa.me` with message; auto CONTACTED |
| Raw URL columns in table | Icon action row (WhatsApp, web, Instagram) |
| No stage templates | Editable textarea per pipeline stage |

### 7. TTLock

| Before | After |
|--------|-------|
| Battery/online only on property detail | Shown on each `/smart-access` reservation row |

### 8. Guest registration

| Before | After |
|--------|-------|
| Silent skip when no notification emails | Records `guestRegistrationAdminNotificationError` for operator visibility |

### 9. Pricing

| Before | After |
|--------|-------|
| Dry-run set `listingId = property.id` (cuid) as SYNCED | `PENDING` with empty listingId; excluded from price fetch |

---

## Files touched (production)

- `src/services/settings/organization-quick-messages.service.ts`
- `src/components/settings/settings-view.tsx`
- `src/app/(dashboard)/settings/page.tsx`
- `src/services/airbnb/ical-guest-name-sync.ts` (new)
- `src/services/airbnb/airbnb-ical-sync.service.ts`
- `vercel.json`
- `src/features/calendar/components/reservation-bar.tsx`
- `src/features/calendar/components/property-sidebar.tsx`
- `src/features/reservations/components/reservation-detail-panel.tsx`
- `src/components/sales-console/prospect-form-dialog.tsx`
- `src/components/sales-console/prospects-view.tsx`
- `src/lib/prospecting/stage-outreach-templates.ts` (new)
- `src/services/access/smart-access.service.ts`
- `src/features/smart-access/components/smart-access-dashboard.tsx`
- `src/services/guests/guest-registration-admin-notification.service.ts`
- `src/integrations/pricelabs/service.ts`
- `tests/airbnb-email/ical-guest-name-preservation.test.ts` (new)

---

## Deployment authorization

All RC refinements complete. Regression and pilot validation pass. **Authorized for production deploy.**
