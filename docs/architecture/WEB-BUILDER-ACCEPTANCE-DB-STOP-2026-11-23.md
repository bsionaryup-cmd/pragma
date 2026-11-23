# WEB BUILDER — STOP operativo (alcance de base de datos)

**Fecha:** 2026-11-23  
**Decisión:** **DETENER operaciones de escritura de reservas / publicación** sobre esta DB hasta autorización explícita.

## Conexión auditada (`.env.local` del worktree)

| Campo | Valor |
|-------|--------|
| Host Neon | `ep-purple-block-apuk7v1k.c-7.us-east-1.aws.neon.tech` |
| DB | `neondb` |
| Clasificación | **DB operativa compartida / piloto** (no hay evidencia de un Neon staging separado en este entorno) |
| Señal | 5 orgs · 8 properties · **170 reservations** · org piloto real URBA Nova |

## Qué ya se aplicó (histórico de esta implementación)

1. Migración aditiva `20260823120000_pragma_web_builder` — **finished_at 2026-11-23T07:42:34Z**
2. Seed piloto `ensure-web-builder-urbanova-pilot` — site DRAFT `urbanovaloft`, 4 property links, 4 pages
3. **0** reservas `[WEB_BUILDER]` creadas hasta el momento de este STOP

## Alcance de datos tocados

- **Solo** tablas nuevas `tenant_web_*` + 1 fila site del org `cmplxfg0a000105jrs0gqtwyc`
- **No** se modificaron reservas, finanzas, Airbnb, usuarios de otros tenants
- Site status permanece **DRAFT** (página pública no publicada)

## Acciones bloqueadas a partir de este documento

- Crear reservas de prueba sobre unidades 801–804 reales
- Publicar el sitio (`PUBLISHED`)
- Migraciones adicionales
- Deploy / merge / PR

## Continuación permitida de la auditoría

- Lectura DB
- Tests unitarios / de código
- Revisión de aislamiento en código
- Regresión de suites existentes sin writes a inventario real
