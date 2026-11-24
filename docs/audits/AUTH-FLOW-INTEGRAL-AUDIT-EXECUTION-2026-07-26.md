# Auditoría integral auth — ejecución completa (2026-07-26)

**Estado local:** `session-ready-v2` restaurado + `requireDbUser` → `/auth/continue`  
**Prod:** `dpl_AFz3c9BmFmf7xmXsiP5wsHS9ActE` — marker `session-ready-v2`, settle-bridge OK  
**Síntoma original:** login OK ~1s → bounce a `/sign-in`

---

## Fases 1–2 — Flujo y mapa de redirecciones

### Flujo esperado (SSOT)

1. Usuario completa `/sign-in` (Clerk SignInFuture).
2. `finalize` + `settleClerkSessionThenGo` espera JWT **y** `GET /api/auth/session-ready` (`ready:true`).
3. Solo entonces `location.replace(/panel)` (document GET con cookie completa).
4. `proxy.ts` (`clerkMiddleware`) ve `userId` → forward.
5. Layout dashboard: `requireDbUser` → sync metadata → `enforceTenantDashboardAccess` → `buildTenantContext` (org DB).
6. Panel render + `ClerkSessionKeepAlive`.

### Dónde se invalidaba la sesión (evidencia)

No era “Clerk cierra sesión” por idle. Era:

`document GET /panel` + `__client_uat` sin `__session` → handshake `client-uat-but-no-session-token` → resolve vacío → **wipe cookies** (`Expires=1970`) → middleware `NextResponse.redirect(/sign-in)`.

Probe prod (este run):

| Caso | Resultado |
|------|-----------|
| `/panel` sin cookies | `307` → `/sign-in?redirect_url=%2Fpanel` |
| `/panel` + `__client_uat=1` | `307` → `/auth/continue?next=%2Fpanel` + `x-pragma-clerk-handshake-bypass: settle-bridge` |
| `/api/auth/session-ready` | `200` `{ready:false}` (no handshake) |
| `/sign-in` HTML | `data-pragma-auth-flow="session-ready-v2"` |

### Quién manda a `/sign-in` (evidencia de código)

| Origen | Condición | ¿Causa del bounce? |
|--------|-----------|-------------------|
| `src/proxy.ts` | `!authState.userId` en ruta protegida | Sí, **después** del wipe |
| Clerk handshake wipe | UAT sin session token | **Causa raíz** |
| `requireDbUser` (antes) | `!userId` → `/sign-in` | Residuo RSC race |
| `requireDbUser` (ahora) | `!userId` → `/auth/continue?next=` | Mitiga |
| Billing / suspended / inactive | estados de cuenta | No (mensajes distintos) |
| INTIENDAS divert | retirado | No |

Clerk Orgs en FAPI: `organization_settings.enabled: false`. El tenant PRAGMA es `User.organizationId` en Postgres (`tenant-context.ts`), no Active Organization de Clerk.

---

## Fases 3–5 — Tenant, sesión, middleware

- **Tenant:** `buildTenantContext` / `requireTenantContext`; org status `SUSPENDED` → `/account-suspended`.
- **Sesión:** cookies `__session` + `__client_uat`; FAPI vía `/__clerk` (custom `clerk.*` TLS roto).
- **Edge:** `src/proxy.ts` (no `middleware.ts`). Matcher: app + api + `/__clerk`; excluye `_next` y estáticos.
- **Público:** marketing, sign-in/up, owner-login, `/auth/continue`, `/api/auth/session-ready`, webhooks/cron/ical/guest/offer.
- **Protegido:** owner + `PROTECTED_DASHBOARD_PREFIXES` + RBAC en `permissions.ts`.

---

## Fases 6–7 — Panel y organizaciones

- Panel no hace `signOut` en error de datos (TTLock/retail soft-fail previo).
- Keepalive en layouts dashboard/owner.
- Guards: sin divert a INTIENDAS.
- Org activa = fila DB del usuario; no depende de Clerk Organization membership.

---

## Fase 8 — Implementación (causa raíz únicamente)

1. **Restaurar SSOT local** (el workspace había **perdido** `session-ready-v2`; un deploy desde ese árbol habría regresado prod).
2. `GET /api/auth/session-ready` — sonda JSON sin handshake.
3. `waitUntilClerkSessionCookieReady` — no navegar a `/panel` hasta `ready:true`.
4. Proxy: handshake UAT-sin-session → **settle-bridge** `/auth/continue` (no wipe).
5. `/auth/continue` — retry UI; no auto-bounce si hay token cliente.
6. Forms: quitar `softNavigate` (navegaba sin prueba server-side).
7. `requireDbUser`: `/auth/continue` en lugar de `/sign-in` bare.

Assert: `node scripts/_assert-session-ready-v2.mjs`

---

## Fases 9–11 — Criterios de aceptación

### Login / refresh / tabs / logout

Validar manual en prod tras deploy:

- [ ] Login tenant → Dashboard estable
- [ ] Refresh `/panel` / `/calendar`
- [ ] Navegación módulos permitidos
- [ ] Nueva pestaña mantiene sesión
- [ ] Logout → `/sign-in` → re-login OK

### Roles

- SUPER_ADMIN_OWNER → owner dashboard (sin impersonate)
- ADMIN → panel completo org
- RECEPTIONIST → `/panel` + `/calendar` únicamente

### No regresión

Calendario, propiedades, finanzas, settings, integraciones, multi-tenant, APIs, Server Actions.

### Checklist final

- [x] Sin bucle handshake wipe en UAT parcial (settle-bridge)
- [x] Sin soft-nav a protegido sin cookie server
- [x] Tenant SSOT = DB organizationId
- [x] Marker `session-ready-v2` en auth layout
- [ ] Confirmación humana login real post-deploy

---

## Scripts de evidencia

- `scripts/_audit-auth-flow-prod.mjs`
- `scripts/_assert-session-ready-v2.mjs`
- Históricos: `LOGIN-BOUNCE-DEEP-AUDIT-2026-07-26.md`, handshake loop audits
