# Cierre — enriquecimiento automático Airbnb (URBA Nova Loft 33)

**Organización:** `cmplxfg0a000105jrs0gqtwyc`  
**Inbound Resend:** `samuel-silva-gqtwyc@vepcen.resend.app`  
**Gmail propietario:** `urbanovaloft@gmail.com`  
**Filtro Gmail (mantener):** `from:(airbnb.com)`  
**Fecha cierre:** 2026-06-15

---

## Resumen ejecutivo

El incidente principal de enriquecimiento Airbnb se considera **resuelto**. El pipeline Gmail → Resend → webhook → clasificación → enriquecimiento funciona de extremo a extremo en producción con el fix `e047ed2`.

---

## Estado por componente

| Componente | Estado | Evidencia |
|------------|--------|-----------|
| Gmail auto-forward | OK | Correos `express@airbnb.com` llegan sin `Fwd:` manual |
| Resend inbound | OK | Integración ACTIVE; 54+ audits históricos |
| Webhook Resend | OK | `/api/webhooks/resend/inbound` procesa y persiste audits |
| Clasificación CONFIRMED | OK | Fix `e047ed2` desplegado; router 5/5 + suite 92/92 |
| Enrichment | OK | Miguel Castro enriquecido (nombre, HM, monto) |
| Cron inbound reconcile | OK | Ruta activa; `CRON_SECRET` en Vercel prod; prueba manual 200 OK |
| Filtro Gmail | Sin cambios | `from:(airbnb.com)` — no optimizado a propósito |

\* Cron programado diario `35 6 * * *` (plan Hobby).

---

## Git y deploy

| Paso | Estado |
|------|--------|
| Rama `cursor/airbnb-enrichment-e2e-cron-deploy` | Pusheada |
| Merge a `main` | `813d8ed` (fast-forward) |
| Deploy producción | `https://www.pragmapms.com` — Ready |

| Item | Detalle |
|------|---------|
| Fix router | `e047ed2` — en producción desde 2026-06-14 |
| Rama hardening | `cursor/airbnb-enrichment-e2e-cron-deploy` |
| Cron schedule | `vercel.json`: `35 6 * * *` (Hobby-compatible) |
| Hardening montos | `pickReservationAmount` incluye `hostPayoutAmount` |

---

## CRON_SECRET — configuración y prueba

**Variable:** `CRON_SECRET` añadida en Vercel **Production** (2026-06-15).

**Autorización:** `Authorization: Bearer <CRON_SECRET>` o `?secret=<CRON_SECRET>`.

**Prueba manual (2026-06-15, post-redeploy `dpl_FPCEshRN7pB9jwoZvAiUMQZX8EQp`):**

| Escenario | HTTP | Resultado |
|-----------|------|-----------|
| Sin `Authorization` | 401 | `{"ok":false,"message":"Unauthorized"}` |
| Con `Bearer <CRON_SECRET>` | 200 | `ok: true`, `durationMs: ~15000`, `resendListed: 64`, `resendIngested: 10` |

El cron inbound reconcile **funciona correctamente** en producción.

---

## Caso validado: Miguel Castro

| Campo | Valor |
|-------|-------|
| Audit | `cmqem616w000004jmapjhyqt3` |
| Reserva | `cmqegpzvl000404ifzh990xtf` |
| Clasificación | CONFIRMED |
| guestName | Miguel Castro |
| reservationCode | HMQDRNFBZW |
| totalAmount | 333.422,12 COP |

---

## Reservas placeholder pendientes

Auditoría de fechas exactas (`scripts/audit-placeholder-reservations.mjs`):

| Reserva | Fechas | guestName | HM | Monto | Correo recuperable |
|---------|--------|-----------|-----|-------|-------------------|
| `cmqegpzso000004if34la52oo` | 27–30 jun 2026 | Huésped Airbnb | — | 0 | **No** |
| `cmqegpzue000204iffd78tkxk` | 7–14 jul 2026 | Huésped Airbnb | — | 0 | **No** |

**Causa:** `NO_AUDIT_IN_DB` — el correo de confirmación nunca ingresó a PRAGMA para esas fechas exactas. Las reservas existen vía iCal; no hay audit ni `ReservationEmailEvent` recuperable en BD.

**Acción:** Esperar auto-forward del próximo correo Airbnb para esas reservas, o reenvío manual puntual del correo histórico desde Gmail si aún existe en bandeja.

---

## Riesgos pendientes (no bloqueantes)

1. **Cron diario** — reconcile inbound solo 1×/día en Hobby; webhooks cubren el flujo principal.
2. **2 reservas placeholder** — sin correo histórico en BD; dependen de próximo inbound.
3. **Reconcile misclassified script** — backfill manual fue necesario para Miguel cuando `netPayout=0` y solo `hostPayoutAmount`; corregido en código con `pickReservationAmount`.
4. **Preview env** — `CRON_SECRET` solo en Production; previews de cron requieren configuración adicional si se prueban.

---

## Comandos de verificación

```bash
npm run test:airbnb-email
npx tsx scripts/prove-router-confirmed-not-canceled.ts
node scripts/verify-miguel-enrichment.mjs
node scripts/audit-placeholder-reservations.mjs
```
