# Informe — Duplicidad de correos al huésped

Fecha: **2026-07-17**  
Auditoría: `docs/audits/GUEST-EMAIL-DUPLICATION-AUDIT-V1.md`  
Evidencia: `docs/audits/evidence/guest-email-duplication-audit.json`

---

## Hallazgo

Los anti-duplicados de bienvenida / admin / código **funcionan** en el camino feliz (1 auto success; reintentos skipped; race claim OK).

**Causa latente real:** al invocar `generateAccessCodeForReservation` cuando ya existía un código activo, el early-return **re-programaba** `scheduleAccessCodeEmail`. Eso reabría el pipeline en cada “ya existe” (UI, reintentos, ventana `NOT_SENT`/`FAILED`).

---

## Corrección

| Archivo | Cambio |
|---------|--------|
| `ttlock-access.service.ts` | No llamar `scheduleAccessCodeEmail` en early-return de código existente |
| `ttlock-access-code-email.service.ts` | Return explícito si `PENDING` |

Envío automático de código se mantiene en: **generación nueva** y **restore**.

---

## Validación

| Check | Resultado |
|-------|-----------|
| Bienvenida auto ≤ 1 | PASS |
| Admin auto ≤ 1 | PASS |
| Código no reenviado en regen | PASS |
| Race 3× notify | 1 success |
| Typecheck | PASS |
| Tests correo/acceso | 18/18 PASS |
| QR / INTIENDAS / Inbox / Facturación | Sin cambios |

**Nota:** El huésped puede recibir **varios tipos** distintos (bienvenida + código). Eso no es duplicado del mismo evento. Duplicado = mismo tipo auto más de una vez.
