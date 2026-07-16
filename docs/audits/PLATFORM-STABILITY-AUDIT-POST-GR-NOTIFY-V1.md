# Auditoría Integral de Estabilidad del Sistema

## PRAGMA PMS

Fecha: 2026-07-16  
Tipo: **Verificación post–Guest Registration / Contactos Operativos / Resend**  
Estado: **APROBADA — PLATAFORMA ESTABLE**

---

## 1. Estado general

La plataforma permanece **estable, consistente y sin regresiones críticas** tras la implementación de notificaciones de Guest Registration, Contactos Operativos y la rotación de `RESEND_API_KEY`.

| Producto | Estado |
|----------|--------|
| **PRAGMA PMS** | Estable — cambios acotados al dominio guests/properties/reservations + email compartido |
| **QR Mobility** | Estable — **cero acoplamiento** con operational-contacts / admin-notify |
| **PRAGMA INTIENDAS** | Estable — **cero acoplamiento** con el mismo superficie |

**Veredicto:** arquitectura íntegra; tres productos aislados correctamente.

---

## 2. Evidencia de pruebas

| Prueba | Resultado |
|--------|-----------|
| `npm run typecheck` | **OK** (tras limpiar `.next/dev/types` corrupto) |
| `npm run build` | **OK** — 103 rutas generadas |
| Tests GR + operational contacts + capacity | **22/22 OK** |
| Tests novedades / inbox / operational feed | **54/54 OK** |
| `npm run test:billing` (billing + RBAC + payments + sales) | **37/37 OK** |
| Tests QR Mobility | **5/5 OK** |
| `prisma migrate status` | **Database schema is up to date** (74 migraciones) |
| Resend infra audit | **approved: true** — dominio `pragmapms.com` verified |
| Remitente institucional | `PRAGMA PMS <noreply@pragmapms.com>` |
| Lint hot-path properties form | **OK** tras corrección mínima |

---

## 3. Estado por módulo

### CORE

| Módulo | Estado | Notas |
|--------|--------|-------|
| Autenticación / Clerk | OK | Sin cambios; password/invites vía Clerk |
| Multi-tenant (`src/lib/platform`) | OK | Scope por org/owner intacto |
| Roles / permisos / RBAC | OK | Tests RBAC 7/7 |
| Navegación / middleware (`proxy.ts`) | OK | Build incluye Proxy |
| Owner Dashboard | OK | Sin imports de admin-notify |

### PMS

| Módulo | Estado | Notas |
|--------|--------|-------|
| Reservas | OK | UI aviso administración; mapping status |
| Calendario | OK | Sin acoplamiento notify |
| Propiedades | OK | Contactos Operativos + selector GR |
| Guest Registration | OK | Pipeline reutilizado; validado E2E real (Margarita) |
| Contactos Operativos | OK | SSOT + fallback `notificationEmails` |
| Inbox / Novedades | OK | Solo lectura del marker `__SENDING__` en feed |
| Tareas / Limpiezas | OK | Sin acoplamiento |
| Billing | OK | Comparte `sendEmail`; tests OK |
| Integraciones UI | OK | Rutas build OK |
| Configuración | OK | |

### Integraciones

| Integración | Acoplamiento a GR admin-notify | Estado |
|-------------|-------------------------------|--------|
| Airbnb iCal | Ninguno | OK |
| Airbnb email (Resend inbound) | Misma `RESEND_API_KEY` (infra), no admin-notify | OK |
| TTLock | Disparo en finalize GR (preexistente), no admin-notify | OK |
| PriceLabs | Ninguno | OK |
| Resend outbound | `send-email.ts` | OK — key + dominio validados |
| Wompi | Ninguno | OK |
| Facturación / recibos | `sendEmail` compartido | OK |
| SIRE / TRAA | Ninguno | OK |

### QR Mobility

Rutas: `/owner-dashboard/qr-mobility`, `aliados`, `servicios`.  
Módulos: `src/modules/qr-mobility`, `src/features/qr-mobility`, `src/components/qr-mobility`.  
**Sin imports** de `operational-contacts` ni `guest-registration-admin-notification`. Tests 5/5.

### PRAGMA INTIENDAS

Rutas retail bajo `/intiendas/*` + owner `/owner-dashboard/intiendas/*`.  
Dominio: `src/domains/retail`.  
**Sin acoplamiento** a Contactos Operativos / admin-notify. Superficie de login, POS, inventario, IA, caja, ayuda y seguridad presente en build.

---

## 4. Arquitectura

| Verificación | Resultado |
|--------------|-----------|
| Dependencias circulares GR ↔ otros productos | No detectadas |
| Duplicación de pipeline de correo | No — un solo `sendEmail` |
| Servicios duplicados de notify | No |
| Referencias `pragma.co` en `src` | **0** |
| Rutas vacías residuales (trigger/e2e stubs) | **Eliminadas** (dirs vacíos sin `route.ts`) |
| Dual SSOT destinatarios | Documentado: contacto operativo → fallback `notificationEmails` (intencional) |

---

## 5. Base de datos

| Item | Estado |
|------|--------|
| Migraciones aplicadas | Sí — schema up to date |
| `Property.operationalContacts` / `guestRegistrationContactKey` | Presentes |
| `Reservation.guestRegistrationAdmin*` + log JSON | Presentes |
| Inconsistencias de migración | Ninguna |

---

## 6. Infraestructura

| Item | Estado |
|------|--------|
| Neon / PostgreSQL | Conectado; migrate status OK |
| Prisma Client | Genera en build |
| `RESEND_API_KEY` | Válida (fuente `.env.local`) |
| Dominio remitente | `pragmapms.com` verified |
| `EMAIL_FROM` | Institucional correcto |
| `RESEND_INBOUND_WEBHOOK_SECRET` | Ausente en local — **no bloquea outbound**; relevante solo para webhook Airbnb inbound |

---

## 7. Seguridad

| Área | Estado |
|------|--------|
| Multi-tenant scope en servicios de reserva/propiedad | Intactos |
| Endpoints cron E2E | Dev-only / no en `vercel.json` crons de producción |
| Secretos | En env; no hardcodeados en servicios |
| RBAC | Tests OK |

---

## 8. Riesgos

### Corregidos en esta auditoría

| Severidad | Riesgo | Acción |
|-----------|--------|--------|
| **Medio** | Typecheck falso-negativo por `.next/dev/types/routes.d.ts` corrupto | Limpieza de tipos generados; typecheck OK |
| **Bajo** | Directorios vacíos `guest-registration-admin-notify-trigger` / e2e stub | Eliminados |
| **Bajo** | `form.watch` incompatible con React Compiler en selector de contactos | Migrado a `useWatch` + `startTransition` en sync de UI |

### Pendientes (no bloqueantes)

| Severidad | Riesgo | Plan |
|-----------|--------|------|
| **Medio** | `RESEND_INBOUND_WEBHOOK_SECRET` no configurado en local | Configurar en staging/prod si se usa webhook inbound Airbnb |
| **Bajo** | Dual destinatario (operational contact vs `notificationEmails`) | Mantener; migrar propiedades legacy vía UI gradualmente |
| **Bajo** | Columna `guestRegistrationAdminNotificationError` sobrecargada como lock `__SENDING__` | Documentado; refactor opcional futuro |
| **Bajo** | Validación DB de `guestRegistrationContactKey` vs keys JSON | Soft constraint; resolver en app layer (ya existe) |
| **Info** | Endpoint E2E `/api/cron/guest-registration-admin-notify-e2e` en árbol de rutas | Solo útil en non-production; no programado en crons Vercel |

### Críticos

**Ninguno.**

---

## 9. Componentes revisados vs modificados

### Revisados (sin cambio de lógica de negocio)

CORE platform, owner APIs, reservas, calendario, inbox/novedades, billing, airbnb, ttlock, pricelabs, wompi, sire, traa, QR Mobility, INTIENDAS/retail, Prisma schema, migraciones, env Resend.

### Modificados (solo auditoría / higiene)

| Archivo | Motivo |
|---------|--------|
| `property-form-drawer.tsx` | Lint React Compiler (`useWatch` / `startTransition`) |
| Dirs vacíos cron/e2e stub | Eliminación de restos muertos |

**No se alteró** la arquitectura de notificaciones, multi-tenant ni integraciones.

---

## 10. Regresiones — confirmación expresa

| Área | ¿Afectada por GR/Contactos/Resend? |
|------|-------------------------------------|
| QR Mobility | **No** |
| INTIENDAS | **No** |
| Owner Dashboard | **No** |
| Facturación | Solo comparte `sendEmail` (esperado) |
| Guest Registration | Mejorado / validado |
| Airbnb | Key compartida; sin cambio de lógica inbound |
| iCal | **No** |
| Billing / Wompi | **No** (salvo remitente institucional en envíos) |
| Multi-tenant | **No** |

---

## 11. Compatibilidad

| Dimensión | Estado |
|-----------|--------|
| Multi-tenant | Intacta |
| PMS ↔ QR Mobility | Aislados |
| PMS ↔ INTIENDAS | Aislados |
| Legacy `notificationEmails` | Compatible (fallback) |

---

## 12. Criterio de aceptación

| Criterio | Cumple |
|----------|--------|
| Plataforma funciona / build+typecheck OK | Sí |
| Sin regresiones entre productos | Sí |
| Sin errores críticos | Sí |
| Sin inconsistencias arquitectónicas graves | Sí |
| Integraciones sin acoplamiento indebido | Sí |
| Tres productos estables | Sí |
| Correcciones revalidadas | Sí (typecheck + lint hot-path) |
| Arquitectura íntegra | Sí |

---

## Veredicto final

### **AUDITORÍA FINALIZADA — PLATAFORMA APROBADA**

PRAGMA PMS, QR Mobility e INTIENDAS permanecen estables tras el trabajo de notificaciones de Guest Registration. No se requieren bloqueos de despliegue por estabilidad estructural.

**Única acción operativa recomendada (no código):** asegurar `RESEND_INBOUND_WEBHOOK_SECRET` en entornos donde el webhook Airbnb inbound esté activo.
