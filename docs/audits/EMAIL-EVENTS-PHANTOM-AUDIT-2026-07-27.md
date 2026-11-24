# Auditoría Integral — Flujo de Eventos y Correos (P0)

**Fecha:** 2026-07-27  
**Prioridad:** P0  
**Alcance:** disparos de correo / eventos GR / TTLock / billing / E2E / scripts

---

## Veredicto

Se identificaron rutas que pueden generar **correos no asociados a un evento de negocio real** (E2E sobre reservas Direct reales, preview Vercel con Resend, huéspedes sintéticos UIVis/E2E/Guest-*).  

Se aplicaron **correcciones quirúrgicas** (sin refactor de arquitectura ni cambios de UI).  
Flujos válidos Direct / Airbnb / iCal / GR / TTLock / force manual se preservan.

---

## Árbol de envío (Resend)

| # | Correo | Trigger | Idempotencia |
|---|--------|---------|--------------|
| 1 | Bienvenida GR | Create Direct / hold finalize / reenvío manual | Claim `__SENDING__` + `inviteSentAt` |
| 2 | Admin/recepción GR done | `completeGuestRegistration` → completion-comms | Claim `adminNotifiedAt` |
| 3 | Código TTLock | completion-comms / generate (autoSend) | Claim `deliveryStatus=PENDING` |
| 4 | Reporte tenant | completion-comms | Heurística skip (débil) |
| 5 | Factura billing | pago aprobado | Claim `invoiceEmailSentAt` (ahora **antes** del send) |

**iCal sync:** crea reservas + token GR; **no** envía bienvenida.  
**Inbound Airbnb email:** solo recepción.

---

## Causas raíz de correos “fantasma”

| Sev | Causa | Impacto |
|-----|-------|---------|
| Crítico | E2E cron mutaba reservas Direct reales; con Resend live bastaba **un** destinatario test mezclado con ops reales | Ops reciben admin/completion por GR E2E |
| Crítico | `VERCEL=1` se trataba como producción → preview con `RESEND_API_KEY` enviaba correo real | Correos desde deploys de preview |
| Alto | Scripts locales (`UIVis`, smoke, audits) sin guard contra DB/Resend prod | Correos a Gmail hardcodeados / ops |
| Medio | Billing receipt TOCTOU (send → mark) | Duplicados bajo concurrencia |
| Medio | Tenant report sin claim durable | Reintentos pueden reenviar |

---

## Correcciones implementadas

1. **`send-email.ts`** — Live solo si `VERCEL_ENV=production` o `NODE_ENV=production` (no preview). Bloqueo de destinatarios sintéticos (`@example.com`, `e2e-owner-`, etc.) salvo `EMAIL_ALLOW_TEST_RECIPIENTS=1`.
2. **`email-safety.ts`** — Detección de huéspedes sintéticos (UIVis, E2E, Guest-*, scripts).
3. **Bienvenida / admin / completion-comms** — Auto-path omite envíos para contexto sintético (manual `force` sigue disponible).
4. **E2E cron** — `isCronAuthorized` + bloqueo prod/preview-prod + exige **100%** destinatarios admin test en modo live.
5. **Billing receipt** — Claim atómico **antes** de `sendEmail`; rollback del claim si falla el envío.

---

## Validaciones

| Check | Resultado |
|-------|-----------|
| `tests/billing/send-email.test.ts` | 7/7 PASS |
| `tests/guests/email-safety.test.ts` | 3/3 PASS |
| Typecheck | PASS |
| ESLint (paths tocados) | 0 errors |
| Prisma validate | PASS |
| `npm run build` | PASS |

---

## Criterios P0

| Criterio | Estado |
|----------|--------|
| No correos por huésped sintético en auto | Mitigado |
| Preview no envía como prod | Mitigado |
| E2E no mezcla ops reales | Mitigado |
| Flujos reales Direct/Airbnb/iCal intactos | Sí (guards solo auto+sintético) |
| Deploy | Completado · `dpl_BHPgmZeXyyKUoze7PLnLEKWTKhn4` · aliased www.pragmapms.com |

### Post-deploy

| Check | Resultado |
|-------|-----------|
| `GET /stay` | 200 |
| E2E cron en Vercel | **No desplegado** (excluido por `.vercelignore`) — correcto |

---

## Notas ops

- Scripts de auditoría/smoke **siguen** pudiendo apuntar a prod DB: usar DB no-prod o quitar `RESEND_API_KEY`.
- Para QA intencional con `@example.com` en live: `EMAIL_ALLOW_TEST_RECIPIENTS=1`.
