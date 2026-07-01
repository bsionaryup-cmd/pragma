# OCP Phase Deliverable — `<DOMAIN>` / `<PHASE>`

**Date:** YYYY-MM-DD  
**Domain state:** OPEN | IN_PROGRESS | CERTIFIED | FROZEN | CLOSED  
**Baseline ref:** `docs/ocp/baselines/<domain>-<timestamp>.md`  
**Commit (post J):** `<sha>` — pending until certified

---

## 1. Objetivo

<!-- Una oración medible. Qué comportamiento debe quedar garantizado. -->

## 2. Alcance

### In scope

- 

### Out of scope (prohibido tocar)

- 

### Stop criteria (detener y documentar)

- Requiere cambio de schema / arquitectura / contrato / regla de negocio

## 3. Baseline

| Métrica / comportamiento | Valor antes | Fuente |
|--------------------------|-------------|--------|
| Tests relevantes | | `npm run …` |
| Replay | | `scripts/_replay-…` |
| Consumidores SSOT | | grep / inventario |
| Performance (si aplica) | | benchmark script |

## 4. Auditoría inicial

<!-- Hallazgos con archivo:línea o script read-only -->

## 5. Hallazgos

| ID | Severidad | Descripción | SSOT violado? |
|----|-----------|-------------|--------------|
| H1 | | | |

## 6. Archivos modificados

| Archivo | Cambio | Necesario? (Y/N) |
|---------|--------|------------------|

## 7. Justificación técnica

<!-- Por qué cada cambio es el mínimo correcto -->

## 8. Evidencia

```
Auditoría → Medición → Comparación → Conclusión
```

## 9. Benchmark antes/después

| Métrica | Antes | Después | Δ | PASS? |
|---------|-------|---------|---|-------|

## 10. Replay

```bash
npx tsx scripts/_replay-enrichment-edge-case-fix.mjs
```

- `regressionCount`: 
- Casos: 

## 11. Comparación antes/después

| Comportamiento observable | Antes | Después | Intencional? |
|---------------------------|-------|---------|--------------|

## 12. Riesgos

| Riesgo | Nivel | Dominio afectado |
|--------|-------|------------------|

## 13. Mitigaciones

## 14. Pruebas ejecutadas

| Comando | Resultado |
|---------|-----------|

## 15. Reauditoría

| Pregunta auditoría global | Respuesta | Evidencia |
|---------------------------|-----------|-----------|

## 16. Declaración de Certificación

- [ ] Auditoría PASS
- [ ] Medición PASS
- [ ] Implementación PASS
- [ ] Replay PASS
- [ ] Reauditoría PASS
- [ ] Smoke PASS
- [ ] Benchmark PASS
- [ ] 0 regresiones

**CERTIFIED:** YES / NO

## 17. Declaración de Congelamiento

**Archivos protegidos:**

- 

**Reapertura:** solo bug reproducible o cambio de negocio aprobado.

## 18. Commit certificado

```
git commit -m "cert(ocp): <domain> — <one-line why>"
```

**SHA:**  
**Rollback:** `git revert <sha>`
