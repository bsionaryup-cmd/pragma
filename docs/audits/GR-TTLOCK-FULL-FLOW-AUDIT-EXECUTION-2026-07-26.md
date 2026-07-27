# Auditoría + ejecución — Guest Registration → TTLock → correos (2026-07-26)

## Fases 1–5 — Hallazgos (evidencia en código)

### Flujo vivo (SSOT)

1. Reserva creada (Direct / Airbnb / iCal).
2. GR link generado / enviado.
3. Huésped completa formulario hasta `registeredCount === occupancy` (adultos+niños).
4. `finalizeGuestRegistration` → `scheduleGuestRegistrationCompletionComms`.
5. Orchestrator: TTLock → recepción → código email → reporte tenant.
6. Código en `AccessCredential` (`ttlockCodeId`, `codeEncrypted`); UI en detalle de reserva.

**Disparador oficial:** `finalizeGuestRegistration` → completion-comms  
(no el hook muerto `onGuestRegistrationCompletedForTTLock`).

### Puntos de ruptura

| # | Causa | Evidencia |
|---|--------|-----------|
| A | `generateAfterGuestRegistration` default **false** → skip silencioso | `schema.prisma` + `processReservationAccessAfterRegistration` |
| B | Email del código al huésped **solo si recepción OK** | `runGuestRegistrationCompletionComms` L316 |
| C | Docs/hook obsoleto confunden operadores | `onGuestRegistrationCompletedForTTLock` sin callers |

### Reglas de negocio vigentes (no tocar)

- TTLock **no** genera sin `guestRegistrationCompletedAt`.
- Capacidad GR = adultos + niños.
- Idempotencia: reusa credential con `ttlockCodeId`; claim email deliveryStatus.

## Fases 6–8 — Fix implementado

1. Default Prisma `generateAfterGuestRegistration = true` + backfill SQL.
2. Bare settings create con `generateAfterGuestRegistration: true`.
3. Correo de código al huésped **independiente** del éxito de recepción (sigue respetando GR completo + código existente).
4. Orden: TTLock → recepción → código (si hay credential) → tenant report.
5. UI TTLock sigue pudiendo desactivar el flag por tenant.

### Evidencia de despliegue

- Deploy prod: `dpl_2cGPVTShtRptZoALAZygBNdyUoJj`
- Backfill Neon: `ttlock_automation_settings` → **3/3** con `generateAfterGuestRegistration=true` (1 fila actualizada)

## Criterio de éxito

Tras deploy: completar GR en reserva con lock mapeado + API live → código generado, visible en panel, 3 correos (huésped código, recepción registro, tenant reporte) sin duplicar en reintento.

## Prueba manual recomendada

1. Reserva Directa con propiedad mapeada a TTLock.
2. Completar Guest Registration (ocupación completa).
3. Verificar código en detalle de reserva / Smart Access.
4. Verificar correos: huésped (código), recepción (registro), tenant (reporte).
5. Reintentar / reenviar → sin duplicar código activo.
