# Post-Deploy — INTIENDAS Help Center + Password Flows

**Date:** 2026-07-14  
**Commit:** `133af7c076296080e499b0bd8f64aa7be52a6d65` (`133af7c`)  
**Branch:** `main` (fast-forward)  
**Deployment ID:** `dpl_4uGySvN8mBRUrXcbzzv7uki3UZtM`

## Production

| Item | Value |
|------|-------|
| Alias | https://www.pragmapms.com |
| Deployment | https://pragma-6zwrqn6c5-pragma-s-projects.vercel.app |
| Inspect | https://vercel.com/pragma-s-projects/pragma-pms/4uGySvN8mBRUrXcbzzv7uki3UZtM |
| readyState | READY |

## Smoke (unauthenticated)

| Route | Result |
|-------|--------|
| `/` | 200 PASS |
| `/intiendas/login` | 200 PASS |
| `/intiendas/login/recuperar` | 200 PASS |
| `/sign-in` | 200 PASS |
| `/intiendas/configuracion` | 307 → login PASS |
| `/intiendas/configuracion/ayuda` | 307 → login PASS |
| `/intiendas/configuracion/seguridad` | 307 → login PASS |
| `/owner-dashboard/salud` | 307 → auth PASS |

## Verdict

**Operativo.** Help Center y flujos de contraseña en producción desde `main`. Smoke INTIENDAS/auth **PASS**. Build Vercel **READY**. Sin regresiones detectadas en las superficies validadas de este deploy.
