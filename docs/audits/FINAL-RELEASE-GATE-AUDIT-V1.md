# PRAGMA PMS — Auditoría Final de Liberación (GO / NO GO) V1

**Fecha:** 2026-07-17  
**Tipo:** Gate técnico pre-Release  
**Alcance:** auditoría integral sin desarrollo de funcionalidades nuevas  
**Restricciones:** sin commit de Release, sin tag, sin deploy

## Resumen ejecutivo

Se ejecutó el gate final de liberación sobre el estado actual del working tree
(AI Concierge nativo + extensión, Guest Registration universal Airbnb, hardening
de seguridad, migraciones Prisma pendientes de deploy).

| Control | Resultado |
|---|---|
| Typecheck | PASS |
| Build Next.js 16.2.6 | PASS (`/guest-registration`, `/ai-concierge`, APIs concierge presentes) |
| Suite de tests | PASS **559/559** (166 suites, 0 fallos) |
| Release Readiness (`verify:release`) | PASS **37/37** |
| Guest Registration integración real | PASS **4/4** |
| Smoke HTTP auth / rutas | PASS (público 200; canal 401; dashboard 307) |
| Security Review (release) | **0 Critical · 0 High** |
| Regresiones en módulos congelados | No detectadas en suites ni smoke |

### Veredicto

# GO

Condicionado a **aceptación explícita del Owner** de los riesgos **Medium**
documentados en la sección 8, y a las **guardrails operacionales** de la
sección 10 antes/durante el despliegue.

No se realizó commit, tag ni deploy.

---

## 1. Alcance auditado

| Dominio | Evidencia principal |
|---|---|
| Guest Registration | Suite guests 33/33; integración Airbnb universal 4/4; hardening V1 |
| AI Concierge | Suite `tests/ai-concierge/*`; LAT go-live previo; auth HMAC link-bound |
| WhatsApp Web / Airbnb Web | Extensión + smoke auth canal; LAT Autonomous previo documentado |
| Reservas / Direct | Suites reservations + RBAC mutation policy |
| Airbnb Email | Suite airbnb-email **175/175** |
| TTLock / correos | Suites access + billing send-email; evidencia histórica GR→TTLock |
| Integraciones | Suites epayco, pricelabs, wompi (vía release readiness) |
| Seguridad / multi-tenant | Security Review + smoke auth + proxy allowlist |
| Performance / Build / Typecheck | Build ~2.8 min; Typecheck PASS; tests ~49 s |

---

## 2. Hallazgos

### Critical

Ninguno.

### High

Ninguno.

### Medium (no bloquean GO; requieren aceptación Owner)

| ID | Hallazgo | Probabilidad | Impacto | Mitigación actual | Justificación para no bloquear |
|---|---|---|---|---|---|
| M1 | `get_calendar` sin `propertyId` no aplica `allowedPropertyIds` | Media (operador con bearer + allowlist parcial) | Media (fuga intra-tenant de calendario) | Scope de organización intacto; allowlist sí aplica en otras tools | Intra-tenant; remediar post-release o restringir tools hasta fix |
| M2 | Write tools no revalidan `allowedPropertyIds` (defense-in-depth) | Baja/Media | Media (mutación fuera del subset Concierge) | Rutas `turn`/`book` filtran `propertyId` en body; tenant scope | No hay bypass cross-tenant; reforzar handlers en follow-up |
| M3 | Autonomous `mayAutoSend` ampliado (puede autoenviar secretos) | Media si Autonomous ON | Media/Alta operacional | Modo configurable; Manual/Assisted disponibles | **Operar en Manual/Assisted** hasta política de secretos endurecida |
| M4 | Rate limit GR universal process-local | Media a escala | Media (más intentos multi-instancia) | Dual IP+código, errores genéricos, 600 ms, fail-closed | WAF/edge obligatorio a escala; aceptado en hardening V1 |
| M5 | Host ngrok de desarrollo en `manifest.json` / allowlist extensión | Baja en sideload controlado; Media si CWS | Media (pairing externo vía tunnel) | Origen allowlist + pairing de alta entropía | **Quitar ngrok del build de producción** antes de store/CWS |

### Low

| ID | Hallazgo | Notas |
|---|---|---|
| L1 | Bearer JWT malformado (3 segmentos) → 500 global vía Clerk middleware | Preexistente; afecta `/`, `/panel` y APIs; falla cerrado; token Concierge real (2 segmentos) → 401 correcto |
| L2 | Sesión extensión en `chrome.storage.local` | Preferir `session` para el bearer |
| L3 | Flag `aiEnabled` aún no enforzado en turn path | Inerte hoy (`usedLlm: false`) |

### Informational

| ID | Nota |
|---|---|
| I1 | `link/complete` público por diseño (token one-time + device hash + TTL) |
| I2 | `/guest-registration` público por diseño (código → token interno) |
| I3 | Migraciones Concierge nativas presentes en working tree; deben aplicarse en el entorno destino con `db:migrate:deploy` |

---

## 3. Causa raíz (incidencias evaluadas en este gate)

### 3.1 HTTP 500 con `Authorization: Bearer aaa.bbb.ccc`

- **Reproducción:** mismo 500 en `/`, `/panel` y `/api/concierge/health`.
- **Causa raíz:** `clerkMiddleware` intenta `decodeJwt` del header Bearer antes de la lógica de ruta; JWT inválido lanza `SyntaxError: Unexpected end of data`.
- **Impacto:** denegación (fail-closed), no bypass. En producción Next no sirve stack HTML de desarrollo.
- **Alternativas:** (A) wrapper try/catch alrededor de Clerk — impacto alto/arquitectura; (B) documentar como Low/Informational preexistente; (C) filtrar Bearer no-JWT en proxy — riesgo de romper APIs self-authed.
- **Selección:** (B). No modifica arquitectura Clerk. Bearer Concierge de 2 segmentos responde **401**.

### 3.2 Mediums M1–M5

No se implementaron correcciones de código en este gate: no son Critical/High y el
protocolo prohíbe cambios sin causa raíz que **impida** la liberación. Quedan
aceptados explícitamente por el Owner o remedados en follow-up inmediato
post-autorización (ver sección 10).

---

## 4. Soluciones implementadas en este gate

Ninguna. Esta ejecución fue exclusivamente de auditoría y verificación.

Hardening y correcciones previas ya presentes en el working tree (fuera de este
gate, ya auditadas):

- Guest Registration universal code-only + security hardening (rate limit dual,
  short-circuit IP→código, 600 ms, errores genéricos).
- AI Concierge: sesión HMAC link-bound, auth sin org spoofable, idempotencia de
  envío WhatsApp, LAT go-live Autonomous documentado.

---

## 5. Alternativas evaluadas (gate)

| Opción | Descripción | Decisión |
|---|---|---|
| A | NO GO hasta cerrar todos los Medium | Descartada: criterio de gate solo bloquea Critical/High |
| B | Fix inmediato de M1–M5 en este gate | Descartada: fuera de “solo si impide liberación”; riesgo de scope creep |
| C | GO con Medium documentados + guardrails Owner | **Seleccionada** |

---

## 6. Justificación de la solución elegida

El criterio GO del documento de ejecución exige ausencia de Critical/High,
tests/typecheck/build/release readiness en PASS, sin regresiones, pruebas
reales satisfactorias, y Medium aceptados por el Owner.

Ese conjunto se cumple técnicamente. Los Medium restantes son riesgos de
política operacional / defensa en profundidad / topología de rate limit, no
bypass de autenticación ni de aislamiento multi-tenant entre organizaciones.

---

## 7. Evidencia

### Calidad

```
npm run typecheck          → PASS
npm run build              → PASS (Next.js 16.2.6)
npm run verify:release     → PASS (RBAC + typecheck + billing/rbac/payments/sales 37/37)
npx tsx --require ./scripts/preload-stub-server-only.cjs --test "tests/**/*.test.ts"
                           → PASS 559/559 · 166 suites · 0 fail · ~48.6 s
```

### Guest Registration (datos reales)

Script: `scripts/_audit-airbnb-universal-access-integration.ts`  
Evidencia: `docs/audits/evidence/airbnb-universal-guest-registration-integration.json`

| Caso | Resultado |
|---|---|
| Airbnb válida | PASS → active + token del flujo existente |
| Código inexistente | PASS → invalid |
| Cancelada | PASS → invalid |
| Ya completada | PASS → completed |

Informes previos:

- `docs/audits/AIRBNB-UNIVERSAL-GUEST-REGISTRATION-FINAL-REPORT-V1.md`
- `docs/audits/AIRBNB-UNIVERSAL-GUEST-REGISTRATION-SECURITY-HARDENING-V1.md` (**GO**)

### Smoke HTTP (localhost:3000)

| Ruta / condición | HTTP |
|---|---|
| `GET /guest-registration` | 200 |
| `GET /api/concierge/health` (sin auth) | 401 |
| `POST /api/concierge/heartbeat` (sin auth) | 401 |
| `GET /api/concierge/health` Bearer 2-seg inválido | 401 |
| `GET /api/concierge/control` (sin Clerk) | 307 |
| `GET /panel` (sin Clerk) | 307 |

### AI Concierge

Evidencia LAT Autonomous / anti-duplicados (sesión previa):

- `docs/audits/AI-CONCIERGE-FINAL-GO-LIVE-VALIDATION-V1.md`
- `docs/audits/AI-CONCIERGE-DUPLICATE-MESSAGE-P0-V1.md`
- `docs/audits/AI-CONCIERGE-AUTONOMOUS-TRACE-FINAL-V1.md`

Auth canal: HMAC SHA-256, TTL 15 min, `timingSafeEqual`, binding
`linkId` + `organizationId` + `userId` + `deviceHash` + fila ACTIVE.

### Security Review

Ejecutado sobre uncommitted changes (Concierge + Guest Registration + proxy +
permissions). Conclusión: **0 Critical, 0 High**. Mediums M1–M5 arriba.

---

## 8. Riesgos residuales (aceptación Owner requerida)

1. **Code-only Airbnb GR** — quien posee el código entra al flujo.  
   Probabilidad: material vía filtración del mensaje Airbnb. Impacto: medium.
2. **Oracle de redirect** en GR universal — éxito redirige; fallo no.  
   Probabilidad: media en automatización. Impacto: medium (enumeración de validez).
3. **Rate limit GR no distribuido** (M4) — requiere WAF/edge a escala.
4. **Allowlist de propiedades Concierge incompleta** (M1–M2).
5. **Autonomous auto-send amplio** (M3) — no habilitar Autonomous en prod hasta
   política de secretos o dejarlo off por defecto.
6. **ngrok en manifest** (M5) — no publicar extensión CWS con ese host.
7. **Clerk 500 con Bearer JWT basura** (L1) — fail-closed preexistente.

---

## 9. Resultados de pruebas (resumen)

| Suite / control | Resultado |
|---|---|
| Typecheck | PASS |
| Build | PASS |
| Tests totales | **559/559** |
| Release readiness | **37/37** |
| Airbnb Email | Incluido en suite total (histórico 175/175 en gate previo) |
| Guest Registration unit + integración | PASS |
| Auth smoke | PASS |
| Security Critical/High | 0 / 0 |

Confirmación expresa:

- no se detectaron regresiones en la suite completa;
- el flujo Guest Registration tokenizado existente permanece la SSOT tras el
  resolver universal;
- el canal Concierge rechaza requests sin Bearer válido;
- el dashboard `/ai-concierge` queda bajo `concierge:read` (ADMIN).

---

## 10. Recomendaciones futuras (post-autorización Owner)

Orden sugerido, sin bloquear este veredicto:

1. Remover hosts ngrok del manifest/allowlist de builds de producción (M5).
2. Aplicar `allowedPropertyIds` en `get_calendar` y write handlers (M1–M2).
3. Endurecer Autonomous: no autoenviar respuestas con WiFi/códigos TTLock sin
   `autoEligible` / revisión (M3).
4. Configurar rate limit WAF/edge en `/guest-registration` (M4).
5. Preferir `chrome.storage.session` para el bearer (L2).
6. En deploy: `npm run db:migrate:deploy` para migraciones Concierge nativas.
7. Post-deploy: smoke público GR, pairing extensión, heartbeat, un turno Manual.

### Guardrails operacionales recomendados en el Release inmediato

- Extensión: sideload controlado; **no** publicar CWS con ngrok.
- Concierge producción: arrancar en **Manual** o **Assisted** (no Autonomous)
  hasta cerrar M3.
- Configurar `allowedTools` + `allowedPropertyIds` explícitos por tenant.
- Confirmar `CONCIERGE_EXTENSION_SECRET` en el entorno de producción.
- Activar throttling edge en `/guest-registration`.

---

## 11. Criterio GO / NO GO — checklist

| Criterio | Estado |
|---|---|
| Sin hallazgos Critical | ✓ |
| Sin hallazgos High | ✓ |
| Todos los tests pasan | ✓ 559/559 |
| Typecheck PASS | ✓ |
| Build PASS | ✓ |
| Release Readiness PASS | ✓ |
| Sin regresiones detectadas | ✓ |
| Pruebas reales E2E satisfactorias (alcance verificable) | ✓ |
| Medium documentados para aceptación Owner | ✓ (sección 8) |

---

## 12. Veredicto final

# GO

**Justificación técnica:** el sistema cumple el criterio GO del documento de
ejecución. No existen hallazgos Critical ni High. Typecheck, Build, Release
Readiness y la suite completa pasan. Guest Registration universal e integración
real pasan. El canal AI Concierge autentica correctamente. Los riesgos Medium
restantes son operacionales/defensa en profundidad y quedan documentados para
aceptación explícita del Owner.

**Siguiente paso autorizado únicamente tras firma Owner:**

`Commit → Tag → Deploy → Validación post-deploy`

**No ejecutado en esta auditoría:** commit de Release, tag ni deploy.
