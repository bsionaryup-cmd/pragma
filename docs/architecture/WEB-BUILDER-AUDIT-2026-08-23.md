# PRAGMA WEB BUILDER — Auditoría técnica (Fase 1)

**Fecha:** 2026-08-23  
**Rama de trabajo:** `feat/pragma-web-builder`  
**Worktree:** `c:\Users\R160\Desktop\pragma-pms-web-builder`  
**Baseline git:** `458003a` (equivale a `main` en el momento del branch)

## Estado Git al iniciar

| Ítem | Valor |
|------|--------|
| Rama limpia de trabajo | `feat/pragma-web-builder` |
| Repo principal (sucio, no usar) | `cursor/apify-prospecting-engine` con cambios locales ajenos |
| Estrategia | Implementar solo en worktree limpio; no mezclar con WIP local |
| Producción | **No desplegar** sin autorización explícita |

## Arquitectura existente (reutilizable)

1. **Next.js 16.2.6** App Router + TypeScript + Prisma 7 + PostgreSQL.
2. **Multi-tenant:** `Organization` + `User.organizationId` + impersonación platform owner.
3. **Propiedades/unidades:** modelo `Property` (no hay `Unit` separado). URBA NOVA = 4 properties en org piloto.
4. **Auth:** Clerk + RBAC (`ADMIN` / `RECEPTIONIST`) en `src/lib/auth/permissions.ts`.
5. **Reservas:** `createReservation` + `assertNoReservationOverlap` + calendario iCal.
6. **Plataforma de reserva directa:** `BookingPlatform.DIRECT` (no existe `WEB_DIRECTA`; se usa DIRECT + nota interna).
7. **Airbnb / iCal / PriceLabs / Wompi:** servicios existentes; no reescribir.
8. **Pagos huésped:** `GuestPaymentLink` + Wompi webhook + holds (`reservation-hold.service`).
9. **Imágenes:** solo `Property.coverImageUrl` (URL). **No hay object storage S3/Blob.**
10. **UI:** sidebar + `features/*` + `services/*` + server actions.
11. **Rutas públicas actuales:** `/`, `/pricing`, `/guest-registration/*`, `/m/*`, `/offer/*`, etc.
12. **Tenant piloto:** `PILOT_PMS_ORGANIZATION_ID = cmplxfg0a000105jrs0gqtwyc` (urbanovaloft).

## Decisiones de diseño

| Tema | Decisión |
|------|----------|
| Slug público | `/w/[slug]` interno + rewrite `/urbanovaloft` → `/w/urbanovaloft` |
| Plantilla | `URBAN_BOUTIQUE` parametrizada por config DB (no código por tenant) |
| Media | Biblioteca por URL + import desde properties / JSON; S3 marcado pendiente |
| Reservas web | Servicio público que reutiliza overlap + create DIRECT |
| Permisos | `website:read` / `website:manage` (ADMIN) |
| Pagos | Reutilizar hold + Wompi existente; no simular confirmación |

## Riesgos

- Ruta root-level `/urbanovaloft` no debe colisionar con módulos PMS (rewrite dedicado).
- Sin object storage: fotos finales dependen de URLs autorizadas del admin.
- `createReservation` exige sesión tenant → se añade camino público aislado sin tocar el wizard admin.
- Working tree sucio en la otra rama: no tocar.

## Plan de reversión

1. Revertir commits del branch `feat/pragma-web-builder`.
2. Migración aditiva: drop tables `tenant_web_*` si hace falta rollback de schema.
3. No tocar migraciones históricas ni datos de otros tenants.
