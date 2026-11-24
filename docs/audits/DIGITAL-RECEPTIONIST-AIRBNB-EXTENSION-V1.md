# Extensión puente Airbnb — nota de no-regresión

**Fecha:** 2026-07-30  
**Deploy:** pendiente de aprobación explícita

## Cambio PMS (mínimo)

- Se eliminó el hard-block `airbnb_send_not_implemented_v1` en runtime/rules.
- El envío sigue gobernado por: status, killSwitch, SUPERVISED, skills, ledger.
- WhatsApp desktop, GR, TTLock, iCal, Inbox: **sin cambios**.

## Extensión (additive)

Carpeta `extensions/recepcionista-airbnb/` — MV3, unpacked.

Default: **autoSend=false** → solo borrador en panel flotante.

## Prueba manual

1. SUPERVISED + canal Airbnb + extensión configurada → draft visible, no envía.
2. Kill ON → canSend false → no envía aunque autoSend.
3. WhatsApp bat sigue independiente.
