# Auditoría forense — sesión no persiste tras login (prod)

**Fecha:** 2026-07-26  
**Ámbito:** `www.pragmapms.com` (Clerk Production `pk_live` + proxy `/__clerk`)  
**Usuarios de interés:** tenant `urbanovaloft@gmail.com` (Samuel Silva); owner `bsionaryup@gmail.com`  
**Restricción:** sin deploy en esta auditoría.

---

## 1. Veredicto

La sesión **sí se crea en el cliente Clerk**, pero el **primer document navigation** a `/panel` (o `/owner-dashboard`) llega al middleware **sin cookie de sesión usable**. Clerk entonces dispara un **handshake** que, sin cliente válido, **borra las cookies** (`Expires=1970`) y el middleware te manda otra vez a `/sign-in`.

No es un bug de “usuario Samuel / owner en DB”. Es un fallo de **persistencia de cookies + handshake post-login**.

Local “funciona” porque usa **Clerk Development** (`pk_test` / `*.clerk.accounts.dev`) **sin** el mismo proxy/`Domain=pragmapms.com`.

---

## 2. Evidencia empírica (prod)

| Check | Resultado |
|--------|-----------|
| HTML `/sign-in` | `pk_live_…`, `data-clerk-proxy-url="/__clerk"`, dpl actual |
| `/panel` sin cookies | `307 → /sign-in`, `X-Clerk-Auth-Status: signed-out`, `session-token-and-uat-missing` |
| Apex `pragmapms.com` | `307 → https://www.pragmapms.com/...` (OK) |
| `GET /__clerk/v1/environment` | `200` (proxy vivo) |
| `https://clerk.pragmapms.com` | TLS/conexión falla (FAPI custom **roto**; proxy es obligatorio) |
| Handshake sin sesión | `307 → /panel` + cookie `__clerk_handshake` |

### Payload del handshake (decodificado)

Directivas dentro del JWT (resumen):

```text
__clerk_handshake=; Domain=pragmapms.com; Expires=1970…   ← borra
__client_uat=; Expires=1970…                              ← borra (host-only)
__client_uat=0; Domain=pragmapms.com; Max-Age=…           ← marca “sin cliente”
__client_uat_69IVtl3L=0; Domain=pragmapms.com
__session_69IVtl3L=; Expires=1970…                        ← borra sesión (host-only)
```

**Conclusión:** un handshake “en frío” **limpia** `__session_*` y deja `__client_uat=0`. Eso explica “alcanza a iniciar sesión y de una se devuelve al login”.

---

## 3. Cadena causal (orden de probabilidad)

### P0 — Handshake post-login borra cookies (alta confianza)

1. Login OK en cliente (`password` → `finalize` / `setActive`).
2. `window.location.replace('/panel')` inmediato (document GET).
3. Esa request **aún no lleva** `__session` (carrera de `Set-Cookie` vía `/__clerk`, o cookies no enviadas por Domain).
4. `authenticateRequest` → signed-out + elegible a handshake (`Sec-Fetch-Dest: document`).
5. Handshake sin cliente válido → **borra** cookies de sesión.
6. Vuelves a `/panel` sin sesión → middleware → `/sign-in?redirect_url=/panel`.

Clerk **solo** auto-handshakes documentos HTML; el problema aparece justo en el hard navigation tras login.

> Nota: el handshake **custom** que añadimos antes era peor (mismo wipe). Se quitó del código local; el handshake **nativo** de Clerk sigue pudiendo hacer lo mismo.

### P0 — Fragmentación de Domain en cookies (alta confianza)

En el mismo handshake conviven:

- Cookies **host-only** (sin `Domain`) al borrar `__session_*`
- Cookies con **`Domain=pragmapms.com`** para `__client_uat`

El jar del navegador puede quedar **inconsistente** entre `www` y el dominio raíz. Opera (visto en captura previa) puede ser más estricto.

### P1 — Carrera finalize → hard navigation (alta confianza)

En `email-password-sign-in-form.tsx` / `owner-login-form.tsx`:

- `finalize` / `setActive` navegan en cuanto Clerk responde.
- No hay espera explícita a que `document.cookie` / `getToken()` confirmen cookie usable.
- Doble navegación residual (aunque mitigada) aumenta la carrera.

### P1 — FAPI `clerk.pragmapms.com` caído (confirmado)

`parsePublishableKey(pk_live)` → `frontendApi: clerk.pragmapms.com`.  
Sin proxy, la sesión no puede sincronizar. Con proxy, **todo** depende de:

- `ClerkProvider.proxyUrl = "/__clerk"`
- middleware `frontendApiProxy: { enabled: true }`
- **Dashboard Clerk → Proxy URL** = `https://www.pragmapms.com/__clerk` verificado

Si el Dashboard no tiene el proxy URL en verde, FAPI puede emitir cookies/dominios incorrectos aunque el proxy HTTP responda 200.

### P1 — `signOut` residual en errores “already signed in” (media)

En el form de sign-in aún hay `signOut()` en ramas de reintento (aprox. líneas 486 / 519). Si el cliente cree que “ya hay sesión” pero el servidor no, un `signOut` **confirma** el wipe.

### P2 — Local ≠ Prod (explica “en local sí”)

| | Local | Prod |
|--|--------|------|
| Keys | `pk_test` / `sk_test` | `pk_live` / `sk_live` |
| FAPI | `*.clerk.accounts.dev` (TLS OK) | `clerk.pragmapms.com` (TLS roto) + `/__clerk` |
| Cookie Domain | accounts.dev / host-only localhost | `Domain=pragmapms.com` + host-only www |

Auditoría DB+Clerk **con keys locales** (no sustituye prod Live):

- `urbanovaloft@gmail.com` — activo, org, `clerkId` match (tenant Samuel).
- `bsionaryup@gmail.com` — activo, **sin org**, `clerkId` **mismatch** en instancia Dev local (owner).  
  Eso **no prueba** el estado Live; sí prueba que no se debe diagnosticar prod con `.env.local`.

### P2 — Percepción de “no aplican los cambios”

- Varios deploys seguidos + bounce de sesión → el usuario no permanece autenticado para validar.
- Parte de fixes estuvo solo en working tree antes de deploy.
- Cache del navegador (Opera) sobre chunks `/_next/static`.

---

## 4. Qué **no** es la causa principal

- “Samuel no es el único tenant en DB” (hay usuarios inactivos/seed; el activo con org coherente es Samuel).
- Falta de permisos RBAC al abrir `/panel` (el redirect es **antes**, por `signed-out`).
- Server Action `401` (eso daba *“An unexpected response…”*; otro síntoma).
- Retail/`retail_stores` (afecta panel owner/tenant data, no el cookie jar de Clerk).

---

## 5. Soluciones de **menor impacto** (recomendadas, sin deploy ahora)

Ordenadas por impacto/riesgo:

### A. Ops Clerk Dashboard (0 código) — hacer primero

1. Clerk **Production** → Domains / Proxy:  
   `https://www.pragmapms.com/__clerk` **Verified**.
2. Application URL canónica: solo `https://www.pragmapms.com` (apex ya redirige).
3. Subir lifetime del session JWT si está en ~60s (menos handshakes).
4. Confirmar que no hay Satellite mal configurado.

### B. Post-login “settle” (código pequeño, bajo riesgo)

Tras `finalize` / `setActive`:

1. `await getToken({ skipCache: true })`
2. `await session?.touch?.()`
3. Esperar 150–300ms o hasta ver señal de cookie/`getToken` OK
4. **Una sola** `location.replace(redirectPath)`

Evita el document request “en vacío” que dispara el handshake wipe.

### C. Intersticial anti-bounce (código acotado)

Si llegas a `/sign-in?redirect_url=/panel` con `document.referrer` reciente de login **o** `isSignedIn` en cliente:

- No `signOut`.
- Pantalla “Activando sesión…” + reintentos `getToken` + navigate.
- Loop breaker en `sessionStorage` (máx. 2 intentos).

### D. Eliminar `signOut` en ramas “already signed in” (mínimo)

Solo `activateExistingSession` / navigate; nunca wipe preventivo.

### E. Verificación manual (ops)

1. Chrome Incógnito en `www` (no apex).
2. Application → Cookies: tras login, ¿existen `__session_*` / `__client_uat` con valor ≠ 0 **antes** de rebotar?
3. Network: ¿algún `307` a `/__clerk/.../handshake` justo después del login?

### F. Evitar (alto riesgo / ya falló)

- Reintroducir handshake custom en middleware.
- `signOut` al montar `/sign-in` salvo `?signed_out=1`.
- Apagar el proxy y usar `clerk.pragmapms.com` directo (TLS roto).

---

## 6. Plan de validación (cuando se implemente A+B, aún sin “deploy por habit”)

1. Incógnito → login Samuel → debe quedarse en `/panel` ≥ 2 min.
2. Recarga dura `/panel` → sigue autenticado.
3. Login owner → `/owner-dashboard` estable.
4. Tras >60s, navegar Calendario (RSC) → no bounce (si falla, es P1 secundario de JWT corto; se ataca con lifetime + `getToken` en navegación).

---

## 7. Resumen ejecutivo

| Pregunta | Respuesta |
|----------|-----------|
| ¿Por qué no mantiene sesión? | Handshake post-login **borra** cookies cuando el 1er `/panel` llega sin `__session`. |
| ¿Samuel / owner? | Síntoma **igual** en ambos; no es aislamiento de tenant. |
| ¿Por qué local sí? | Dev keys + FAPI sano; prod = proxy + `Domain=pragmapms.com` + FAPI custom roto. |
| ¿Fix de menor impacto? | Dashboard proxy verificado + settle post-login + quitar `signOut` residual. |

**Siguiente paso sugerido (cuando lo autorices):** implementar solo B+D en código y validar en preview; deploy a prod solo con tu OK explícito.
