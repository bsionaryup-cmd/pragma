# AI Concierge — Fase 5 Gate (Pre-implementación)

**Fecha:** 2026-07-17  
**Documento maestro:** v1.0 APROBADO PARA EJECUCIÓN  
**Fases 1–4:** Completadas (`AI-CONCIERGE-PHASE1-4-AUDIT-ARCHITECTURE-V1.md`)  
**Estado:** Gate aprobado para implementación local de Fase 5 únicamente

---

## Alcance Fase 5 (Master)

Motor del Agente **sin respuestas**. Solo:

- conversación
- memoria
- contexto
- tools (infraestructura / registry)

**Fuera de alcance:** envío, extensión, LLM live, tools de lectura wired a DB (Fase 6), escritura (Fase 10), deploy/commit/migraciones.

---

## Alineación arquitectura híbrida (Master)

| Nivel | Rol en Fase 5 |
|-------|----------------|
| L1 Determinístico | Biblioteca de intenciones + plantillas (estructura) |
| L2 Motor intención | Detector + decisión resolve / escalate / needs_tools / needs_llm |
| L3 LLM | **No invocado** — solo marcado `resolutionPath: "llm_deferred"` |

---

## Alternativas (menor impacto)

| Opción | Descripción | Decisión |
|--------|-------------|---------|
| **A** | Módulo nuevo `src/modules/ai-concierge` sin Prisma; memoria serializable; registry sin DB | **Elegida** |
| B | Migraciones + tablas ya en Fase 5 | Rechazada (deploy/migrate prohibidos) |
| C | Extender Inbox AI in-place | Rechazada (modifica módulo existente; mezcla draft UI con agente) |
| D | Microservicio | Rechazada (alto impacto) |

---

## Riesgos Fase 5

| Riesgo | Mitigación |
|--------|------------|
| Contaminar Inbox AI / Novedades | Cero imports de escritura; solo reutilizar detector opcional vía adapter |
| Acceso directo a DB | Ningún `db` / Prisma en el módulo Fase 5 |
| Envío accidental | Orchestrator no tiene canal send; `outboundBlocked: true` |
| Duplicar intents | Adapter reusa `detectInboxMessageIntent` + mapa a ConciergeIntent |
| Scope creep a Fase 6 | Tools registradas como contratos; `execute` no cableado a servicios |

---

## Impacto en dominios congelados

| Dominio | Impacto |
|---------|---------|
| PMS / GR / TTLock / email auto | Ninguno |
| Inbox AI | Ninguno (sin edits) |
| QR / INTIENDAS / Facturación | Ninguno |

---

## Criterio de cierre Fase 5

1. Módulo implementado + tests unitarios  
2. Typecheck + build PASS  
3. Orchestrator produce run auditado sin outbound  
4. Informe post + evidencia  
5. **Sin** migrate / commit / deploy hasta autorización explícita
