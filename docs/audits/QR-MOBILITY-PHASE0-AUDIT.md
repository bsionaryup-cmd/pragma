# QR Mobility — Fase 0: Auditoría e Integración Inicial

**Fecha:** 2026-07-06  
**Estado:** Auditoría completada + implementación Fase 0 (sin deploy)  
**Modo:** NO DEPLOY

---

## 1. Resumen ejecutivo

Se auditó la arquitectura de PRAGMA PMS y se integró el módulo **QR Mobility** dentro del Owner Dashboard existente, siguiendo el patrón de Sales Console. El módulo queda **completamente aislado** del dominio PMS (reservas, calendario, finance, etc.) mediante modelos Prisma independientes (`mobility_allies`, `mobility_services`).

**Alcance implementado:**
- Menú "QR Mobility" visible solo para Owner (`SUPER_ADMIN_OWNER`)
- Dashboard con KPIs (Aliados, Servicios, QR, Reservas placeholder)
- CRUD Aliados (crear, editar, desactivar, soft delete, QR, copiar link)
- CRUD Servicios (categorías controladas por enum)
- Ruta pública `/m/[token]` (sin flujo de reservas)
- Migración `20260706120000_qr_mobility_phase0`
- Auditoría vía `PlatformAuditLog`

**No implementado (definido para fases futuras):** Reservas, Conductores, Comisiones, Configuración.

---

## 2. Auditoría de arquitectura

### 2.1 Estructura del proyecto

| Área | Patrón existente | Integración QR Mobility |
|------|------------------|-------------------------|
| Rutas Owner | `src/app/(owner)/owner-dashboard/` | `qr-mobility/`, `aliados/`, `servicios/` |
| Layout guard | `layout.tsx` → `isSuperAdminOwner` | Heredado sin cambios |
| Navegación | `owner-shell-header.tsx` → `PLATFORM_NAV` | Entrada "QR Mobility" añadida |
| Módulo sub-nav | `sales-console-section-shell.tsx` | `qr-mobility-section-shell.tsx` |
| Services | `src/modules/*/services/` | `src/modules/qr-mobility/services/` |
| Actions | `src/features/*/actions/` | `src/features/qr-mobility/actions/` |
| UI | `src/components/*/` | `src/components/qr-mobility/` |

**Blueprint de referencia:** Sales Console (`docs/sales-console-domain-blueprint.md`).

### 2.2 App Router y layouts

- Owner Dashboard usa layout único en `owner-dashboard/layout.tsx` con `requireDbUser()` + `isSuperAdminOwner`.
- No se creó layout independiente para Mobility.
- Páginas del módulo son Server Components delgados: auth → service → view.

### 2.3 Middleware (proxy)

- Clerk middleware en `src/proxy.ts`.
- Rutas `/owner-dashboard/*` requieren sesión Clerk; rol Owner se valida en layout/páginas.
- Ruta pública `/m/[token]` añadida a `isPublicRoute` — **único cambio en proxy**, justificado para URLs QR compartibles.

### 2.4 Flujo de navegación

```
Owner Dashboard → QR Mobility (nav principal)
  ├── Dashboard (KPIs)
  ├── Aliados (CRUD)
  ├── Servicios (CRUD)
  └── [Reservas | Conductores | Comisiones | Configuración] — placeholder Fase 1+
```

---

## 3. Auditoría de base de datos

### 3.1 Convenciones reutilizadas

| Convención | Uso en Mobility |
|------------|-----------------|
| `cuid()` IDs | `MobilityAlly.id`, `MobilityService.id` |
| `createdAt` / `updatedAt` | Ambos modelos |
| `deletedAt` soft delete | Ambos modelos |
| Enums controlados | `MobilityRecordStatus`, `MobilityAllyType`, `MobilityServiceCategory` |
| Índices compuestos | `status + createdAt`, `status + sortOrder`, `deletedAt` |
| FK explícita | `createdById` → `users` |

### 3.2 Modelos nuevos (sin tocar PMS)

**`MobilityAlly`** (`mobility_allies`):
- Campos: nombre, tipo, empresa, teléfono, correo, comisión, estado, código, qrToken, publicUrl, qrImageDataUrl, observaciones
- QR: token único + URL pública + imagen PNG (data URL)

**`MobilityService`** (`mobility_services`):
- Campos: nombre, categoría, descripción, precios (base/nocturno/festivo), horarios, estado, orden, imagen, vehículo, capacidad, equipaje

### 3.3 Multi-tenant

- **Decisión:** Alcance **platform-owner** (sin `organizationId`), igual que `Prospect` en Sales Console.
- **Motivo:** Menú solo en Owner Dashboard; no afecta tenant PMS ni cliente piloto.
- **Riesgo mitigado:** Cero queries cruzadas con `Organization`, `Reservation`, `Property`.

---

## 4. Auditoría de autenticación

| Capa | Implementación Mobility |
|------|-------------------------|
| Clerk session | Reutilizado |
| `requirePlatformOwnerUser()` | Todas las pages y server actions |
| `isSuperAdminOwner` | Heredado del layout Owner |
| Tenant RBAC | **No usado** — correcto para módulo Owner |

No se creó segundo sistema de auth.

---

## 5. Auditoría de UI — componentes reutilizados

| Componente | Uso |
|------------|-----|
| `KpiCard` | Dashboard KPIs |
| `Table` (shadcn) | Listas Aliados/Servicios |
| `Dialog` + `Input` + `Label` | Formularios CRUD |
| `Badge` | Estados ACTIVE/INACTIVE |
| `Button` | Acciones |
| `toast` (sonner) | Feedback |
| `copyTextToClipboard` | Copiar link |
| `GuestBrandMark` | Landing pública `/m/[token]` |
| Tokens visuales | `pragma-electric`, `shadow-pragma-soft`, `rounded-2xl` |

No se duplicaron DataTables ni componentes de dashboard tenant.

---

## 6. Riesgos identificados

| Riesgo | Severidad | Mitigación |
|--------|-----------|------------|
| Migración en producción sin deploy | Baja | Migración documentada; **no desplegada** en Fase 0 |
| Cambio en `proxy.ts` (ruta pública) | Baja | Solo añade `/m/(.*)` a rutas públicas; no altera dashboard |
| `qrImageDataUrl` en DB (tamaño) | Media | PNG 320px; aceptable Fase 0; Fase 1 puede externalizar a storage |
| Sin `organizationId` en aliados | Media | Documentado; Fase 1 puede vincular a tenant si se requiere |
| Dependencia `qrcode` nueva | Baja | Paquete estándar, solo server-side |

---

## 7. Arquitectura propuesta (implementada)

```
Page (RSC)
  └── requirePlatformOwnerUser()
  └── Service (server-only)
        └── Prisma (mobility_*)
        └── writeMobilityAuditLog → PlatformAuditLog
  └── Client View
        └── Server Actions → Service
```

**Ruta pública:**
```
/m/[token] → getMobilityAllyByToken() → landing mínima
```

---

## 8. Registro de decisiones técnicas

| # | Decisión | Motivo | Riesgo | Impacto |
|---|----------|--------|--------|---------|
| D1 | Modelos `mobility_*` separados | Aislamiento dominio PMS | Bajo | Cero en piloto |
| D2 | Platform-owner scope (sin orgId) | Menú solo Owner; patrón Prospect | Medio futuro | Cero en piloto |
| D3 | Server Actions vs API routes | Patrón Sales Console | Bajo | Ninguno |
| D4 | QR como data URL en DB | Fase 0 simple; sin S3 | Medio storage | Solo Owner |
| D5 | `/m/[token]` ruta pública | URL compartible QR | Bajo | Aislado |
| D6 | `qrcode` npm package | Generación server-side estándar | Bajo | Nueva dep |
| D7 | Soft delete + status INACTIVE | Patrón `deletedAt` existente | Bajo | Ninguno |
| D8 | Reservas KPI = 0 placeholder | Constitución Fase 0 | Ninguno | UI only |

---

## 9. Archivos creados / modificados

### Nuevos
- `prisma/migrations/20260706120000_qr_mobility_phase0/`
- `src/modules/qr-mobility/services/*`
- `src/features/qr-mobility/actions/*`, `types/*`
- `src/components/qr-mobility/*`
- `src/app/(owner)/owner-dashboard/qr-mobility/**`
- `src/app/m/[token]/page.tsx`
- `tests/qr-mobility/*.test.ts`

### Modificados (mínimos)
- `prisma/schema.prisma` — modelos Mobility + relaciones User
- `src/components/owner/owner-shell-header.tsx` — nav "QR Mobility"
- `src/proxy.ts` — ruta pública `/m/(.*)`
- `package.json` — `qrcode`

### No modificados (impacto cero)
- Reservas, calendario, Airbnb, iCal, TTLock, billing, Wompi, PriceLabs, inbox, dashboard tenant, middleware RBAC tenant.

---

## 10. Verificación obligatoria

| Prueba | Resultado |
|--------|-----------|
| `npm run typecheck` | ✅ Pass |
| `npx prisma validate` | ✅ Pass |
| `npm run build` | ✅ Pass |
| `npx tsx --test tests/qr-mobility/*.test.ts` | ✅ 5/5 pass |
| ESLint (archivos QR Mobility) | ✅ 0 errores (2 warnings `<img>` data URL QR) |
| `npm run lint` (repo completo) | ⚠️ Falla por scripts temporales preexistentes — no relacionados con Mobility |
| Deploy | ❌ No realizado (constitución Fase 0) |
| Migración DB aplicada | ⏳ Pendiente aprobación — `npm run db:migrate` local |

---

## 11. Criterios de aprobación Fase 0

| Criterio | Estado |
|----------|--------|
| Sin regresiones en PMS piloto | ✅ Build exitoso; cero cambios en módulos PMS |
| QR Mobility aislado del dominio PMS | ✅ |
| Reutiliza arquitectura existente | ✅ |
| Convenciones respetadas | ✅ |
| Pruebas satisfactorias | ✅ typecheck + build + tests Mobility |
| Sin deploy | ✅ |

---

## 12. Listo para Fase 1

Tras aprobación, Fase 1 puede abordar:
- Reservas Mobility
- Conductores
- Comisiones
- Configuración
- Vinculación opcional `organizationId`
- Storage externo para imágenes QR
- Analítica y tracking QR
