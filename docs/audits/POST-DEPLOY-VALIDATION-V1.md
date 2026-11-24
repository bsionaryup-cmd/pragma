# PRAGMA PMS — Post-Deploy Validation V1

**Release:** `v1.2.0`  
**Fecha:** 2026-07-18  
**Commit:** `83cfaac`  
**Tag:** `v1.2.0`  
**Deployment:** `dpl_GYceYvAnoJCi69zT18NwsvtBKtbK`  
**Producción:** https://www.pragmapms.com  
**Estado:** **PASS — DESPLIEGUE CONCLUIDO**

---

## 1. Release ejecutado

| Paso | Resultado |
|------|-----------|
| Certificación `PRAGMA-PRODUCTION-CERTIFICATION-V1.md` | GO |
| Commit RC | `83cfaac` |
| Tag | `v1.2.0` |
| Push branch + tag | PASS |
| `vercel deploy --prod` | PASS · aliased `www.pragmapms.com` |
| `prisma migrate status` | Database schema is up to date (78 migrations) |

---

## 2. Smoke Test Post Deploy

Evidencia HTTP: `docs/audits/evidence/post-deploy-v1.2.0-smoke.json`  
Evidencia Airbnb: `docs/audits/evidence/post-deploy-v1.2.0-airbnb-resolve.json`

| Superficie | Resultado | Evidencia |
|------------|-----------|-----------|
| Login (`/sign-in`) | PASS 200 | smoke JSON |
| Home / marketing | PASS 200 | smoke JSON |
| Guest Registration universal | PASS 200 + `reservationCode` en body | smoke JSON |
| Link Universal Airbnb resolve (DB) | PASS `HM5JC2HP5S` → `active` | airbnb-resolve JSON |
| AI Concierge health sin auth | PASS 401 (esperado) | smoke JSON |
| Dashboard / Calendario / Reservas / TTLock / Correos | Requieren sesión Clerk; no regresiones de código en este release; rutas deployadas en build | build prod Vercel |
| `robots.txt` | 404 preexistente (no introducido por v1.2.0) | Medium aceptado / fuera de alcance GR |

**Veredicto smoke (alcance Release):** **PASS**

---

## 3. Confirmaciones expresas

- Guest Registration canónico + jurídico desplegado.  
- Sin riesgos Critical/High abiertos.  
- Flujo Airbnb código → resolve operativo en producción.  
- Schema BD al día con migración legal canónica.  
- Módulos congelados no modificados en el commit de release.

---

## 4. Cierre

El despliegue de **v1.2.0** se considera **concluido**: smoke post-deploy **PASS** para el alcance del Release Candidate Final de Guest Registration.
