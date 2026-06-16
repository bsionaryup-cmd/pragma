# 0F-1b Privacy checklist — public marketing assets

**Status:** PASSED — synthetic demo tenant only (`PRAGMA Demo · Urbano Loft`).

## Scope

| Check | Result |
|-------|--------|
| Pilot / client org untouched | Yes — capture via platform-owner impersonation |
| Real guest names | No |
| Phone numbers visible | No |
| Email addresses visible | No |
| Reservation / confirmation codes visible | No |
| Internal property ref codes (e.g. `1y22dm`) | Hidden via calendar view settings during capture |
| Admin impersonation / trial banners | Hidden during capture (not in final crop) |
| Blur applied | No — clean synthetic data at source |

## Panel (`panel-command-center-main.webp`)

| Item | Status |
|------|--------|
| Guest names | Synthetic — María Torres, Juan Pérez, Laura Gómez (+ otros ficticios demo) |
| Amounts | Redondeados (ej. 980.000 $) |
| Property labels | Demo — unidades 801, 1202, 305, 602 · barrios genéricos Medellín |

## Calendar (`calendar-june-mid-main.webp`)

| Item | Status |
|------|--------|
| Guest names on bars | Synthetic demo only |
| Nightly rates | Redondeados desde baseRate demo |
| Phones / emails / codes | Not shown in grid |

## Regenerate

```bash
node scripts/0f1b-prepare-marketing-demo.mjs
node scripts/capture-landing-screenshots-0f1b.mjs
```
