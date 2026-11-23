# PRAGMA WEB BUILDER — Informe de aceptación

**Fecha:** 2026-11-23  
**Rama / worktree:** `feat/pragma-web-builder` · `pragma-pms-web-builder`  
**Deploy / merge / PR / publish:** **NO**  
**Escrituras de reserva en unidades reales:** **DETENIDAS** (ver STOP DB)

---

## 1. Base de datos

| Pregunta | Evidencia | Resultado |
|----------|-----------|-----------|
| ¿Qué Neon usa? | `.env.local` → `ep-purple-block-apuk7v1k.c-7.us-east-1.aws.neon.tech` / `neondb` | Identificado |
| ¿Staging o producción? | 5 orgs · 8 props · **170 reservas** · org real URBA Nova · docs hablan de “shared pilot” | **DB operativa compartida / piloto** — **no hay Neon staging separado en este entorno** |
| Migraciones | `prisma migrate status` → **up to date**; última aplicada `20260823120000_pragma_web_builder` (2026-11-23T07:42:34Z) | PASS (lectura) |
| Tablas nuevas | `tenant_web_sites`, `tenant_web_pages`, `tenant_web_media`, `tenant_web_site_properties` + 5 enums | PASS |
| Otros tenants tocados | Solo 1 site, org piloto; 0 reservas WEB_BUILDER | PASS |
| Prisma validate | Schema valid | PASS |
| Inconsistencia | Schema del worktree puede no reflejar todos los modelos históricos de Neon (otras features); migraciones reportadas al día | **RIESGO menor** documentado |

### STOP (obligatorio)

Por ser DB operativa compartida (no staging aislado):

- **No** se crearon reservas de prueba sobre 801–804.
- **No** se publicó el sitio.
- **No** se corrieron migraciones adicionales.
- Documento: `docs/architecture/WEB-BUILDER-ACCEPTANCE-DB-STOP-2026-11-23.md`

---

## 2. Interfaz administrativa `/web-builder`

| Sección | Implementada en código | Probada en UI live | Notas |
|---------|------------------------|--------------------|-------|
| Sitio | Sí | **NO (bloqueado)** | Dev activo está en `pragma-pms` (otra rama), sin este módulo |
| Diseño | Sí (colores, logo URL, font) | NO live | Persistencia vía `updateWebSiteAction` |
| Páginas | **Lista read-only** | NO live | **GAP:** no edita body/slug desde UI |
| Alojamientos | Sí (toggle publish) | NO live | |
| Contenido | Sí (hero/ubicación + media URL) | NO live | |
| Importar | Sí (from properties) | NO live | |
| Reservas | Sí (`bookingEnabled`) | NO live | |
| Configuración | Sí | NO live | |
| SEO | Sí | NO live | |
| Publicación | Sí (status actions) | NO live | |

**Permisos (probado con tests):** ADMIN OK · RECEPTIONIST denegado · nav solo ADMIN — PASS (15 tests web-builder incluyen RBAC).

**Veredicto admin UI:** **PARTIAL** — código presente; smoke UI autenticada pendiente de levantar `npm run dev` **en el worktree** con sesión ADMIN.

---

## 3. URBA NOVA

| Check | Resultado | Evidencia |
|-------|-----------|-----------|
| Tenant | PASS | `cmplxfg0a000105jrs0gqtwyc` · “URBA Nova Loft 33” |
| Slug | PASS | `urbanovaloft` |
| 4 unidades reales | PASS | 801, 802, 803, 804 |
| Fotografías | **PENDIENTE** | `media: 0`, `heroImageUrl: null` |
| Contenido copy | PASS | defaults piloto en DB |
| Plantilla URBAN_BOUTIQUE | PASS | |
| Identidad visual (código) | PASS parcial | paleta + fonts Cormorant/DM Sans + CTA oliva |
| Comparación visual vs referencia | **NO ejecutada en browser** | requiere preview autenticada en worktree |
| Vista previa auth | PASS (código + aislamiento) | `/w/[slug]/preview` exige `website:read` + mismo org |
| Público DRAFT | PASS | `getPublishedSiteBySlug` → `null` |
| Responsive | PASS código / **NO** QA device | mobile-first en template |

---

## 4. Reserva real de prueba

| Paso | Resultado |
|------|-----------|
| Entorno staging aislado | **NO DISPONIBLE** |
| Unidad de prueba autorizada | **NO CONFIRMADA** (solo unidades operativas 801–804) |
| Flujo E2E crear reserva | **BLOQUEADO** por STOP DB |
| Negativo seguro | **PASS** — booking rechaza sitio no PUBLISHED; search `available: []` |

No se usaron pagos reales.

---

## 5. Doble reserva

| Check | Resultado |
|-------|-----------|
| E2E concurrente en Neon | **BLOQUEADO** (STOP) |
| Guard en código | **PASS** — `assertNoReservationOverlap` antes de `db.reservation.create` |
| `ReservationConflictError` | PASS (test) |
| Holds / idempotencia pago | **NO E2E** — hold reutilizado; sin prueba concurrente real |

---

## 6. Aislamiento multi-tenant

| Check | Resultado | Evidencia |
|-------|-----------|-----------|
| Media listada por `organizationId` | PASS código | `web-media.service` |
| Update site sin org ajena | PASS código | `requireOrgId()` |
| Preview org extranjera → null | **PASS test** | `getTenantWebSitePreviewBySlug(..., foreign)` |
| Booking a sitio DRAFT | **PASS test** | reject |
| Público solo PUBLISHED | **PASS test** | |
| Solo 1 site en DB | **PASS test** | |

Manipulación de `propertyId` cruzado en sitio PUBLISHED: **no E2E** (requeriría publish); el booking carga links solo del slug publicado + propiedad en esos links.

---

## 7. Regresión PMS (suites ejecutadas)

| Suite | Tests | Resultado |
|-------|------:|-----------|
| `tests/web-builder/*` | 16 | PASS |
| Calendar visual / capacity | 4 | PASS |
| RBAC permissions | 7 | PASS |
| Reservation mutation policy | 5 | PASS |
| Reservation delete eligibility | 5 | PASS |
| Billing / email / Wompi webhook crypto | 15 | PASS |
| Payments balance / reference | 5 | PASS |
| Airbnb metadata + display guest name | 12 | PASS |

**Total observado esta auditoría:** ≥ **69 PASS / 0 FAIL** en suites tocadas.

**No re-ejecutado E2E live:** Dashboard UI, Inbox operativo, PriceLabs sync live, iCal sync live (evitar side-effects en DB operativa).

---

## 8. Errores encontrados y correcciones

| # | Severidad | Hallazgo | Corrección |
|---|-----------|----------|------------|
| 1 | **P1** | Al publicar el site, páginas seguían en `DRAFT` y el query público las filtraba por `PUBLISHED` → páginas vacías tras publish | `setWebSiteStatus` ahora hace cascade `tenantWebPage.updateMany` |
| 2 | **P0 operativo** | Migración + seed ya corrieron en Neon operativo compartido | STOP de writes; documentación |
| 3 | **P2** | Sección Páginas admin es solo listado | Documentado GAP (sin rewrite amplio) |
| 4 | **P2** | `npm run dev` actual no sirve este módulo (otra rama) | Documentado; requiere worktree |

---

## 9. Estado consolidado

### Base de datos
- Migración web builder **aplicada** en Neon operativo.
- Datos piloto DRAFT; sin reservas web.
- Producción app **sin deploy** de este código.

### Página pública
- `/urbanovaloft` y `/w/urbanovaloft` → contenido solo si PUBLISHED → hoy **no público** (DRAFT). Correcto.

### Calendario / reservas
- Integración por diseño: DIRECT + overlap. **E2E no demostrado** en esta DB.

### Veredicto de aceptación

| Criterio | Estado |
|----------|--------|
| Módulo implementado y testeable en código | **PASS** |
| Aislamiento + draft safety | **PASS** (tests) |
| Estabilidad PMS (regresión unitaria) | **PASS** (suites corridas) |
| Demostración E2E reserva + calendario | **FAIL / BLOQUEADO** (falta staging) |
| UI admin smoke autenticada | **FAIL / BLOQUEADO** (dev en otra rama) |
| Listo para publicar / merge | **NO** |

**Conclusión:** el módulo **funciona a nivel de diseño, persistencia piloto, seguridad de borrador y regresión unitaria**, pero **no se puede certificar el flujo comercial completo** sin un Neon staging aislado y un `dev` del worktree. El PMS no muestra regresiones en las suites ejecutadas.

---

## Próximos pasos recomendados (requieren autorización)

1. Confirmar si `ep-purple-block-…` es prod o branch Neon compartido; idealmente **crear branch staging**.
2. Levantar `npm run dev` en `pragma-pms-web-builder` y smoke `/web-builder` + preview.
3. Con unidad de prueba autorizada en staging: E2E reserva + doble reserva + calendario.
4. Solo entonces valorar publish/PR/deploy.
