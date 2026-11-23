# URBA NOVA LOFT 33 — Fidelidad visual URBAN BOUTIQUE

Fecha: 2026-11-23  
Rama / worktree: `feat/pragma-web-builder` (`pragma-pms-web-builder`)  
URL staging: `http://localhost:3005/urbanovaloft`

## Capturas

| Vista | Archivo |
| --- | --- |
| Desktop (viewport) | `urbanova-desktop.png` |
| Desktop (página completa) | `urbanova-desktop-full.png` |
| Móvil (~390×844) | `urbanova-mobile.png` |

## Comparación con referencia

| Elemento | Referencia (mockup + manual) | Implementación |
| --- | --- | --- |
| Header | Logo izq., nav central, RESERVAR oliva | ✅ Isotipo techo+UN + wordmark; nav LOFTS/UBICACIÓN/CONTACTO; CTA Olive Leaf |
| Tipografía | Montserrat títulos / Poppins cuerpo | ✅ `next/font` Montserrat + Poppins |
| Paleta | Soft White, Sand Oak, Urban Gray, Stone Taupe, Matte Black, Olive Leaf `#6E7862` | ✅ CSS vars desde tenant + preset admin |
| Hero | Foto grande redondeada + overlay | ✅ Inset rounded, eyebrow ESTANCIAS CORTAS, título tenant, subtítulo |
| Buscador | Pill blanco Llegada/Salida/Huéspedes/BUSCAR | ✅ Conectado a `/api/web-builder/availability` → book |
| Lofts | 4 cards 801–804 | ✅ Listings del tenant (no hardcode estático de unidades) |
| Ubicación | Texto Laureles + imagen + mapa | ✅ Contenido tenant + mapa autorizado |
| Footer | Logo invertido, copy, redes | ✅ Stacked mark invertido; WhatsApp FAB solo si hay número |

## Componentes modificados

- `src/modules/web-builder/templates/urban-boutique/urban-boutique-layout.tsx`
- `src/modules/web-builder/templates/urban-boutique/urban-boutique-site.tsx`
- `src/modules/web-builder/templates/urban-boutique/urba-nova-mark.tsx`
- `src/lib/web-builder/urban-boutique-defaults.ts`
- `src/features/web-builder/components/web-builder-hub.tsx` (preset Olive Leaf + tipografía)
- `scripts/staging/seed-synthetic-tenant.ts`

## Pruebas

- `npm run staging:seed` — OK (4 properties, slug `urbanovaloft`)
- `npm run staging:e2e` — OK (`siteStatus: PUBLISHED`, booking DIRECT, calendar, race-safe)
- `npm run test:web-builder` — 27/27 pass

## Confirmaciones

1. **Buscador → motor de reservas:** `POST /api/web-builder/availability` y `POST /api/web-builder/book` (sin segundo motor).
2. **Contenido del tenant:** hero, lofts, tarifas, ubicación y contacto salen de `TenantWebSite` / listings publicados.
3. **Sin deploy a producción** ni cambios al PMS operativo (calendario, Airbnb, Wompi, auth).
