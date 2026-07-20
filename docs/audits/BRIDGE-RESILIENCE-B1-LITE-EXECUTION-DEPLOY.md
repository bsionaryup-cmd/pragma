# Bridge Resiliencia B1-lite — Ejecución y deploy

**Fecha:** 2026-07-20  
**Versión extensión:** `1.0.19`  
**Autorización Owner:** explícita — «EJECUTA E IMPLEMENTA TODO Y HACES DEPLOY»

## Arquitectura elegida (Fase 2)

**B1-lite** — estabilidad sin subir riesgo:

- Heartbeat reforzado (ping tab + `tabAliveAt`)
- Detección sesión cerrada / red
- Cola outbound + `turnInFlight`
- Soft recover + wake tick
- Recarga segura con gates (sin reopen automático)
- UI Canal honesta + checklist host

**Fuera de este release:** reopen auto, Cloud API, Baileys, cambios al Engine/Concierge.

## Cambios

| Área | Archivos |
|------|----------|
| Server HB | `heartbeat-channel-status.ts`, `operational-state.ts` |
| Extensión | `background.js`, `content-whatsapp.js`, `manifest.json` 1.0.19 |
| UI | `assistant-studio-channel-panel.tsx` |
| Tests | `heartbeat-channel-status.test.ts` |

## Verificación automatizada

- `npx tsx --test tests/ai-concierge/heartbeat-channel-status.test.ts`
- `npx tsx --test tests/ai-concierge/receptionist-fsm.test.ts` (regresión)

## Post-deploy (Owner / kiosk)

1. Chrome → Extensiones → Recargar **PRAGMA AI Concierge** (1.0.19).  
2. Refresh `web.whatsapp.com`.  
3. Recepcionista Digital → Canal: Extensión HB + WhatsApp “Pestaña viva”.  
4. Cerrar pestaña WA → debe dejar de mostrar Online mentiroso.  
5. Smoke: Hola → reply.

## Riesgos residuales aceptados

Ver § riesgos del plan: PC sleep, Chrome off, QR, DOM WA, ToS Web, sin reopen v1.

## Deploy

Vercel production (`vercel deploy --prod`) del commit de este release.
