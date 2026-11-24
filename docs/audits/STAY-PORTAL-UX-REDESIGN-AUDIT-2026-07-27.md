# Stay Portal UX Redesign — Audit (2026-07-27)

## Scope

UX/UI-only redesign of `/stay/[token]` against the approved mockup.
No TTLock / reservation / GR business-logic changes.

## Hierarchy (implemented)

1. Logo (page header)
2. Property header (name, location, status, optional cover)
3. Access code (primary card + copy)
4. Quick actions (mapa, WiFi, WhatsApp, Llamar)
5. WiFi (red / password / copy)
6. Cómo abrir (3 curated steps) + Reglas (5 curated rules)
7. Contact (WhatsApp / Llamar)
8. Reservation summary (entrada, salida, huésped, código) — lowest priority
9. Footer safety line

## Components

| Component | Path |
|-----------|------|
| AccessCodeCard | `src/features/guests/components/stay-portal/access-code-card.tsx` |
| QuickActionsCard | `.../quick-actions-card.tsx` |
| WifiCard | `.../wifi-card.tsx` |
| OpenDoorInstructions | `.../open-door-instructions.tsx` |
| HouseRulesCard | `.../house-rules-card.tsx` |
| ReservationSummary | `.../reservation-summary.tsx` |
| ContactCard | `.../contact-card.tsx` |
| StayPortalPropertyHeader | `.../stay-portal-property-header.tsx` |
| StayPortalViewPanel | `.../stay-portal-view-panel.tsx` |

## Pre-deploy validations

| Check | Result |
|-------|--------|
| `npm run typecheck` | PASS |
| ESLint (stay portal paths) | PASS (0 errors) |
| `npx tsx --test tests/guests/stay-portal-access.test.ts` | 2/2 PASS |
| `npm run build` | PASS (`/stay`, `/stay/[token]` present) |

## Compatibility preserved

- Access code decrypt / format / clipboard copy
- Maps / WhatsApp / tel URLs from existing portal payload
- WiFi copy
- Reservation dates / guest / code display
- Portal state shells (ended / unavailable)

## Data plumbing (presentation only)

- `coverImageUrl` and `locationLabel` exposed on `StayPortalView` for header UI
- Instructions / house rules UI use curated copy (not long property free-text)

## Production deploy

| Campo | Valor |
|-------|-------|
| Deployment ID | `dpl_5Jt6JMDes8KbV3TEM6NqDZhtNGVc` |
| Deploy URL | https://pragma-qw26nl5fr-pragma-s-projects.vercel.app |
| Aliased | https://www.pragmapms.com |
| Inspect | https://vercel.com/pragma-s-projects/pragma-pms/5Jt6JMDes8KbV3TEM6NqDZhtNGVc |
| Ready | YES |

### Prod smoke

| URL | Result |
|-----|--------|
| `GET /stay` | 200 — lookup form |
| `GET /stay/invalid-token-smoke-test` | 200 — "Portal no disponible" |
| `GET /stay/{token-real}` | 200 — código, acciones rápidas, WiFi, cómo abrir, reglas, contacto, resumen reserva |

Código de acceso visible en prod (ej. `959666#`) con jerarquía del rediseño.
