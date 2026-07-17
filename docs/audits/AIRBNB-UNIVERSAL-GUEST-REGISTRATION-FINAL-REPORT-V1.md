# Airbnb Universal Guest Registration — Final Report V1

**Fecha:** 2026-07-17  
**Ruta:** `https://pragmapms.com/guest-registration`  
**Entrada solicitada:** únicamente código de reserva Airbnb  
**Estado:** implementación funcional completa; riesgo code-only documentado  
**Restricciones:** sin commit, migración ni deploy.

## Resumen ejecutivo

Se implementó el enlace universal sin crear un segundo Guest Registration:

`/guest-registration`  
→ código Airbnb  
→ resolución fail-closed de una única reserva Airbnb global  
→ generación/reutilización del token interno de 192 bits  
→ redirect a `/guest-registration/[token]`  
→ Guest Registration existente.

El token interno continúa siendo el único mecanismo que permite entrar al formulario, registrar huéspedes, completar el proceso y activar los pipelines existentes de TTLock y correos.

Las pruebas funcionales, integración con datos reales, Typecheck, Build y suites de regresión finalizaron en PASS.

## 1. Auditoría

### Implementación anterior

PRAGMA identificaba una reserva pública exclusivamente mediante
`GuestRegistrationToken.token`, generado con `randomBytes(24)` (192 bits) y
vinculado a `reservationId`.

No existía una página sin parámetros en `/guest-registration`. Solo existía:

- `/guest-registration/[token]`;
- generación/reutilización del token en
  `src/services/guests/guest-registration.service.ts`;
- formulario, finalización, TTLock y correos existentes.

### Fuente del código Airbnb

La ingesta Airbnb persiste el código canónico en
`Reservation.reservationCode`. La extracción email lo normaliza a mayúsculas;
iCal aporta fechas/nombre, pero no el código.

Evidencia real:

- 45 reservas Airbnb con código;
- códigos de 10 caracteres;
- 0 duplicados globales actuales;
- 2 organizaciones;
- `reservationCode` no posee constraint `UNIQUE`.

### Confirmaciones de impacto

- Direct: excluido mediante `platform: AIRBNB`.
- Guest Registration: no se modificó el servicio/formulario existente.
- TTLock: no se modificaron hooks, credenciales ni delivery.
- Correos: no se modificaron servicios ni plantillas.
- PMS/Reservas/Inbox/AI Concierge: sin cambios de implementación.
- Multi-tenant: el caller no entrega `organizationId`; PRAGMA resuelve globalmente
  y rechaza 0 o 2+ coincidencias.

## 2. Causa raíz

El bloqueo era exclusivamente de acceso:

1. Airbnb necesita enviar un enlace fijo sin token.
2. PRAGMA solo aceptaba enlaces individuales con token.
3. No existía un resolver público de código Airbnb que terminara en el token
   interno existente.

No faltaba un segundo formulario ni lógica TTLock/correo. Duplicarlos habría
creado dos fuentes de verdad.

## 3. Alternativas

### A. Crear un Guest Registration paralelo por código

Descartada: duplica formulario, reglas, TTLock y correos; riesgo alto.

### B. Convertir el código Airbnb en token de Guest Registration

Descartada: reduce la entropía del bearer token y rompe el modelo vigente.

### C. Resolver código y redirigir al token interno

Seleccionada:

- impacto mínimo;
- no modifica downstream;
- fail-closed ante duplicados;
- mantiene token aleatorio como única autorización del formulario;
- compatible con reservas Airbnb existentes.

## 4. Implementación

### Archivos runtime

- `src/app/guest-registration/page.tsx`
- `src/app/guest-registration/actions.ts`
- `src/features/guests/components/airbnb-universal-access-form.tsx`
- `src/services/guests/airbnb-universal-guest-registration.service.ts`
- `src/proxy.ts` — únicamente allowlist exacta del enlace universal.

### Validación/evidencia

- `tests/guests/airbnb-universal-guest-registration.test.ts`
- `scripts/_audit-airbnb-universal-access-readonly.ts`
- `scripts/_audit-airbnb-universal-access-integration.ts`

### Controles

- normalización `trim().toUpperCase()`;
- formato y longitud acotados;
- búsqueda exclusiva `AIRBNB`;
- máximo 2 resultados y `matches.length === 1`;
- reserva cancelada/ineligible: denegada;
- error genérico para formato, inexistencia, ambigüedad, cancelación y rate limit;
- rate limit 5 intentos / 10 minutos;
- IP almacenada como SHA-256;
- headers proxy confiables; no se usa `x-forwarded-for` arbitrario;
- token interno no se expone hasta resolver una única reserva válida;
- token activo existente se reutiliza; si falta, se crea mediante el servicio
  vigente;
- completadas redirigen al estado read-only vigente.

## 5. Pruebas reales

Evidencia:
`docs/audits/evidence/airbnb-universal-guest-registration-integration.json`.

| Caso | Resultado |
|---|---|
| Reserva Airbnb válida | PASS; token ACTIVE vinculado a la reserva correcta |
| Código inexistente | PASS; error genérico, sin acceso |
| Reserva cancelada | PASS; `invalid`, sin token |
| Registro ya completado | PASS; token COMPLETED, vista final existente |

El script preserva el estado: elimina únicamente tokens creados por la propia
auditoría y restaura el pointer anterior.

### Flujo completo

La prueba válida confirmó:

- resolver código;
- obtener token interno;
- token apunta exactamente a la reserva;
- continuar por `/guest-registration/[token]`.

El downstream continúa en las mismas funciones:

- persistencia de huéspedes;
- finalización transaccional;
- `onGuestRegistrationCompletedForTTLock`;
- delivery de credencial;
- notificación administrativa.

Evidencia operacional histórica:

- 13 Airbnb con Guest Registration completado;
- 11 con credencial de acceso;
- existen credenciales entregadas y notificaciones administrativas reales.

## 6. Evidencia visual

`docs/audits/evidence/airbnb-universal-guest-registration-code-only-mobile.png`

La página pública respondió HTTP 200 y muestra únicamente el campo
“Código de reserva de Airbnb”.

## 7. Seguridad

Security Review:

- ningún hallazgo critical/high;
- no bypass cross-tenant;
- no “first match wins”;
- no exposición de PII en errores;
- no SQL injection/open redirect;
- token interno mantiene 192 bits.

Riesgos medios inherentes al requisito code-only:

1. un código válido produce redirect y uno inválido no, por lo que existe un
   oracle de validez;
2. quien obtenga el código obtiene acceso a la reserva por diseño;
3. el rate limit es process-local, no distribuido entre instancias serverless.

Estos riesgos no son bypasses de implementación: son consecuencia de usar el
código como único factor. Para endurecimiento a escala se requiere rate limit
compartido/WAF/CAPTCHA o reintroducir un segundo factor.

## 8. Reauditoría

| Control | Resultado |
|---|---|
| Typecheck | PASS |
| Build Next.js 16.2.6 | PASS |
| Ruta `/guest-registration` en build | PASS |
| Tests nuevos | PASS 3/3 |
| Guest Registration regression | PASS 35/35 |
| Airbnb Email | PASS 175/175 |
| Release readiness | PASS 37/37 |
| Integración real | PASS 4/4 |
| AI Concierge | Syntax PASS; sin archivos modificados; LAT go-live previo permanece PASS |
| Security Review | Sin critical/high; 3 riesgos medium documentados |
| Linter | Sin errores |

## 9. Antes / después

### Antes

Airbnb debía recibir un enlace individual:

`/guest-registration/[token]`

### Después

Airbnb puede enviar siempre:

`/guest-registration`

El huésped introduce el código y PRAGMA lo intercambia por el token interno.
Desde ese punto el comportamiento es exactamente el mismo.

## 10. Criterios de aceptación

- enlace universal: PASS;
- código identifica la reserva única actual: PASS;
- inexistente/cancelada: denegado;
- token interno sigue siendo el único acceso al formulario: PASS;
- Direct no afectado: PASS;
- TTLock/correos no afectados: PASS;
- AI Concierge no afectado: PASS;
- sin regresiones detectadas: PASS;
- solución de menor impacto: confirmada.

## Veredicto

**FUNCIONALMENTE LISTO PARA PRODUCCIÓN.**

La autorización de producción requiere aceptación explícita del owner sobre el
riesgo medium del acceso code-only y configurar rate limiting distribuido/WAF
antes de una exposición a escala. Sin esa aceptación no debe declararse
“seguro para producción” de forma incondicional.

No se realizó commit, migración ni deploy.
