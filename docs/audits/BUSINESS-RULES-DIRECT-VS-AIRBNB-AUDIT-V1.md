# Auditoría de Reglas de Negocio — Direct vs Airbnb

Fecha: **2026-07-16**  
Estado: **APROBADA — TODOS PASS**  
Tipo: Solo pruebas reales / sin cambios de código de producto  
Evidencia: `docs/audits/evidence/business-rules-direct-vs-airbnb.json`  
Script: `scripts/audit-business-rules-direct-vs-airbnb.ts`

---

## Resumen ejecutivo

| Flujo / Área | Resultado |
|--------------|-----------|
| Flujo Reserva Directa | **PASS** |
| Flujo Airbnb | **PASS** |
| Guest Registration | **PASS** |
| Administración | **PASS** |
| TTLock | **PASS** |
| Correo con Código | **PASS** |
| Anti-Duplicados | **PASS** |
| Casos Negativos | **PASS** |
| Auditoría Global | **PASS** |

**No se detectó defecto de producto.** No se modificó código de aplicación.

---

## Regla 1 — Reserva Directa → **PASS**

Prueba real (propiedad 801 / Margarita):

| Check | Evidencia |
|-------|-----------|
| Correo válido | `magvillafuerte@gmail.com` |
| Guest Registration Link | generado (`/guest-registration/…`) |
| Bienvenida automática | providerId registrado en evidencia JSON (`success`) |
| Historial | `guestRegistrationInviteLog` status `success` |
| Sin duplicado auto | 2º intento → `skipped` |

---

## Regla 2 — Reserva Airbnb → **PASS**

| Check | Evidencia |
|-------|-----------|
| iCal sync | Llama `ensureGuestRegistrationForReservation`; **no** importa/envía welcome |
| Auto welcome | `skipped: Correo de bienvenida solo para reservas directas` |
| Historial invite | vacío / `inviteSentAt` null |
| TTLock antes de GR | `tryGenerate` → `null` |

---

## Regla 3 — Guest Registration → **PASS**

| Check | Evidencia |
|-------|-----------|
| COMPLETED | `guestRegistrationCompletedAt` seteado |
| Titular + acompañante | 2 huéspedes registrados |

---

## Regla 4 — Correo administración → **PASS**

| Check | Evidencia |
|-------|-----------|
| Auto post-GR | Sí |
| Contacto Operativo | `porterialofts33ph@gmail.com` (`source: operational-contact`) |
| Historial | `success` + providerId registrado |
| Anti-dupe | `Ya se notificó a administración` / skipped |

---

## Regla 5 — Código TTLock → **PASS**

| Check | Evidencia |
|-------|-----------|
| Antes de GR | Bloqueado: *"aún no completó el registro"* · 0 credenciales |
| Después de GR | Credencial `cmrnj4jyt00094ctyoyw5qiuc`; código `819834#` |

---

## Regla 6 — Correo con código → **PASS**

| Check | Evidencia |
|-------|-----------|
| Destinatarios | Huésped + Contacto Operativo (vía `autoSendCode`) |
| Formato | `819834#` plain — sin `**…**` |
| `deliveryStatus` | `SENT` |

---

## Regla 7 — Anti-duplicados → **PASS**

| Canal | Resultado |
|-------|-----------|
| Bienvenida | 2º auto → skipped |
| Administración | 2º auto → skipped |
| Código TTLock | 2º envío → skipped |

---

## Casos negativos → **PASS**

| Caso | Resultado |
|------|-----------|
| Direct sin correo | No envía — *"no tiene email de huésped válido"* |
| Airbnb | No bienvenida automática |
| GR incompleto | No TTLock / no correo código |
| TTLock falla (credencial sin código) | Envío no exitoso; `deliveryStatus` ≠ `SENT` |
| Reenvío | Auto bloqueado; `force: true` (manual) permitido con link ACTIVE |

---

## Auditoría global → **PASS**

| Check | Resultado |
|-------|-----------|
| Pipelines de correo nuevos | No — solo `sendEmail` → Resend |
| Duplicación de lógica de transporte | No |
| Impacto QR Mobility / INTIENDAS / Facturación / Inbox | Ninguno en este flujo |
| Cambios de código | Ninguno (solo script/informe de auditoría) |

---

## Criterio de aceptación

| Criterio | Cumple |
|----------|--------|
| Direct envía bienvenida + link GR | Sí |
| Airbnb no envía bienvenida auto | Sí |
| TTLock nunca antes de GR COMPLETED | Sí |
| Correo código solo tras generación exitosa | Sí |
| Huésped + Contacto Operativo reciben código | Sí |
| Sin duplicados automáticos | Sí |
| Sin regresiones / arquitectura intacta | Sí |

**Conclusión:** la funcionalidad queda **definitivamente validada** respecto a las reglas de negocio Direct vs Airbnb.
