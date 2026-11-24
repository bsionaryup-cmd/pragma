# PRAGMA — Worktree fuente de verdad (SSOT)

**Fecha:** 2026-11-24

## Regla

| Uso | Carpeta | Rama |
|-----|---------|------|
| **Desarrollo, tests, deploy a www** | `C:\Users\R160\Desktop\pragma-pms-web-builder` | `feat/pragma-web-builder` |
| **No usar para Panel / WEB BUILDER / prod** | `C:\Users\R160\Desktop\pragma-pms` | `cursor/apify-prospecting-engine` (u otras) |

`www.pragmapms.com` se despliega desde **pragma-pms-web-builder** → proyecto Vercel **pragma-pms**.

## Local correcto

```bash
cd C:\Users\R160\Desktop\pragma-pms-web-builder
npm run staging:dev   # http://localhost:3005  (Neon dawn-union)
# o, con cuidado:
npm run dev           # usa .env.local (puede ser Neon operativa)
```

En Cursor: **File → Open Folder → `pragma-pms-web-builder`**.

El `npm run dev` en `pragma-pms` **no** incluye WEB BUILDER en el menú ni las donuts del Panel.

## Por qué divergieron

La intervención WEB BUILDER + plan maestro se implementó en un git worktree aislado para no mezclar con experimentación Apify en `pragma-pms`. Producción sigue ese worktree.
