# AI Concierge — Fase 13 Parte 2: Auditoría de la Extensión

**Fecha:** 2026-07-17

## Hallazgos previos (F7–12)

| Tema | Antes | Riesgo |
|------|-------|--------|
| Polling 4–5s fijo | Alto CPU relativo | Medio |
| Sin MutationObserver | Latencia / miss | Medio |
| Sin multi-tab guard | Doble turno | Alto |
| Sin health | Operador ciega | Medio |
| Sin retry red | Fallos intermitentes | Medio |
| WebSocket ausente | Doc vs realidad | Bajo (HTTP OK) |

## Soluciones de menor impacto implementadas (F13)

1. **MutationObserver + debounce 350ms** + polling backup 8s.
2. **Leader election** por canal en `chrome.storage.local` (una pestaña procesa).
3. **Retry ×3** con backoff en `background.js`.
4. **Health** `GET /api/concierge/health` + botón en popup/panel.
5. **visibilitychange / online** → re-scan.
6. Documentar HTTPS REST en lugar de WS.

## Verificación manual recomendada

| Caso | Cómo |
|------|------|
| Memoria/CPU | Chrome Task Manager con WA abierto 30 min |
| MutationObserver | Escribir mensaje → panel &lt;1s |
| Pérdida internet | Offline → panel OFFLINE → Online → recovery |
| Cierre pestaña | Reabrir chat → leader se renueva |
| Multi-pestaña | Dos WA: solo una debe llamar turn |
| Multi-conversación | Cambiar chat → nuevo fingerprint |
| Multi-propiedad | Pasar `propertyId` en turn cuando se conozca |

## Estabilidad del canal

Fail-closed: si DOM no parsea o API cae, **no inventa** respuesta; solo deja de sugerir / marca OFFLINE.
