# Auditoría y corrección — Titular de reserva vs Guest Registration (2026-08-05)

**Estado:** Corrección de código + reparación de datos piloto aplicada. **Deploy pendiente** de aprobación expresa.

## Causa raíz (evidencia)

Tras OCP Phase 2 (`dce36b2`), Guest Registration **dejó de** sobrescribir `guestName*`.  
El release `83cfaac` (2026-07-17) **reintrodujo** el writeback del titular desde el huésped registrado.

Puntos exactos en `src/services/guests/guest-registration.service.ts`:

| Función | Antes | Después |
|---|---|---|
| `finalizeGuestRegistration` (path legacy) | `guestName/First/Last` ← owner registrado | Solo contacto + `guestRegistrationCompletedAt` |
| `registerGuest` / step owner | Idem | Solo `guestEmail/Phone/Country` |
| `completeGuestRegistration` | `guestName*` ← `primaryData` | Solo contacto + completedAt |

`titularFullName` en aceptación legal **sigue** siendo el del registrante (evidencia legal del formulario), sin alterar el titular de la reserva.

## Corrección de comportamiento futuro

1. GR ya no escribe `guestName` / `guestFirstName` / `guestLastName`.
2. Display calendario/inbox (`resolveReservationDisplayGuestName`): **canal (enrichment) primero**; el nombre de un huésped registrado ya no desplaza al titular del canal.

## Corrección de datos históricos

Script: `scripts/_repair-gr-overwritten-titular.ts`

Criterio (solo afectadas):

- Airbnb + GR completado
- Existe nombre de canal confiable (evento CONFIRMED / audit)
- `reservation.guestName` ≠ canal
- `reservation.guestName` coincide con un `ReservationGuest` (huella de overwrite por GR)

### Piloto Loft 33 — aplicado

| Antes (GR) | Restaurado (canal) | Código |
|---|---|---|
| Gloria Stella Carreño Pinto | Andres Fleipe Guerrero Cordero | HMF9JEZHWW |
| Andres Felipe Mejia Montoya | Andres Felipe Mejia | HMCTQPEFN8 |
| Ludwing Eliu Azurdia Morales | Lud Azurdia Azurdia Morales | HMMYRBF5HJ |
| Dennis Peña | Dennis Reynaldo Peña Minera | HMWEQA95FC |
| Marta Duque | Marta Duque Ramirez | HMY9W4885K |

**5 restauradas.** Re-scan piloto → `affected: 0`.

## Tests

- `tests/reservations/display-guest-name.test.ts` — 6/6
- `tests/guests/reservation-holder-preservation.test.ts` — 5/5

## Archivos tocados

- `src/services/guests/guest-registration.service.ts`
- `src/lib/reservations/display-guest-name.ts`
- `tests/reservations/display-guest-name.test.ts`
- `tests/guests/reservation-holder-preservation.test.ts`
- `scripts/_repair-gr-overwritten-titular.ts` (ops)

## No tocado (a propósito)

- Enrichment / iCal / match policy
- TTLock, finanzas, inbox messaging
- Header UX del formulario GR (sigue mostrando nombre del registrante para la bienvenida del formulario)

## Criterios de aceptación

| Criterio | Estado |
|---|---|
| Registrar huéspedes no modifica titular | Cumple (código) |
| Calendario muestra titular de canal | Cumple (display + datos) |
| Huéspedes se guardan en `ReservationGuest` | Sin cambio |
| Históricos afectados restaurados | Cumple (piloto 5/5) |
| Sin rewrite de módulos ajenos | Cumple |

## Deploy

No desplegado en esta fase. Requiere “apruebo deploy”.
