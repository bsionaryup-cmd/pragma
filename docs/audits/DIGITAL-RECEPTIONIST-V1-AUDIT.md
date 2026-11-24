# Digital Receptionist V1 — Fase 1 Auditoría

**Fecha:** 2026-07-30  
**Alcance:** Evidencia previa a Context Engine / Skills / KB  
**Deploy:** No autorizado hasta informe final + aprobación explícita

## Qué existe

| Área | Evidencia | Reutilizar / No tocar |
|------|-----------|------------------------|
| Inbox PMS | `listReservationsForInbox` = lista de reservas | Leer; no mutar UI |
| Airbnb inbound | Email → `airbnb-email` → `ReservationCommunication` + `AIRBNB_MESSAGE` | No tocar pipeline |
| Airbnb outbound | Sin HostAPI; desktop solo WhatsApp | GAP V1 send |
| Recepcionista | `DigitalReceptionistConfig`, policy, brain, audit, ledger, runtime API, Owner UI, desktop Opera | Extender |
| Brain | Determinista, sin LLM, sin writes PMS | Base de Decision |
| Property FAQ | `wifi*`, `houseRules`, `accessInstructions`, schedules | ContextEngine |
| Early/late | `adjustAccessWindowForReservation` (staff) | Solo consulta en V1 |
| Limpiezas | Sin modelo | Solape de reservas |
| Kill switch | `killSwitch` + status OFF + STOP file | Flag de apagado |

## No tocar

- `src/modules/airbnb-email/**`, iCal, PriceLabs, billing crons  
- Guest Registration invite/completion/comms  
- TTLock generate/revoke/email  
- Sales OpenAI client  
- Inbox AI eliminado (no reintroducir)

## Riesgos mitigados en V1

| Riesgo | Mitigación |
|--------|------------|
| Envío erróneo | SUPERVISED / kill; ledger fingerprint |
| Inventar códigos | Rules + portal/GR; `sendAccessCode` bloqueado en AUTONOMOUS |
| Regresión core | Solo `digital-receptionist/**` + Owner KB |
| channelAirbnb sin listener | Runtime no envía Airbnb en V1 |
| Early/late auto | Consulta only; sin `adjustAccessWindow` |

## Arquitectura V1 (additive)

Listener (desktop) → Decision → Context (read) + Skills + Rules + Templates → Audit → Ledger (si canSend).
