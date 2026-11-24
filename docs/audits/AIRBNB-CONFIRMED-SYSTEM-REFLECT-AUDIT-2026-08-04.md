# Auditoría Airbnb CONFIRMED → Sistema / Calendario

**Fecha:** 2026-08-04T05:53Z (audit) · **Remediación:** 2026-08-04T06:00Z  
**Org piloto:** `cmplxfg0a000105jrs0gqtwyc` (Loft 33)

## Remediación aplicada

### 1) Importación de la reserva faltante

- Propiedad: Comuna 13 (`cmpmqaeea000004jvytqozsq1`)
- UID: `1418fb94e984-83d174a1a9f1237ded726032b27f0d9c@airbnb.com`
- Resultado sync: `created: 1`
- Reserva: `cmse92rxu000028tyeshdpjlt`
- Fechas: **2026-09-03 → 2026-09-07**, status **CONFIRMED**, platform AIRBNB
- Calendario query: **`visibleInCalendarQuery: true`** (orphan/ACTIVE OK)

Script: `scripts/_sync-airbnb-ical-property.ts`

### 2) Prevención (automático)

**Causa del hueco:** cron iCal solo corría **1×/día** (`15 6 * * *`). Si Airbnb publica la reserva después del sync y nadie tiene el dashboard abierto (auto-sync cliente), la reserva “no existe” en PRAGMA hasta el día siguiente.

**Fix:** `vercel.json` → `/api/cron/airbnb-ical-sync` ahora **`20 * * * *` (cada hora)**.

Auto-sync en dashboard (`AirbnbAutoSyncLazy` en layout) se mantiene; el cron horario cubre el caso sin sesión abierta.

**Nota:** requiere **deploy** para que el cron horario quede activo en Vercel.

### 3) Re-audit feed

Tras import: los únicos “faltantes” en iCal vivo son `Airbnb (Not available)` → **omitidos por diseño** (`isAirbnbBlockedSummary`). Ningún `Reserved` pendiente.

---

## Veredicto final

| Check | Estado |
|--------|--------|
| Reserved Sep 3–7 en DB + calendario | **PASS** |
| CONFIRMED Airbnb previas | **PASS** |
| Cron para no repetir hueco | **Código listo** — activo tras deploy |
| GR HTTPS fix | Código listo — activo tras deploy |

**Deploy gate:** tras deploy, verificar en UI `/calendar` la barra Sep 3–7 Comuna 13 y que el cron horario figure en Vercel.
