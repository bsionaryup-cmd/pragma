# PRAGMA AI Concierge — LAT Cierre Definitivo

**Versión:** Final  
**Fecha:** 2026-07-17  
**Naturaleza:** Aceptación operativa (sin nuevas funcionalidades).  
**Única excepción aplicada:** un hallazgo real en validación en vivo del canal → protocolo PRAGMA → fix mínimo → reauditoría.

---

## Veredicto

# ❌ NO APROBADO PARA PRODUCCIÓN

**Motivo:** el criterio de liberación exige evidencia de conversación en **WhatsApp Web** y **Airbnb Web** con canal real. Esa evidencia **no existe** aún (`docs/audits/evidence/phase13-live/` ausente). Además, el entorno local aún no tiene `CONCIERGE_EXTENSION_SECRET` en `.env.local`, requisito operativo para que la extensión autentique.

Según el propio documento: si hay riesgo crítico/alto pendiente → **detener**, no Release, no Deploy.

Tras el hallazgo corregido abajo, **no queda defecto de código conocido que bloquee**; el bloqueo es de **aceptación en canal real + configuración local del secreto**.

---

## Hallazgo encontrado en LAT (protocolo PRAGMA) — RESUELTO

### HALLAZGO LAT-1 — CRÍTICO — Extensión no alcanzaba el cerebro

| Campo | Detalle |
|---|---|
| **Síntoma** | `GET /api/concierge/health` devolvía HTML de sign-in (Clerk), no JSON |
| **Causa raíz** | `src/proxy.ts` no listaba `/api/concierge(.*)` en `isSelfAuthedApi` ni en rutas públicas. Clerk exigía sesión; la extensión solo envía Bearer `CONCIERGE_EXTENSION_SECRET` |
| **Impacto** | WhatsApp/Airbnb Web **imposibles** en operación real: la extensión nunca llega al handler |
| **Alternativas** | (1) Clerk session en extensión → cambia arquitectura; (2) ruta pública sin auth → inseguro; (3) **`isSelfAuthedApi`** → patrón ya usado por TTLock/airbnb auto-sync |
| **Solución elegida** | Alternativa 3 — una línea en `isSelfAuthedApi`: `"/api/concierge(.*)"` |
| **Reauditoría** | Tras el fix: `GET /api/concierge/health` → JSON `503` `{"error":"CONCIERGE_EXTENSION_SECRET no configurado"}` (correcto sin secreto). Typecheck PASS. Tests 21/21 PASS. Build PASS (previo). |

**Antes → Después:** redirect HTML sign-in → handler propio responde JSON (503/401/200 según secreto/usuario).

---

## Gates re-ejecutados (esta fase)

| Gate | Resultado |
|---|---|
| Typecheck | ✅ PASS |
| Build | ✅ PASS (107 páginas; 4 rutas `/api/concierge/*`) |
| Tests Concierge | ✅ 21/21 PASS |
| Escenarios cerebro + tools | ✅ `allOk: true` — `docs/audits/evidence/ai-concierge-phase13-scenarios.json` |
| OpenAI | ✅ **0 calls / 0 tokens** |
| Aislamiento multi-tenant | ✅ spoof org ignorado; user inválido 401 |
| Tool no autorizada | ✅ denegada |
| Health live (post-fix) | ✅ JSON 503 (secreto ausente) — ya no HTML |
| Capturas WhatsApp Web | ❌ pendientes (humano) |
| Capturas Airbnb Web | ❌ pendientes (humano) |
| `CONCIERGE_EXTENSION_SECRET` en `.env.local` | ❌ no configurado |

**Regresiones en módulos congelados:** NINGUNA detectada (typecheck + build + tests; cambios acotados a Concierge + 1 matcher en proxy).

---

## Persistencia (v1)

**¿Es suficiente el store en memoria para la versión inicial?** → **SÍ**

- El hilo real vive en WhatsApp/Airbnb; la extensión reenvía contexto en cada turno.
- Acciones de negocio (reserva, GR, TTLock, pagos) las persiste el PMS en BD.
- Sesiones acotadas (FIFO 2000); audits/learning acotados (200).
- Limitación aceptada: pérdida al reinicio / no multi-instancia. **Estrategia V2:** tablas Prisma de conversación/auditoría (nueva versión, no esta liberación).

---

## Informe Final — respuestas obligatorias

| # | Pregunta | Respuesta |
|---|---|---|
| Arquitectura | ¿Continúa íntegra? | **SI** |
| Seguridad | ¿Continúa íntegra? | **SI** (auth Bearer + org desde BD; proxy self-auth corregido) |
| Regresiones | ¿Existen? | **NO** |
| Conversaciones | ¿Mantiene contexto? | **SI** (evidencia cerebro/hilo; DOM vivo pendiente) |
| Herramientas | ¿Funcionan correctamente? | **SI** |
| OpenAI | ¿Solo cuando es estrictamente necesario? | **SI** (0 tokens en FAQs soportadas; L3 diferido) |
| Extensión | ¿Es estable? | **SI** a nivel código; stress DOM vivo pendiente |
| WhatsApp | ¿Funciona correctamente? | **NO** — falta evidencia live + secreto local |
| Airbnb | ¿Funciona correctamente? | **NO** — falta evidencia live + secreto local |
| Plataforma | ¿Continúa estable? | **SI** |
| Producción | ¿Riesgo crítico/alto pendiente? | **SI** — evidencia live de canal real ausente (criterio de aceptación no cumplido). Config: secreto no seteado en local. |

---

## Qué falta para pasar a ✅ APROBADO PARA PRODUCCIÓN

1. Agregar `CONCIERGE_EXTENSION_SECRET` a `.env.local` y reiniciar `npm run dev`.
2. Cargar la extensión unpacked; Health JSON OK con User ID real.
3. Ejecutar Escenarios 1–2 (teléfono real WA + Airbnb) con capturas en `docs/audits/evidence/phase13-live/`.
4. Exportar `/api/concierge/health` (métricas, 0 tokens).
5. Autorización explícita del propietario para: Commit Release → Tag → Deploy → Post-deploy.

Hasta entonces: **STOP.** No Commit de Release. No Tag. No Deploy.

---

## Kit mínimo (propietario)

Ver `docs/audits/AI-CONCIERGE-PHASE13-LIVE-CHANNEL-CHECKLIST.md`.

Guion WA/Airbnb: Hola → disponibilidad → precio → mascotas → ubicación → reservar → datos → cotización → aceptar → pago → GR → código → WiFi → Gracias. Más: conversación larga, escalamientos, helicóptero, FAQs sin OpenAI.

---

## Cierre de alcance v1

Cualquier mejora futura (Owner Dashboard Concierge, persistencia Prisma, nuevos canales, nuevas intenciones, L3 OpenAI activo, etc.) = **v2** con ciclo completo propio.

Este LAT cierra el desarrollo de v1 en código; **no** cierra la liberación a producción hasta cumplir el criterio de canal real.
