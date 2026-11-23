# WEB BUILDER — Fix Clerk + diseño exacto URBA NOVA (2026-11-23)

**Worktree:** `pragma-pms-web-builder` · `feat/pragma-web-builder`  
**Staging:** `http://localhost:3005` · Neon claim staging  
**Merge / PR / prod:** NO

## Resultados

| Criterio | Estado |
|----------|--------|
| Clerk sidebar sin `useClerk` crash | **PASS** — `useClientSignOut` + provider guard; `/web-builder` carga con menú Owner |
| `/urbanovaloft` fiel a referencia | **PASS** — header UN, hero full-bleed, pill BUSCAR, lofts 4 cards, ubicación split, footer charcoal |
| Buscador y reserva | **PASS** — E2E `raceSafe: true` + site PUBLISHED |
| 4 lofts visibles | **PASS** |
| Staging publicado | **PASS** |
| E2E booking | **PASS** |
| Regresión `test:web-builder` | **PASS** 27/27 |

## Clerk

- Causa: `useClerk()` lanza si no hay `ClerkInstanceContext` (key inválida / montaje incompleto).
- Fix: `src/lib/auth/use-client-sign-out.ts`; sidebar + owner menu; recovery sin `useClerk`.
- `ClerkRootProvider` valida publishable key.
- Removido pin directo de `@clerk/shared` en `package.json`.

## Diseño

- Plantilla reescrita: `urban-boutique-site.tsx` + `urba-nova-mark.tsx`.
- Tokens: cream `#F7F4EB`, olive `#5D6325`, charcoal `#1A1A1A`.
- Assets staging: `public/web-builder/urbanova/*` (comps de diseño para hero/ubicación/lofts).
- **PENDING EXTERNAL:** sustituir comps por fotografías oficiales con derechos cuando el owner las aporte; WhatsApp comercial real; mockup JPG original del chat no estaba en disco.

## Capturas

- `docs/architecture/web-builder-screenshots/urbanova-ref-match-hero.png`
- `docs/architecture/web-builder-screenshots/urbanova-ref-match-lofts.png`

## Cómo validar

```bash
cd pragma-pms-web-builder
npm run staging:dev   # :3005
# http://localhost:3005/urbanovaloft
# http://localhost:3005/web-builder
npm run staging:e2e
npm run test:web-builder
```
