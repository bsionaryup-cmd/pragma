# Auditoría — Duplicidad de comunicaciones al huésped

Fecha: **2026-07-16 / 2026-07-17**  
Estado: **CAUSA LATENTE CORREGIDA · ANTI-DUPE VALIDADO**  
Evidencia: `docs/audits/evidence/guest-email-duplication-audit.json`

---

## Fase 1 — Mapa de disparadores (correo al huésped)

| Correo | Evento disparador | Archivo | Destinatario |
|--------|-------------------|---------|--------------|
| **Bienvenida / GR invite** | `createReservation` (Direct, antes del hold) | `reservation.service.ts` | Huésped |
| Bienvenida | `finalizeGuestRegistrationAfterHold` (depósito / post-hold) | `reservation-hold.service.ts` | Huésped |
| Bienvenida | Reenvío manual UI | `resendGuestRegistrationEmailAction` (`force`) | Huésped |
| **Admin GR** | `completeGuestRegistration` → schedule | `guest-registration.service.ts` | Contacto Operativo |
| Admin GR | Reenvío manual | `resendAdminGuestRegistrationNotification` | Contacto Operativo |
| **Código TTLock** | Tras `generateAccessCodeForReservation` (nuevo) | `ttlock-access.service.ts` L526 | Huésped + Ops |
| Código TTLock | **Early-return “ya existe código”** → `scheduleAccessCodeEmail` | `ttlock-access.service.ts` L344 | Huésped + Ops |
| Código TTLock | `restoreRevokedAccessCodeForReservation` | L660 | Huésped + Ops |
| Código TTLock | Cron / jobs | No hay cron de reenvío de código | — |
| Airbnb iCal | Solo `ensure` token | `airbnb-ical-sync.service.ts` | **No** envía bienvenida |

**No** hay pipeline paralelo: todo sale por `sendEmail` → Resend.

---

## Fase 2 — Análisis anti-duplicados

### Bienvenida
| Pregunta | Respuesta |
|----------|-----------|
| ¿Cuándo? | Create Direct (y reintento post-hold) |
| ¿Anti-dupe? | `inviteSentAt` + claim `__SENDING__` + log |
| ¿Puede repetirse auto? | No, si el primer envío dejó `inviteSentAt` |
| ¿Manual? | Sí, con `force: true` |

### Administración
| Anti-dupe | `adminNotifiedAt` + claim + log |
| Manual | `force` |

### Código TTLock
| Anti-dupe | `deliveryStatus` NOT_SENT/FAILED → PENDING → SENT |
| Race concurrente | Claim atómico — 1 éxito / N skipped (**probado**) |
| **Riesgo** | Cada llamada a `generateAccessCode` con código ya existente **vuelve a programar** el envío (L344). Si `deliveryStatus` aún es NOT_SENT (ventana async) o FAILED, puede reintentar. |

---

## Fase 3 — Reproducción

Reserva `cmro688w60000bgtyfp4rjqqz`:

| Prueba | Resultado |
|--------|-----------|
| Welcome × create + post-hold + retry | **1** success auto; 2º/3º skipped |
| Admin auto + retry | **1** success; retry skipped |
| Generate código ×3 + notify ×2 | delivery SENT; re-notify skipped |
| Race 3× notify paralelo | **1** success, 2 skipped |

DB reciente: multi-invite solo en casos **auto + manual** (esperado).

---

## Fase 4 — Corrección (causa latente demostrada)

**Causa:** `generateAccessCodeForReservation`, al encontrar credencial ya activa, llamaba `scheduleAccessCodeEmail` — disparador oculto en cada regeneración/consulta.

**Fix mínimo:** no programar correo en el early-return de “ya existe código”. El envío automático queda solo en generación nueva y en restauración explícita. Anti-dupe `deliveryStatus` se mantiene.

También: retorno explícito si `deliveryStatus === PENDING` (antes caía al claim).

---

## Fase 5–6 — Validación / regresión

Tras el fix: typecheck + tests de correo + re-ejecución del script de duplicidad.

Confirmado: sin cambios a QR / INTIENDAS / Inbox / Facturación / GR core.
