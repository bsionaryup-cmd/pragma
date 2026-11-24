# Production outage — Tarifas deploy rollback — 2026-07-29

## Symptom
Dashboard routes (`/revenue`, `/calendar`, `/properties`, `/finance`, …) returned **HTTP 404** on `www.pragmapms.com`. Home and `/sign-in` still worked.

## Evidence
- Response headers on broken deploy (`dpl_HLXzZmx36cwzyF5anGZbA3w56apc`):
  - `X-Clerk-Auth-Reason: protect-rewrite, session-token-and-uat-missing`
  - `X-Matched-Path: /_not-found`
- Logs also showed `/__clerk/...` 404 and Prisma schema drift (`tasks` table missing) from stale app vs current DB.

## Root cause
CLI prod deploy was built from **stale `origin/main`** (`458003a`) + Tarifas-only patches.

That rolled production **backwards**:
1. Old `src/proxy.ts` used `auth.protect()` for signed-out dashboard traffic → Clerk **protect-rewrite to `/_not-found`** (404) instead of redirect to `/sign-in`.
2. Older Clerk proxy / app surface vs current production DB and auth wiring.

Tarifas UI changes were not the primary breakage; **shipping from outdated main** was.

## Fix applied (no further code change on prod)
```text
vercel rollback pragma-2cbmrrtrm-pragma-s-projects.vercel.app --yes
```
Restored: `dpl_BHPgmZeXyyKUoze7PLnLEKWTKhn4` (alias `www.pragmapms.com`).

## Post-rollback smoke
| Path | Result |
|------|--------|
| `/` | 200 |
| `/revenue` | 307 → `/sign-in?redirect_url=%2Frevenue` |
| `/calendar` | 307 → sign-in |
| `/properties` | 307 → sign-in |
| `/sign-in` | 200 |

## Rule for next Tarifas deploy
Do **not** deploy from stale `main`. Rebase Tarifas onto the **current production commit/deployment codebase**, verify proxy redirects (not `auth.protect()` 404), then deploy.
