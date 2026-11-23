# URBAN BOUTIQUE — Fidelidad visual URBA NOVA LOFT 33

**Fecha:** 2026-11-23  
**Rama / worktree:** `feat/pragma-web-builder` · `pragma-pms-web-builder`  
**URL staging:** http://localhost:3005/urbanovaloft  
**Deploy / merge / prod / DB operativa:** NO

## Comparación vs referencia

| Elemento | Referencia | Resultado |
|----------|------------|-----------|
| Header crema + UN house + nav + RESERVAR oliva | Sí | **PASS** |
| Hero inset, esquinas redondeadas, tipografía editorial | Sí | **PASS** |
| Copy ESTANCIAS CORTAS / Tu hogar… / LOFTS AMOBLADOS · AIRBNB… | Sí | **PASS** (desde tenant) |
| Buscador pill flotante Llegada/Salida/Huéspedes/BUSCAR | Sí | **PASS** (API availability/book intacta) |
| NUESTROS LOFTS + ALOJAMIENTO TURÍSTICO + 4 cards | Sí | **PASS** (listings del tenant) |
| Ubicación split + VER EN EL MAPA | Sí | **PASS** |
| Footer oliva oscuro | Sí | **PASS** |
| WhatsApp FAB | Solo si hay número | **PASS** (oculto sin WhatsApp) |

## Componentes modificados

- `src/modules/web-builder/templates/urban-boutique/urban-boutique-site.tsx`
- `src/modules/web-builder/templates/urban-boutique/urban-boutique-layout.tsx`
- `src/modules/web-builder/templates/urban-boutique/urba-nova-mark.tsx`
- `src/lib/web-builder/urban-boutique-defaults.ts`
- `public/web-builder/urbanova/*`
- `scripts/staging/crop-urbanova-reference.mjs`

## Pruebas

| Suite | Resultado |
|-------|-----------|
| `npm run staging:e2e` | **PASS** (`raceSafe: true`, PUBLISHED) |
| `npm run test:web-builder` | **PASS** 27/27 |

## Confirmaciones

1. **Buscador → motor:** `POST /api/web-builder/availability` + `POST /api/web-builder/book` sin cambios de servicio.
2. **Contenido tenant:** `site.heroTitle`, listings, tarifas `baseRate`, ubicación desde `TenantWebSite` / property links.
3. **No tocado:** reservas core, calendario, Airbnb/iCal, PriceLabs, Wompi, auth, multi-tenant models.

## Capturas

- `docs/architecture/web-builder-screenshots/urbanova-fidelity-desktop.png`
- `docs/architecture/web-builder-screenshots/urbanova-fidelity-mobile.png`
- `docs/architecture/web-builder-screenshots/reference-urbanova.jpg`

## Sistema permite este diseño

| Capacidad | Dónde |
|-----------|--------|
| Plantilla URBAN BOUTIQUE (layout referencia) | Público `/w/[slug]` y `/urbanovaloft` |
| Paleta Soft White / Sand Oak / Olive / Matte Black | `/web-builder` → **Diseño** (+ preset «Aplicar identidad Urban Boutique») |
| Hero, ubicación, WhatsApp, redes | Contenido + Configuración |
| Portadas por loft | Alojamientos / media `customCoverUrl` |
| Buscador → motor reservas | API web-builder (sin motor paralelo) |

## PENDING EXTERNAL

- Sustituir comps de hero/ubicación por archivos maestros de fotógrafo con derechos definitivos (la referencia del owner se usó para recortes de lofts; hero limpio sin texto quemado).
- WhatsApp / Instagram / TikTok comerciales reales cuando existan en config del sitio.
