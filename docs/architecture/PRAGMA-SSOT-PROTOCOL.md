# PRAGMA PMS — Protocolo permanente (única fuente de verdad)

**Vigente desde:** 2026-11-24  
**Commit de consolidación:** `9134574` en `origin/main`

## Reglas

1. **`origin/main` es la única fuente oficial de verdad.**
2. Desarrollo puede usar ramas temporales (`feat/*`, `fix/*`), pero **todo termina integrado en `main`** tras auditoría.
3. No mantener funcionalidades exclusivas indefinidamente en ramas laterales.
4. Todo cambio: TypeScript + pruebas relevantes + build antes de merge a `main`.
5. **Vercel Production** debe desplegarse desde el árbol de `main` (CLI desde checkout `main`, o Production Branch = `main` cuando el proyecto esté git-connected).
6. Entorno local principal: carpeta **`C:\Users\R160\Desktop\pragma-pms`** en rama **`main`**, sincronizada con `origin/main`.
7. Nunca trabajar “por accidente” sobre una versión antigua sin `git fetch` + `git status`.

## Comandos de arranque

```bash
cd C:\Users\R160\Desktop\pragma-pms
git fetch origin
git checkout main
git pull --ff-only origin main
npm run staging:dev   # preferido (Neon dawn-union) o npm run dev con cuidado
```

## Respaldos temporales (≥ 30 días)

- `backup/web-builder-wip-20261124-044611`
- `backup/apify-wip-20261124-044611`
- `backup/apify-stashes-ref-20261124-045702`
- Worktree `pragma-pms-web-builder` (histórico)
- Worktree `pragma-pms-tarifas-deploy` (histórico)
- Rama `cursor/apify-prospecting-engine` (integrada; conservar como archivo)

## Stay Portal

- Tokens válidos: `StayPortalToken` (no enumerable por `reservationCode`).
- Links legacy `/stay/{guestRegistrationToken}` se resuelven vía `getStayPortalUrlForGuestRegistrationToken`.
- Token inválido → “Enlace no disponible” (**comportamiento correcto**).
