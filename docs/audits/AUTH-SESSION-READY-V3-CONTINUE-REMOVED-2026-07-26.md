# Auth session-ready-v3 — sin atrapar en `/auth/continue` (2026-07-26)

## Problema reportado

Usuario en https://www.pragmapms.com/auth/continue?next=%2Fpanel — “Activando tu sesión…” sin entrar al panel.

Requisito: solo `/sign-in` (y `/owner-login`); tras login → `/panel`; sesión estable hasta logout explícito.

## Evidencia

| Hecho | Dato |
|-------|------|
| HTML prod | `data-clerk-proxy-url="/__clerk"` (**relativo**) |
| Commit previo | Absolute `https://www.pragmapms.com/__clerk` requerido para cookies |
| Happy path roto | `/sign-in` con `userId` hacía `redirect(/auth/continue)` |
| Continue | Esperaba `session-ready` que no llegaba → pantalla infinita |

## Causa

1. `proxyUrl` relativo → cookie `__session` no alineada con host → server nunca ve sesión.
2. Flujo mandaba a `/auth/continue` como “puente” y el usuario quedaba atrapado ahí.

## Fix (v3)

1. `resolveClerkProviderProxyUrl()` → **URL absoluta** (`origin/__clerk` en browser; www en SSR Vercel).
2. Ya autenticado en `/sign-in` / `/owner-login` → `PostAuthSessionGate` (settle → panel), **sin** continue.
3. Settle-bridge UAT incompleto → `/sign-in?sync=1` (o owner-login), no continue.
4. `/auth/continue` legacy → redirect a `/sign-in?sync=1`.
5. Marker `session-ready-v3`.

## Validación manual

1. Ventana privada → `/sign-in` → login → `/panel` (sin quedar en continue).
2. Refresh, módulos, nueva pestaña.
3. Logout → login de nuevo.
