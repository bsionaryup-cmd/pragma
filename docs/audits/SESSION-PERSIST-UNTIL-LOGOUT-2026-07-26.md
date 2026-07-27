# Persistencia de sesión — cierre solo por logout explícito (2026-07-26)

## Objetivo

La sesión Clerk debe permanecer abierta hasta que el usuario pulse **Cerrar sesión**. El sistema no debe destruir la sesión por sí solo.

## Causa de “cierre automático”

No había un `signOut()` periódico en el PMS. Lo que se percibe como logout es:

1. JWT corto (`__session` ~60s) expira.
2. Navegación/RSC llega al middleware sin token usable.
3. Handshake Clerk apunta a FAPI custom con TLS roto.
4. Respuesta con `Expires=1970` **borra cookies**.
5. Middleware redirige a `/sign-in` → parece logout.

Además, `/intiendas/login` hacía `signOut()` al cargar si ya había sesión (destruía la sesión del PMS al abrir INTIENDAS).

## Cambios

| Cambio | Archivo |
|--------|---------|
| Keep-alive: `getToken({ skipCache })` + `session.touch()` cada 45s y al volver a la pestaña | `clerk-session-keepalive.tsx` |
| Montado en dashboard, owner-dashboard e INTIENDAS app | layouts correspondientes |
| INTIENDAS: `signOut` solo con `?signed_out=1` | `retail-password-sign-in-form.tsx` |
| INTIENDAS: post-login vía `settleClerkSessionThenGo` | mismo |
| Ya existentes: `/auth/continue`, rewrite handshake → `/__clerk` | sin regresión |

## Ops (Clerk Dashboard)

Subir **Session JWT lifetime** (recomendado ≥ 10 minutos) en la instancia Production para reducir handshakes. El keep-alive mitiga el valor corto por defecto (~60s).

## Criterio de éxito

- Login → permanece en `/panel` / `/calendar`.
- Hard refresh y cambio de módulo tras varios minutos → sigue autenticado.
- Logout solo desde el menú de usuario / botón Cerrar sesión.
