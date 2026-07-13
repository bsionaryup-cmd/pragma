# PRAGMA INTIENDAS — Inventory Intelligence Engine
## Auditoría de arquitectura y propuesta técnica

**Fecha:** 2026-07-13  
**Tipo:** Solo auditoría / diseño — **sin implementación**  
**Alcance:** Dominio Retail (INTIENDAS). Aislado de PMS, QR Mobility y Core.  
**Estado actual del “AI”:** Reglas heurísticas síncronas en `ai-engine.service.ts` + tabla `RetailPurchaseSuggestion`. Se dispara al abrir Compras. No hay perfiles, jobs ni eventos.

---

## 0. Diagnóstico del estado actual

| Pieza | Hoy | Límite |
|-------|-----|--------|
| `analyzeAndSuggestPurchases` | Lookback 14 días, stock vs `minStock`/`idealStock` | No aprende tendencias; recalcula en request HTTP |
| `RetailPurchaseSuggestion` | Sugerencia por producto | Sin agrupación persistente por proveedor ni lifecycle de pedido IA |
| Acoplamiento | Llamada desde página Compras | Mezcla UI con “inteligencia”; no es motor continuo |
| POS | No importa AI | Correcto — **mantener** |
| Escala | Full scan de productos activos por request | No sirve para 10k productos × 100 tiendas |

**Conclusión:** Lo actual es un *reorder assistant* útil como MVP, no un Administrador Inteligente de Inventario. La propuesta siguiente reemplaza/evoluciona ese núcleo sin meter lógica en el POS.

---

## 1. ¿Dónde debe vivir el motor?

### Recomendación (final)

**Subdominio Retail dedicado:** `src/domains/retail-intelligence/` (o `src/domains/retail/intelligence/` como paquete interno **sin** imports desde POS/UI de caja).

Complementado con:

1. **Proyecciones materializadas** en Prisma (`RetailProductIntelProfile`, `RetailSupplierIntelProfile`, …).  
2. **Procesamiento asíncrono** (jobs / cola) por tienda y por lote.  
3. **Eventos de dominio Retail** (outbox liviano) emitidos por `sale` / `purchase` / `inventory` — **no** por el POS React.

### Por qué no mezclarlo con el POS

- El POS debe ser síncrono, barato y predecible (escáner → carrito → cobro).  
- Recalcular inteligencia en cada venta bloquearía caja y acoplaría fallos de IA a ventas.  
- El tendero no “pregunta”; el motor escribe sugerencias/acciones; la UI solo las muestra.

### Alternativas evaluadas

| Opción | Pros | Contras | Decisión |
|--------|------|---------|----------|
| A. Lógica en `ai-engine.service` + cron | Simple | Sigue siendo monolito; difícil escalar | Transición corta |
| B. Microservicio externo | Escala horizontal | Ops, auth, latencia, costo; prematuro | Descartada ahora |
| C. **Dominio `retail-intelligence` + jobs + proyecciones** | Aislamiento, testable, escala por tienda | Más modelos | **Elegida** |
| D. Solo LLM/prompts | “Inteligente” percibido | No determinista, caro, no aprende datos | **Prohibido** como núcleo |

### ¿Eventos?

**Sí, eventos internos de Retail (outbox), no bus global de PMS.**  
Patrón: escritura transaccional (`RetailSale` + `RetailIntelOutbox`) → worker consume → actualiza perfiles → regenera sugerencias/pedidos draft.

---

## 2. Información que debe alimentar la IA

### Señales transaccionales (fuente de verdad)

- Ventas completadas / ítems (qty, precio, costo, hora Bogotá, método pago, crédito).  
- Compras / recepción (qty recibida vs pedida, costo, lead time real).  
- Movimientos de inventario (ajuste, pérdida, devolución, traslado).  
- Stock actual, `minStock`, `idealStock`, categoría, proveedor primario/secundario.  
- Pagos de clientes y cartera (demanda financiada / riesgo).  
- Sesiones de caja (contexto operativo, no predicción primaria).  
- Bodegas / stock por ubicación (si multi-bodega).

### Señales derivadas (aprendidas)

- Velocidad de venta (día/semana/mes), estacionalidad, dow/hora.  
- Margen bruto, contribución, elasticidad implícita (precio vs volumen).  
- Lead time observado vs `leadTimeDays` declarado.  
- Cumplimiento de pedidos (fill rate).  
- Días de cobertura (stock / velocity).  
- Correlación canasta (productos que se venden juntos) → pedidos compuestos.

### Señales que **no** deben contaminar el motor

- Datos PMS / reservas / finanzas hotel.  
- Texto libre de chat.  
- Inputs manuales del tendero como “verdad” sin evidencia (pueden ser *overrides*).

### Señales adicionales recomendadas

- Merma / pérdida por producto.  
- Stockouts (días en cero).  
- Cancelaciones de venta / anulaciones.  
- Cambios de precio/costo (historial).  
- Festivos Colombia (calendario) para estacionalidad local.  
- Multiplicador por tienda (si hay cadena).

---

## 3. Perfil inteligente del producto

### Modelo propuesto: `RetailProductIntelProfile` (1 fila / producto)

Campos sugeridos (todos recalculables, no “ entrena LLM”):

| Indicador | Descripción |
|-----------|-------------|
| `avgDailySales7/14/30/90` | Promedios de unidades |
| `avgWeeklySales`, `avgMonthlySales` | Agregados |
| `salesByMonthJson` | 12 buckets (estacionalidad) |
| `salesByDowJson`, `salesByHourJson` | Patrones intra-semana / día |
| `peakMonths`, `lowMonths` | Derivados |
| `daysToStockoutEst` | stock / velocity (con piso) |
| `avgDaysToDeplete` | Histórico entre reposiciones |
| `grossMarginPct`, `contributionScore` | Rentabilidad |
| `reorderFrequencyDays` | Cadencia de compras |
| `lastCost`, `lastPrice`, `costTrend`, `priceTrend` | Precios |
| `demandTrendSlope` | Tendencia (regresión simple 30–90d) |
| `stockoutDays30` | Días en quiebre |
| `suggestedReorderQty` | Output del motor |
| `suggestedAction` | enum (ver §8) |
| `confidence` | 0–1 según volumen de datos |
| `computedAt` | Freshness |

### Indicadores adicionales

- **ABC class** (contribución a margen/volumen).  
- **XYZ class** (variabilidad de demanda).  
- **Dead stock score** (sin ventas + stock alto).  
- **New item cold-start** (usar categoría / similares).  
- **Promo sensitivity** (si existen descuentos en venta).

---

## 4. Perfil inteligente del proveedor

### Modelo: `RetailSupplierIntelProfile` (1 fila / proveedor)

| Indicador | Descripción |
|-----------|-------------|
| `productCount`, `topProductIds` | Catálogo efectivo |
| `avgLeadTimeDaysObserved` | Recepción − pedido |
| `leadTimeP50/P90` | Robustez |
| `preferredDeliveryDows` | Días habituales |
| `onTimeRate`, `fillRate` | Cumplimiento |
| `priceHistoryJson` / `avgCostTrend` | Precios |
| `orderFrequencyDays` | Cadencia |
| `lastOrderAt`, `lastOrderTotal` | Recencia |
| `avgOrderTotal`, `lifetimePurchaseTotal` | Volumen |
| `reliabilityScore` | Score compuesto |
| `computedAt` | Freshness |

### Indicadores adicionales

- % pedidos con faltantes.  
- Variación de costo vs competencia interna (si hay 2º proveedor).  
- Score de “mejor proveedor” por SKU.  
- Riesgo de concentración (% compras en un solo proveedor).

---

## 5. Generación automática de pedidos

### Flujo recomendado

```
Perfiles actualizados
        ↓
Motor de reorden (reglas + velocity + lead time + cobertura objetivo)
        ↓
RetailIntelReorderPlan (borrador por tienda)
        ↓
Agrupación por supplierId
        ↓
RetailPurchaseOrder status=SUGGESTED|DRAFT, aiGenerated=true
        ↓
UI Compras: Revisar → Editar → Aprobar → Recibir
```

### Agrupación tipo Alpina

1. Para cada producto con acción `BUY` / `INCREASE_STOCK`, elegir proveedor (primario o mejor score).  
2. Bucket por `supplierId`.  
3. Una propuesta = N líneas + `estimatedTotal` + `suggestedSendAt` (hoy + lead time − días de cobertura objetivo).  
4. Persistencia: **no** solo sugerencias sueltas; también `RetailIntelSupplierOrderDraft` (opcional) o directamente `RetailPurchaseOrder` AI.

### Arquitectura limpia

- **Policy engine** (código determinista): cobertura objetivo (ej. 14 días), MOQ, redondeo a empaque.  
- **Learning layer**: actualiza velocity/lead time en perfiles.  
- **LLM (opcional, fase tardía):** solo para redactar mensaje al proveedor a partir del draft ya calculado — **nunca** para decidir cantidades.

### Por qué no recalcular en la página Compras

Hoy `analyzeAndSuggestPurchases` en request es aceptable para MVP chico; a escala debe ser **job** + lectura de proyecciones.

---

## 6. Comunicación automática (solo diseño)

| Canal | Ventajas | Desventajas | Fase |
|-------|----------|-------------|------|
| **PDF + descarga/email** | Universal, auditable, sin API WhatsApp | Menos inmediato | **Fase 1** |
| **Email (Resend ya en Core/PMS)** | Automatizable, adjunto PDF | Spam, no lectura inmediata | Fase 1–2 |
| **Enlace web firmado** (`/intiendas/p/[token]`) | Proveedor confirma sin login complejo | Requiere portal mínimo | **Fase 2 recomendada** |
| **WhatsApp** | Alto open-rate en LatAm | Meta API, opt-in, plantillas, compliance | Fase 3 |

**Recomendación:** Arquitectura de *Notification Adapter* (`RetailOrderDispatchPort`) con implementaciones Email/PDF/Link/WhatsApp. El motor solo emite `OrderReadyToDispatch`. **No implementar aún.**

---

## 7. Aprendizaje continuo (sin entrenamiento manual)

### Estrategia elegida: **estadística online + proyecciones**, no ML pesado al inicio

1. **Evento venta** → incrementa contadores diarios (`RetailProductDemandDay`).  
2. Job nocturno / cada N minutos → recalcula perfiles (EWMA o media móvil + slope).  
3. Detección de cambio:  
   - Comparar `avgDailySales7` vs `avgDailySales30`.  
   - Si ratio > umbral (ej. 1.3) → `demandTrend = UP` y subir `suggestedReorderQty`.  
   - Si ratio < 0.7 → `DOWN` / `WAIT`.  
4. Cold start: usar mediana de categoría hasta `n` ventas.

### Alternativa “mejor” a largo plazo (opcional)

- Forecasting ligero (Croston para intermitentes, ETS simple).  
- Solo si hay volumen; no bloquear MVP de inteligencia.

### Lo que **no** hacer

- Reentrenar modelos por tienda con GPU.  
- Guardar prompts.  
- Depender de que el usuario “corrija a la IA” como único aprendizaje (sí registrar *feedback*: aprobar/descartar sugerencia como señal).

---

## 8. Recomendaciones inteligentes

### Enum propuesto `RetailIntelAction`

| Acción | Cuándo |
|--------|--------|
| `BUY_NOW` | Cobertura < lead time + buffer |
| `BUY_SOON` | Cobertura baja pero no crítica |
| `WAIT` | Cobertura sana / tendencia down |
| `DO_NOT_REORDER` | Dead stock / fin de vida |
| `SWITCH_SUPPLIER` | Lead time/costo peor que alternativa |
| `PROMOTE` | Exceso + baja rotación |
| `INCREASE_STOCK_TARGET` | Tendencia up sostenida |
| `DECREASE_STOCK_TARGET` | Tendencia down / overstock |
| `ADJUST_PRICE_REVIEW` | Margen erosionado (alerta, no auto-precio) |
| `CHECK_SHRINKAGE` | Pérdidas altas |
| `BUNDLE_OPPORTUNITY` | Canasta frecuente |

UI: panel “Inteligencia” / Compras muestra **acciones**, no chat.

---

## 9. Arquitectura de eventos (sí, adecuada)

```
[Retail write path]
  completeSale / receivePurchase / adjustStock
        ↓ (misma transacción)
  RetailIntelOutbox { type, storeId, entityId, payload, createdAt }
        ↓
[Worker retail-intel]
  claim outbox
        ↓
  update DemandDay + ProductProfile (+ SupplierProfile si compra)
        ↓
  maybeRefreshReorderPlan(storeId)  // debounce por tienda
        ↓
  update suggestions / AI drafts
        ↓
  Dashboard lee proyecciones (barato)
```

**Sí es adecuada** si:

- Outbox es **solo Retail**.  
- Workers son **idempotentes**.  
- POS **nunca** espera al worker.  
- Debounce por `storeId` evita tormentas (100 ventas/hora → 1 refresh de plan).

**No** usar eventos cross-producto (PMS) ni webhooks públicos para esto.

---

## 10. Escalabilidad (10k productos, 100 tiendas, millones de ventas)

### Principios

1. **Particionar por `storeId`** en todas las tablas intel.  
2. **No escanear historial completo**: tablas diarias agregadas (`DemandDay`) + perfiles.  
3. **Jobs por shard de tienda** (`storeId % N`).  
4. **Índices**: `(storeId, computedAt)`, `(storeId, suggestedAction)`, `(storeId, productId, day)`.  
5. **Hot path venta**: O(ítems) writes + 1 outbox; sin N+1 de perfiles.  
6. **Read path UI**: solo perfiles/sugerencias; nunca `groupBy` sobre `RetailSaleItem` en request.  
7. **Retención**: raw sales forever OK; aggregates compactos; archivar outbox procesado.  
8. **Límites**: batch update 500 productos/tienda/tick.

### Capacidad aproximada

- 100 tiendas × 10k SKUs = 1M perfiles → caben en Postgres con cuidado de índices.  
- Millones de ventas → agregados diarios (~365 × 10k × 100 peor caso teórico; en práctica sparse) → factible.

---

## Modelos necesarios (Prisma, aditivos, solo Retail)

1. `RetailProductDemandDay` — `storeId, productId, day, qtySold, revenue, cost`  
2. `RetailProductIntelProfile` — §3  
3. `RetailSupplierIntelProfile` — §4  
4. `RetailIntelOutbox` — eventos pendientes  
5. `RetailIntelReorderPlan` + `RetailIntelReorderPlanLine` (opcional si no se usa PO directo)  
6. Extender `RetailPurchaseSuggestion` con `action`, `confidence`, `planId` **o** migrar a plan  
7. `RetailIntelFeedback` — approve/dismiss como aprendizaje  

*(Nombres exactos ajustables; todos `@map` retail_* y scoped por `storeId`.)*

---

## Servicios necesarios

| Servicio | Responsabilidad |
|----------|-----------------|
| `intel-outbox.publisher` | Inserta eventos desde sale/purchase/inventory |
| `intel-outbox.worker` | Consume, idempotente |
| `product-profile.service` | Recalcula perfil producto |
| `supplier-profile.service` | Recalcula perfil proveedor |
| `reorder-engine.service` | Acciones + qty + agrupación proveedor |
| `reorder-plan.service` | Persiste drafts / sincroniza PO AI |
| `intel-read.service` | API/UI: sugerencias, planes, scores |
| `dispatch.port` (fase 2+) | Email/PDF/Link/WhatsApp |

**POS / `tiendas-on/pos.tsx`:** cero imports de intelligence.

---

## Jobs necesarios

| Job | Schedule | Trabajo |
|-----|----------|---------|
| `retail-intel-outbox-drain` | cada 1–5 min | Procesar outbox |
| `retail-intel-recompute-stale` | diario 02:00 Bogotá | Perfiles no tocados > 24h |
| `retail-intel-seasonality-roll` | semanal | Recompute seasonality |
| `retail-intel-plan-refresh` | tras debounce o 06:00 | Planes de pedido |

Alineable con `vercel.json` crons **solo rutas `/api/cron/retail-*`** aisladas — sin tocar crons PMS existentes más de lo aditivo.

---

## Riesgos

| Riesgo | Mitigación |
|--------|------------|
| Contaminar POS | Regla de arquitectura + test isolation |
| Recalcular en request (hoy) | Migrar a proyecciones |
| Sugerencias incorrectas → sobrecompra | `confidence`, caps, aprobación humana |
| Multi-tenant leak | Siempre `storeId` en where |
| Explosión de outbox | Debounce + batch + TTL |
| LLM como oráculo | Prohibido en núcleo |
| Acoplar a PMS email/WhatsApp | Ports + adapters |

---

## Alternativas globales

1. **Quedarse en heurística on-request** — barato, no escala, no “aprende”.  
2. **Intelligence domain + aggregates + jobs (recomendada)**.  
3. **Warehouse analítico externo** — overkill hoy.  
4. **ML SaaS** — costo/privacidad; no como capa 1.

---

## Recomendación final

1. **Crear subdominio `retail-intelligence`** desacoplado del POS.  
2. **Outbox de eventos Retail** + workers idempotentes.  
3. **Perfiles materializados** de producto y proveedor.  
4. **Motor de reorden determinista** que genera pedidos agrupados por proveedor.  
5. **UI solo consume** planes/acciones (Compras / Inteligencia).  
6. **Comunicación** vía adapters (PDF/Email/Link primero; WhatsApp después).  
7. **Aprendizaje** = estadísticas online + feedback de aprobación; sin chatbot.  
8. Evolucionar el `ai-engine.service` actual a *legacy adapter* hasta que los perfiles estén listos.

**No implementar en esta fase.** Siguiente paso cuando se autorice: baseline OCP/Retail + migración aditiva de tablas intel + worker outbox + desacople de `compras/page.tsx`.

---

## Checklist de aislamiento (diseño)

| Regla | Cumple |
|-------|--------|
| Retail ↛ PMS | Sí (dominio propio) |
| PMS ↛ Retail intel | Sí |
| QR ↛ Retail | Sí |
| POS ↛ intelligence | Sí (obligatorio) |
| Core solo infra (DB, cron shell, email port) | Sí |

**Documento de solo arquitectura — sin código aplicado.**
