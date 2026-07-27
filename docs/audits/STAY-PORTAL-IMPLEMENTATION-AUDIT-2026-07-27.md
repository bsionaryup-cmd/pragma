# Portal de Estadía (Guest Stay Portal) — Auditoría e implementación

**Fecha:** 2026-07-27  
**Deploy:** pendiente (aprobación owner + migrate `stay_portal_tokens`)

## Veredicto

Extensión del flujo post–Guest Registration **sin reemplazar** GR → TTLock → correos.  
Nuevo acceso público `/stay` + `/stay/[token]` sobre tokens propios (`StayPortalToken`).

## Reutilización

| Capacidad | Clasificación |
|-----------|---------------|
| Occupancy / finalize GR | REUSE |
| AccessCredential decrypt | REUSE |
| Operational contacts | REUSE |
| Property wifi/address/times/rules | REUSE |
| Airbnb code lookup pattern | ADAPT → `/stay` |
| GuestRegistrationToken | NO reutilizar (COMPLETED) |
| StayPortalToken | CREATE |

## Activación

`finalizeGuestRegistration` / `submitGuestRegistration` → `ensureStayPortalTokenForReservation` → settle TTLock/emails.

Portal activo solo si:
- `guestRegistrationCompletedAt` presente
- status ∈ CONFIRMED | CHECKED_IN | CHECKOUT_TODAY
- token ACTIVE y no expirado

Tras checkout / cancelado: mensaje “Estadía finalizada” sin datos sensibles.

## Accesos

1. CTA **Ir a mi Estadía** en éxito GR y página completed.
2. `/stay` + código de reserva (rate-limited, fail-closed 1 match).
3. Correo de acceso: botón **Ir a mi Estadía**.

## Seguridad

- Rutas públicas en `proxy.ts`: `/stay`, `/stay/(.*)`
- Token de 24 bytes hex (mismo patrón que GR)
- Lookup fail-closed + throttle IP/código
- No mezcla de reservas (match único por código)

## Archivos clave

- `src/services/guests/stay-portal.service.ts`
- `src/app/stay/page.tsx`, `src/app/stay/[token]/page.tsx`
- `prisma/migrations/20260727020000_stay_portal_tokens/`

## Pendiente pre-prod

1. `prisma migrate deploy` en producción.
2. E2E: Direct + Airbnb GR → portal → código/WiFi/Maps.
3. Aprobación explícita de deploy.
