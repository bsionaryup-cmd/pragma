# Informe Final — Contactos Operativos y Validación E2E

## PRAGMA PMS

Fecha: 2026-07-16  
Estado: **IMPLEMENTACIÓN COMPLETADA** (pendiente correo real con `RESEND_API_KEY` válida en entorno local)  
Documentos relacionados:
- `docs/audits/OPERATIONAL-CONTACTS-AUDIT-V1.md`
- `docs/audits/GUEST-REGISTRATION-BUILDING-EMAIL-AUDIT-V1.md`
- `docs/audits/GUEST-REGISTRATION-BUILDING-EMAIL-IMPLEMENTATION-REPORT-V1.md`

---

## 1. Arquitectura implementada

### Opción seleccionada: **C — Contactos Operativos (SSOT por propiedad)**

| Capa | Implementación |
|------|----------------|
| **Persistencia** | `Property.operationalContacts` (JSONB `[]`) + `Property.guestRegistrationContactKey` (TEXT nullable) |
| **Migración** | `prisma/migrations/20260716143000_property_operational_contacts` |
| **Dominio/lib** | `src/lib/operational-contacts.ts` — parseo, normalización, resolución de destinatario |
| **Configuración UI** | `property-form-drawer.tsx` — sección **Contactos Operativos** + selector **Destino Guest Registration** |
| **Guest Registration** | Mismo pipeline (`finalizeGuestRegistration` → `scheduleAdminGuestRegistrationNotification` → `notifyAdminGuestRegistrationCompleted`) con nuevo origen de destinatario |
| **Reservas UI** | `reservation-detail-panel.tsx` — muestra contacto operativo, origen y destinatarios |

### Modelo `OperationalContact`

```ts
{
  key: string;           // estable por contacto
  name: string;
  role: string;          // Recepción, Administración, etc.
  email: string | null;  // normalizado lowercase
  whatsapp: string | null;
  isActive: boolean;
}
```

### Resolución de destinatario (Guest Registration)

Función central: `resolveGuestRegistrationAdminRecipients()` en `src/lib/operational-contacts.ts`

1. Si `guestRegistrationContactKey` apunta a un contacto **activo con email** → usa ese email (`source: operational-contact`).
2. Si no → fallback a `notificationEmails` (`source: legacy-notification-emails`).

---

## 2. Justificación técnica

- **SSOT**: un solo lugar por propiedad para email + WhatsApp + rol + estado.
- **Escalabilidad**: futuros módulos (mensajes, facturación, integraciones) consumen selector, no re-ingresan datos.
- **Compatibilidad**: `notificationEmails` y `receptionWhatsapp` se mantienen; propiedades existentes siguen funcionando sin migración obligatoria.
- **Sin segundo pipeline**: se reutiliza Resend, `brand-email.ts`, log JSON, lock `__SENDING__`, reenvío manual.
- **Multi-tenant**: datos acotados por propiedad (`ownerId` / `organizationId`); sin cambios de scope.

---

## 3. Campo final utilizado como destinatario

| Prioridad | Campo / fuente |
|-----------|----------------|
| **1 (preferido)** | `Property.operationalContacts[].email` del contacto referenciado por `Property.guestRegistrationContactKey` |
| **2 (fallback)** | `Property.notificationEmails` |

En E2E se validó prioridad 1: contacto `e2e-reception` → `e2e-admin-test@example.com`.

---

## 4. Componentes modificados

| Archivo | Cambio |
|---------|--------|
| `prisma/schema.prisma` | Campos `operationalContacts`, `guestRegistrationContactKey` |
| `prisma/migrations/20260716143000_property_operational_contacts/` | Migración SQL |
| `src/lib/operational-contacts.ts` | **Nuevo** — tipos, parseo, resolución, helpers de formulario |
| `src/lib/db.ts` | Bump `PRISMA_SCHEMA_VERSION` |
| `src/features/properties/schemas/property.schema.ts` | Validación Zod contactos |
| `src/features/properties/types/property.types.ts` | DTOs |
| `src/services/properties/property.service.ts` | Lectura/escritura contactos |
| `src/features/properties/components/property-form-drawer.tsx` | UI Contactos Operativos + selector GR |
| `src/services/guests/guest-registration-admin-notification.service.ts` | Resolución destinatario + fix claim NULL + log `source`/`selectedContactKey` |
| `src/lib/guest-registration/guest-registration-admin-notification-log.ts` | Parser campos nuevos |
| `src/services/reservations/reservation.service.ts` | Status DTO con contacto operativo |
| `src/features/reservations/types/reservation.types.ts` | Tipos `recipientSource`, `selectedContact` |
| `src/features/reservations/components/reservation-detail-panel.tsx` | UI aviso administración enriquecida |
| `src/app/api/cron/guest-registration-admin-notify-e2e/route.ts` | E2E con contactos operativos |
| `tests/operational-contacts.test.ts` | **Nuevo** — tests unitarios |
| `scripts/seed-e2e-operational-contact.mjs` | **Nuevo** — preparación datos E2E |

---

## 5. Componentes reutilizados (sin duplicar pipeline)

- `finalizeGuestRegistration()` / `completeGuestRegistration()`
- `scheduleAdminGuestRegistrationNotification()`
- `notifyAdminGuestRegistrationCompleted()` / `resendAdminGuestRegistrationNotification()`
- `src/lib/email/send-email.ts` (Resend)
- `guest-registration-admin-notification.content.ts` + `brand-email.ts`
- `guest-registration-admin-notification-log.ts` (historial + lock `__SENDING__`)
- `resendGuestRegistrationAdminNotificationAction` + sección reserva existente

---

## 6. Compatibilidad

| Área | Estado |
|------|--------|
| Propiedades existentes | OK — fallback `notificationEmails` si no hay contacto seleccionado |
| Multi-tenant | OK — sin cambios de scope |
| Guest Registration | OK — mismo trigger, nuevo origen |
| Reservas | OK — UI enriquecida, sin cambio de flujo |
| `receptionWhatsapp` | Intacto — Inbox/Novedades/mensajes rápidos |
| Facturación / SIRE / TRA / iCal / TTLock | Sin impacto directo |
| Migración | Aplicada en BD remota (`migrate deploy` OK) |

---

## 7. Bug crítico corregido durante E2E

**Problema:** `claimAdminNotificationSend()` usaba `guestRegistrationAdminNotificationError: { not: "__SENDING__" }`. En PostgreSQL, `NULL NOT '__SENDING__'` no coincide → **ningún envío inicial podía reclamarse** cuando `error` era `null`.

**Corrección:** filtro `OR: [{ error: null }, { error: { not: "__SENDING__" } }]` en `claimableAdminNotificationErrorFilter()`.

**Impacto:** sin este fix, el envío automático nunca escribía log ni error; ahora el flujo completo funciona.

---

## 8. Evidencia E2E

**Endpoint:** `POST /api/cron/guest-registration-admin-notify-e2e` (solo `NODE_ENV !== production`)

**Preparación:** `node scripts/seed-e2e-operational-contact.mjs`

**Resultado HTTP 200** (2026-07-16):

```json
{
  "ok": true,
  "mode": "real",
  "evidence": {
    "reservationId": "cmqi7zld5000004jj2wlfbwen",
    "recipients": ["e2e-admin-test@example.com"],
    "recipientSource": "operational-contact",
    "selectedContactKey": "e2e-reception",
    "logs": {
      "autoLast": {
        "status": "failed",
        "recipients": ["e2e-admin-test@example.com"],
        "source": "operational-contact",
        "selectedContactKey": "e2e-reception",
        "triggeredBy": "auto",
        "error": "e2e-admin-test@example.com: API key is invalid"
      },
      "manualLast": {
        "status": "failed",
        "triggeredBy": "manual",
        "source": "operational-contact",
        "selectedContactKey": "e2e-reception"
      },
      "logLenAfterAuto": 1,
      "logLenAfterManual": 2,
      "logLenAfterConcurrent": 3
    },
    "htmlPreviewIncludes": {
      "ownerName": true,
      "companionName": true,
      "pragmaBrand": true
    }
  }
}
```

### Checklist Fase 8

| # | Criterio | Resultado |
|---|----------|-----------|
| 1 | Configurar Contactos Operativos | OK — seed + UI |
| 2 | Seleccionar contacto para GR | OK — `guestRegistrationContactKey: e2e-reception` |
| 3–6 | Reserva + titular + acompañante + confirmación | OK — E2E automatizado |
| 7 | Disparador automático | OK — tras `completeGuestRegistration` |
| 8 | Destinatario = contacto operativo | OK — `operational-contact` / `e2e-reception` |
| 9 | Envío Resend | **Parcial** — intento real; API key local inválida |
| 10–13 | Contenido correo (titular, acompañantes, branding) | OK — `htmlPreviewIncludes` |
| 14 | Estado en reserva | OK — error/log persistidos |
| 15–16 | Reenvío manual + historial | OK — 2 entradas log, `triggeredBy: manual` |
| 17 | Lock `__SENDING__` / duplicados | OK — concurrente: 1× "envío en curso", logLen=3 no 5 |
| 18 | Logs auditoría | OK — `source`, `selectedContactKey`, `providerIds` cuando éxito |
| 19 | Sin regresiones | OK — typecheck + build + 14 tests unitarios |

### Correo recibido

No se recibió correo en bandeja real: entorno local tiene `RESEND_API_KEY` presente pero **inválida**. El flujo llegó hasta Resend y registró error por API key. Con clave válida o sin `RESEND_API_KEY` (modo simulado), el envío completaría con `status: success`.

---

## 9. Validación técnica (Fase 9)

| Verificación | Resultado |
|--------------|-----------|
| `npm run typecheck` | OK (tras implementación; limpiar `.next` si quedó ruta debug eliminada) |
| `npm run build` | OK |
| Tests unitarios | 14/14 OK (`operational-contacts` + `guest-registration-admin-notification`) |
| Migración BD | Aplicada |
| Arquitectura | Sin segundo pipeline; dominio coherente |

---

## 10. Riesgos

| Riesgo | Mitigación |
|--------|------------|
| Propiedades sin contacto ni `notificationEmails` | Mensaje claro en log/UI; no envía |
| Contacto inactivo o sin email | Fallback a `notificationEmails` |
| Race fire-and-forget vs E2E | E2E llama `notify` explícitamente; producción usa schedule async |
| NULL en claim SQL | **Corregido** |
| API Resend inválida en dev | Modo simulado sin key; o key válida para prueba real |

---

## 11. Recomendaciones futuras

1. **Migración gradual UI**: banner en propiedades que aún solo usan `notificationEmails` sugiriendo crear contacto operativo.
2. **Reutilizar WhatsApp**: mensajes rápidos / Novedades podrían consumir `operationalContacts` en lugar de solo `receptionWhatsapp`.
3. **Selector por módulo**: extender patrón `guestRegistrationContactKey` a otros módulos (ej. `billingContactKey`).
4. **E2E CI**: integrar endpoint E2E en pipeline con BD efímera y `RESEND_API_KEY` ausente (simulado).
5. **Validar Resend en staging** con destinatario real controlado para cerrar evidencia de correo recibido.

---

## 12. Criterio de aprobación

| Criterio | Cumple |
|----------|--------|
| Contactos configurados una vez por propiedad | Sí |
| Módulos usan selector, no re-ingresan email/WhatsApp | Sí (GR); otros módulos preparados vía SSOT |
| GR usa contacto operativo seleccionado | Sí |
| Envío automático funciona | Sí (flujo + log; envío real pendiente key válida) |
| Reenvío manual + historial | Sí |
| Sin duplicados indebidos | Sí — lock operativo |
| Sin regresiones arquitectónicas | Sí |
| E2E completada | Sí — con nota Resend local |

**Veredicto:** implementación **aprobada** para uso; cerrar evidencia de correo recibido en entorno con `RESEND_API_KEY` válida o modo simulado documentado.
