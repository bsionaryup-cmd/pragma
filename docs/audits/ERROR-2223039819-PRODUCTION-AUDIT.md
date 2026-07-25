# Auditoría ERROR 2223039819 — Producción

Fecha: 2026-07-25  
Deployment inspeccionado: `dpl_3fW1xs14pfwsaZBDaQahzEunTEnF` (alias www.pragmapms.com)

## Fase 1 — Reproducción

| URL | Status (sin sesión) | Headers Clerk | Notas |
|-----|---------------------|---------------|-------|
| `/` | 200 | — | OK |
| `/owner-login` | 200 | — | HTML Clerk OK |
| `/owner-dashboard` | 307 → login | `dev-browser-missing` | Redirect custom Owner |
| `/panel` | **404** | `protect-rewrite, dev-browser-missing` | Roto UX |
| `/calendar` | **404** | `protect-rewrite, dev-browser-missing` | Roto UX |
| `/settings` | **404** | `protect-rewrite, dev-browser-missing` | Roto UX |
| `/guest-registration` | 200 | — | OK |

Assets estáticos (`/favicon.ico`, `/icon-192.png`, `/manifest.webmanifest`): **200**.

Texto de error reportado por usuario:

```
This page couldn’t load
A server error occurred. Reload to try again.
ERROR 2223039819
```

Coincide con el UI/digest de **Clerk** (no con un digest RSC de Next genérico). Ver Clerk `auth-was-called` / protect-rewrite.

## Fase 2 — Hallazgos clave

### Clerk en producción usa instancia de **desarrollo**

HTML live de `/owner-login` contiene:

- `data-clerk-publishable-key="pk_test_…"`
- dominio `clerk.accounts.dev`

Eso es instancia **Development**, no Production (`pk_live_`).

### Middleware (`src/proxy.ts`)

Para rutas PMS (`/panel`, `/calendar`, …) sin `userId`:

```ts
await auth.protect(); // → protect-rewrite → /_not-found (404)
```

Owner usa redirect explícito a `/owner-login` (mejor).

`X-Clerk-Auth-Reason: protect-rewrite, dev-browser-missing` aparece en rutas PMS firmadas-out — comportamiento típico de Clerk **dev** + `auth.protect()`.

### Prisma / Neon / db.ts

`HEAD` `db.ts` ya no hace hard-throw por retail (fix Owner previo). No es la causa del ERROR 2223039819 (UI Clerk).

### TTLock

`TTLOCK_API_ENABLED` no figura en env de producción (pull). Relacionado con códigos falsos (ya corregido en código); no causa este ERROR Clerk.

### Variables

`vercel env pull` enmascara secrets como `""` (no concluyente). La evidencia **en HTML renderizado** sí prueba `pk_test_` en prod.

## Fase 3 — Causa raíz

**Causa raíz (primaria):**  
El sitio de producción `www.pragmapms.com` está empaquetado/configurado con **Clerk Development keys (`pk_test_`)** y Frontend API `*.clerk.accounts.dev`. En dominio de producción, el handshake/`dev-browser` falla o queda inconsistente → Clerk muestra *“This page couldn’t load… ERROR &lt;digest&gt;”* (p. ej. `2223039819`).

**Causa raíz (secundaria / amplifica):**  
`auth.protect()` en `proxy.ts` para rutas dashboard sin sesión hace **protect-rewrite → 404**, en lugar de redirect limpio a `/sign-in`. Eso empeora la experiencia y dispara el mismo circuito `dev-browser-missing`.

**Por qué “solo” se nota en prod:** el dominio público no es localhost; las cookies/handshake de instancia Development no son fiables ahí. En local con `pk_test_` suele “funcionar”.

**Impacto:** Alto — bloquea acceso autenticado (Owner/PMS) de forma intermitente o total.  
**Riesgo de no corregir:** Alto.

## Archivos involucrados

- `src/proxy.ts` — `auth.protect()` → 404
- Config Vercel / Clerk Dashboard — keys Development en Production
- `src/components/providers/clerk-root-provider.tsx` — ClerkProvider (OK estructuralmente)
- Root `src/app/layout.tsx` — providers (OK)

## Fase 4 — Corrección (plan)

1. **Código (mínimo):** en `proxy.ts`, si no hay `userId` en rutas no-Owner, `NextResponse.redirect(/sign-in?next=…)` en lugar de `auth.protect()`.
2. **Operación (obligatoria, fuera de git):** en Vercel Production + Clerk Dashboard Production:
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_…`
   - `CLERK_SECRET_KEY=sk_live_…`
   - Domains: `www.pragmapms.com`, `pragmapms.com`
   - Redeploy tras cambiar env

Sin el paso (2), el ERROR Clerk puede persistir aunque (1) mejore el 404.

## Estado pre-deploy

| Check | Estado |
|-------|--------|
| Causa raíz identificada | PASS |
| Fix código aislado | PENDING |
| Keys live en Vercel | **NOT READY** (requiere acción humana) |
| READY para deploy completo | Solo código middleware → sí; cierre total del ERROR → requiere keys live |
