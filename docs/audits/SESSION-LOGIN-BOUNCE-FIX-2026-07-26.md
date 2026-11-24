# Auditoría + fix — login bounce / sesión se cae (2026-07-26)

## Síntoma

La página de login se refresca, muestra “sesión iniciada” un segundo y vuelve a pedir login. Tras autenticarse, la sesión se pierde y el usuario no llega a `/panel` ni `/calendar`.

## Causa raíz (verificada)

1. Tras login, el navegador hace un **document GET** a una ruta protegida (`/panel`) con estado parcial: a menudo `__client_uat` presente y **`__session` ausente**.
2. Clerk middleware detecta `ClientUATWithoutSessionToken` y lanza **handshake**.
3. `@clerk/backend@3.7.0` construye el `Location` del handshake contra **`frontendApi` = `clerk.pragmapms.com`**, **aunque** exista `proxyUrl` derivado de `/__clerk`.
4. `clerk.pragmapms.com` tiene **TLS roto** → el handshake no completa bien → directivas `Expires=1970` **borran cookies**.
5. El cliente Clerk en memoria aún cree estar signed-in un instante (flash) y luego sincroniza signed-out.

Evidencia:

- Prod `/panel` sin cookies → `X-Clerk-Auth-Reason: session-token-and-uat-missing`
- Environment FAPI vía proxy responde, pero **cero** `proxy` en `display_config` de instancia live
- Código local `buildRedirectToHandshake` usa `frontendApi`, no `proxyUrl`

## Solución implementada (sin tocar finanzas / multi-tenant / datos)

| Cambio | Archivo | Efecto |
|--------|---------|--------|
| Reescribir `Location` de handshake FAPI → `/__clerk/...` | `src/proxy.ts` | Handshake usable pese a TLS de `clerk.*` |
| Proxy on también con `pk_live` en dev | `proxy.ts` + `clerk-root-provider.tsx` | Local con live keys no habla directo con FAPI roto |
| Nunca hard-redirect server a `/panel` | `sign-in/page.tsx`, `owner-login/page.tsx` | Primero `/auth/continue` (público) |
| Post-login siempre vía continue | `post-auth-navigation.ts` | Evita primer GET protegido prematuro |
| Helpers compartidos | `post-auth-paths.ts` | Seguro server+client |

## Validación requerida antes de deploy

1. Ventana privada en `localhost` (dev con pk_live + proxy).
2. Login tenant → debe pasar por `/auth/continue` → `/panel` y **permanecer**.
3. Hard refresh en `/panel` y `/calendar` → sigue autenticado.
4. Logout explícito → `/sign-in?signed_out=1` → puede volver a entrar.
5. Repetir owner login → `/owner-dashboard`.

**Deploy solo tras pruebas reales OK.**

## Ops recomendado (Dashboard Clerk)

Verificar Proxy URL = `https://www.pragmapms.com/__clerk` (Verified) en instancia Production. El rewrite de código mitiga el fallo aunque el Dashboard esté mal; el Dashboard correcto es la solución definitiva a largo plazo.
