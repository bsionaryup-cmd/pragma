# PRAGMA PMS — Final Production Deploy Report V1

**Fecha:** 2026-07-17  
**Release:** `v1.1.0`  
**Alcance:** AI Concierge (canal nativo + extensión) + Guest Registration Universal Airbnb  
**Estado final:** ✅ RELEASE COMPLETADO · PRODUCCIÓN OPERATIVA

---

## 1. Resumen ejecutivo

Se revalidó el gate técnico, se generó el Release `v1.1.0`, se configuró
`CONCIERGE_EXTENSION_SECRET` en Vercel Production, se confirmó el schema de
producción al día, se desplegó a `www.pragmapms.com` y se validó post-deploy.

Durante el primer intento de deploy apareció un defecto real de empaquetado
(`.vercelignore` con patrón `data/` demasiado amplio). Se aplicó el protocolo
PRAGMA, se corrigió con el cambio de menor impacto (`/data/` solo en raíz), se
movió el tag `v1.1.0` al commit deployable y se redesplegó con éxito.

---

## 2. Auditoría final pre-Release

| Control | Resultado |
|---|---|
| Typecheck | PASS |
| Build local | PASS (Next.js 16.2.6) |
| Tests | PASS **559/559** (166 suites) |
| Release Readiness | PASS **37/37** |
| Guest Registration integración real | PASS **4/4** |
| Security Gate previo | 0 Critical · 0 High (`FINAL-RELEASE-GATE-AUDIT-V1.md`) |
| Regresiones | No detectadas |

Smoke local previo:

- `GET /guest-registration` → 200  
- `GET /api/concierge/health` sin auth → 401  

Producción previa al deploy:

- `GET https://www.pragmapms.com/guest-registration` → **404** (ruta aún no existía)

---

## 3. Alcance del Release (shippable)

Incluido:

- Canal AI Concierge (APIs, auth HMAC, dashboard, tools, extensión)
- Guest Registration universal (`/guest-registration` + resolver + hardening)
- Migraciones Prisma Concierge nativas
- Tests y auditorías de evidencia del Release
- `.vercelignore` (excluye probes/e2e/cron de prueba)
- Remoción de hosts ngrok del manifest/extensión (guardrail M5)

Excluido deliberadamente:

- `data/` financiero local
- scripts `_audit` / `_lat` / probes temporales
- cron e2e `guest-registration-admin-notify-e2e`
- probes de layout nav
- screenshots de marketing no relacionados
- docs/scripts ajenos al Release

---

## 4. Defecto encontrado en el primer deploy

### Reproducción

`vercel deploy --prod` falló en Typecheck remoto:

`Cannot find module '@/features/sales-console/data/mock-analytics'`

### Causa raíz

`.vercelignore` contenía el patrón `data/`, que en semántica tipo gitignore
excluye **cualquier** carpeta `data/` del upload, incluyendo
`src/features/sales-console/data/`.

### Alternativas

1. Eliminar `.vercelignore` — mayor riesgo de subir probes/e2e.  
2. Renombrar carpetas `data` de features — impacto alto innecesario.  
3. Acotar a `/data/` (solo raíz del repo) — **menor impacto**.

### Solución elegida

Opción 3. Commit `b50821a`.

### Reauditoría

Redeploy → Build PASS → rutas `/guest-registration` y `/ai-concierge` presentes  
Cron e2e **no** aparece en el manifiesto de rutas de producción.

---

## 5. Commit · Tag · Deploy

| Campo | Valor |
|---|---|
| Commit de Release | `178929fc35caa52715bcd41800732f2d3d5e9819` |
| Commit fix deploy | `b50821a` (tag apuntando aquí) |
| Mensaje Release | `release(v1.1.0): AI Concierge native channel and Airbnb universal Guest Registration` |
| Branch | `cursor/apify-prospecting-engine` |
| Tag | **`v1.1.0`** → `b50821a` |
| Deployment ID | `dpl_CM2S4xveCur73Sc4UYyAcCaAow7w` |
| URL deployment | https://pragma-9i2ykibw4-pragma-s-projects.vercel.app |
| Alias producción | **https://www.pragmapms.com** |
| Inspect | https://vercel.com/pragma-s-projects/pragma-pms/CM2S4xveCur73Sc4UYyAcCaAow7w |
| Estado | **READY** |

### Variables / secretos

| Variable | Acción |
|---|---|
| `CONCIERGE_EXTENSION_SECRET` | **Añadida** a Vercel Production (antes ausente; sin ella el canal responde 503) |
| `DATABASE_URL` / Clerk / `CRON_SECRET` | Ya presentes en Production |
| Migraciones Prisma | `migrate deploy` → **Database schema is up to date** (77 migraciones; sin pendientes) |

---

## 6. Validación Post Deploy

Evidencia: `docs/audits/evidence/post-deploy-v1.1.0-smoke.json`

| Verificación | HTTP / resultado |
|---|---|
| `/` | 200 |
| `/sign-in` | 200 |
| `/guest-registration` | **200** (antes 404) |
| Formulario universal visible (“Código de reserva de Airbnb”) | PASS |
| `/guest-registration/[token]` inválido | 200 (página pública manejada) |
| `/api/concierge/health` sin auth | **401** `{"error":"Unauthorized"}` (secret activo; no 503) |
| Bearer 2-seg inválido → health | **401** |
| `/api/concierge/heartbeat` POST sin auth | **401** |
| `/api/concierge/heartbeat` GET | 405 (solo POST; esperado) |
| `/api/integrations/ttlock/callback` | 200 |
| `/panel`, `/ai-concierge`, `/reservations`, `/calendar`, `/novedades` sin sesión | 404 auth-gated (comportamiento Clerk prod documentado) |
| Resolver GR integración (DB) | PASS **4/4** post-deploy |

Confirmaciones funcionales:

- Guest Registration Universal **operativo en producción**.  
- AI Concierge APIs **operativas** (auth Bearer exigido).  
- Extensión: recargar/sideload build `v1.1.0` sin ngrok; re-vincular desde `/ai-concierge`.  
- TTLock callback reachable.  
- Cron e2e **no** desplegado.

---

## 7. Seguridad post-deploy

| Control | Estado |
|---|---|
| Critical / High nuevos | Ninguno |
| Multi-tenant Concierge (token + link binding) | Intact |
| GR universal rate limit + errores genéricos | Intact |
| Ngrok removido del manifest | Confirmado en Release |
| Allowlist / Autonomous Medium | Aceptados; operar Concierge en Manual/Assisted al inicio |
| Rate limit GR process-local | Aceptado; recomendar WAF edge |

---

## 8. Riesgos Medium aceptados (sin cambio)

1. Code-only Airbnb GR (bearer por diseño).  
2. Rate limiting GR por instancia.  
3. Allowlist Concierge incompleta en algunas tools.  
4. Autonomous `mayAutoSend` amplio — **no habilitar Autonomous** hasta política de secretos.  
5. (Mitigado parcialmente) Manifest ngrok — **eliminado** en este Release.

---

## 9. Observabilidad / monitoreo 24 h

Monitorear:

- heartbeats de extensión  
- `[airbnb-universal-access] rate_limited`  
- turnos Concierge / errores 401/423  
- Guest Registration → TTLock → correos  
- logs Vercel sin errores críticos de build/runtime  

Si aparece incidente Critical/High: protocolo PRAGMA inmediato; no iterar features.

---

## 10. Conclusión

### ✅ RELEASE COMPLETADO · PRODUCCIÓN OPERATIVA

Evidencia verificable:

- Typecheck / Build / Tests 559 / Release Readiness PASS  
- Seguridad sin Critical/High  
- Sin regresiones detectadas en la suite  
- Guest Registration Universal en producción (200 + formulario)  
- AI Concierge APIs en producción (401 sin Bearer; secret configurado)  
- Deploy READY en `www.pragmapms.com`  
- Tag `v1.1.0`  
- Post-deploy smoke + integración GR 4/4 PASS  

**Guardrails operativos inmediatos:**

1. Extensión: recargar build sin ngrok y re-parear.  
2. Concierge: iniciar en **Manual** o **Assisted**.  
3. Configurar `allowedTools` / `allowedPropertyIds` por tenant.  
4. Programar WAF/throttle en `/guest-registration` a escala.
