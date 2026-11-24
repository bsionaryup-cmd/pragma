# Airbnb Universal Guest Registration — Security Hardening V1

**Fecha:** 2026-07-17  
**Alcance:** acceso público `/guest-registration` mediante código Airbnb  
**Flujo funcional:** sin cambios  
**Restricciones cumplidas:** sin commit, migración ni deploy

## Resumen ejecutivo

Se auditó exclusivamente el riesgo del acceso code-only y se endureció la
frontera pública sin añadir pasos al huésped ni modificar el Guest Registration
existente.

Mitigaciones finales:

- límite simultáneo por IP y por código: 5 intentos / 10 minutos;
- claves de rate limit SHA-256, sin IP ni código en texto plano;
- cortocircuito: un IP bloqueado no crea, consume ni expulsa buckets por código;
- mapa limitado a 10.000 buckets para evitar crecimiento de memoria sin cota;
- respuesta mínima uniforme de 600 ms;
- mismo mensaje genérico para formato inválido, inexistencia, ambigüedad,
  cancelación y rate limit;
- prioridad de headers de plataforma: Cloudflare, Vercel y `x-real-ip`;
- telemetría de rate limit con identificadores hash truncados, sin PII;
- resolución global fail-closed: solo una coincidencia Airbnb puede continuar.

La revisión final independiente no encontró hallazgos critical/high. Los
riesgos residuales son medium y corresponden al requisito aprobado de usar el
código como único factor y al alcance process-local del rate limit.

## 1. Evidencia técnica

Auditoría read-only del 2026-07-17:

- 45 reservas Airbnb con código;
- 11 reservas actualmente elegibles;
- longitud observada: 10 caracteres en 45/45;
- 43 códigos alfanuméricos y 2 con guion;
- 0 grupos duplicados globales;
- 0 grupos duplicados por tenant;
- 2 organizaciones;
- 13 registros completados;
- 11 registros completados con credencial de acceso.

Esta evidencia confirma alta cardinalidad observada y ausencia actual de
duplicados, pero no demuestra matemáticamente que Airbnb genere códigos
uniformemente aleatorios. Por ello no se usa la longitud como sustituto del
rate limit.

Evidencia persistida:

- `docs/audits/evidence/airbnb-universal-access-data-audit.json`
- `docs/audits/evidence/airbnb-universal-guest-registration-integration.json`

## 2. Riesgo 1 — factor único

### Probabilidad

- Adivinación aleatoria: baja con los códigos observados, el límite por IP y el
  límite por código.
- Obtención por filtración, captura, reenvío o acceso al mensaje Airbnb:
  posible y de probabilidad material.
- Ataque dirigido con un código ya conocido: alta probabilidad de éxito,
  porque el código es deliberadamente el factor de identificación.

Como referencia, bajo el supuesto no demostrado de ocho posiciones base-36
después de un prefijo, el espacio sería 36^8, aproximadamente 2,82 billones de
combinaciones. Con 11 reservas elegibles, un intento uniforme tendría una
probabilidad aproximada de 3,9 × 10^-12 de acertar una activa. Este cálculo no
se considera garantía criptográfica.

### Impacto

Impacto medium/high para la reserva afectada:

- un código válido permite obtener el redirect al token interno;
- en una reserva activa permite continuar el formulario vigente;
- una reserva completada conserva el comportamiento read-only vigente;
- no existe acceso masivo por tenant ni “first match wins”;
- ambigüedad global, cancelación o estado no elegible fallan de forma cerrada.

El token de 192 bits continúa siendo la credencial del formulario. El código no
lo reemplaza ni se almacena como token.

### Posibilidad real de explotación

La explotación con un código filtrado es inmediata y real. La explotación por
fuerza bruta ciega es baja en el conjunto observado, pero no imposible en un
ataque distribuido. El redirect exitoso sigue constituyendo un oracle de
validez por diseño.

### Alternativas evaluadas

1. Segundo factor: apellido, fecha o email.
   - Seguridad: alta.
   - Impacto/compatibilidad: alto; cambia UX y contradice code-only.
   - Complejidad/mantenibilidad: media; datos incompletos y normalización.
   - Decisión: descartada por restricción funcional.

2. Mantener exclusivamente enlaces individuales con token.
   - Seguridad: muy alta.
   - Impacto: elimina el enlace universal requerido.
   - Compatibilidad: incompatible con el mensaje fijo Airbnb.
   - Decisión: descartada.

3. Código como bearer con controles compensatorios.
   - Seguridad: media, adecuada al riesgo observado.
   - Impacto: mínimo; no añade pasos.
   - Complejidad/mantenibilidad: baja.
   - Compatibilidad: total.
   - Decisión: seleccionada.

La exigencia aprobada de solicitar únicamente el código y prohibir pasos
adicionales constituye aceptación explícita del riesgo residual de filtración
del bearer.

## 3. Riesgo 2 — rate limiting

### Alcance final

- Ventana fija process-local de 10 minutos.
- Máximo 5 intentos por IP.
- Máximo 5 intentos por código normalizado.
- El IP se evalúa primero.
- Si el IP está bloqueado, el código no modifica estado.
- Máximo 10.000 buckets por proceso, con expulsión FIFO del más antiguo.
- Inputs malformados consumen el bucket IP, pero no crean bucket de código.

### Limitaciones

- Reinicio del proceso elimina contadores.
- Cada instancia mantiene su propio mapa.
- Una cardinalidad extrema puede expulsar buckets antiguos al llegar a 10.000.
- El valor `unknown` comparte presupuesto si la infraestructura no entrega un
  header de cliente confiable.
- No sustituye control de bots en edge.

### Múltiples instancias y balanceadores

El límite efectivo en serverless es aproximadamente 5 multiplicado por el
número de instancias que reciben el tráfico. No existe coordinación global.

Detrás de Cloudflare/Vercel se priorizan headers establecidos por la plataforma
y no se confía en `x-forwarded-for` arbitrario. En una infraestructura distinta
debe garantizarse que el balanceador sobrescriba `x-real-ip`; de lo contrario,
ese fallback podría ser falsificable.

### Alternativas evaluadas

1. Redis/KV compartido.
   - Seguridad: alta y distribuida.
   - Impacto/arquitectura: medio; nueva dependencia y operación.
   - Complejidad/mantenibilidad: media.
   - Decisión: no seleccionada por alcance.

2. WAF/rate limit en Cloudflare o Vercel.
   - Seguridad: alta frente a volumen y bots.
   - Impacto de código: nulo.
   - Complejidad: baja/media operacional.
   - Decisión: recomendada antes de exposición a gran escala; no ejecutada
     porque no se autorizó deploy ni cambio externo.

3. Tabla de intentos en PostgreSQL.
   - Seguridad: distribuida.
   - Impacto: alto; escritura por intento, migración y limpieza.
   - Mantenibilidad: media/alta.
   - Decisión: descartada.

4. Buckets duales en memoria y mapa acotado.
   - Seguridad: defensa local efectiva.
   - Impacto: mínimo.
   - Complejidad/mantenibilidad: baja.
   - Compatibilidad: total.
   - Decisión: seleccionada para esta ejecución.

## 4. Riesgo 3 — fuerza bruta, enumeración y automatización

### Fuerza bruta

El atacante debe superar formato, límite IP, límite por código y espacio de
códigos. La rotación de IP no evita el bucket por código dentro de una misma
instancia. Un ataque distribuido entre instancias conserva riesgo medium.

### Enumeración

No se distingue entre código malformado, inexistente, cancelado, ambiguo o
limitado mediante el texto de error. Todos los caminos esperan al menos 600 ms.

El redirect únicamente presente en éxito continúa revelando validez. Eliminar
ese oracle impediría la continuación automática al Guest Registration y
cambiaría el flujo aprobado.

### Automatización

La automatización de bajo volumen queda ralentizada por los dos buckets. La de
alto volumen puede generar carga de base de datos y repartir intentos entre
instancias. El mapa de 10.000 entradas evita agotamiento ilimitado de memoria,
pero no es un sistema anti-bot global.

### Alternativas evaluadas

1. CAPTCHA/Turnstile adaptativo.
   - Seguridad: media/alta contra bots.
   - Impacto: añade interacción o challenge.
   - Compatibilidad: contradice la experiencia sin pasos adicionales.
   - Decisión: descartada para esta fase.

2. Envío posterior de enlace de un solo uso por email.
   - Seguridad: alta.
   - Impacto: crea otro paso y depende de cobertura de email.
   - Complejidad: media/alta.
   - Decisión: descartada.

3. Error uniforme, piso temporal, rate limit dual y telemetría.
   - Seguridad: media.
   - Impacto: mínimo y sin cambio visual.
   - Complejidad/mantenibilidad: baja.
   - Compatibilidad: total.
   - Decisión: seleccionada.

## 5. Hallazgo durante la reauditoría y corrección

La revisión final detectó que la primera versión evaluaba el bucket por código
aunque el IP ya estuviera bloqueado. Un atacante podía crear suficientes
buckets desde ese IP para forzar expulsiones FIFO y debilitar el control por
código.

Corrección mínima:

- se centralizó la evaluación en
  `checkAirbnbUniversalAccessRateLimits(ipKey, codeKey)`;
- el chequeo IP corta la ejecución antes de tocar el bucket por código;
- se añadió la prueba “does not consume code buckets after the IP is blocked”.

Una segunda revisión independiente confirmó la eliminación del hallazgo high.

## 6. Archivos modificados por el hardening

- `src/app/guest-registration/actions.ts`
- `src/services/guests/airbnb-universal-guest-registration.service.ts`
- `tests/guests/airbnb-universal-guest-registration.test.ts`
- `docs/audits/AIRBNB-UNIVERSAL-GUEST-REGISTRATION-SECURITY-HARDENING-V1.md`

No se modificó el formulario, la ruta tokenizada, TTLock, Reservas, PMS, Inbox,
AI Concierge, correos, multi-tenant ni otros módulos congelados.

## 7. Reauditoría final

- Typecheck: PASS.
- Build Next.js 16.2.6: PASS.
- Ruta `/guest-registration` presente en build: PASS.
- Guest Registration: PASS, 33/33.
- Controles específicos de acceso universal: PASS, 5/5.
- Airbnb Email: PASS, 175/175.
- Release Readiness: PASS, 37/37.
- Integración con datos reales: PASS, 4/4:
  - Airbnb válida;
  - inexistente;
  - cancelada;
  - registro completado.
- Linter de archivos modificados: PASS.
- Security Review final: sin critical/high.

Nota de ejecución: una primera invocación agregada de tests Guest Registration
omitió el preload requerido para `server-only`; falló el harness, no una
aserción funcional. Se repitió con el preload oficial y finalizó 33/33.

## 8. Riesgos residuales

1. Quien conoce un código válido puede continuar por diseño.
2. El redirect permite distinguir éxito de error.
3. El rate limit no se comparte entre procesos o regiones.
4. El FIFO puede perder un bucket bajo más de 10.000 claves activas por proceso.
5. La calidad del límite IP depende de los headers del edge.
6. El piso de 600 ms reduce diferencias temporales, pero no es tiempo constante.

Todos son medium. No se identificó un bypass cross-tenant, SQL injection, open
redirect, exposición de PII en errores ni hallazgo critical/high.

## 9. Decisión final

# GO

Justificación:

- el único hallazgo high de implementación fue corregido y probado;
- no quedan hallazgos critical/high;
- el flujo code-only aprobado permanece intacto;
- el token interno de 192 bits sigue siendo el único acceso al Guest
  Registration existente;
- las regresiones obligatorias finalizaron en PASS;
- los riesgos medium inherentes al requisito code-only quedan aceptados por las
  restricciones funcionales aprobadas y documentados de forma explícita.

Recomendación operacional: configurar rate limiting distribuido/WAF y alertas
sobre `airbnb-universal-access rate_limited` antes de exposición de alto volumen.
Esto no cambia el veredicto para el alcance y escala actuales, pero es necesario
si se pretende garantizar globalmente 5 intentos por ventana.

No se realizó commit, migración ni deploy.
