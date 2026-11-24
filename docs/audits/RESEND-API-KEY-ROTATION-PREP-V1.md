# Auditoría y Preparación — Sustitución Controlada de RESEND_API_KEY

## PRAGMA PMS

Fecha: 2026-07-16  
Estado: **PREPARACIÓN COMPLETADA — SIN CAMBIOS DE CÓDIGO**  
Prioridad: No romper Airbnb ni ningún flujo existente

---

## FASE 1 — Mapa de dependencias

### Conclusión de lectura de credencial

**Toda** la lógica de aplicación obtiene la clave exclusivamente desde:

```text
process.env.RESEND_API_KEY
```

No hay claves hardcodeadas en servicios. Sustituir el valor en `.env` / `.env.local` (y en Vercel/producción) es suficiente para rotar la credencial **sin tocar código**.

### Diagrama de dependencias

```text
                    RESEND_API_KEY (env)
                            │
          ┌─────────────────┴─────────────────┐
          │                                   │
   OUTBOUND (enviar)                   INBOUND (recibir)
          │                                   │
  src/lib/email/send-email.ts     resend-inbound.client.ts
          │                         │
          ├─ Guest Registration     ├─ webhook /api/webhooks/resend/inbound
          │   (huésped + admin)     ├─ cron airbnb-email-inbound-reconcile
          ├─ Billing receipt        ├─ repair-guest-message-bodies
          └─ (futuros via sendEmail)└─ scripts reinject / reconcile
```

**Variable separada (NO es la API key):**

| Variable | Uso |
|----------|-----|
| `RESEND_INBOUND_WEBHOOK_SECRET` | Firma Svix del webhook inbound |
| `EMAIL_FROM` | Remitente `PRAGMA PMS <noreply@pragmapms.com>` |
| `AIRBNB_INBOUND_EMAIL_DOMAIN` / dirección inbound | Routing Airbnb (cuenta Resend) |

### Consumidores OUTBOUND (`sendEmail` → `api.resend.com/emails`)

| Módulo | Archivo | Usa `RESEND_API_KEY` |
|--------|---------|----------------------|
| Guest Registration → huésped | `src/services/guests/guest-registration-email.service.ts` | Indirecto vía `sendEmail` |
| Guest Registration → administración | `src/services/guests/guest-registration-admin-notification.service.ts` | Indirecto |
| Contactos Operativos | Misma notificación admin (destinatario) | Indirecto |
| Facturación (recibo) | `src/modules/billing/services/billing-receipt-email.service.ts` | Indirecto |
| Adaptador único | `src/lib/email/send-email.ts` | **Directo** |

### Consumidores INBOUND Airbnb (`api.resend.com/emails/receiving`)

| Componente | Archivo | Usa `RESEND_API_KEY` |
|------------|---------|----------------------|
| Cliente Resend receiving | `src/modules/airbnb-email/integrations/resend-inbound.client.ts` | **Directo** (`list` + `fetch`) |
| Webhook inbound | `src/app/api/webhooks/resend/inbound/route.ts` | Fetch body vía cliente |
| Cron reconcile | `src/app/api/cron/airbnb-email-inbound-reconcile/route.ts` | Gate + cliente |
| Repair cuerpos mensaje | `src/modules/reservation-activity/services/repair-guest-message-bodies.ts` | Gate + fetch |
| Scripts operativos | `scripts/run-airbnb-inbound-reconcile.ts`, `reinject-historical-inbound-email.ts`, `verify-resend-inbound-receipt.ts`, `search-resend-for-placeholder-emails.ts` | Env |

### NO usan `RESEND_API_KEY`

| Flujo | Proveedor |
|-------|-----------|
| Password reset / MFA / verificación email | **Clerk** |
| Invitaciones de usuarios | **Clerk** |
| Auth UI “resend código” | Clerk (cooldown UI, no Resend) |

### Endpoints / Cron relacionados

| Ruta | Rol |
|------|-----|
| `POST /api/webhooks/resend/inbound` | Airbnb inbound (Svix + fetch email) |
| `GET/POST /api/cron/airbnb-email-inbound-reconcile` | Poll receiving + reintento |
| `POST /api/cron/guest-registration-admin-notify-e2e` | E2E local (modo real si hay key) |

### Dónde configurar el valor (sin código)

| Entorno | Archivo / panel |
|---------|-----------------|
| Local | `.env` y/o `.env.local` (Next prioriza `.env.local`) |
| Producción | Variables de entorno en Vercel (o host equivalente) |

**Estado local al momento de la auditoría:**

- `RESEND_API_KEY` presente en `.env`
- No definida en `.env.local` (se hereda de `.env`)
- Formato aparente válido (`re_…`) pero **Resend responde `API key is invalid`**
- Remitente institucional ya alineado: `EMAIL_FROM="PRAGMA PMS <noreply@pragmapms.com>"`

---

## FASE 2 — Análisis de impacto

### ¿Cambiar solo `RESEND_API_KEY` afecta…?

| Flujo | ¿Afectado por rotar la key? | Detalle |
|-------|----------------------------|---------|
| **Airbnb (mensajes / inbound)** | **Sí, misma key** | El fetch de cuerpos y el reconcile usan `RESEND_API_KEY`. Rotar es transparente **si la nueva key pertenece a la misma cuenta Resend** (mismos receiving addresses / dominio inbound). |
| Guest Registration | Sí (outbound) | Transparente con key válida + dominio/remitente OK |
| Contactos Operativos | Sí (destino + outbound) | Sin cambio de lógica |
| Facturación | Sí (outbound recibos) | Transparente |
| Password Reset | **No** | Clerk |
| Invitaciones | **No** | Clerk |
| Remitente institucional | No (variable distinta) | Sigue `EMAIL_FROM` |

### Riesgos documentados (antes de rotar)

| Riesgo | Severidad | Mitigación |
|--------|-----------|------------|
| Nueva key de **otra cuenta** Resend | Alta para Airbnb | Airbnb dejaría de ver correos en receiving de la cuenta anterior. Usar key de la **misma** cuenta, o migrar inbound/dominio/webhooks a la cuenta nueva. |
| Key inválida / mal pegada | Alta | Validar con `node scripts/audit-resend-infrastructure.mjs` antes de reiniciar prod |
| Olvidar actualizar Vercel | Alta | Rotar en local y en producción |
| Confundir con `RESEND_INBOUND_WEBHOOK_SECRET` | Media | No rotar el webhook secret al cambiar solo la API key |
| Dominio `pragmapms.com` / `noreply@` no verificado en la cuenta de la key | Media (outbound) | Verificar dominio en Resend Dashboard |

### Veredicto de seguridad para rotación

**Seguro y transparente** si:

1. La nueva `RESEND_API_KEY` es de la **misma cuenta Resend** que hoy recibe Airbnb inbound.
2. Se actualiza solo el valor en env (local + producción).
3. Se reinicia el proceso Node / redeploy para cargar env.
4. No se modifica código fuente.

**No se requieren cambios de lógica, servicios, eventos ni integraciones.**

---

## FASE 3 — Implementación (preparación)

### Acciones realizadas

- Auditoría completa de dependencias.
- Confirmación: cero hardcodes de API key en src.
- **Ninguna modificación de código fuente** (según restricción).

### Procedimiento operativo (único cambio necesario)

1. Generar nueva API key en [Resend Dashboard](https://resend.com/api-keys) **en la misma cuenta**.
2. Sustituir en local (recomendado: una sola fuente):

```env
RESEND_API_KEY=re_xxxxxxxx
EMAIL_FROM="PRAGMA PMS <noreply@pragmapms.com>"
```

Preferible definir `RESEND_API_KEY` en `.env.local` (prioridad Next) y mantener `.env` alineado o sin valor conflictivo.

3. En producción (Vercel): actualizar `RESEND_API_KEY` y redeploy/restart.
4. Validar: `node scripts/audit-resend-infrastructure.mjs` → `approved: true` (o al menos domains `ok: true`).
5. Reiniciar `npm run dev` para que el proceso tome la nueva env.

### No hacer

- No cambiar `RESEND_INBOUND_WEBHOOK_SECRET` salvo rotación deliberada del webhook.
- No cambiar direcciones inbound Airbnb.
- No modificar `send-email.ts` ni `resend-inbound.client.ts`.

---

## FASE 4 — Validación (estado actual)

| Prueba | Resultado |
|--------|-----------|
| Infra audit vs Resend API | **FALLA** — `API key is invalid` (key actual) |
| Remitente institucional | **OK** — `PRAGMA PMS <noreply@pragmapms.com>` |
| Código preparado para rotación | **OK** — solo env |
| E2E outbound / Airbnb con key nueva | **Pendiente** — instalar key válida |

### Checklist post-instalación de la nueva key

```powershell
# 1) Infra
node scripts/audit-resend-infrastructure.mjs

# 2) Outbound GR + contactos operativos
node scripts/prepare-e2e-guest-registration-notify.mjs
curl.exe -s -X POST http://localhost:3000/api/cron/guest-registration-admin-notify-e2e

# 3) Airbnb inbound (si hay correos recientes en Resend)
# Preferir el cron existente / script de reconcile ya documentado:
# npx tsx scripts/run-airbnb-inbound-reconcile.ts
```

Confirmar:

- [ ] Domains API responde 200
- [ ] Envío GR `status: success` + `providerIds`
- [ ] Reenvío manual crea nueva entrada de historial
- [ ] Remitente From = `PRAGMA PMS <noreply@pragmapms.com>`
- [ ] Reconcile Airbnb no falla por `RESEND_API_KEY no configurado` / invalid key
- [ ] Webhook inbound sigue verificando con `RESEND_INBOUND_WEBHOOK_SECRET` (sin cambios)

---

## FASE 5 — Informe final

| Pregunta | Respuesta |
|----------|-----------|
| ¿Fue necesario modificar código? | **No** |
| ¿Módulos que usan Resend? | Outbound: GR, facturación recibos. Inbound: Airbnb email + repair activity |
| ¿Lógica de negocio alterada? | **No** |
| ¿Sustitución transparente? | **Sí**, vía env únicamente |
| ¿Airbnb permanece compatible? | **Sí**, si la nueva key es de la misma cuenta Resend |
| ¿Remitente institucional? | **PRAGMA PMS \<noreply@pragmapms.com\>** (confirmado en env + código) |
| ¿Regresiones introducidas por esta tarea? | **Ninguna** (cero cambios de código) |

### Criterios de aceptación

| Criterio | Estado |
|----------|--------|
| Sin modificar lógica (salvo justificación) | **Cumple** — sin cambios |
| Nueva API Key funciona | **Pendiente** — key actual inválida; listo para sustituir |
| Correos automáticos OK | Pendiente de key válida |
| Airbnb sin cambios de código / compatible | **Cumple** (misma cuenta) |
| Sin regresiones de esta tarea | **Cumple** |
| Cambio transparente | **Cumple** |

---

## Veredicto

**El sistema ya está preparado.** La única acción pendiente del operador es reemplazar el valor de `RESEND_API_KEY` en el entorno (misma cuenta Resend) y reiniciar el proceso.

**No se modificó código fuente en esta ejecución.**

Cuando la nueva key esté instalada, re-ejecutar la checklist de Fase 4 para cerrar la validación operativa como APROBADA.
