# Airbnb Universal Guest Registration — Auditoría V1

> **SUPERSEDIDO:** la especificación final cambió a acceso mediante únicamente
> el código Airbnb. Ver
> `docs/audits/AIRBNB-UNIVERSAL-GUEST-REGISTRATION-FINAL-REPORT-V1.md`.

**Fecha:** 2026-07-17  
**Estado:** Implementado y validado localmente  
**Ruta universal:** `https://pragmapms.com/guest-registration`  
**Restricciones cumplidas:** sin commit, sin migraciones, sin deploy.

## Conclusión

Se implementó un mecanismo de identificación previo que solicita:

1. código de reserva Airbnb;
2. fecha exacta de llegada;
3. apellido del titular.

Si los tres factores identifican exactamente una reserva Airbnb, PRAGMA genera o reutiliza el token opaco del Guest Registration existente y redirige a `/guest-registration/[token]`. No existe un segundo registro ni lógica duplicada de huéspedes, TTLock o correos.

La validación técnica y los seis casos operativos disponibles finalizaron en **PASS**.

## 1. Auditoría previa

### 1.1 ¿Cómo identifica actualmente PRAGMA una reserva?

El flujo vigente usa un bearer token aleatorio de 24 bytes (`randomBytes(24)`, 192 bits), almacenado en `GuestRegistrationToken.token` y vinculado a `reservationId`.

- Emisión/reutilización: `src/services/guests/guest-registration.service.ts`
- Página existente: `src/app/guest-registration/[token]/page.tsx`
- Token único: `prisma/schema.prisma`, modelo `GuestRegistrationToken`

El formulario, registro incremental, finalización, TTLock y notificaciones dependen de ese token. La implementación universal no altera esas funciones.

### 1.2 ¿Qué proporciona Airbnb?

El repositorio recibe y conserva el código de confirmación Airbnb como `Reservation.reservationCode`; la ingesta email lo extrae, normaliza a mayúsculas y lo vincula a la reserva. iCal aporta fechas y nombre, pero no aporta el código.

El mensaje automático propuesto aporta únicamente el enlace universal. No incluye parámetros, token ni datos de reserva.

### 1.3 ¿El código es suficiente por sí solo?

No.

Evidencia real de datos:

- 45 reservas Airbnb con código;
- códigos de 10 caracteres;
- 0 duplicados actuales;
- **sin restricción UNIQUE** ni índice en `Reservation.reservationCode`;
- datos pertenecientes a 2 organizaciones.

Aunque el código tiene entropía razonable, conocerlo concedería acceso directo si se usara como único factor. Además, no existe garantía estructural de unicidad futura/global.

### 1.4 Riesgo de acceso ajeno

Sí existe con código único: filtración del mensaje, captura de pantalla, reenvío o intento dirigido. El enlace es público y no contiene contexto tenant, por lo que la resolución debe ser global y fail-closed.

Controles implementados:

- plataforma obligatoria `AIRBNB`;
- código + fecha + apellido;
- exactamente una coincidencia global;
- error genérico para formato, inexistencia, factor incorrecto, cancelación y ambigüedad;
- ninguna información de reserva antes de autenticar;
- rate limit 5 intentos / 10 minutos;
- IP almacenada solo como SHA-256;
- headers de origen confiables (`cf-connecting-ip`, `x-vercel-forwarded-for`, `x-real-ip`);
- redirección final a token aleatorio existente.

### 1.5 Segundo factor

Sí. Se seleccionaron fecha de llegada y apellido del titular.

Evidencia:

- fecha de llegada: 45/45;
- apellido: 45/45;
- apellido en reservas elegibles: 11/11;
- email: solo 13/45.

El email se descartó por baja cobertura. Fecha + apellido son datos conocidos por el titular y disponibles en todas las reservas elegibles auditadas.

### 1.6 Solución de menor impacto

Una página pública de identificación que redirige al token existente. No se creó API paralela, segundo Guest Registration, modelo nuevo ni migración.

### 1.7 Reutilización del flujo existente

Completa:

`/guest-registration` → validación → token existente → `/guest-registration/[token]` → formulario existente → finalización existente → TTLock/notificaciones existentes.

### 1.8 Módulos afectados

- nueva página y Server Action de acceso;
- nuevo formulario de acceso;
- nuevo servicio de resolución Airbnb;
- una entrada pública exacta en `src/proxy.ts`;
- tests y scripts de auditoría.

Guest Registration interno, reservas, PMS, TTLock, Inbox, QR, INTIENDAS, facturación y multi-tenant no fueron modificados.

### 1.9 Riesgo de regresiones

Bajo. La nueva ruta termina antes del flujo actual y solo entrega un token ya soportado. Build y suites existentes finalizaron en PASS.

### 1.10 Alternativa más segura con el mismo impacto

Código + fecha + apellido es más segura que código + fecha y mantiene el mismo patrón arquitectónico. Un rate limit distribuido (Redis/KV/WAF) sería mejor a escala, pero no existe store compartido en el repositorio y agregarlo cambiaría arquitectura/operación, fuera del alcance autorizado.

## 2. Alternativas evaluadas

### A. Código Airbnb solamente

- Ventaja: mínima fricción.
- Desventaja: cualquier poseedor del código obtiene acceso.
- Seguridad: insuficiente.
- Impacto: mínimo.
- Decisión: descartada.

### B. Código + fecha de llegada

- Ventaja: cobertura 100%, simple.
- Desventaja: la fecha puede ser conocida o inferida.
- Seguridad: media.
- Impacto: bajo.
- Decisión: descartada frente a una opción más segura del mismo patrón.

### C. Código + fecha + apellido, luego token existente

- Ventaja: tres señales disponibles, sin datos en URL, fail-closed global.
- Desventaja: un campo adicional.
- Seguridad: alta para este alcance.
- Impacto: bajo.
- Mantenibilidad: alta; una sola integración con el flujo actual.
- Compatibilidad: total.
- Decisión: **seleccionada**.

### D. Enlace individual/token enviado por Airbnb

- Ventaja: máxima entropía, flujo actual directo.
- Desventaja: contradice el requisito de enlace universal sin parámetros y exige personalización por reserva en Airbnb.
- Seguridad: alta.
- Impacto operativo: mayor.
- Decisión: descartada.

## 3. Implementación

Archivos runtime:

- `src/app/guest-registration/page.tsx`
- `src/app/guest-registration/actions.ts`
- `src/features/guests/components/airbnb-universal-access-form.tsx`
- `src/services/guests/airbnb-universal-guest-registration.service.ts`
- `src/proxy.ts` (solo allowlist de `/guest-registration`)

Validación y evidencia:

- `tests/guests/airbnb-universal-guest-registration.test.ts`
- `scripts/_audit-airbnb-universal-access-readonly.ts`
- `scripts/_audit-airbnb-universal-access-integration.ts`

No se modificó `guest-registration.service.ts`, el formulario existente ni los hooks TTLock/correo.

## 4. Seguridad

Security Review:

- sin hallazgos críticos o altos;
- sin bypass cross-tenant;
- ambigüedad global fail-closed;
- token final mantiene 192 bits;
- errores no permiten enumerar reservas;
- reservas canceladas/ineligibles no generan token.

Hallazgo medio inicial: rate limit en memoria por instancia. Mitigaciones aplicadas:

- tercer factor (apellido);
- no confiar en `x-forwarded-for` arbitrario;
- error de rate limit idéntico al error de credenciales;
- limpieza de buckets vencidos;
- inputs acotados.

Riesgo residual: el contador no es distribuido entre instancias. Se acepta como defensa en profundidad porque el acceso requiere código de 10 caracteres + fecha + apellido y no existe infraestructura compartida autorizada. Para escala mayor se recomienda WAF/KV compartido.

## 5. Pruebas reales

Evidencia: `docs/audits/evidence/airbnb-universal-guest-registration-integration.json`.

| Caso | Resultado |
|---|---|
| Reserva Airbnb válida + tres factores correctos | PASS; token ACTIVE resuelve la reserva correcta |
| Código inexistente | PASS; `invalid`, sin acceso |
| Código real + fecha de otra reserva | PASS; `invalid`, sin acceso |
| Código/fecha reales + apellido incorrecto | PASS; `invalid`, sin acceso |
| Reserva cancelada | PASS; `invalid`, sin acceso |
| Reserva ya registrada | PASS; redirige al token COMPLETED |

La prueba válida verificó que el token resultante pertenece exactamente a la reserva autenticada. El script elimina únicamente tokens creados por la auditoría y restaura el estado anterior.

### Flujo completo existente

El downstream no se reimplementó:

- finalización actual actualiza reserva/token;
- invoca `onGuestRegistrationCompletedForTTLock`;
- programa la notificación administrativa;
- TTLock mantiene su generación y delivery existentes.

Evidencia real histórica: 13 Airbnb completadas; 11 poseen credencial de acceso; existen entregas de credencial y notificaciones administrativas verificadas en producción. La regresión de Guest Registration/communications pasó 36/36.

## 6. Evidencia visual

Captura móvil:

`docs/audits/evidence/airbnb-universal-guest-registration-mobile.png`

La ruta pública respondió HTTP 200 sin sesión Clerk y mostró los tres campos requeridos.

## 7. Reauditoría

| Validación | Resultado |
|---|---|
| Typecheck | PASS |
| Build Next.js 16.2.6 | PASS; `/guest-registration` incluida |
| Guest Registration tests | PASS 36/36 |
| Airbnb Email tests | PASS 175/175 |
| Release readiness | PASS 37/37 |
| Tests nuevos | PASS 4/4 |
| Integración con datos reales | PASS 6/6 |
| AI Concierge | Sin archivos modificados; syntax extension PASS; evidencia go-live previa permanece PASS |
| Security Review | Sin critical/high; riesgo residual documentado |

El LAT completo de AI Concierge fue intentado nuevamente, pero la corrida headed quedó bloqueada por el navegador local y fue terminada; no produjo fallo funcional. La extensión pasó syntax check y este cambio no toca ningún archivo AI Concierge.

## 8. Antes / después

**Antes:** solo un enlace individual `/guest-registration/[token]`.

**Después:** el enlace universal autentica código + llegada + apellido y redirige al mismo enlace individual. A partir del token, el comportamiento es idéntico.

## 9. Criterios

- enlace universal: PASS;
- identificación correcta: PASS;
- acceso con factores incorrectos: denegado;
- canceladas: denegadas;
- completadas: comportamiento read-only existente;
- flujo único reutilizado: confirmado;
- sin migración, commit ni deploy: confirmado;
- sin regresiones detectadas: confirmado.

## Resultado

**APTO PARA VALIDACIÓN OPERATIVA FINAL EN PRODUCCIÓN, sujeto a deploy autorizado y prueba desde un mensaje Airbnb real.**

No se realizó commit, migración ni deploy.
