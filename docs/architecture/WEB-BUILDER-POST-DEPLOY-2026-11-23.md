# WEB BUILDER — Post-deploy 2026-11-23

## Auditoría pre-deploy (staging Neon)

| Check | Resultado |
| --- | --- |
| `staging:assert` | OK (dawn-union staging) |
| `staging:e2e` | OK — DIRECT booking, calendar, idempotency, race-safe, PUBLISHED |
| `test:web-builder` | 27/27 pass |
| `typecheck` | pass |
| HTTP `:3005/urbanovaloft` | 200 + hero + BUSCAR + LOFT 801 |
| `POST /api/web-builder/availability` | 200 ok |

## Deploy

| Paso | Detalle |
| --- | --- |
| Commit | `693d74b` — `feat(web-builder): URBAN BOUTIQUE public sites with URBA NOVA branding` |
| Branch | `feat/pragma-web-builder` → pushed |
| Production git | `main` fast-forward `458003a..693d74b` |
| Vercel | Production deploy success (`Cy3ZGmVTfX39mLaG28ZLc42NK3fS`) |
| Migrate prod | purple-block — no pending migrations |
| Pilot publish | `urbanovaloft` PUBLISHED · 4 properties · accent `#6E7862` |

## Smoke producción

| URL | Resultado |
| --- | --- |
| https://www.pragmapms.com/urbanovaloft | 200 — ESTANCIAS CORTAS, NUESTROS LOFTS, BUSCAR, LOFT 801 |
| https://www.pragmapms.com/w/urbanovaloft | 200 |
| `POST /api/web-builder/availability` | 200 — unidades reales + quote |

## Notas

- Buscador conectado al motor de reservas DIRECT existente.
- Contenido y tarifas desde tenant PMS (no hardcode de unidades).
- WhatsApp FAB oculto hasta configurar número comercial válido.
