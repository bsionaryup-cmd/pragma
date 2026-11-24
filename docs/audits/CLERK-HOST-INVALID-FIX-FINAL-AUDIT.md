# Clerk `host_invalid` — Informe final de corrección

**Fecha:** 2026-07-26  
**Estado:** Código corregido y validado en local + smoke de producción.  
**Deploy:** No desplegado en este ciclo (sin solicitud explícita; prod actual ya sano).

---

## 1. Causa raíz confirmada

| Hecho | Evidencia |
|-------|-----------|
| Producción sana | `GET https://www.pragmapms.com/__clerk/v1/environment` → **200** + `auth_config` |
| Fallo solo en localhost | Antes: `GET http://localhost:3000/__clerk/v1/environment` → **400** `host_invalid` |
| Trigger | Código forzaba proxy `/__clerk` con `pk_live` también en `npm run dev` |
| Mensaje engañoso | Clerk culpa a la Publishable Key; el rechazo es por **host** no atribuible a la instancia Production |
| Causa adicional (no proxy) | TLS a `clerk.www.pragmapms.com` / `clerk.pragmapms.com` **roto** → sin proxy, `pk_live` en local tampoco puede hablar con FAPI |

**Conclusión:** El error `host_invalid` en local se debía a usar el proxy same-origin de Clerk Production desde `localhost`. La solución correcta es: **nunca proxy en localhost**; **Development keys (`pk_test`/`sk_test`) en local**; **proxy solo en hosts desplegados (www / Vercel Preview)**.

---

## 2. Archivos modificados

| Archivo | Cambio |
|---------|--------|
| `src/lib/auth/clerk-proxy-config.ts` | **SSOT** nueva: `shouldProxyClerkFrontendApi`, `resolveClerkProviderProxyUrl`, `CLERK_PROXY_PATH` |
| `src/proxy.ts` | Único proxy: `frontendApiProxy.enabled(url)` via SSOT; handshake rewrite solo si proxy activo |
| `src/components/providers/clerk-root-provider.tsx` | Usa `resolveClerkProviderProxyUrl()` |
| `src/app/__clerk/[[...path]]/route.ts` | **Eliminado** (duplicaba `createFrontendApiProxyHandlers`) |
| `.env.example` | Documenta local=`pk_test`, sin proxy; prod/Preview=`/__clerk` |
| `scripts/dev.mjs` | Warning si detecta `pk_live` en local |
| `tests/auth/clerk-proxy-config.test.ts` | Cobertura unitaria de la política |

---

## 3. Justificación técnica

1. **Un solo mecanismo de proxy:** middleware `frontendApiProxy` de `@clerk/nextjs` (recomendado Next.js App Router / Next 16). Se eliminó la ruta App Router duplicada.
2. **Localhost nunca proxied:** evita `host_invalid` aunque alguien deje `pk_live` o `NEXT_PUBLIC_CLERK_PROXY_URL` en `.env.local` (`scripts/dev.mjs` también borra el env del proxy).
3. **Vercel Production + Preview:** `NODE_ENV=production` + hostname no local → proxy; `ClerkProvider` en SSR usa `VERCEL` para no activar proxy en `next start` local (evita hydration mismatch / `host_invalid`).
4. **Production behavior preserved:** www sigue con `proxyUrl=/__clerk` + middleware proxy + rewrite de handshake FAPI.

---

## 4. Pruebas ejecutadas

| Prueba | Resultado |
|--------|-----------|
| `npm run typecheck` | OK |
| `npm run lint` (archivos Clerk) | OK |
| `npm run build` | OK |
| `npm run verify:env` | OK |
| Unit: `clerk-proxy-config` + handshake rewrite | 10/10 (luego 7+4) OK |
| Prod `/__clerk/v1/environment` | **200**, `hostInvalid=false` |
| Prod `/sign-in` | **200**, `hasProxyAttr=true` |
| Local `/sign-in` (dev post-fix) | **200**, `hasProxyAttr=false`, sin `host_invalid` |
| Local `/__clerk/v1/environment` | **307** → sign-in (proxy off; **no** `host_invalid`) |

Evidencia: `docs/audits/evidence/clerk-host-invalid-fix-probes.json` + stdout del probe.

---

## 5. Pruebas funcionales — estado

### Localhost

| Caso | Estado |
|------|--------|
| App inicia | OK (`npm run dev`) |
| Clerk sin `host_invalid` | OK (proxy desactivado; HTML sin `data-clerk-proxy-url`) |
| Login / logout / refresh / rutas | **Bloqueado** mientras `.env.local` tenga `pk_live` — FAPI custom sin TLS; requiere `pk_test`/`sk_test` de Clerk **Development** |

El propio `scripts/dev.mjs` emite warning al arrancar con `pk_live`.

### Producción (despliegue actual, pre-este-diff)

Login/sesión/proxy: smoke OK (`/__clerk` 200, `/sign-in` con proxy). **Este diff no está en prod aún**; al desplegar, la política de proxy en hosts no locales es equivalente a la actual.

### Preview Vercel

Misma política que prod (`VERCEL` + hostname no local). Sin deploy de este branch no hay Preview nueva que re-probar; no se cambia el contrato de Preview.

---

## 6. Auditoría posterior (fase 6)

| Chequeo | Resultado |
|---------|-----------|
| Proxies duplicados | Eliminado route `__clerk`; queda solo middleware |
| Condición `pk_live` fuerza proxy | Eliminada |
| Variables obsoletas | `NEXT_PUBLIC_CLERK_PROXY_URL` opcional; no requerida en local |
| Inconsistencia Provider vs middleware | Unificada en `clerk-proxy-config.ts` |

---

## 7. Riesgos

| Riesgo | Mitigación |
|--------|------------|
| Local con `pk_live` sin login | Warning en `dev.mjs` + docs; usar Development keys |
| Self-host sin `VERCEL` | Set `NEXT_PUBLIC_CLERK_PROXY_URL=/__clerk` |
| Regresión prod al desplegar | Proxy sigue activo en www; build + smoke `/__clerk` post-deploy |

---

## 8. Criterios de éxito

| Criterio | Cumple |
|----------|--------|
| `host_invalid` eliminado en local (proxy) | **Sí** |
| Local inicia / HTML sin proxy | **Sí** |
| Prod smoke sin regresión (actual) | **Sí** |
| Compila / tsc / lint | **Sí** |
| Login local E2E | **Pendiente** de `pk_test`/`sk_test` en `.env.local` |
| Alineado Clerk + Next 16 | **Sí** (único `frontendApiProxy`) |

---

## 9. Acción requerida del operador

1. En [Clerk Dashboard](https://dashboard.clerk.com) → instancia **Development** → copiar `pk_test_…` y `sk_test_…` a `.env.local`.
2. Reiniciar `npm run dev`.
3. Verificar login/logout/refresh en localhost.
4. Cuando se pida deploy: desplegar este diff y re-smoke `https://www.pragmapms.com/__clerk/v1/environment` + login.
