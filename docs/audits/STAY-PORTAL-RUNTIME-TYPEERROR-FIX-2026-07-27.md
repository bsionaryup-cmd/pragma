# Stay Portal — Runtime TypeError forensic fix (2026-07-27)

## Veredicto

Causa raíz identificada y corregida. El crash **no** era ausencia de tabla,
modelo o token de negocio: era un **Prisma Client stale** en el singleton de
`src/lib/db.ts` tras añadir `StayPortalToken` sin bumpear
`PRISMA_SCHEMA_VERSION` (y sin detectar delegados generados faltantes tras HMR).

## FASE 1 — Flujo forense

```
/stay
→ accessStayPortalAction()
→ resolveStayPortalByReservationCode()
→ ensureStayPortalTokenForReservation()
→ db.stayPortalToken.findFirst(...)   ← TypeError aquí

/stay/[token]
→ getStayPortalByToken()
→ db.stayPortalToken.findUnique(...)  ← mismo undefined
```

`undefined` era **`db.stayPortalToken`** (delegado Prisma), no el resultado de
la query ni la reserva.

## FASE 2–4 — Modelo / cliente / DB (demostrado)

| Chequeo | Resultado |
|---------|-----------|
| `Prisma.dmmf` incluye `StayPortalToken` | ✅ |
| Cliente fresco expone `stayPortalToken` | ✅ |
| Tabla `public.stay_portal_tokens` | ✅ (9 cols, índices OK) |
| Migración `20260727020000_stay_portal_tokens` | ✅ aplicada |
| `PRISMA_SCHEMA_VERSION` bumpeada | ✅ `20260727020000_stay_portal_tokens` |

Evidencia: `docs/audits/evidence/stay-portal-prisma-delegate-forensic.json`

## Causa raíz (exacta)

1. Schema + cliente generado + tabla DB estaban correctos.
2. `src/lib/db.ts` solo reciclaba el singleton HMR cuando cambia
   `PRISMA_SCHEMA_VERSION`.
3. Tras introducir Stay Portal, la versión seguía en
   `20260726010000_drop_concierge_…`.
4. El Proxy `db` seguía sirviendo un `PrismaClient` **pre-modelo** →
   `db.stayPortalToken === undefined` →
   `Cannot read properties of undefined (reading 'findFirst'|'findUnique')`.

## Corrección (causa raíz)

1. Bump `PRISMA_SCHEMA_VERSION = "20260727020000_stay_portal_tokens"`.
2. Soft-recycle si el DMMF tiene `StayPortalToken` pero el cliente en cache
   no expone `stayPortalToken` (cubre HMR sin bump / proceso viejo).
   No es try/catch ni guard cosmético sobre `findFirst`.

## Token ausente (diseño)

No se asume que toda reserva tenga `StayPortalToken`.
`ensureStayPortalTokenForReservation` es **lazy/idempotente**: si GR está
completo y el estado es elegible, emite el token. El huésped no debe ver error
interno por ausencia de token.

## Corrección secundaria (contrato GR)

`ensureGuestRegistrationForReservation()` **ya devuelve URL completa**.
El lookup del portal la envolvía otra vez con `buildGuestRegistrationUrl` →
CTA “Completar registro” roto. Se usa la URL tal cual (sin cambiar GR).

## Comportamiento por estado

| Estado | Resultado |
|--------|-----------|
| Código inexistente | Mensaje amigable (`not_found`) |
| Código ambiguo (duplicados) | Fail-closed amigable (`ambiguous`) |
| GR pendiente | “Debes completar primero…” + CTA Completar registro |
| GR completo | Emite token si falta → abre portal |
| Reserva finalizada | “Esta reserva ya finalizó.” |

## FASE 7 — Matriz real + HTTP

Evidencia:
- `docs/audits/evidence/stay-portal-access-matrix.json`
- `docs/audits/evidence/stay-portal-http-probe.json`

- `neverThrew: true` / `allPass: true`
- invalid / pending DIRECT / pending AIRBNB+iCal / open AIRBNB+iCal / ended ✅
- Tras reinicio de `npm run dev`: `GET /stay/[token]` **200** con WiFi, código,
  dirección, horarios, contacto — sin TypeError
- `GET /stay` **200**
- `gr-ttlock-flow assert OK` (no regresión GR→TTLock)

## No modificado (congelado)

- Guest Registration business rules
- TTLock
- Reservas / Calendario
- Flujos de email (salvo CTA portal ya existente)

## Deploy

**No desplegado.** Requiere aprobación explícita del owner. En prod hay que
aplicar la migración `stay_portal_tokens` si aún no está y desplegar el bump
de `PRISMA_SCHEMA_VERSION` + soft-recycle de delegados.
