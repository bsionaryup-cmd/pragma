# AUTH P0 — Login único + logout completo · Informe pre-deploy

**Fecha:** 2026-07-30  
**Deploy:** `dpl_8gZUW52Jx74HMDXaAFz6k1e8AHq2` → https://www.pragmapms.com (2026-07-30)  
**Alias prod actual:** https://www.pragmapms.com

---

## 1. Causa raíz del problema del logout

Owner (y algunos botones) llamaban `signOut({ redirectUrl: "/owner-login" })` **sin** `?signed_out=1`.  
El formulario owner **no** ejecutaba cleanup residual. Clerk dejaba cookies/`isSignedIn` vivos → reutilización al volver.

## 2. Causa raíz de dos páginas de login

Diseño de producto (no bug): `/sign-in` (tenant) vs `/owner-login` (platform), bifurcado por middleware.  
Misma stack Clerk; diferencia de UX y destino post-auth.

## 3. Causa raíz del mensaje «Ya hay una sesión…»

Copy **propia** de PRAGMA (`EmailPasswordSignInForm`), no de Clerk.  
Se muestra cuando hay sesión viva (`isSignedIn` / `serverSessionActive`) **sin** `clearStaleSession`.  
Tras logout incompleto, Clerk seguía firmado → banner + a veces `activateExistingSession`.

## 4. Archivos modificados (principales)

| Área | Archivos |
|------|----------|
| Login único | `src/app/(auth)/login/page.tsx` (nuevo); `/sign-in` y `/owner-login` → redirect |
| Paths | `src/lib/auth/auth-paths.ts`, constants platform/middleware, `APP_SIGN_IN_PATH` |
| Logout | `src/lib/auth/full-sign-out.ts`; menus Owner/tenant; `ClerkSignOutButton`; provider; error boundary |
| Middleware | `src/proxy.ts`, `clerk-incomplete-session-bridge.ts`, `lib/auth.ts` |
| Anti-reuse | `email-password-sign-in-form.tsx` (no activate/banner con `signed_out`) |
| Tests | `tests/auth/clerk-incomplete-session-bridge.test.ts`, `unified-login-paths.test.ts` |
| Docs | `docs/audits/AUTH-UNIFIED-LOGIN-LOGOUT-P0-PHASE1.md`, este informe |

## 5. Componentes reutilizados

- `EmailPasswordSignInForm` (único formulario)
- `PragmaAuthLayout`, `ClerkProvider`, `resolvePostAuthHomePath` / `resolvePostAuthHomePathForUser`
- Settle-bridge / `establish-session` (sin reescritura de contrato de cookies `__session`)

## 6. Riesgos identificados

| Riesgo | Nivel |
|--------|-------|
| Clerk Dashboard aún apunta a `/sign-in` | Medio — aliases redirigen |
| Bounce loop si se limpia sesión en cada visita a `/login` | Alto si se regresa — mitigado con solo `?signed_out=1` |
| `.env.local` con `SIGN_IN_URL=/sign-in` | Bajo — provider hardcodea `/login` |
| Retail/INTIENDAS links legacy | Bajo — redirect a `/login` |

## 7. Riesgos mitigados

- Logout unificado → `/login?signed_out=1` + expire `__client_uat*`
- Sin `activateExistingSession` tras logout explícito
- Alias `/sign-in` y `/owner-login` preservan bookmarks
- No se tocaron Organizations, Roles Prisma, ni matrices de permisos

## 8. Resultado de pruebas

| Check | Resultado |
|-------|-----------|
| `prisma validate` | OK |
| Auth unit tests (bridge + paths + proxy-config) | Pass |
| ESLint archivos tocados | Pass |
| `tsc --noEmit` | Pass |
| `next build` | Pass (`/login` en rutas) |
| E2E browser Owner/Admin/Receptionist | Manual pendiente (local/prod post-OK) |

## 9. Confirmación de ausencia de regresiones (código)

- Post-auth por rol **sin** nuevo dashboard: Owner → `/owner-dashboard`; Admin/Receptionist → `/panel` (ACL intacta)
- Handshake settle-bridge sigue evitando redirect loops
- No cambios en impersonación / billing redirect logic salvo path de login

## 10. Mantenimiento futuro

1. En Clerk Dashboard (al desplegar): Sign-in URL = `/login`.  
2. Nunca llamar `signOut` en montaje de `/login` sin `signed_out=1`.  
3. Todos los menús de logout deben usar `performFullSignOut` / `APP_SIGNED_OUT_LOGIN_PATH`.  
4. No reintroducir un segundo formulario owner.

---

## Checklist pre-deploy

- [x] Implementación login único + logout  
- [x] Auditoría + informe 10 puntos  
- [x] Aprobación owner  
- [ ] Actualizar Clerk Dashboard Sign-in URL (recomendado: `/login`)  
- [x] `npx vercel --prod` (`dpl_8gZUW52Jx74HMDXaAFz6k1e8AHq2`)  
- [x] Smoke prod: `/` 200, `/login` 200, `/sign-in`→`/login`, `/owner-login`→`/login`, protegidas → `/login?redirect_url=…`  

**Smoke manual restante:** login/logout Owner + tenant en navegador (sin banner residual).
