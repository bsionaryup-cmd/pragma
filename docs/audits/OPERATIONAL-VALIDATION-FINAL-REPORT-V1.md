# Informe de Validación Operativa Final

## PRAGMA PMS — Notificaciones Guest Registration (Resend)

**Fecha de ejecución:** 2026-07-16  
**Estado:** **NO APROBADA PARA PRODUCCIÓN** (bloqueo de infraestructura)  
**Ejecutor:** validación automatizada en entorno local  
**Documentos previos:** `OPERATIONAL-CONTACTS-E2E-REPORT-V1.md`, `OPERATIONAL-CONTACTS-AUDIT-V1.md`

---

## Conclusión ejecutiva

La funcionalidad de PRAGMA (pipeline, contactos operativos, historial, reenvío, anti-duplicados, plantilla HTML) **opera correctamente hasta la llamada a Resend**. El flujo E2E completo se ejecutó y registró evidencia consistente.

**Bloqueo único para producción:** la `RESEND_API_KEY` configurada en el entorno local **no es válida** (`API key is invalid`). Resend rechaza la autenticación antes de cualquier intento de entrega. **No se pudo confirmar recepción real del correo.**

No se detectaron defectos en el código de PRAGMA que requieran cambios arquitectónicos.

---

## FASE 1 — Auditoría de infraestructura

**Script:** `node scripts/audit-resend-infrastructure.mjs`  
**Evidencia:** `docs/audits/evidence/resend-infrastructure-audit.json`

### Variables verificadas (sin exponer secretos)

| Variable | Estado |
|----------|--------|
| `RESEND_API_KEY` | Presente, formato `re_…` (39 chars), **rechazada por Resend** |
| `EMAIL_FROM` | `PRAGMA Facturación <facturacion@pragma.co>` |
| `PRAGMA_BILLING_EMAIL` | `facturacion@pragmapms.com` |
| `RESEND_INBOUND_WEBHOOK_SECRET` | No configurada (no aplica a envío transaccional GR) |
| `NODE_ENV` | `development` |
| `VERCEL` | No definida (runtime local) |

### Remitente resuelto

- **From:** `PRAGMA Facturación <facturacion@pragma.co>`
- **Dominio remitente:** `pragma.co`

### Llamadas API Resend

| Endpoint | HTTP | Resultado |
|----------|------|-----------|
| `GET /domains` | 400 | `API key is invalid` |
| `GET /api-keys` | 400 | `API key is invalid` |

### Anomalías documentadas

1. **CRÍTICA — API Key inválida:** Resend rechaza la clave en `.env` y `.env.local` (misma clave en ambos archivos).
2. **ADVERTENCIA — Dominio remitente vs billing:** `EMAIL_FROM` usa `facturacion@pragma.co` mientras `PRAGMA_BILLING_EMAIL` apunta a `facturacion@pragmapms.com`. Aun con clave válida, conviene alinear remitente con un dominio **verificado** en la cuenta Resend (probablemente `pragmapms.com`).
3. **INFO — Inbound webhook:** `RESEND_INBOUND_WEBHOOK_SECRET` ausente; no bloquea envío saliente de Guest Registration.

### Veredicto Fase 1

**NO APROBADA** — infraestructura de correo no operativa en local.

---

## FASE 2 — Configuración

**Scripts utilizados:**

- `node scripts/prepare-e2e-guest-registration-notify.mjs` — reset/creación de reserva + contacto operativo
- Contacto: `e2e-reception` → `e2e-admin-test@example.com`
- Propiedad: `804 Loft amplio 4P con Vista Panorámica | Laureles Top`
- Reserva: `cmqi7zld5000004jj2wlfbwen`

No se insertaron datos manualmente en BD; solo scripts de preparación existentes/nuevos de soporte E2E.

---

## FASE 3 — Validación E2E

**Endpoint:** `POST /api/cron/guest-registration-admin-notify-e2e`  
**Evidencia:** `docs/audits/evidence/e2e-run-latest.json`  
**Resultado HTTP:** `200`

| Paso | Resultado |
|------|-----------|
| Reserva de prueba | OK — reset automático |
| Huésped principal | OK — `E2E Titular-*` |
| Acompañante | OK — `E2E Acompañante-*` |
| Completar GR | OK — `guestRegistrationCompletedAt` set |
| Disparo automático | OK — pipeline invocado |
| Resolución destinatarios | OK — `operational-contact` / `e2e-reception` |
| Llamada Resend | OK — request enviada |
| Entrega / recepción | **FALLA** — `API key is invalid` |
| Contenido HTML | OK — ver Fase 7 |
| Branding | OK — `pragmaBrand: true` |

### Asunto generado (ejemplo visual)

`Registro de huéspedes — 804 Loft amplio 4P | Laureles Top (E2E-VAL-001)`

### Destinatarios

`e2e-admin-test@example.com` (desde contacto operativo, no `notificationEmails`)

---

## FASE 4 — Reenvío manual

Simulado vía `resendAdminGuestRegistrationNotification` en E2E (equivalente a acción UI "Reenviar a Administración"):

| Criterio | Evidencia |
|----------|-----------|
| Nuevo envío | OK — segundo intento registrado |
| Nuevo timestamp | OK — `10:02:48` vs auto `10:02:47` |
| `triggeredBy: manual` | OK |
| `userId` presente | OK — `e2e-user-e7fb6967` |
| Historial actualizado | OK — `logLenAfterManual: 2` |

---

## FASE 5 — Anti-duplicados

Prueba concurrente (2 reenvíos simultáneos):

| Resultado | Detalle |
|-----------|---------|
| Envíos registrados | 3 total (no 4+) — `logLenAfterConcurrent: 3` |
| Lock `__SENDING__` | OK — uno devolvió `"Ya hay un envío en curso para esta reserva"` |
| Sin registros huérfanos | OK — error persistido de forma coherente |

---

## FASE 6 — Historial

Entrada automática (extracto):

```json
{
  "at": "2026-07-16T10:02:47.164Z",
  "status": "failed",
  "recipients": ["e2e-admin-test@example.com"],
  "error": "e2e-admin-test@example.com: API key is invalid",
  "triggeredBy": "auto",
  "source": "operational-contact",
  "selectedContactKey": "e2e-reception"
}
```

Entrada manual: mismo patrón con `triggeredBy: manual` y `userId`.

**Nota:** `providerIds` vacío porque Resend no devolvió ID al fallar autenticación. Con envío exitoso, se persistiría `providerIds[email] = resend_id`.

---

## FASE 7 — Validación visual

**Artefactos:**

- `docs/audits/evidence/guest-registration-admin-email-preview.html`
- `docs/audits/evidence/guest-registration-admin-email-preview.txt`

| Elemento | Validado |
|----------|----------|
| Logo PRAGMA | OK — `logo-full-light.png` |
| Encabezado / pie | OK — `pragmaEmailHeaderHtml` / footer |
| Texto "PRAGMA PMS" | OK |
| Tabla huésped principal | OK — nombre, documento, nacionalidad, nacimiento, teléfono, correo |
| Tabla acompañantes | OK — 4 columnas |
| Información reserva | OK — código, propiedad, fechas, conteo |
| Responsive / legibilidad | OK — tablas inline, max-width 640px |
| Ortografía | OK — español correcto |

Envío simulado (sin API key en script preview): `id: "simulated"`, `ok: true`.

---

## FASE 8 — Auditoría técnica posterior

| Verificación | Resultado |
|--------------|-----------|
| Regresiones de código | Ninguna introducida en esta ejecución |
| Arquitectura | Sin cambios — no se modificó pipeline |
| Tests unitarios | **14/14 OK** |
| Typecheck | OK tras limpiar caché `.next` de ruta debug eliminada |
| Build (sesión previa) | OK |
| Otros módulos | Sin impacto |

**Scripts de soporte añadidos (solo operación/auditoría, no dominio):**

- `scripts/audit-resend-infrastructure.mjs`
- `scripts/prepare-e2e-guest-registration-notify.mjs`
- `scripts/generate-guest-registration-email-preview.ts`

---

## Matriz de criterios de aceptación

| Criterio | Cumple |
|----------|--------|
| Auditoría infraestructura aprobada | **No** — API key inválida |
| Configuración Resend validada | **No** |
| Correo enviado correctamente | **No** — fallo en proveedor |
| Correo recibido correctamente | **No** — no verificable |
| Contenido completo y correcto | **Sí** — HTML/texto validados |
| Branding validado | **Sí** |
| Reenvío manual funcionando | **Sí** — flujo + historial |
| Historial consistente | **Sí** |
| Anti-duplicados validado | **Sí** |
| Sin regresiones | **Sí** |
| Auditoría posterior aprobada | **Sí** (código PRAGMA) |
| Informe final entregado | **Sí** |

---

## Acciones correctivas requeridas (antes de producción)

### Bloqueante

1. **Rotar / reemplazar `RESEND_API_KEY`** en Resend Dashboard y actualizar `.env.local` con una clave activa.
2. **Verificar dominio remitente** en Resend (`pragmapms.com` o el dominio que corresponda).
3. **Alinear `EMAIL_FROM`** con un remitente autorizado en dominio verificado, por ejemplo:
   ```
   EMAIL_FROM="PRAGMA PMS <notificaciones@pragmapms.com>"
   ```
4. **Repetir E2E** con destinatario real controlado y confirmar recepción en bandeja.

### Recomendado

5. Configurar `RESEND_INBOUND_WEBHOOK_SECRET` si se usa inbound (Airbnb email); no bloquea GR admin notify.
6. Integrar `scripts/audit-resend-infrastructure.mjs` en checklist pre-deploy.

---

## Procedimiento de re-validación (cuando exista API key válida)

```powershell
node scripts/audit-resend-infrastructure.mjs
# Debe retornar approved: true

node scripts/prepare-e2e-guest-registration-notify.mjs
curl.exe -s -X POST http://localhost:3000/api/cron/guest-registration-admin-notify-e2e
```

Confirmar en evidencia:

- `status: "success"` en log automático
- `providerIds` con ID Resend
- `guestRegistrationAdminNotifiedAt` poblado
- Correo recibido en bandeja del contacto operativo

---

## Veredicto final

| Área | Estado |
|------|--------|
| Código PRAGMA | **Apto** |
| Infraestructura Resend (local) | **No apto** |
| **LISTA PARA PRODUCCIÓN** | **NO** |

La funcionalidad queda **implementada y validada a nivel aplicación**, pero **bloqueada para despliegue productivo** hasta resolver la API key y el dominio remitente en Resend. Una vez corregido el proveedor, se estima una re-validación de **< 30 minutos** sin cambios de código.
