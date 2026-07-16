# Informe — Incidencia bienvenida Direct + corrección

Fecha: **2026-07-16**  
Auditoría: `docs/audits/WELCOME-EMAIL-INCIDENT-AUDIT-V1.md`  
Evidencia causa: `docs/audits/evidence/welcome-email-incident-root-cause.json`  
Evidencia fix: `docs/audits/evidence/welcome-email-hold-fix-verify.json`

---

## Causa raíz

`createReservation` solo enviaba bienvenida si `totalAmount === 0`.  
Con monto > 0 (wizard real) activaba hold y **no** enviaba hasta el depósito.

Caso Urba 33 (`cmrnm2qbv000e04l7f17j5nih`): DIRECT + CONFIRMED + email válido + total 196510 + hold activo → invite vacío.

Auditorías previas usaron `totalAmount: 0` → falso PASS.

---

## Corrección (mínima)

| Archivo | Cambio |
|---------|--------|
| `reservation.service.ts` | ensure + send bienvenida Direct **antes** de activar hold |
| `guest-registration-email.service.ts` | Comprobar `inviteSentAt` antes que `holdExpiresAt` (mensaje anti-dupe correcto) |

Sin pipelines nuevos. Post-hold sigue como reintento idempotente.

---

## Recuperación incidente

Reserva Urba 33: reenvío manual (`force`) → providerId `a2431392-f3a9-4ddb-8f6c-121ebb17983e` · success.

---

## Regresión

| Check | Resultado |
|-------|-----------|
| Direct con monto + hold | Bienvenida enviada **antes** del hold · PASS |
| Anti-dupe | skipped · PASS |
| Airbnb sin bienvenida auto | PASS |
| Typecheck | PASS |

Dominios no tocados: GR core, TTLock, admin notify, QR, INTIENDAS, facturación, Inbox.

---

## Criterio de aceptación

| Criterio | Cumple |
|----------|--------|
| Causa raíz identificada | Sí |
| Bienvenida auto en Direct con monto | Sí |
| Airbnb sin bienvenida auto | Sí |
| Sin regresiones de dominio | Sí |
