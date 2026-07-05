# Auditoría Financiera, Métricas, Consistencia y UX

**Fecha:** 2026-07-05  
**Alcance:** Tenant Dashboard (Panel), Finanzas, Propiedades, ocupación, mensajes rápidos  
**Estado:** Implementado y verificado en tests

---

## Fase 1 — Hallazgos de auditoría

### 1. ¿De dónde sale "Acumulado" en Owner Dashboard?

**No existe ese label en Owner Dashboard (plataforma).**  
`/owner-dashboard` muestra facturación SaaS (MRR, cobros de suscripción) y GMV histórico de reservas comerciales — dominio distinto.

Si el usuario se refiere al **Panel tenant** (`/panel`):

| Superficie | Métrica | Fuente |
|---|---|---|
| Panel → Finanzas | Ingresos del mes | `getFinanceOverview()` → `kpis.revenue` |
| Finanzas | Acumulado {{year}} | `buildFinanceYearlySeries()` → `yearToDateRevenue` |

### 2. ¿De dónde sale "Acumulado 2026" en Finanzas?

```
finance/page.tsx → getFinanceOverview()
  → buildFinanceYearlySeries(scope, year)
  → suma revenue de meses no futuros (ingresos confirmados por check-in)
```

Filtros: estados contables, check-in ≤ hoy, `withVisibleReservationsFilter`, ingresos manuales operativos incluidos, timezone Bogotá → claves UTC en `financeMonthBounds`.

### 3. ¿Mismas reglas entre módulos?

| Dimensión | Panel (mes) | Finanzas YTD | Antes del fix |
|---|---|---|---|
| Resolver $/reserva | `resolveFinanceReservationRevenueAmount` | Igual | ✅ |
| Ingreso confirmado | `isReservationIncomeConfirmed` | Igual | ✅ |
| Ocupación mensual | `loadMonthlyFinanceAggregates` | Tarjeta + gráfica | ❌ Gráfica usaba fórmula distinta |
| Owner GMV | N/A | N/A | Dominio distinto (all-time, sin confirmación) |

### 4. Cálculos duplicados identificados

- Ingresos mensuales: `command-center.service` y `finance.service` (misma regla vía `sumConfirmedReservationRevenue`, queries paralelas — aceptable).
- Ocupación: **7 implementaciones** → unificadas bajo `calculateOccupancy()` + `loadMonthlyFinanceAggregates`.
- Property cards: fórmula distinta → alineada a finanzas (blocked nights, estados contables).

---

## Fase 2 — Unificación implementada

| SSOT | Archivo | Consumidores |
|---|---|---|
| Ingreso confirmado / reserva | `resolveFinanceReservationRevenueAmount` | Finanzas, Panel, Owner GMV (solo monto) |
| Suma ingresos confirmados | `sumConfirmedReservationRevenue` | Finanzas, Command Center |
| Ocupación % | `calculateOccupancy()` | `monthly-finance-calc`, propiedades |
| Agregados mensuales | `loadMonthlyFinanceAggregates` | Finanzas tarjeta, gráfica anual, Panel KPI backend |
| Ingresos por canal | `computeChannelRevenueSummary` | Finanzas UI |

---

## Fase 3 — Validación acumulado

- **Panel ingresos mes** = `getFinanceOverview().kpis.revenue` (operations-center.compose).
- **Finanzas ingresos mes** = misma función, mismo mes seleccionado.
- **Acumulado año** = solo en Finanzas; no comparable con Owner Dashboard (dominios distintos).
- **Canal total** = `channelSummary.totalRevenue` debe igualar `kpis.revenue` (reservas confirmadas + otros ingresos).

---

## Fases 4–8 — Cambios UX

| Fase | Cambio |
|---|---|
| 4 | Cuadro resumen Ingresos Airbnb / Directos / Total en Finanzas |
| 5 | KPIs secundarios: solo Ocupación + Margen (eliminados Proyección e Ingreso prom./propiedad de UI) |
| 6 | Ocupación unificada: tarjeta = gráfica = panel backend |
| 7 | Tabla histórico mensual eliminada (datos conservados en API) |
| 8 | Mensajes rápidos UI: 5 botones; plantillas completas en Ajustes |

---

## Fase 9 — Pruebas ejecutadas

```bash
npm run typecheck
npx tsx --test tests/finance/calculate-occupancy.test.ts
npx tsx --test tests/finance/channel-revenue-summary.test.ts
npx tsx --test tests/finance/monthly-finance-metrics.test.ts
```

---

## Fase 10 — Re-auditoría

- ✅ Sin cambios de schema Prisma
- ✅ Tipos actualizados (`FinanceOverview.channelSummary`)
- ✅ SSR: servicios server-only sin cambio de contrato breaking
- ✅ Multi-tenant: scopes preservados
- ✅ Plantillas HOUSE_RULES y REVIEW siguen en settings

---

## Criterios de aprobación

| Criterio | Estado |
|---|---|
| Acumulados alineados entre módulos comparables | ✅ Panel = Finanzas (mes) |
| Ocupación idéntica tarjeta/gráfica | ✅ Misma fuente aggregates |
| Ingresos por canal discriminados | ✅ Cuadro resumen |
| KPIs eliminados sin romper dependencias | ✅ Datos en API, UI reducida |
| Histórico mensual solo visual removido | ✅ |
| 5 mensajes rápidos en UI | ✅ |
| Tests pasando | ✅ |

**Deploy:** Pendiente autorización explícita del owner (no ejecutado en esta fase).
