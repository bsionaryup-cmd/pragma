# Auditoría Forense — LOGIN stuck en "Ingresando…"

**Versión:** 1.0  
**Fecha:** 2026-07-25  
**Prioridad:** P0  
**Entorno inspeccionado:** https://www.pragmapms.com (`dpl_BmK967mbWyVV9WNyRMDgffPQbDbE`)

---

## 1. Diagnóstico

El botón de `/sign-in` queda en **"Ingresando…"** indefinidamente porque **Clerk JS nunca carga** en el navegador. El publishable key de producción embebe el Frontend API host `clerk.pragmapms.com`. Ese host:

1. Tiene CNAME correcto → `frontend-api.clerk.services`
2. **No sirve TLS/FAPI usable** (handshake SSL falla en Cloudflare; rutas caen en `DEPLOYMENT_NOT_FOUND` / fetch fallido)
3. Los scripts `clerk.browser.js` / `ui.browser.js` quedan con `transferSize: 0`
4. `window.Clerk` permanece `undefined`
5. El submit igual corre (bootstrap timeout 2.5s muestra el form) → `fetchStatus`/`pending` se quedan activos → UI "Ingresando…"

Punto exacto donde se detiene el flujo:

```
Usuario → Pantalla Login → submit → [BLOQUEO]
  clerk-js no carga desde clerk.pragmapms.com
  ⇒ signIn.password() / FAPI nunca completan
  ⇒ no hay setActive / finalize / middleware / dashboard
```

---

## 2. Causa raíz

| Capa | Hallazgo |
|------|----------|
| **Primaria (infra)** | Custom Frontend API `clerk.pragmapms.com` no está operativo (SSL / edge). Publishable key `pk_live_…` decodifica a `clerk.pragmapms.com$`. |
| **Amplificador (código)** | Clerk auto-proxy **solo** aplica a `*.vercel.app`, no a `www.pragmapms.com`. Sin `proxyUrl`, el cliente sigue yendo al host roto. |
| **Matcher** | El matcher de `proxy.ts` excluía `*.js`, así que aunque se activara `/__clerk`, los bundles `.../clerk.browser.js` **no** pasarían por middleware. |
| **Secundaria (post-auth)** | En HEAD, `finalize({ navigate })` hacía `if (session?.currentTask) return` sin fallback → tras password OK el usuario podía quedarse en `/sign-in` ("no abre"). |

**Archivos responsables (código):**

- `src/components/providers/clerk-root-provider.tsx` — faltaba `proxyUrl` en producción
- `src/proxy.ts` — proxy condicionaba a env; matcher sin `/__clerk/(.*)`
- `src/components/auth/email-password-sign-in-form.tsx` — skip navigate en `currentTask` (HEAD)

**No es regresión de lógica de negocio / permisos / Prisma.** Keys ya son `pk_live_` (corregido en ops previa). El middleware redirect a `/sign-in` (commit `45c5601`) funciona.

---

## 3. Evidencia (Fase 6 — Network)

Desde Chromium en `https://www.pragmapms.com/sign-in` tras submit:

| Request | Resultado |
|---------|-----------|
| `https://clerk.pragmapms.com/npm/@clerk/clerk-js@6/dist/clerk.browser.js` | `transferSize: 0` (reintentos) |
| `https://clerk.pragmapms.com/v1/environment` | `transferSize: 0` / Failed to fetch |
| UI | `btnText: "Ingresando…"`, `window.Clerk: undefined`, sin mensaje de error tras 8s+ |

DNS (Google DoH): CNAME OK. TLS a Cloudflare IP: handshake fatal. Curl local a veces resuelve IPs que responden `Server: Vercel` + `DEPLOYMENT_NOT_FOUND`.

---

## 4. Corrección realizada

Mínima, sin reescribir auth ni cambiar dependencias:

1. **Producción usa FAPI proxy same-origin `/__clerk`**  
   - `ClerkProvider` recibe `proxyUrl="/__clerk"` en production  
   - `clerkMiddleware({ frontendApiProxy: { enabled: true } })` en production  
   - Los scripts pasan a `/__clerk/npm/@clerk/...` (host app, SSL válido)  
   - El proxy reenvía a FAPI canónico de Clerk (no al CNAME roto)

2. **Matcher incluye `/__clerk/(.*)`** para no excluir `*.js` del proxy

3. **Finalize siempre navega** + fallback `window.location.assign` (evita hang post-password por `currentTask`)

4. **`redirect_url`** aceptado en sign-in (middleware ya lo envía)

---

## 5. Archivos modificados

| Archivo | Cambio |
|---------|--------|
| `src/proxy.ts` | Proxy FAPI en production; matcher `/__clerk/(.*)` |
| `src/components/providers/clerk-root-provider.tsx` | `proxyUrl` en production |
| `src/components/auth/email-password-sign-in-form.tsx` | finalize siempre navega; lee `redirect_url` |
| `src/app/(auth)/sign-in/[[...sign-in]]/page.tsx` | acepta `redirect_url` |
| `src/components/owner/owner-login-form.tsx` | misma pila SignInFuture + finalize (ya en WIP) |
| `src/lib/clerk-dev-origins.ts` | orígenes canónicos prod (WIP previo) |
| `.env.example` | nota de proxy |
| `docs/audits/LOGIN-FORENSIC-AUDIT-V1.md` | este informe |

## 6. Archivos no modificados

Arquitectura Clerk, permisos, multitenancy, Prisma, dashboard modules, APIs de negocio, versiones de dependencias: **intactos**.

---

## 7. Riesgo residual

| Riesgo | Nivel | Nota |
|--------|-------|------|
| Proxy FAPI en prod | Bajo | Patrón oficial Clerk; ya scaffolded |
| Custom domain `clerk.*` sigue roto | Medio ops | Login ya no depende de él; conviene completar SSL en Clerk Dashboard o retirar el CNAME custom |
| Registrar `proxy_url` en Clerk Dashboard | Bajo–Medio | Recomendado tras deploy para handshake completo; el middleware ya envía `Clerk-Proxy-Url` + secret |

---

## 8. Validaciones

| Check | Resultado |
|-------|-----------|
| ESLint (archivos auth tocados) | **PASS** (0 issues) |
| `npm run lint` (repo completo) | **WARN** — 230 issues preexistentes no relacionados con auth |
| `npm run typecheck` | **PASS** (tras limpiar `.next/types` stale de rutas intienda eliminadas) |
| `npm run build` | **PASS** (exit 0, incluye `/sign-in`, Proxy middleware) |

Pruebas funcionales post-deploy (requieren aprobación de deploy):

- [ ] Login tenant correcto → dashboard
- [ ] Credenciales inválidas → error (no hang)
- [ ] Owner login
- [ ] Logout + re-login
- [ ] Refresh con sesión
- [ ] Network: scripts desde `/__clerk/npm/...` (200), no desde `clerk.pragmapms.com`

---

## 9. Estado final

**PASS WITH WARNINGS** (código listo; cierre total tras deploy + smoke login).

Warning: completar SSL del custom domain Clerk o dejar solo el proxy (ops).

**Deploy:** no automático — esperar aprobación explícita del propietario.
