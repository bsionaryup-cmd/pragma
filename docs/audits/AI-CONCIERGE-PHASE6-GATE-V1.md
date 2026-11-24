# AI Concierge — Fase 6 Gate (Tools de lectura)

**Fecha:** 2026-07-17  
**Master:** v1.1 APROBADO PARA EJECUCIÓN (validación local; sin deploy)  
**Fase 5:** Commit `1a9d3f2` — no modificar  
**Estado:** Gate para implementación Fase 6

---

## Alcance

Solo herramientas de **lectura**:

| Tool | Fuente reutilizada |
|------|-------------------|
| `search_reservations` | Query scoped vía `mergeReservationScope` |
| `get_reservation` | Idem + `assertReservationInScope` |
| `get_property_guest_info` | Property fields (WiFi, reglas, dirección, horarios) |
| `get_guest_registration_status` | `getActiveGuestRegistrationForReservation` |
| `get_access_status` | `AccessCredential` + decrypt (código si existe) |
| `search_availability` | `findOverlappingReservation` tras assert property |
| `get_calendar` | Reservas visibles en rango + propiedades scoped |
| `get_operational_contacts` | `parseOperationalContacts` |
| `get_payment_balance` | `getReservationPaymentBalance` si existe |
| `list_payment_links` | list for reservation scoped |

Sin escritura. Sin Prisma en orchestrator/intent. Sin modificar Inbox AI / GR / TTLock services (solo imports).

---

## Alternativas

| Opción | Decisión |
|--------|---------|
| **A** Handlers en `ai-concierge/tools/read` + scope explícito (no Clerk) | **Elegida** |
| B Extender cada service con `scope?` opcional | Más impacto en módulos existentes |
| C Llamar `getCalendarData` / `getReservationForInbox` (requieren sesión) | Incompatible con agente |

---

## Riesgos

| Riesgo | Mitigación |
|--------|------------|
| Cross-tenant | `assertPropertyInScope` / `assertReservationInScope` obligatorio |
| Prisma “desde el agente” | Solo en capa `tools/read`; orchestrator no importa `db` |
| Exponer secretos | Resultados etiquetados; códigos/WiFi solo en tools de acceso/guest info |
| Side effects calendar | `get_calendar` tool **no** llama purgeGhost ni PriceLabs refresh |

---

## Criterio de cierre Fase 6

1. Handlers registrados; `currentPhase: 6` → `executed`  
2. Tests unitarios + script de prueba real local  
3. Typecheck / build / tests Fase 5+6 PASS  
4. Sin migrate / sin deploy (commit Fase 6 solo si se autoriza después)
