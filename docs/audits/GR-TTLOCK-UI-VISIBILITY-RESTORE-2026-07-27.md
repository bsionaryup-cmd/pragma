# Auditoría + restauración — Código TTLock visible en detalle de reserva (2026-07-26/27)

## Veredicto

**Restaurado con evidencia.** Tras Guest Registration completo, el código:

1. se genera en TTLock (`ttlockCodeId`),
2. se persiste en `access_credentials.code_encrypted`,
3. aparece en el DTO del detalle de reserva **inmediatamente** (sin poll),
4. correos de recepción + código al huésped + reporte tenant se envían.

Evidencia: `docs/audits/evidence/gr-ttlock-ui-visibility.json` (`ok: true`).

## Modelo de datos (SSOT)

| Qué | Dónde |
|-----|--------|
| Código | Tabla `access_credentials` (`AccessCredential`) |
| Cifrado | Columna `code_encrypted` (`enc:v1:…`) |
| ID TTLock | Columna `ttlock_code_id` |
| Asociación | `reservation_id` → reserva |
| UI detalle | `getReservationForInbox` → `reservation.accessCode.{code,status,isActive}` |

**No** hay columna de código en `Reservation`.

## Causas de la regresión (paso 3)

| # | Causa | Efecto |
|---|--------|--------|
| A | `scheduleGuestRegistrationCompletionComms` fire-and-forget + `revalidatePath` **antes** de persistir | Detalle leía reserva sin credential |
| B | Mapper tomaba el credential **más reciente** aunque fuera fantasma (`ttlockCodeId=null`, modo `prepared_without_live_api`) | Sección vacía / “Aún no generado” |
| C | `resolveTTLockApiSessionForIntegration` exigía status `CONNECTED\|READY` y rechazaba `SYNC_ERROR` aunque el OAuth token fuera válido | Generación fallaba: “Integración TTLock no conectada” |

Evidencia histórica fantasma (Ludwing): evento `CODE_GENERATED` con `mode: "prepared_without_live_api"` y `ttlockCodeId: null`.

## Restauración implementada

1. **`settleGuestRegistrationCompletionComms`** — await generación TTLock + revalidate; emails en background idempotente.
2. **`finalizeGuestRegistration` / legacy submit** — llaman `settle…` (ya no solo `schedule…`).
3. **`getReservationForInbox` / Smart Access** — solo credentials con `ttlockCodeId != null`.
4. **Sesión API** — `SYNC_ERROR` + token válido permite keyboardPwd (no bloquea GR→código).

## Evidencia E2E (2026-07-27)

```json
{
  "immediateAfterSettle": {
    "settleMs": 7594,
    "detailDto": { "status": "GENERATED", "code": "294527#", "isActive": true },
    "immediateUiOk": true,
    "ttlockCodeId": "98031108"
  },
  "emails": {
    "receptionNotifiedAt": "...",
    "accessDelivery": "SENT"
  },
  "verdict": {
    "generated": true,
    "stored": true,
    "visibleInReservationDetailDto": true,
    "receptionEmail": true,
    "guestAccessEmail": true,
    "noPhantomPreferred": true
  },
  "ok": true
}
```

Tenant report: OK en log `[gr-completion-comms]` → `urbanovaloft@gmail.com`.

## Criterio “finalizado”

- [x] Código generado en TTLock
- [x] Almacenado en DB
- [x] Visible en DTO de detalle de reserva al instante
- [x] Correo recepción
- [x] Correo código huésped
- [x] Reporte tenant
- [ ] **Deploy a producción** (requiere aprobación explícita del owner)

## Notas operativas

- Vercel `TTLOCK_CLIENT_*` están Encrypted; `vercel env pull` local puede devolver vacíos. Producción runtime debe tener secretos reales **o** tokens de integración en DB + `TTLOCK_API_ENABLED` efectivo.
- Fantasmas previos (`ttlockCodeId` null) ya no envenenan el detalle; al regenerar con API live se reemplazan.
