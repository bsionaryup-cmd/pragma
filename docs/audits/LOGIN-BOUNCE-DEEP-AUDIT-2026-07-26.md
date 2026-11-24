# Auditoría profunda — login vuelve a `/sign-in` (2026-07-26)

**Deployment auditado:** `dpl_Fp1hiTngW2JPZsmWdFoR576mNe77`  
**Síntoma:** Tras login, el usuario regresa a `/sign-in` y no entra al PMS.

---

## Evidencia reproducida (producción)

Cadena forzada con cookie parcial `__client_uat=1` (sin `__session`):

| Paso | URL | Resultado |
|------|-----|-----------|
| 1 | `/panel` | `307` handshake `client-uat-but-no-session-token` → `/__clerk/v1/client/handshake?...` |
| 2 | handshake | `307` → `/panel` + Set-Cookie `__clerk_handshake` |
| 3 | `/panel` + handshake | `signed-out` reason=`session-token-missing` + **wipe** `__session`/`__client_uat` (`Expires=1970`) → `/sign-in?redirect_url=%2Fpanel` |
| 4 | `/sign-in` | `200` signed-out |

Scripts: `scripts/_audit-handshake-loop.mjs`, `scripts/_audit-login-bounce-deep.mjs`.

### Infra confirmada

- Proxy `/__clerk` OK (`environment` 200); `data-clerk-proxy-url="/__clerk"`.
- FAPI custom `clerk.pragmapms.com` / `clerk.www.pragmapms.com` → **TLS fail** (sigue roto).
- Handshake Location ya apunta a `/__clerk` (no al FAPI roto); el wipe ocurre al **resolver** handshake sin session token.

### Bug de aplicación agravante

`settleClerkSessionThenGo` hacía `location.replace(/auth/continue)` **antes** de esperar JWT/cookies en la página de login. `/auth/continue` solo esperaba ~1.8s y, si no había token, devolvía a `/sign-in`. El hard navigation a `/panel` con UAT incompleto dispara el wipe.

---

## Causa raíz

1. Tras `finalize`, la cookie `__session` llega con carrera vía `/__clerk`.
2. Un document GET protegido con `__client_uat` y sin `__session` activa handshake.
3. Handshake sin session token → Clerk firma **signed-out** y **borra cookies**.
4. Middleware manda a `/sign-in` → “no logro entrar”.

No es INTIENDAS ni billing en este loop (reproducido sin login real).

---

## Fix implementado

1. **Settle en la página pública primero** (esperar token + `session.touch` + `GET /__clerk/v1/client` + reconfirmación).
2. **Soft navigation** (`router.replace`) hacia `/panel` / owner (evita handshake `Sec-Fetch-Dest: document`); hard fallback si se queda en login.
3. `/auth/continue` espera hasta ~8s y usa soft nav.
4. Hint `?session_pending=1` si aún falla.

---

## Validación requerida

1. Ventana privada → `/sign-in` → login tenant.
2. Debe permanecer en `/panel` (o pasar breve continue) **sin** volver a sign-in.
3. Hard refresh en `/panel` y `/calendar`.
4. Logout explícito → volver a entrar.
5. Repetir `/owner-login`.
