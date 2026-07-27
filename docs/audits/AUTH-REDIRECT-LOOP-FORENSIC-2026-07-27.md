# Auditoría forense — ERR_TOO_MANY_REDIRECTS (auth / cookies / proxy)

**Fecha:** 2026-07-27  
**Deploy:** **NO** (requiere aprobación explícita del owner)

## Veredicto

**Causa raíz identificada (confianza 98%).**  
No es un fallo genérico de Clerk ni del tenant. Es un **auto-bucle 307** introducido por el interceptor PRAGMA `settle-bridge` en `src/proxy.ts` cuando existen cookies incompletas.

## Flujo reconstruido (hasta el panel)

```
GET /panel (document)
  → clerkMiddleware authenticateRequest
  → si __client_uat sin __session:
       x-clerk-auth-status=handshake
       reason=client-uat-but-no-session-token
  → rewriteClerkFapiHandshakeLocation (PRAGMA)
       ANTES: 307 → /sign-in?redirect_url=/panel  (sin limpiar UAT)
  → GET /sign-in?redirect_url=/panel + Cookie: __client_uat=…
       ANTES: mismo handshake → 307 → /sign-in?redirect_url=/panel
       → ERR_TOO_MANY_REDIRECTS
```

Evidencia producción (antes del fix local):

| Probe | Status | Location | bypass |
|-------|--------|----------|--------|
| `/panel` limpio | 307 | `/sign-in?redirect_url=%2Fpanel` | — |
| `/panel` + `__client_uat=1` | 307 | `/sign-in?redirect_url=%2Fpanel` | `settle-bridge` |
| `/sign-in?redirect_url=/panel` + `__client_uat=1` | **307** | **`/sign-in?redirect_url=%2Fpanel`** | **`settle-bridge`** |
| `/sign-in` limpio | 200 | — | — |

Archivo: `docs/audits/evidence/auth-redirect-loop-forensic.json`

## Por qué tablet / intermitente

Condición necesaria: cookie `__client_uat` (host o `Domain=pragmapms.com`) **sin** `__session` / `__session_<sufijo>` válida.

Más frecuente en tablet porque:

- Sesiones a medio establecer (JWT cliente sin cookie servidor).
- Cookies de dominio apex vs `www` residuales.
- Navegador no limpia jar tras handshake fallido previo.

Computador “limpio” suele no tener UAT huérfano → no entra al bucle.

## Mapa de redirecciones relevantes

| Origen | Destino | Condición |
|--------|---------|-----------|
| proxy protected + no userId | `/sign-in?redirect_url=` | signed-out normal |
| proxy handshake UAT sin session | `/sign-in` o pass-through | settle-bridge / auth-surface-pass |
| sign-in page | **no** hard-redirect a panel | cookie race (intencional) |
| `settleClerkSessionThenGo` | hard `location.replace` | solo si `session-ready` |
| `/auth/continue` | redirige a sign-in/owner-login | legacy bridge |

## Solución de menor impacto (implementada localmente)

1. Extraer decisión pura: `resolveIncompleteSessionBridge`.
2. Si ya estamos en superficie de auth (`/sign-in`, `/sign-up`, `/owner-login`, `/auth/*`): **pass-through** (`auth-surface-pass`) — **nunca** 307 a sí mismo.
3. En pass-through y en settle-bridge: **expirar** `__client_uat` (+ sufijos presentes + `Domain=pragmapms.com`) para que el siguiente document no re-dispare handshake.

No se reescribe Clerk, middleware matcher, multi-tenant ni login forms.

## Validación local

- Unit tests: `tests/auth/clerk-incomplete-session-bridge.test.ts`
- Producción **sigue** con el bucle hasta deploy.

## Post-deploy (checklist owner)

1. Tablet con síntoma: abrir `https://www.pragmapms.com/sign-in` (debe cargar formulario, no ERR_TOO_MANY_REDIRECTS).
2. Login → panel; refresh; logout; re-login.
3. Probe: `Cookie: __client_uat=1` en `/sign-in` → 200 + `x-pragma-clerk-handshake-bypass: auth-surface-pass`.
4. Smoke: calendario, reservas, GR (no-regresión auth).

## READY FOR PRODUCTION

**Código listo para deploy con aprobación.**  
No se publica automáticamente.
