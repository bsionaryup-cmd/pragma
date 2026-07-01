# PRAGMA PMS — OPERATIONAL CONSISTENCY PROGRAM (OCP)

**MASTER EXECUTION PROTOCOL** · Phased Certification Model · Zero Regression · Zero Data Corruption

**Version:** 1.1  
**Registry:** `docs/ocp/DOMAIN-REGISTRY.md`  
**Deliverable template:** `docs/ocp/templates/PHASE-DELIVERABLE-TEMPLATE.md`

---

## MISIÓN

PRAGMA ha superado la fase de desarrollo inicial.

Todos los trabajos se realizan por **DOMINIOS FUNCIONALES**:

```
AUDITARSE → IMPLEMENTARSE → VALIDARSE → REAUDITARSE → CERTIFICARSE → CONGELARSE → CERRARSE
```

No se abre el siguiente dominio hasta cerrar completamente el anterior.

**Única aprobación manual:** DEPLOY a producción.

---

## AUTONOMÍA

Cursor autorizado para auditar, medir, implementar, corregir, reestructurar internamente (alcance), pruebas, replay, reauditar, certificar, congelar — **sin aprobación intermedia**.

**Excepción — DETENER solo ese punto** si requiere: arquitectura, schema, contratos, lógica de negocio, integraciones, compatibilidad. Documentar, proponer alternativas, continuar el programa.

---

## REGLAS ABSOLUTAS

Nunca: romper comportamiento, tocar dominio certificado sin evidencia, scope creep, cambios especulativos, eliminar lógica sin prueba, sobrescribir históricos.

Nunca contaminar: Reservas, Finanzas, Parser, Matching, Enrichment, Dashboard, Calendar, Inbox, Analytics, API, Cron, Multi Tenant, TTLock, PriceLabs.

---

## METODOLOGÍA (por dominio)

| Fase | Nombre |
|------|--------|
| A | Auditoría |
| B | Medición |
| C | Diseño |
| D | Implementación mínima |
| E | Pruebas |
| F | Replay |
| G | Reauditoría |
| H | Certificación |
| I | Congelamiento |
| J | Commit certificado |

---

## PROGRAMA DE FASES

| # | Dominio | Objetivo |
|---|---------|----------|
| **1** | Financial Consistency | SSOT lectura unificado; medir fallbackGross; no tocar escritura |
| **2** | Reservation Holder | Titular = quien reservó |
| **3** | Guest Registration | Capacidad solo desde reserva |
| **4** | Default Messages | Redundancias demostradas únicamente |
| **5** | UI Financial | Host principal / guest secundario (post Fase 1) |
| **6** | Fallback Certification | Decisión evidenciada sobre grossAmount write |
| **7** | Global Replay | 0 regresiones |
| **8** | Global Audit | 6 preguntas con evidencia |
| **9** | Certificación | CERTIFIED + FROZEN por dominio |
| **10** | Deploy | Solo con aprobación del propietario |

---

## ENTREGABLE (15 puntos por fase)

1. Objetivo · 2. Auditoría inicial · 3. Hallazgos · 4. Archivos modificados · 5. Justificación · 6. Evidencia · 7. Benchmarks · 8. Replay · 9. Antes/Después · 10. Riesgos · 11. Mitigaciones · 12. Pruebas · 13. Reauditoría · 14. Certificación · 15. Congelamiento (+ commit J)

---

## DEPLOY (Fase 10)

Requiere aprobación del propietario. Pre-requisitos PASS: Typecheck, Build, Verify Release, Replay, Smoke, Benchmark, Auditoría Final.
