# Recepcionista — autoridad exclusiva del Workflow

**Fecha:** 2026-07-20  
**Objetivo:** Una sola fuente de verdad para textos enviados a WhatsApp.

## Cambios

1. **`runtime.ts`**: desactivado classify NL; sin `handled:false`; reprompt solo con copy de playbook/nodos; sin textos inventados en availability.
2. **`compose-reply.ts`**: early return de recepción; **bloqueo** del fallback Concierge (LLM / hospitality / ack banks).
3. **UI Studio**: pestañas reducidas a Panel · Bienvenida · Menú · Workflows (ocultas Mensajes/Variables/Acciones).

## Regla

Mensaje → FSM → mensaje del paso configurado → un send → esperar.  
Sin dígito/botón válido → reenvía menú o nodo actual, no inventa.

## Tests

`npx tsx --test tests/ai-concierge/receptionist-fsm.test.ts`
