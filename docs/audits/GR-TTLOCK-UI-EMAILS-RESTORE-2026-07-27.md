# Restauración — Código TTLock en detalle + correos automáticos (2026-07-27)

## Veredicto

**Completado con evidencia E2E** (`docs/audits/evidence/gr-ttlock-ui-visibility.json`, `ok: true`).

## Regresión 1 — Código en detalle de reserva

### Causa
- DTO omitía `validFrom` / `validTo`.
- Fantasmas sin `ttlockCodeId` podían envenenar la lectura.
- Race fire-and-forget (ya corregida con `settleGuestRegistrationCompletionComms`).

### Restauración
- `ReservationAccessCodeDto` incluye vigencia.
- `getReservationForInbox` lee solo credentials sincronizados + fechas.
- `AccessCodeDisplay`: oculto por defecto (`••••••••`), ojo mostrar/ocultar, copiar, estado (Activo/Expirado/Eliminado/…) y vigencia.

### Evidencia
- Código `332644#`, `ttlockCodeId=98034410`
- DTO inmediato con `validFrom` / `validTo`
- UI capabilities: eye / copy / status / validity = true

## Regresión 2 — Correos automáticos

### Causa de contenido incompleto
- Correo recepción: GR sin código TTLock.
- Correo huésped: solo código (sin framing de registro confirmado).
- Correo tenant: solo estado de steps, sin código ni fechas.

### Restauración (pipeline SSOT)
Orden: TTLock → recepción (con código) → huésped (confirmación + código) → tenant (GR + código + estado).

| Destinatario | Contenido |
|--------------|-----------|
| Huésped | Registro confirmado + código + vigencia + branding |
| Recepción | GR + titular + acompañantes + **código TTLock** + vigencia + reserva |
| Tenant | GR completado + código generado + datos reserva + estado steps |

Idempotencia: reintento omite recepción/código ya enviados y el reporte tenant si el ciclo anterior ya cerró esos envíos.

### Evidencia Resend (recepción)
- `delivered` a ops
- `hasCode: true`, `accessCodeSection: true`, branding PRAGMA
- Huésped: `deliveryStatus=SENT`
- Tenant: `ok: true`
- Reintento: recepción/código `skipped: true`

## Pendiente

Deploy a producción (requiere aprobación explícita del owner).
