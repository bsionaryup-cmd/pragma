# Auth P0 — Fase 1 Auditoría (Login único + logout)

**Fecha:** 2026-07-30  
**Deploy:** HOLD (sin producción hasta informe final + OK owner)

## Causas raíz

| Síntoma | Causa raíz |
|---------|------------|
| Logout incompleto (Owner) | `signOut` → `/owner-login` sin `?signed_out=1`; form owner no limpia sesión residual |
| Dos páginas de login | Diseño producto: `/sign-in` (tenant) vs `/owner-login` (platform); middleware bifurca |
| «Ya hay una sesión en este navegador» | Copy propia en `EmailPasswordSignInForm` cuando Clerk sigue `isSignedIn` sin `clearStaleSession` |
| Redirect por rol | Ya existe `resolvePostAuthHomePath` — no es un gap |

## Superficies (pre-cambio)

- Tenant: `/sign-in` → `EmailPasswordSignInForm`
- Owner: `/owner-login` → `OwnerLoginForm` (email locked)
- Middleware: `src/proxy.ts` (Clerk)
- Provider: `ClerkRootProvider` `afterSignOutUrl=/sign-in?signed_out=1`

## Plan de corrección

Ver implementación: `/login` único, logout → `/login?signed_out=1`, aliases `/sign-in` y `/owner-login`.
