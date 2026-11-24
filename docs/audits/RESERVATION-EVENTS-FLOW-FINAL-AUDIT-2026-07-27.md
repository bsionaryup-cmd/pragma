# Auditoría final — Flujo de eventos Reserva → GR → TTLock → Notificaciones

**Fecha:** 2026-07-27  
**Estado local:** estandarización implementada + evidencia de asuntos  
**READY FOR PRODUCTION:** **NO** hasta deploy + E2E live (Direct + Airbnb + iCal) con Resend/TTLock reales

## Flujo oficial (único post-GR)

```
createReservation (Direct) → correo confirmación + CTA GR
airbnb-ical / universal ingress → ensure token (sin correo auto PRAGMA)
        ↓
Guest Registration completado (occupancy)
        ↓
settleGuestRegistrationCompletionComms
        ↓
TTLock persistido (access_credentials)
        ↓
Correo recepción → Correo acceso huésped → Reporte tenant
```

## Asuntos estandarizados (evidencia)

Archivo: `docs/audits/evidence/reservation-events-email-standardization.json`

| Destinatario | Asunto |
|--------------|--------|
| Huésped (Direct create) | `Reserva confirmada — Solo falta completar el registro de huéspedes` |
| Huésped (post TTLock) | `Bienvenido — Tu código de acceso ya está disponible` |
| Recepción | `Check-in registrado \| {prop} \| {huésped}` |
| Tenant | `Registro completado \| {huésped} \| {prop}` |

## Cambios realizados (mínimo impacto)

- Confirmación Direct: sin branding PRAGMA; incluye alojamiento, fechas, huésped, nº reserva, CTA.
- Acceso huésped: sin branding PRAGMA; código destacado + instrucción copiar + contacto recepción.
- Recepción/tenant: asuntos operativos legibles en bandeja.
- Airbnb “Copiar mensaje”: enlace universal `/guest-registration` + instrucción de código de reserva.
- Constantes SSOT: `src/lib/guest-registration/reservation-event-email-subjects.ts`

## No modificado (congelado)

- Clerk / multi-tenant / roles
- Calendario, finanzas, propiedades
- Orquestación settle/run + idempotencia claims
- Regla occupancy = registrados
- Persistencia TTLock en `access_credentials`
- UI AccessCodeDisplay (oculto / ojo / copiar)

## Airbnb welcome + 5 min

PRAGMA **no** envía mensajes outbound a Airbnb. El flujo host/Airbnb permanece OPS. El panel asiste con copy del enlace universal. Post-GR = misma lógica que Direct.

## Pendiente para READY FOR PRODUCTION

1. Deploy a producción (aprobación owner).
2. E2E live: Direct create → GR → TTLock → 4 correos.
3. E2E Airbnb: universal code → GR → mismo pipeline.
4. Smoke no-regresión: calendario, reservas, finanzas, Clerk.
5. Confirmar `TTLOCK_API_ENABLED` no está en `false` en prod.
