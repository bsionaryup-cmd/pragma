# Auditoría — GR completado con/sin código visible (2026-07-27)

## Pregunta

¿Por qué algunas reservas con Guest Registration completo muestran el código TTLock y otras no?

## Hallazgo (cobertura)

Muestra de reservas con GR completado (no canceladas), n=23:

| Bucket | Count | Significado |
|--------|------:|-------------|
| OK_VISIBLE | 3 | Código sincronizado + email SENT |
| MISSING_CREDENTIAL | 4 | GR OK, lock mapeado, **sin** `AccessCredential` |
| PHANTOM_LOCAL_ONLY | 1 | Código local sin `ttlockCodeId` (UI oculta a propósito) |
| CODE_OK_EMAIL_NOT_SENT | 15 | Hay código (a menudo REVOKED/EXPIRED histórico) sin delivery SENT |

Evidencia: `docs/audits/evidence/gr-code-coverage-audit.json`

## Causa raíz de los que NO muestran código

No es un bug del mapper UI en los casos “sí se ve”.

Los huecos reales fallaron **al generar**:

1. Integración en `SYNC_ERROR` → `resolveTTLockApiSession` devolvía null  
   (antes del fix que permite SYNC_ERROR con token válido).
2. Evento típico: `LOCK_SYNC_FAILED` / `step: session`  
   *“Integración TTLock no conectada o sin token válido”*  
   Ejemplo: **Angie Suarez** (802) — recepción sí se notificó, código nunca se creó.
3. Fantasma histórico `prepared_without_live_api` (**Ludwing**) → UI no muestra dígitos sin `ttlockCodeId`.

Casos reales sin código (antes del repair): Angie Suarez, German Oviedo (801/804), Ludwing, audit UI.

## Qué ya estaba bien en los que SÍ se ve

Ej. Marcio: GR → live API → `ttlockCodeId` + `code_encrypted` + delivery SENT → detalle lee DTO y muestra sección.

## Remedios aplicados

1. **Sesión API**: SYNC_ERROR + token válido permite generar (ya en código).
2. **Settle post-GR**: await generación antes de emails (ya en código).
3. **UI**: solo credentials `GENERATED|SENT|ACTIVE` con `ttlockCodeId`; sección arriba del detalle.
4. **Tras generar OK**: limpia `SYNC_ERROR` → `READY` en la integración.
5. **Repair ejecutado** sobre 5 gaps vigentes (checkOut ≥ hoy):

| Huésped | Unidad | Código UI | Correos |
|---------|--------|-----------|---------|
| Ludwing | 804 | `959666#` | recepción + huésped + tenant OK |
| German Oviedo | 801 | `377618#` | OK |
| Angie Suarez | 802 | (en evidence) | OK |
| German Oviedo | 804 | (en evidence) | OK |
| UI Visibility Audit | 801 | (en evidence) | OK |

Evidencia: `docs/audits/evidence/gr-missing-access-repair.json` (`ok: true`, `repaired: 5`).

## Comportamiento esperado a futuro

GR completo + lock mapeado → await TTLock → código en DB → visible en detalle → correos recepción/huésped/tenant automáticamente.

## Pendiente

Deploy a producción para que el fix de sesión/settle aplique en runtime Vercel (el repair ya escribió códigos en la DB compartida/Neon).
