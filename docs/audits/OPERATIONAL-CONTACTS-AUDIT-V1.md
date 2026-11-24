# Auditoría Fase 1 y Evaluación Fase 2

## PRAGMA PMS — Contactos Operativos

Fecha: 2026-07-16  
Estado: APROBADO PARA IMPLEMENTACIÓN  
Alcance: diagnóstico y decisión técnica antes de cambios de dominio.

## Hallazgos de auditoría

- **Correos por propiedad**: se guardan en `Property.notificationEmails` (JSON), normalizados por `parsePropertyNotificationEmails()`.
- **WhatsApp de recepción**: se guarda en `Property.receptionWhatsapp` (string).
- **Sección Recepción actual**: en `property-form-drawer` existe campo `WhatsApp recepción` (mensajería huésped), pero no hay modelo reusable de contactos.
- **Guest Registration**: `notifyAdminGuestRegistrationCompleted()` toma destinatarios de `property.notificationEmails`.
- **Reservas/UI**: ya muestra estado del envío admin en detalle de reserva.
- **Módulos que usan `receptionWhatsapp`**: Inbox AI, Novedades/actions sugeridas, plantillas rápidas.
- **Módulos que usan `notificationEmails`**: hoy principalmente Guest Registration admin notify.
- **Modelo reutilizable existente**: no existe un SSOT de “contactos operativos” por propiedad; hay campos separados por caso.
- **Multi-tenant**: propiedades ya están scopeadas por `ownerId/organizationId`; un modelo por propiedad conserva compatibilidad multi-tenant.

## Riesgos de reemplazo directo

- Reemplazar `notificationEmails` sin compatibilidad rompería notificación admin existente.
- Eliminar `receptionWhatsapp` rompería plantillas y contexto de Inbox AI.
- Mover de golpe todos los consumidores a un modelo nuevo incrementa riesgo de regresiones.

## Evaluación técnica (Fase 2)

### Opción A — Mantener `notificationEmails`
- Ventaja: cero migración.
- Desventaja: no cubre WhatsApp ni reutilización cross-module.
- Veredicto: insuficiente para el objetivo SSOT.

### Opción B — Usar solo “campo recepción”
- Ventaja: simple para un caso.
- Desventaja: no modela múltiples contactos/roles; no escala.
- Veredicto: insuficiente.

### Opción C — Modelo centralizado Contactos Operativos (**seleccionada**)
- Ventaja: una sola fuente por propiedad para email + WhatsApp + rol + estado.
- Permite selector de destino por módulo (ej. Guest Registration).
- Se implementa con compatibilidad legacy (`notificationEmails`, `receptionWhatsapp`) para evitar regresiones.
- Veredicto: mejor equilibrio entre reutilización, deuda técnica y escalabilidad.

## Estrategia aprobada para implementación

1. Añadir `Property.operationalContacts` (JSON) y `Property.guestRegistrationContactKey` (string opcional).
2. Mantener `notificationEmails` y `receptionWhatsapp` como fallback/compat.
3. Crear helper central (`lib/operational-contacts`) para parsear/validar/resolver contactos activos.
4. En Guest Registration, cambiar solo origen de destinatario:
   - prioridad: contacto operativo seleccionado para Guest Registration;
   - fallback: `notificationEmails`.
5. Añadir sección “Contactos Operativos” en configuración de Propiedad.
6. Exponer selector de destino para Guest Registration usando esos contactos.

## Compatibilidad y no-regresión

- Guest Registration: mantiene `finalizeGuestRegistration()` y pipeline actual.
- Reservas: sin cambios de flujo, solo origen de destinatario.
- Facturación/SIRE/TRA/iCal/TTLock: sin dependencia directa; riesgo bajo.
- Multi-tenant: intacto (datos siguen acotados por propiedad y tenant).

