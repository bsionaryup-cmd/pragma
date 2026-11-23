# PRAGMA WEB BUILDER — Informe de implementación final

**Fecha:** 2026-11-23  
**Rama / worktree:** `feat/pragma-web-builder` · `c:\Users\R160\Desktop\pragma-pms-web-builder`  
**Entorno:** Neon staging `ep-dawn-union-bebo02dx` · app `http://localhost:3005`  
**Deploy / merge / PR / producción:** **NO**

---

## 1. Resumen ejecutivo

PRAGMA WEB BUILDER quedó **operativo en staging** con:

- Panel nativo `/web-builder` (10 secciones, CRUD de páginas incluido).
- Plantilla URBAN BOUTIQUE publicada en `/urbanovaloft` y `/w/urbanovaloft`.
- Motor de reservas DIRECT reutilizando el calendario PMS (sin motor paralelo).
- E2E staging: disponibilidad, reserva, idempotencia, doble reserva (con lock), cancelación.
- Smoke browser: búsqueda + reserva UI + mensaje de pago pendiente Wompi.
- Regresión PMS (web-builder, rbac, reservations, calendar, payments, billing, airbnb-email): **PASS**.

---

## 2. Criterio de terminación

| Ítem | Resultado |
|------|-----------|
| WEB BUILDER operativo | **PASS** |
| Gestión de páginas completa | **PASS** (crear/editar/publicar/archivar/eliminar con protección home) |
| Plantilla URBAN BOUTIQUE | **PASS** |
| Diseño URBA NOVA fiel a referencia | **PASS** (estructura + paleta + copy; fotos reales PENDING EXTERNAL) |
| Cuatro alojamientos asociados | **PASS** (801–804 staging) |
| Biblioteca multimedia | **PASS** código (URL/JSON/ZIP; S3 PENDING EXTERNAL) |
| Importador | **PASS** código |
| Contenido editable | **PASS** |
| Vista previa | **PASS** `/w/urbanovaloft/preview` |
| Publicación staging | **PASS** sitio `PUBLISHED` |
| `/urbanovaloft` visible | **PASS** HTTP 200 |
| Disponibilidad | **PASS** API + browser |
| Tarifas conectadas | **PASS** (baseRate + cleaningFee del property) |
| Reserva directa | **PASS** (servicio + browser `cmwt1l91n001ofwtyoei9xd3d`) |
| Integrada al calendario | **PASS** (`appearsInCalendarQuery: true`, platform `DIRECT`) |
| Doble reserva protegida | **PASS** (`pg_advisory_xact_lock` + overlap; `raceSafe: true`) |
| Pagos de prueba Wompi | **PENDING EXTERNAL** (código listo; sin credenciales tenant) |
| Cancelaciones | **PASS** (E2E libera fechas) |
| Multi-tenant | **PASS** (tests aislamiento + org staging dedicada) |
| Responsive | **PASS** (mobile Menú + hero legible) |
| SEO | **PASS** (título/descripción piloto) |
| Regresión PMS | **PASS** |
| Errores críticos abiertos | **Ninguno** |

---

## 3. Entorno verificado

| Check | Evidencia |
|-------|-----------|
| Rama | `feat/pragma-web-builder` |
| Worktree | `pragma-pms-web-builder` |
| DB | `.env.staging` → Neon claim `ep-dawn-union-bebo02dx` |
| Flag | `PRAGMA_WEB_BUILDER_STAGING=1` |
| Migración WEB BUILDER | `20260823120000_pragma_web_builder` (ya aplicada; no re-ejecutada destructivamente) |
| Dev server | `npm run staging:dev` → `:3005` |
| DB operativa compartida | **No tocada** (`ep-purple-block` fuera de alcance) |

---

## 4. Servicios conectados

| Servicio | Uso |
|----------|-----|
| `web-site.service` | Sitio, páginas, publicación, property links |
| `web-media.service` + ZIP import | Media URL/JSON/ZIP, fingerprints, hero/portada |
| `web-booking.service` | Disponibilidad + reserva DIRECT + advisory lock |
| `web-booking-payment.service` | Hold + checkout Wompi cuando está configurado |
| `reservation-conflicts` / holds | Overlap + payment hold PMS |
| `airbnb-export-push` (`touchPropertyIcalExport`) | Feed iCal saliente tocado al crear reserva |
| Clerk RBAC `website:read` / `website:manage` | Admin |
| Owner self-service guards | Owner con org puede usar `/web-builder` |

**Límite sync Airbnb:** la reserva DIRECT aparece en calendario PMS e invalida/toca export iCal; **no** se asume push API Airbnb outbound automático más allá del mecanismo iCal existente.

---

## 5. Migraciones

- Única migración del módulo: `prisma/migrations/20260823120000_pragma_web_builder/`
- Tablas: `tenant_web_sites`, `tenant_web_pages`, `tenant_web_media`, `tenant_web_site_properties`
- **No** se crearon migraciones adicionales en esta fase
- **No** se corrieron migraciones contra producción

---

## 6. Archivos principales (creación / cambio)

### Módulo y admin
- `src/app/(dashboard)/web-builder/`
- `src/features/web-builder/**`
- `src/services/web-builder/**`
- `src/modules/web-builder/**`
- `src/lib/web-builder/**`
- `src/app/api/web-builder/{availability,book}/`
- `src/app/urbanovaloft/`, `src/app/w/`

### Staging
- `scripts/staging/**`
- `.env.staging` (local, no commitear secretos)
- `package.json` scripts `staging:*`, `test:web-builder`

### Tests
- `tests/web-builder/*.test.ts` (27 PASS)

### Docs / capturas
- Este informe
- `docs/architecture/web-builder-screenshots/`

---

## 7. Evidencia E2E staging (`npm run staging:e2e`)

```json
{
  "ok": true,
  "unit": "801",
  "platform": "DIRECT",
  "organizationId": "stg_web_builder_org_001",
  "appearsInCalendarQuery": true,
  "paymentStatus": "PENDING",
  "idempotentReplay": true,
  "idempotentSameId": true,
  "doubleBookingBlocked": true,
  "raceWins": 1,
  "raceActiveBeforeCleanup": 1,
  "raceSafe": true,
  "availableAgainAfterCancel": true,
  "siteStatus": "PUBLISHED"
}
```

### Browser (Prueba B/C)
- `/urbanovaloft` PUBLISHED con marca URBA NOVA LOFT 33
- BUSCAR → 4 unidades con tarifas COP
- Confirmar reserva → `cmwt1l91n001ofwtyoei9xd3d`
- Mensaje: pago pendiente / conectar Wompi tenant (**PENDING EXTERNAL**, sin simular PAID)

---

## 8. Regresión

| Suite | Resultado |
|-------|-----------|
| `test:web-builder` | 27/27 PASS |
| rbac + reservations + calendar + payments | 59/59 PASS |
| `test:billing` | 37/37 PASS |
| `test:airbnb-email` | 175/175 PASS |

---

## 9. Capturas

| Archivo | Contenido |
|---------|-----------|
| `docs/architecture/web-builder-screenshots/urbanovaloft-desktop-hero-v2.png` | Hero desktop |
| `docs/architecture/web-builder-screenshots/urbanovaloft-availability-results.png` | Resultados / formulario |
| `docs/architecture/web-builder-screenshots/urbanovaloft-mobile-hero.png` | Mobile (Menú + ESTANCIAS CORTAS + título) |

Rutas live staging local:
- Público: http://localhost:3005/urbanovaloft
- Preview auth: http://localhost:3005/w/urbanovaloft/preview
- Admin: http://localhost:3005/web-builder

---

## 10. Configuraciones externas pendientes

| Recurso | Estado |
|---------|--------|
| Fotografías reales autorizadas URBA NOVA | **PENDING EXTERNAL** — UI muestra “Fotografía pendiente de carga autorizada”; no se usan stock genéricos como reales |
| WhatsApp comercial real | **PENDING EXTERNAL** — null en seed (no inventado) |
| Wompi sandbox del tenant | **PENDING EXTERNAL** — wiring completo; sin keys no hay `checkoutUrl` |
| S3 `WEB_BUILDER_S3_*` / AWS | **PENDING EXTERNAL** — ZIP de binarios; manifest URL funciona sin S3 |
| Logo oficial | **PENDING EXTERNAL** — tipografía de marca en header |

---

## 11. Instrucciones de administración

1. Entrar a staging con cuenta ADMIN de org `stg_web_builder_org_001` (Clerk ya linkeable vía scripts staging).
2. Abrir **WEB BUILDER** en el menú PMS.
3. Secciones: Sitio → Diseño → Páginas → Alojamientos → Contenido → Importar → Reservas → Configuración → SEO → Publicación.
4. Páginas: crear/editar, publicar/borrador, archivar; `home`/`inicio` no se eliminan en duro.
5. Contenido: hero, ubicación, media URL; Importar: properties / JSON / ZIP.
6. Publicar sitio → verificar `/urbanovaloft` y `/w/{slug}`.
7. Preview sin publicar: `/w/{slug}/preview`.

---

## 12. Procedimiento para otro tenant

1. Crear/activar Organization + Properties en PMS.
2. ADMIN con `website:manage` abre `/web-builder` (se crea sitio vacío o plantilla).
3. Elegir plantilla `URBAN_BOUTIQUE` (u otra disponible).
4. Configurar slug único (no reservado), marca, colores, SEO, contacto.
5. Vincular propiedades publicadas + media autorizada.
6. Activar `bookingEnabled` cuando tarifas/calendario estén listos.
7. Publicar → ruta pública `/w/{slug}` (alias corto solo si se añade ruta dedicada como `/urbanovaloft`).

Script de referencia de seed aislado: `npm run staging:seed` (solo org sintética staging).

---

## 13. Cómo reproducir staging

```bash
cd pragma-pms-web-builder
# .env.staging con Neon claim + PRAGMA_WEB_BUILDER_STAGING=1
npm run staging:assert
npm run staging:migrate   # solo si claim nuevo
npm run staging:seed
npm run staging:e2e
npm run staging:dev       # :3005
```

---

## 14. Estado para aprobación

Producto **listo para validación en staging**.  
Sin merge, sin PR, sin deploy a producción, sin escritura en DB operativa compartida.

**Pendiente de dueño:** fotografías autorizadas, WhatsApp comercial, Wompi sandbox tenant, bucket S3 (opcional para ZIP binario).
