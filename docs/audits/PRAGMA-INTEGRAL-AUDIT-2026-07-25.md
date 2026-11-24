# Auditoría integral PRAGMA — 2026-07-25

Deploy login/scope: `dpl_EAmzurnhPQYX21a4RufGdhE7dvAY` → https://www.pragmapms.com

## Veredicto

| Área | Estado | Severidad |
|------|--------|-----------|
| Login tenant/owner | Fix desplegado (single_session + clerkId relink) | **CRÍTICO → mitigado** |
| Owner dashboard retail P2021 | Soft-fail | Mitigado |
| Automatizaciones (crons) | Cableadas; cadence Hobby = 1×/día | MED |
| Reservas SSOT | Calendar/`/reservations`/`Reservation` alineados | OK / MED residual |
| Finanzas SSOT | Host payout + confirmation; Owner GMV filtrado | Mitigado |
| Contaminación reservas | Ghost auto-delete OFF; orphans ocultos | MED |

---

## 1. Login (causa raíz)

1. **Clerk Production `single_session_mode: true`** → “You're already signed in” si queda sesión residual.  
   **Fix:** activar `existingSession` / `setActive` y continuar al panel.
2. **Drift `clerkId` DB ↔ instancia Clerk** (local `pk_test` vs prod `pk_live`, misma Neon).  
   Ejemplo: `urbanovaloft@gmail.com` tenía `user_3GzbAb2` (live) vs `user_3EEwb6m` (dev).  
   **Fix:** `authenticatedRelink` en `requireDbUser` + relink local al Dev id; en prod el primer login Live re-enlaza.
3. **FAPI custom domain TLS roto** (`clerk.pragmapms.com`); prod usa proxy `/__clerk` (OK).
4. Usuarios **inactivos** en DB (`dairo…`, `daydiana…`, `demo@…`) no pueden entrar aunque existieran en Clerk.

### Cómo entrar ahora

- **Local:** `.env.local` = `pk_test` / `sk_test`. Activos: `urbanovaloft@gmail.com`, `bsionaryup@gmail.com`.
- **Prod:** https://www.pragmapms.com/sign-in (hard refresh). Si dice “already signed in”, el fix activa la sesión y entra.
- Owner: `/owner-login` (mismo stack).

---

## 2. Automatizaciones

Crons en `vercel.json` (todos **diarios** Hobby UTC): billing, iCal, email enrich/reconcile, guest-payment, PriceLabs, TTLock, retail-intel.

- Sin `CRON_SECRET` → todos 401 (fail-closed).
- Comentarios “cada 5–15 min” **no** coinciden con schedule real (1×/día).
- GR → TTLock → emails: cableado fail-closed; `generateAfterGuestRegistration` default `false` en schema puede silenciar códigos en orgs viejas.
- Client Airbnb auto-sync en dashboard (~90s) compensa iCal diario.

---

## 3. Reservas / finanzas

- SSOT: modelo `Reservation` + `withVisibleReservationsFilter`.
- Ghost purge ya no borra (solo log).
- Owner GMV ahora usa el mismo filtro de visibilidad (antes podía contar orphans Airbnb).
- Finance soft-fail P2021 en gastos/otros ingresos → subconteo silencioso si faltan tablas.
- Placeholders iCal / orphans ocultos: residual MED; no re-cert Jul 2026 en evidence/.

---

## 4. Regresiones / cableado roto detectado

| Item | Acción |
|------|--------|
| Login single_session | Desplegado |
| Login clerkId drift | Relink auth + script local |
| Owner `retail_stores` P2021 | Soft-fail |
| Owner GMV orphans | Filtro visibilidad |
| Crons sub-horarios vs Hobby | Ops: subir plan o aceptar 24h |
| `clerk.pragmapms.com` TLS | Ops: Verify SSL en Clerk Domains |
| Usuarios inactivos | Reactivar en DB/Owner si deben entrar |

---

## 5. Próximos pasos ops (humanos)

1. Hard refresh + login en prod con `urbanovaloft@…` / owner.
2. Clerk Dashboard → Domains → Verify SSL de `clerk` / `accounts` (opcional si proxy sigue OK).
3. Confirmar `CRON_SECRET` + `RESEND_API_KEY` + TTLock live en Vercel Production.
4. Reactivar usuarios tenant necesarios (`isActive=true`) y asegurar existen en instancia **Production** de Clerk.
