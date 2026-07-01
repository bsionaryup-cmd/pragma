# OCP Phase 6 — Fallback Certification

**State:** FROZEN (decision documented, no code change)  
**Measurement:** `scripts/_audit-fallback-gross-readonly.mjs`

## Results (pilot CONFIRMED events, n=11)

| Source | Count |
|--------|-------|
| hostPayout | 11 |
| netPayout | 0 |
| fallbackGross | 0 |
| none | 0 |

## Decision: **MAINTAIN** `pickReservationAmount` gross fallback

**Evidence chain:** Auditoría → Medición (0 en muestra) → Comparación con tests existentes (`safe-reservation-enrichment.test.ts` confirma prioridad host→net→gross) → Conclusión.

**Rationale:** Muestra pilot no demuestra ausencia global. Eliminar `grossAmount` fallback sin auditoría completa de reservas históricas sin host/net violaría zero regression. Re-evaluar cuando script cubra 100% CONFIRMED events o bug reproducible demuestre gross como única fuente válida.

**Action:** Ninguna modificación a escritura enrichment en este ciclo.
