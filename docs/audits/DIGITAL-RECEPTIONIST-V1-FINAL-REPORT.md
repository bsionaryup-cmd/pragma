# Digital Receptionist V1 — Informe Final

**Fecha:** 2026-07-30  
**Deploy producción:** **NO** (requiere aprobación explícita)

## Auditoría — qué se reutilizó / creó / no tocó

| Reutilizado | Creado | Intactos |
|-------------|--------|----------|
| Config, policy, kill, ledger, audit, Owner power, desktop WA listener, Stay Portal / GR URL helpers | ContextEngine, RuleEngine, Skills, Decision async, KB CRUD + UI, ThreadFact memory, intents module, migration knowledge/memory | Inbox reservas, iCal, airbnb-email pipeline, TTLock generate/send, GR completion/comms, PriceLabs, Sales OpenAI |

## Arquitectura V1

```
Desktop Listener (WA) → runtime /plan
  → ThreadFact upsert (memory)
  → ContextEngine (read-only reservation/property/KB)
  → RuleEngine (hard gates)
  → Skill runners (FAQ, WiFi name, location, GR, portal, early/late consult, escalate)
  → Template reply
  → Audit payload enriquecido
  → Ledger solo si canSend
```

## Funcionamiento

1. **Intent:** `detectReceptionIntent` (regex).  
2. **Contexto:** código reserva / teléfono → columnas reserva + property FAQ fields + KB hits + stay-window consult.  
3. **Reglas:** nunca TTLock antes de GR; WiFi password solo vía portal; early/late **consulta** sin `adjustAccessWindow`; Airbnb-only channel no envía.  
4. **Skills:** archivos independientes en `skills/skill-runners.ts`.  
5. **NL:** plantillas grounded (sin LLM).  
6. **Escala:** mode `escalate` + audit.  
7. **Apagado:** status OFF / killSwitch / STOP file / Apagar Owner.

## Manual breve

- **Activar:** Owner → Recepcionista Digital → Encender (AUTONOMOUS + kill off) + desktop bat.  
- **Desactivar:** Apagar / kill / OFF.  
- **Modos:** OFF · CONFIG_ONLY · SUPERVISED (solo drafts) · AUTONOMOUS.  
- **KB:** sección «Base de conocimiento» en Owner (CRUD).  
- **Auditoría:** `DigitalReceptionistAuditEvent` (intent, skill, rules, contextHash, reservationId).  
- **Nueva skill:** añadir runner + branch en `decideDigitalReceptionistReply`.

## Validación

- Unit: `tests/platform/digital-receptionist-v1.test.ts` + loft33 — PASS  
- Regresión policy/kill — PASS  
- Sin deploy; migración local: `20260730230000_digital_receptionist_knowledge_memory`

## Criterios de aceptación V1

- [x] Sin techo fijo inventado; FAQ desde KB/Property  
- [x] Early/late consult only  
- [x] Kill / SUPERVISED / OFF  
- [x] Audit enriquecida  
- [x] Core PMS no mutado por el agente (salvo ensure GR link existente)  
- [x] Puente Airbnb = extensión MV3 (`extensions/recepcionista-airbnb`) — default draft  
- [ ] Deploy prod — pendiente aprobación
