# Post-Deploy Report — INTIENDAS RC + Intelligence + Hardenings

**Date:** 2026-07-13  
**Authorize:** Owner explicit (“APROBADO … Y HACER DEPLOY”)  
**Branch:** `cursor/apify-prospecting-engine`  
**Commits:** `1ced822` (release), `cd57a28` (cron Hobby fix)

---

## Production

| Item | Value |
|------|-------|
| Status | **READY** |
| Alias | https://www.pragmapms.com |
| Deployment | https://pragma-o6v18tb0c-pragma-s-projects.vercel.app |
| Inspect | https://vercel.com/pragma-s-projects/pragma-pms/9Q2wfDjjUuBs2ZtowxZtnGC7C5zx |
| Deployment ID | `dpl_9Q2wfDjjUuBs2ZtowxZtnGC7C5zx` |

## Preflight

| Check | Result |
|-------|--------|
| Prisma migrate deploy | No pending (72 migrations) |
| Critical tests | 32/32 PASS |
| Build (Vercel) | PASS |

## Deploy blocker resolved

Hobby plan rejected hourly cron `0 * * * *` for `/api/cron/retail-intel-outbox`.  
**Fix:** daily `0 8 * * *` (08:00 UTC). Intelligence still drains; frequency reduced vs hourly.

## Smoke (post-alias)

Validate manually:

- https://www.pragmapms.com/intiendas/login
- POS / Caja / Pedidos with pilot store session
- Owner Dashboard → QR Mobility / INTIENDAS admin

## Notes

- Production shipped from feature branch via `vercel --prod` (not merged to `main`).
- Remaining local WIP (audit scripts, screenshots, data/) not included.
