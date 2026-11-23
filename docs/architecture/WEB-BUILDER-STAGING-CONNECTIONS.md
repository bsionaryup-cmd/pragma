# WEB BUILDER — Inventario de conexiones y aislamiento

**Fecha:** 2026-11-23  
**Worktree:** `pragma-pms-web-builder` · rama `feat/pragma-web-builder`

## Regla

La Neon operativa (`ep-purple-block-…`) es **compartida**. Queda prohibido usarla para reservas de prueba, migraciones nuevas, publish de URBA NOVA o seeds sintéticos.

## Variables identificadas (worktree)

| Archivo | Variables relevantes | Uso |
|---------|----------------------|-----|
| `.env` | `EMAIL_FROM`, `PRAGMA_BILLING_EMAIL` | No-DB |
| `.env.local` | `DATABASE_URL`, Clerk, `APP_URL`, etc. | **Operativa compartida** (dev histórico) |
| `.env.staging` | *(a crear, gitignored)* | **Solo staging WEB BUILDER** |
| `DIRECT_URL` | **No definida** en este worktree | N/A |

### Host fingerprint operativa (no secretos)

- Host: `ep-purple-block-apuk7v1k.c-7.us-east-1.aws.neon.tech`
- DB name: `neondb`
- Clasificación: operativa / piloto compartido

### Staging (creado en esta fase)

- Archivo: `.env.staging` (gitignored)
- Host: `ep-dawn-union-bebo02dx-pooler.c-9.us-east-2.aws.neon.tech`
- Origen: Neon **claim** temporal (`restless-smoke-07337143`) — expira ~2026-11-26 si no se reclama
- Guard: `scripts/staging/assert-staging-db.mjs` aborta si el host coincide con la operativa
- Puerto app: `3005`

## Cómo apuntar Prisma/dev a staging

```bash
# Solo worktree pragma-pms-web-builder
copy .env.staging.example .env.staging
# Pegar DATABASE_URL del branch Neon staging (nunca la operativa)

npm run staging:assert
npm run staging:migrate
npm run staging:seed
npm run staging:dev
```

`staging:dev` carga **solo** `.env.staging` (+ `.env` no-DB) y **no** override desde `.env.local` operativo.

## No tocar

- `.env.local` del worktree principal `pragma-pms` / otras ramas
- Migración ya aplicada en operativa (no revertir)
