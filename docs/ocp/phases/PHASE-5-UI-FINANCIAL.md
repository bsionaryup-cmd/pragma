# OCP Phase 5 — UI Financial Consistency

**State:** FROZEN (commit pending)  
**Prerequisite:** Phase 1 FROZEN `3f459f6`

## Summary

`reservation-detail-panel.tsx`:
- Primary: ingreso anfitrión (`hostPayoutAmount` or `totalAmount`)
- Secondary: Pagado por huésped (only when distinct)
- Removed guest total as primary fallback

## Out of scope (documented)

- `reservation-card.tsx`, `upcoming-arrivals.tsx` — list shortcuts use stored `totalAmount` (host write path)
