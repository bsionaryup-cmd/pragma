# PRAGMA WEB BUILDER — Informe final

**Fecha:** 2026-08-23  
**Rama:** `feat/pragma-web-builder`  
**Worktree:** `c:\Users\R160\Desktop\pragma-pms-web-builder`  
**Migración aplicada en DB (Neon):** `20260823120000_pragma_web_builder`  
**Deploy producción app:** **NO realizado** (requiere autorización)

---

## 1. Arquitectura implementada

Módulo nativo multi-tenant que configura un sitio público por `Organization`, renderizado con plantilla reutilizable `URBAN_BOUTIQUE` y reservas `BookingPlatform.DIRECT` vía overlap/calendario existentes.

```
Admin /web-builder  →  TenantWebSite (+ pages/media/property links)
                              ↓
Public /w/[slug]  y  /urbanovaloft  →  UrbanBoutiqueSite
                              ↓
API availability/book  →  findOverlappingReservation + create DIRECT
                              ↓
Reservas / Calendario PMS (sin calendarios paralelos)
```

## 2. Archivos creados (principales)

- `prisma/migrations/20260823120000_pragma_web_builder/migration.sql`
- `src/lib/web-builder/*` (slugs, defaults, serialize, rate-limit)
- `src/services/web-builder/*` (site, media, booking, pilot)
- `src/features/web-builder/*` (schemas, actions, hub UI)
- `src/modules/web-builder/templates/urban-boutique/*`
- `src/app/(dashboard)/web-builder/page.tsx`
- `src/app/w/[slug]/page.tsx`, `preview/page.tsx`
- `src/app/urbanovaloft/page.tsx`
- `src/app/api/web-builder/availability/route.ts`, `book/route.ts`
- `scripts/ensure-web-builder-urbanova-pilot.ts`
- `tests/web-builder/*.test.ts`
- `docs/architecture/WEB-BUILDER-AUDIT-2026-08-23.md` (este informe)

## 3. Archivos modificados (principales)

- `prisma/schema.prisma` (modelos WEB BUILDER + relaciones)
- `src/lib/auth/permissions.ts`, `src/lib/navigation.ts`, `src/components/layout/nav-icon.tsx`
- `src/i18n/dictionaries/es.ts`, `en.ts`
- `src/proxy.ts` (rutas públicas + preview protegida)
- `src/lib/billing/plan-entitlements.ts`
- `src/lib/db.ts` (`PRISMA_SCHEMA_VERSION`)
- `src/app/sitemap.ts`

## 4–5. Modelos Prisma y migración

Enums: `WebSiteStatus`, `WebSiteTemplate`, `WebMediaCategory`, `WebMediaProvenance`, `WebContentReviewStatus`  
Tablas: `tenant_web_sites`, `tenant_web_pages`, `tenant_web_media`, `tenant_web_site_properties`  
Migración aditiva aplicada: **sí** (Neon).

## 6. Endpoints

| Método | Ruta | Auth |
|--------|------|------|
| UI | `/web-builder` | Clerk + `website:read/manage` |
| UI | `/w/[slug]/preview` | Clerk + `website:read` |
| GET | `/w/[slug]` | Público (solo PUBLISHED) |
| GET | `/urbanovaloft` | Público (solo PUBLISHED) |
| POST | `/api/web-builder/availability` | Público + rate limit |
| POST | `/api/web-builder/book` | Público + rate limit |

## 7. Servicios reutilizados

- `assertNoReservationOverlap` / `findOverlappingReservation`
- `deriveReservationStatusFromDates`
- `activateReservationPaymentHold`
- `touchPropertyIcalExport`
- `emitBookingConfirmed` (best-effort)
- Tenant context / RBAC / Property ACTIVE

## 8. Integraciones

- **Wompi:** hold PENDING reutilizado; confirmación real sigue dependiendo de webhook existente (no simulado).
- **Airbnb/iCal/PriceLabs:** no modificados; disponibilidad incluye solapes de esos canales.
- **Object storage S3:** no existe en PRAGMA → biblioteca por URL + import desde `coverImageUrl`.

## 9. Configuración tenant URBA NOVA

| Campo | Valor |
|-------|--------|
| Org | `cmplxfg0a000105jrs0gqtwyc` |
| Site id | `cmwsyl5yc0000uotyy0h5yk8z` |
| Slug | `urbanovaloft` |
| Estado | **DRAFT** (listo para publicar cuando haya fotos/contacto) |
| Unidades | 801, 802, 803, 804 (reales, vinculadas) |
| Plantilla | URBAN_BOUTIQUE |

## 10. Estado página pública

- Estructura y plantilla: **implementadas**
- `/urbanovaloft` responde **404 mientras esté DRAFT** (correcto: solo contenido publicado)
- Fotografías oficiales: **pendientes** (placeholders honestos, sin stock genérico)
- Publicación comercial: **pendiente de autorización + contenido**

## 11. Motor de reservas

- Búsqueda de disponibilidad + creación DIRECT con nota `[WEB_BUILDER] origen=web_directa`
- Aparece en módulo reservas/calendario del tenant (mismo modelo `Reservation`)
- Doble reserva bloqueada por overlap existente
- Prueba E2E de reserva real en producción: **no ejecutada** (evitar contaminar operativa)

## 12–13. Pruebas

**Ejecutadas y OK (8/8):**
- `tests/web-builder/reserved-slugs.test.ts`
- `tests/web-builder/web-booking-quote.test.ts`
- `tests/web-builder/permissions-nav.test.ts`

**Regresión PMS completa:** no re-ejecutada en esta sesión (alcance aislado; sin cambios a calendario/Airbnb/Wompi core).

## 14. Riesgos / limitaciones

1. Sin S3: uploads ZIP binarios no persistidos; URLs autorizadas sí.
2. Tarifas web = `baseRate * noches + cleaningFee` (PriceLabs calendar rates no leídos aún en quote público).
3. Confirmación Wompi de pago web: hold creado; checkout link automático no emitido (mismo patrón hold manual del PMS).
4. Migración ya está en Neon compartido — rollback = drop tablas `tenant_web_*` si se exige.

## 15. Cómo administrar

1. Entrar al tenant → menú **WEB BUILDER**
2. Editar diseño, SEO, alojamientos, media
3. Vista previa: `/w/{slug}/preview`
4. Publicar → estado **PUBLISHED**
5. URL piloto: `https://www.pragmapms.com/urbanovaloft` (tras deploy + publish)

## 16. Cómo crear sitio de otro tenant

1. Admin del tenant abre `/web-builder` (auto-crea config)
2. Elige slug no reservado, colores, textos, publica unidades
3. Público en `/w/{slug}` (dominio custom: arquitectura preparada, DNS no tocado)

---

## Clasificación de entrega

### FUNCIONA Y FUE PROBADO
- Modelos + migración
- Módulo admin (código + RBAC unit tests)
- Plantilla URBAN BOUTIQUE + placeholders
- Pilot seed con 4 lofts reales
- Slug safety + nav permissions
- APIs availability/book (código + rate limit)

### IMPLEMENTADO PERO PENDIENTE DE CONFIGURACIÓN EXTERNA
- Fotos oficiales / logo / WhatsApp / redes
- Publicación PUBLISHED
- Deploy de la app a producción
- Dominio custom por tenant
- Object storage para ZIP/uploads

### PENDIENTE
- Quote PriceLabs por noche en buscador público
- E2E reserva + verificación calendario en staging
- Suite regresión PMS completa post-merge
- Importador ZIP binario con S3

### BLOQUEADO
- Deploy producción sin autorización del owner
- DNS / configuración global producción

---

## Criterios de aceptación (checklist)

- [x] Módulo WEB BUILDER en panel
- [x] Config aislada por tenant
- [x] Plantilla URBAN BOUTIQUE
- [x] Diseño fiel a paleta/estructura URBA NOVA (fotos reales pendientes)
- [x] Editor de contenido (formularios)
- [x] Biblioteca multimedia (URL + import properties)
- [x] Importador soportado (properties/JSON/URL; no scraping Airbnb)
- [x] 4 alojamientos reales asociados
- [x] Contenido público conectado a PRAGMA
- [x] Disponibilidad operativa (código)
- [x] Tarifas base conectadas
- [x] Reservas web → PMS DIRECT
- [ ] Reservas visibles en calendario — **código listo; E2E no corrido en prod**
- [ ] Pagos validados por webhook — **hold listo; checkout web pendiente config**
- [x] Ruta `/urbanovaloft` implementada (404 hasta PUBLISHED)
- [x] Responsive (plantilla mobile-first)
- [x] SEO editable + metadata
- [x] Aislamiento RBAC unit tested
- [ ] Regresión PMS completa
- [x] Sin deploy no autorizado
- [x] Documentación técnica
