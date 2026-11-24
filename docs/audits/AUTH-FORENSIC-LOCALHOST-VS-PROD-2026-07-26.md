# Auditoría forense login — localhost OK / producción NO (2026-07-26)

## Pregunta del owner

¿Por qué en localhost inicia sesión bien y en producción no? ¿Es Clerk o PRAGMA?

## Respuesta corta

**El login de Clerk en el navegador SÍ funciona en producción.**  
Lo que falla es **cómo PRAGMA deja (o no deja) la cookie de sesión en `www.pragmapms.com`** antes de entrar a `/panel`.

En local no hay proxy ni cookies “sufijadas” de producción → funciona.  
En prod hay proxy + cookies Clerk con nombre `__session_<hash>` → nuestro `establish-session` escribe solo `__session` (sin sufijo) → el servidor **no la lee** → handshake / bounce a `/sign-in`.

## Diferencia clave

| | Localhost | Producción |
|---|---|---|
| Keys | `pk_test` / `sk_test` | `pk_live` / `sk_live` |
| Proxy `/__clerk` | **Apagado** | **Obligatorio** (FAPI custom con TLS roto) |
| Cookies | Simples `__session` | A menudo **`__session_<sufijo>`** |
| Resultado | Cookie leída → panel | Cookie ignorada → no entra |

## Cadena del fallo (producción)

1. Usuario pone correo/contraseña → Clerk OK (cliente tiene JWT).
2. PRAGMA llama `POST /api/auth/establish-session` y pone cookie `__session`.
3. En prod Clerk middleware busca **`__session_<sufijo>`** si ya existe UAT sufijado → **ignora** la cookie sin sufijo.
4. `session-ready` sigue `ready:false` **o** se navega a `/panel` con cookies incompletas.
5. Document GET `/panel` → reason `client-uat-but-no-session-token` → wipe / settle-bridge → **otra vez `/sign-in`**.

Eso se siente como “PRAGMA no deja iniciar sesión”. Correcto a nivel producto: **el bug está en nuestro bridge de cookies en prod**, no en “Clerk rechaza el password”.

## Qué NO es (para este síntoma)

- Billing / org suspended (otras URLs).
- `signOut` automático post-login (solo con `?signed_out=1`).
- Rejection por `azp` en `verifyToken` (hoy no se pasa `authorizedParties`).

## Opciones de decisión (implementar UNA)

### A — Corregir cookies (recomendado)
En `establish-session`, escribir **también** `__session_<sufijo>` y `__client_uat_<sufijo>` con `getCookieSuffix(publishableKey)`, mismo `Secure`/`SameSite`/`Domain` que Clerk en prod.

### B — UX de reintento
Si settle falla, no mandar a “login fallido”; reintentar establish en la misma pantalla de sign-in.

### C — Ops Clerk Dashboard
Verificar Proxy URL = `https://www.pragmapms.com/__clerk` Verified + un solo dominio canónico.

**Recomendación:** A (+ B de refuerzo). Revocar sesiones **no arregla** el bug; solo limpia estado fantasma.

## Revocación de sesiones

Script: `scripts/_revoke-all-clerk-sessions-prod.mjs` (usa env production de Vercel).
