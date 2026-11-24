# Guest Registration — Production Readiness V1

**Módulo:** Guest Registration  
**Estado de este ciclo:** AUDITORÍA INTEGRAL COMPLETADA — IMPLEMENTACIÓN DIFERIDA  
**Fecha:** 2026-07-17  
**Prioridad:** CRÍTICA  
**Restricciones respetadas:** sin commit · sin migraciones · sin tags · sin deploy · sin tocar módulos congelados  

---

## Veredicto ejecutivo

| Criterio | Resultado |
|----------|-----------|
| ¿GR es hoy la única fuente oficial del huésped? | **NO** |
| ¿Cumple legislación colombiana (SIRE + TRA + Habeas Data)? | **NO** |
| ¿Preparado para integrar SIRE sin re-pedir datos? | **NO** |
| ¿Preparado para integrar TRA / SIAT sin re-pedir datos? | **NO** |
| ¿Flujo Airbnb → GR → Admin → TTLock operativo? | **SÍ** (evidencia E2E previa; condicional ops) |
| ¿Regresiones introducidas en este ciclo? | **NINGUNA** (solo auditoría) |
| ¿Listo para autorizar Deploy de ampliación legal? | **NO** — faltan campos, consentimiento auditable y modelo canónico persistido |

**Causa raíz (no síntoma):** el modelo `ReservationGuest` y el formulario actual capturan identidad operativa (nombre, documento, contacto, nacionalidad/DOB opcionales). **No capturan** el conjunto normativo TRA/SIAT ni el mínimo migratorio SIRE documentado por MinCIT/Migración, ni almacenan **autorización Habeas Data** consultable.

**Decisión Fase 6:** no implementar ampliación de campos ni firma en este ciclo. Toda ampliación exige **migración Prisma** (prohibida aquí) y reauditoría. La alternativa de menor impacto es documentar el **modelo canónico**, el plan aditivo y los gaps; mantener el flujo actual intacto.

---

## Fuentes de evidencia (objetivas)

### Legales / oficiales

| Tema | Fuente |
|------|--------|
| TRA = prueba del contrato de hospedaje | Ley 2068 de 2020 art. 22; proyecto de resolución MinCIT “Tarjeta de Registro de Alojamiento” / SIAT |
| Campos TRA (huésped + acompañantes + estancia) | MinCIT — resolución de implementación TRA/SIAT (texto publicado en mincit.gov.co) |
| Conservación TRA ≥ 5 años desde check-out | Mismo acto MinCIT art. 7 |
| Autorización datos personales + protocolo TRA | MinCIT art. 11; Ley 1581 de 2012 arts. 9 y 12; Decreto 1377 de 2013 |
| SIRE — reporte de extranjeros en hospedaje | Guía MinCIT alojamiento; Migración Colombia SIRE |
| Campos migratorios en hospedaje (guía sectorial) | Guía legal MinCIT: nombres, nacionalidad, documento, DOB, género, profesión, procedencia/destino, fechas llegada/salida |
| Contrato de hospedaje | Ley 300 art. 79 (mod. Ley 2068 art. 21): contrato de adhesión, pago, plazo &lt; 30 días |

### Código / producto PRAGMA

| Artefacto | Hallazgo |
|-----------|----------|
| `prisma/schema.prisma` → `ReservationGuest` | Campos: first/last/fullName, documentType/Number, email?, phone?, nationality?, dateOfBirth? |
| `Reservation` | `guestName`, `guestEmail?`, `guestPhone?` (snapshot paralelo a GR) |
| `guest-registration.schema.ts` + form | Mismos campos; email/phone obligatorios solo en titular |
| `guest-document-types.ts` | Activos: CC, RC, TI, PASSPORT, DNI, DL — **CE legacy en BD, no en formulario** |
| Integraciones UI SIRE/TRAA | Stubs de credenciales/test — **no pipeline de envío de huéspedes** |
| Consentimiento / firma | **Ausentes** en schema y UI |
| Seguridad acceso universal | `AIRBNB-UNIVERSAL-GUEST-REGISTRATION-SECURITY-HARDENING-V1.md` |
| E2E Airbnb → GR → emails → TTLock | `AIRBNB-UNIVERSAL-GUEST-REGISTRATION-END-TO-END-V1.md` |

---

# FASE 1 — AUDITORÍA LEGAL

## 1. ¿Qué información exige actualmente SIRE?

**Evidencia:** Guía MinCIT de alojamiento + portal Migración Colombia (SIRE).  
Obligación: registro diario de **extranjeros** en establecimientos de hospedaje.

Campos citados en la guía sectorial para registro de extranjeros (mínimo operativo documentado):

- Nombres y apellidos completos  
- Nacionalidad  
- Documento de identidad  
- Fecha de nacimiento  
- Género / sexo  
- Profesión  
- Lugar de procedencia y de destino  
- Fechas de llegada y salida  

**Nota de alcance:** el detalle exacto de catálogos/formatos SIRE vive en la plataforma de Migración Colombia tras inscripción del prestador. PRAGMA **no** implementa hoy el payload SIRE; la evidencia sectorial anterior es el piso funcional para “estar preparado”.

## 2. ¿Qué información exige actualmente TRA?

**Evidencia:** proyecto/resolución MinCIT de implementación de la Tarjeta de Registro de Alojamiento vía **SIAT**.

### Prestador / establecimiento (una vez + actualizaciones)

Actividad económica, tipo/número identificación PST, matrícula mercantil, RNT, operador, razón social, nombre comercial, ubicación (depto/municipio/dirección), contactos, disponibilidad (habitaciones/camas).

### Huésped principal

| Campo TRA | Obligatorio en SIAT |
|-----------|---------------------|
| Nº/nombre habitación | Sí (prestador) |
| Tipo y nº identificación | Sí |
| Nombre completo | Sí |
| Fecha de nacimiento | Sí |
| Sexo | Sí |
| Nacionalidad | Sí |
| Motivo principal de viaje | Sí |
| Ocupación / profesión / oficio | Sí |
| País + depto/estado residencia | Sí |
| País + depto/estado procedencia | Sí |
| Ciudad residencia (si Colombia) | Sí |
| Ciudad procedencia (si Colombia) | Sí |
| Check-in / check-out | Sí |
| Número de acompañantes | Sí |

### Acompañante (por cada uno)

Tipo/nº ID, nombre, DOB, sexo, nacionalidad, motivo viaje, profesión, residencia, procedencia, check-in/out.

### Características del servicio

Tipo de acomodación, valor total pagado, medio de pago, medio de reserva.

**Conservación:** mínimo **5 años** desde check-out.

**Registro:** en línea o el mismo día del registro del huésped (instructivos MinCIT).

## 3. ¿Qué información exige un contrato de hospedaje válido en Colombia?

**Evidencia:** Ley 300 art. 79 (mod. Ley 2068): contrato de **adhesión** entre prestador y huésped, con pago, plazo inferior a 30 días, propósito principal de alojamiento.

La Ley 2068 art. 22 dispone que la **TRA** diligenciada en el sistema del Gobierno es la **prueba del contrato de hospedaje**.

Implicación para PRAGMA: no es obligatorio un PDF contractual separado para cumplir TRA; sí es necesario poder generar/enviar la TRA con los datos correctos. Un contrato interno (términos + aceptación) es **complementario** (operación / prueba civil), no sustituto de TRA.

## 4. ¿Qué consentimiento exige Habeas Data?

**Evidencia:** Ley 1581 de 2012 art. 9 — autorización **previa, expresa e informada**, por medio consultable posteriormente.  
Decreto 1377 de 2013 — solicitar autorización a más tardar al recolectar; informar datos y finalidades; silencio ≠ autorización.

## 5. ¿Qué consentimiento exige tratamiento de datos personales?

Además del art. 9/12 Ley 1581: informar finalidades (operación de la reserva, acceso, comunicaciones, **fines estadísticos TRA/SIAT**, eventual reporte migratorio).  
MinCIT art. 11 TRA: protocolo de autorización para tratamiento con fines estadísticos.

## 6. ¿Qué evidencia debe conservar el sistema?

| Evidencia | Base |
|-----------|------|
| Datos TRA por huésped ≥ 5 años post check-out | MinCIT TRA |
| Autorización Habeas Data consultable (quién, cuándo, texto/versión, IP/user-agent opcionales) | Ley 1581 art. 9 |
| Relación huésped ↔ reserva ↔ propiedad ↔ org | Operación multi-tenant |
| Traza de envío futuro SIRE/TRA (éxito/fallo, payload hash) | Operación + auditoría |

## 7–8. Obligatorios vs opcionales (marco legal vs producto)

### Obligatorios para cumplimiento TRA (huésped)

Identidad completa, DOB, sexo, nacionalidad, motivo viaje, ocupación, residencia, procedencia, fechas estancia, acompañantes; más metadatos de estancia (acomodación, valor, pago, canal).

### Obligatorios SIRE (extranjeros) — piso documentado

Identidad, nacionalidad, documento, DOB, género, profesión, procedencia/destino, fechas.

### Obligatorios operativos actuales en PRAGMA (titular)

Nombre, apellido, tipo/número documento, email, teléfono válido.

### Opcionales hoy en PRAGMA

Nacionalidad, fecha de nacimiento, email/teléfono de acompañantes.

## 9. ¿Qué captura ya PRAGMA?

`ReservationGuest`: firstName, lastName, fullName, documentType, documentNumber, email?, phone?, nationality?, dateOfBirth?.  
De la reserva (no del formulario de acompañantes): check-in/out, propiedad, código Airbnb, montos/plataforma según modelo de reserva.

## 10. ¿Qué falta?

| Gap | Impacto |
|-----|---------|
| Sexo / género | TRA + SIRE |
| Motivo de viaje | TRA |
| Profesión / ocupación | TRA + SIRE |
| Residencia (país/depto/ciudad) | TRA |
| Procedencia (país/depto/ciudad) | TRA + SIRE |
| Destino (SIRE guía) | SIRE |
| CE en catálogo activo del formulario | Extranjeros residentes |
| Nacionalidad/DOB **obligatorios** cuando aplique TRA/SIRE | Cumplimiento |
| Autorización Habeas Data persistida | Ley 1581 |
| Aceptación contractual / TRA acknowledgment auditable | Prueba + UX legal |
| Datos prestador RNT/matrícula en modelo org/property listos para SIAT | Prestador (no huésped) |
| Medio de pago / acomodación explícitos para TRA | Estancia |
| Conservación/export 5 años orientada a TRA | Retención |

## 11. ¿Qué sobra?

Nada “legalmente sobrante” en el formulario. Operativamente, `Reservation.guestName/guestEmail/guestPhone` **duplican** identidad ya capturable en GR (ver Fase 2).

## 12. ¿Qué está duplicado?

| Dato | Dónde |
|------|--------|
| Nombre huésped | `Reservation.guestName` (iCal/email) + `ReservationGuest.fullName` |
| Email / teléfono | `Reservation.guestEmail/Phone` + `ReservationGuest` del titular |
| Capacidad / conteo | Reserva + lista de huéspedes registrados |

---

# FASE 2 — AUDITORÍA FUNCIONAL

## ¿Puede el GR actual convertirse en la única fuente oficial del huésped?

**Hoy: no.** Puede serlo **si** se define canonicidad: `ReservationGuest` (+ consentimiento/firma metadata) como **única** fuente de PII del huésped; `Reservation.guest*` queda como **proyección/caché de display** alimentada solo desde GR (o iCal provisional hasta registro).

### Consumo por módulo (evidencia de uso)

| Módulo | Qué reutiliza hoy | ¿Debería salir solo de GR? |
|--------|-------------------|----------------------------|
| Reservas / calendario / panel | `guestName`, conteos, estado registro | Display: sí desde GR post-registro; pre-registro: placeholder iCal |
| TTLock / emails de acceso | Email/nombre del titular (`ReservationGuest` / fallback reserva) | Sí — email titular GR |
| Emails admin GR | Lista de huéspedes registrados | Sí |
| AI Concierge | Contexto de reserva / huésped (lectura) | Sí — PII desde GR |
| Contactos operativos | Destinatarios admin (property), no huésped | No aplica |
| Contratos / TRA / SIRE | **No implementados** | Sí — modelo canónico |
| Reportes | Mezcla reserva + guests | Sí — guests canónicos |

### Datos que se vuelven a pedir innecesariamente

- Nacionalidad/DOB opcionales → se pierden oportunidades de completar TRA.  
- No hay reutilización estructurada país→depto→ciudad (no existen campos).  
- Post-registro, el PMS no debe pedir de nuevo documento/contacto en otros flujos (hoy no hay segundo formulario legal; el riesgo es futuro si se añaden módulos sin leer GR).

---

# FASE 3 — MODELO CANÓNICO DEL HUÉSPED

Diseño **documental** (no persistido aún). Toda integración futura debe depender de este modelo, **nunca** de la UI.

```text
CanonicalGuest
├── identity
│   ├── firstName, lastName, fullName
│   ├── documentType (catálogo CO + CE + PASSPORT + …)
│   ├── documentNumber
│   ├── nationality (ISO 3166-1 alpha-2)
│   ├── dateOfBirth
│   └── sex (catálogo TRA)
├── contact
│   ├── email?
│   └── phoneE164?
├── travel (TRA / SIRE)
│   ├── travelMotive
│   ├── occupation
│   ├── residence { country, adminArea, city }
│   ├── origin { country, adminArea, city }
│   └── destination { country, adminArea, city }  // SIRE
├── stayLinkage
│   ├── reservationId
│   ├── role: PRIMARY | COMPANION
│   ├── checkIn, checkOut (desde Reservation; no duplicar salvo override)
│   └── roomLabel?
├── consent
│   ├── habeasDataAcceptedAt, policyVersion, evidenceRef
│   └── lodgingTermsAcceptedAt, termsVersion
└── audit
    ├── createdAt, updatedAt, source: GUEST_REGISTRATION
    └── submissionIpHash?, userAgentHash?
```

### ¿Soporta?

| Integración | ¿Modelo propuesto? | ¿Hoy en BD? |
|-------------|--------------------|-------------|
| SIRE | Sí | No |
| TRA / SIAT | Sí | Parcial (identidad + fechas reserva) |
| TTLock | Sí (contact) | Sí (email) |
| AI Concierge | Sí | Parcial |
| Emails | Sí | Sí |
| Contratos | Sí (consent + identity + stay) | No |
| Reportes | Sí | Parcial |
| Migraciones futuras | Sí (campos aditivos versionados) | N/A |

---

# FASE 4 — AUDITORÍA UX

| Componente | Situación actual | Recomendación (menor impacto, sin migrar aún) |
|------------|------------------|-----------------------------------------------|
| Calendario / DOB | `<input type="date">` nativo | Mantener nativo móvil; en desktop, year-first o select de año para reducir fricción |
| Nacionalidad | Texto libre opcional | Catálogo ISO + buscador; banderas opcionales (no críticas) |
| Tipo documento | Select parcial | Catálogo completo incl. **CE**; mapear a códigos TRA/SIRE |
| País / depto / ciudad | No existen | Cascada dependiente (DIVIPOLA CO + ISO extranjero) cuando se añadan campos |
| Teléfono | `PhoneInput` + validación | Ya orientado a internacional; persistir **E.164** de forma explícita en modelo |
| Dirección | No | Solo si TRA/SIRE o contrato interno lo exigen; evitar over-capture |
| Autocompletado | Nombre desde header reserva | Prefill titular desde `guestName` iCal; no inventar documento |
| Validaciones | Zod básico | Evitar docs duplicados (ya); forzar DOB/nacionalidad cuando se active modo TRA |
| Tiempo | ~2–4 min titular + ~1–2 min/acompaante (estimación UX) | Con catálogos + prefill: objetivo &lt; 2 min titular |

**Objetivo:** minimizar esfuerzo **sin** omitir campos legales cuando se active el modo cumplimiento.

---

# FASE 5 — CONTRATO DE ALOJAMIENTO (TRA)

## ¿Qué exige el contrato?

- Marco legal: contrato de adhesión de hospedaje.  
- **Prueba legal del contrato ante turismo:** TRA en SIAT (Ley 2068 art. 22).

## ¿Qué información ya existe?

Identidad parcial + fechas reserva + propiedad. **Insuficiente** para TRA completa.

## ¿Qué debe capturarse?

Campos Fase 1 + aceptación informada Habeas Data (+ términos de hospedaje si se emite contrato interno).

## ¿Es suficiente una aceptación? ¿Debe existir firma?

| Alternativa | Validez práctica | Facilidad | Impacto | Mantenimiento | Decisión |
|-------------|------------------|-----------|---------|---------------|----------|
| Checkbox + texto legal + timestamp + versión política | Alta para Habeas Data (Ley 1581 permite escrito/conducta inequívoca consultable) | Alta | Bajo | Bajo | **Elegida (menor impacto)** |
| Aceptación electrónica con OTP email | Alta | Media | Medio | Medio | Reserva |
| Firma tipográfica (nombre) | Media | Alta | Bajo | Bajo | Complemento opcional |
| Firma dibujada (canvas) | Media-alta percepción; no exigida por TRA | Baja móvil | Alto (storage) | Alto | **Descartada** por impacto |
| Firma avanzada / certificado | Alta | Baja | Muy alto | Muy alto | Fuera de alcance |

**Conclusión:** para el alcance PRAGMA (hospedaje corto + TRA futura), **no** se requiere firma biométrica dibujada. Se requiere:

1. Completar datos TRA.  
2. Checkbox de autorización Habeas Data + política versionada + evidencia consultable.  
3. Opcional: checkbox de aceptación de términos de hospedaje.  
4. Generación/envío TRA al SIAT cuando exista integración (prueba del contrato ante MinCIT).

---

# FASE 6 — IMPLEMENTACIÓN

**Estado:** DIFERIDA en este ciclo.

**Motivo objetivo:** ampliar campos, consentimientos o firma exige cambios en `ReservationGuest` / tablas satélite → **migración Prisma**, prohibida por el documento de ejecución hasta cierre auditado con autorización explícita.

**Qué se hizo:** auditoría + modelo canónico + informe de readiness.  
**Qué no se tocó:** PMS, reservas, calendario, inbox, AI Concierge, TTLock, tokens GR, Airbnb, iCal, facturación, finanzas, QR, INTIENDAS, multi-tenant.

**Plan aditivo futuro (cuando se autoricen migraciones):**

1. Migración aditiva de campos canónicos + `GuestConsentEvidence`.  
2. UI aditiva en GR (sin romper TTLock/emails).  
3. Backfill no destructivo; `Reservation.guest*` sincronizado desde titular.  
4. LAT real Airbnb → GR → admin → guest → TTLock.  
5. Reauditoría + informe V2 → autorización deploy.

---

# FASE 7 — SEGURIDAD

Basado en código actual + hardening universal + modelo de token.

| Pregunta | Respuesta |
|----------|-----------|
| ¿Contaminación entre huéspedes/reservas? | Token amarra una reserva; proyección mínima en header. Sin evidencia de leak cross-tenant en flujo token. |
| ¿Un huésped ve datos de otro? | Solo huéspedes de **su** reserva en el hub de confirmación (esperado). |
| ¿Fugas / IDs / tokens visibles? | Token en URL (factor de acceso); no exponer en emails de marketing; rate limit en acceso por código Airbnb. |
| ¿Enumeración? | Mensajes genéricos + rate limit en acceso universal (hardening V1). |
| ¿Modificar reservas desde GR? | GR escribe guests + flags de registro; no rediseña calendario/iCal. |
| ¿Duplicados? | Unique por documento en reserva; riesgo de **duplicidad semántica** Reservation vs Guest (datos), no de seguridad directa. |

**Corrección en este ciclo:** ninguna (sin hallazgos nuevos critical que exijan cambio mínimo sin migración). Riesgos residuales: factor único código Airbnb (medium, documentado).

---

# FASE 8 — PRUEBAS REALES

**En este ciclo:** no se reejecutó un Full Flow destructivo (no hubo cambios de producto).

**Evidencia real previa reutilizable:**

| Paso | Evidencia |
|------|-----------|
| Airbnb código → resolve → token | E2E V1 + LAT `HM9MJ4HBFJ` |
| Formulario / registro | Full Flow Direct histórico + schema vigente |
| Admin / guest / TTLock emails | E2E V1 + servicios TTLock email (titular) |
| Firma | **N/A** — no implementada |
| Contaminación | Security hardening V1 |

**Pendiente para V2 post-implementación:** repetir Full Flow real incluyendo consentimiento y campos TRA.

---

# FASE 9 — REAUDITORÍA DE GATES

| Gate | Este ciclo |
|------|------------|
| Typecheck / Build / Release Readiness | No re-ejecutados como cierre de cambio (sin diff de producto) |
| Regresiones GR / AI / TTLock / Emails / Calendario / Reservas | **Sin cambios de código → sin regresiones introducidas** |

Confirmación expresa: **sin regresiones atribuibles a este ciclo de auditoría.**

---

# INFORME OBLIGATORIO — 15 PREGUNTAS

### 1. ¿El Guest Registration cumple completamente la legislación colombiana?

**No.** Cumple identidad operativa parcial; no cumple TRA completa ni piso SIRE documentado ni autorización Habeas Data consultable.

### 2. ¿Está preparado para integrar SIRE?

**No.** Faltan género, profesión, procedencia/destino estructurados; CE no está en el catálogo activo del formulario; no hay exporter.

### 3. ¿Está preparado para integrar TRA?

**No.** Faltan sexo, motivo, ocupación, residencia/procedencia, metadatos de estancia TRA, retención 5 años orientada a SIAT, y datos RNT del prestador en el pipeline.

### 4. ¿Toda la información necesaria se captura una sola vez?

**No.** PII aún vive en `Reservation.guest*` e iCal además de `ReservationGuest`. Campos legales ni siquiera se capturan.

### 5. ¿Existe contaminación de información?

**No demostrada** entre tenants/reservas en el flujo token. Riesgo residual de acceso con código Airbnb válido (factor único), mitigado parcialmente por rate limit.

### 6. ¿Existen duplicidades?

**Sí** — snapshot de reserva vs GR; fullName vs first+last (derivado, aceptable).

### 7. ¿Existen riesgos de seguridad?

**Residuales medium** en acceso universal por código; token en URL. Sin hallazgos critical nuevos en este ciclo.

### 8. ¿Existen riesgos jurídicos?

**Sí** — recolección de PII sin evidencia de autorización Ley 1581; imposibilidad actual de diligenciar TRA/SIRE solo con datos GR.

### 9. ¿La firma electrónica propuesta es suficiente para el alcance definido?

**Sí, la propuesta (checkbox + política versionada + timestamp consultable)** es la adecuada y de menor impacto. Firma dibujada **no** es requerida por TRA. Aún **no está implementada**.

### 10. ¿Qué faltaría para considerarlo jurídicamente robusto para producción?

1. Persistencia de consentimiento Habeas Data.  
2. Campos TRA/SIRE en modelo canónico.  
3. Catálogos (documento, sexo, motivos, DIVIPOLA/ISO).  
4. Política de retención ≥ 5 años.  
5. Integración o export SIAT/SIRE.  
6. Datos RNT/prestador.  
7. LAT real post-cambio + reauditoría.

### 11. ¿Puede generar el contrato de alojamiento solo con lo capturado por el huésped?

**No** (ni TRA completa ni contrato interno con aceptación). Faltan campos y evidencia de aceptación.

### 12. ¿Puede enviar automáticamente info gubernamental sin volver a pedir datos?

**No.**

### 13. ¿El formulario quedó preparado para crecer sin rediseños futuros?

**Parcial.** La UX multi-paso actual escala; el **schema** no. Sin modelo canónico persistido, cualquier cumplimiento forzó rediseño de datos.

### 14. ¿Existen impactos negativos sobre módulos existentes?

**No** en este ciclo (sin implementación).

### 15. ¿Existen regresiones?

**No** en este ciclo.

---

## Criterio de aceptación — checklist

| Criterio | Estado |
|----------|--------|
| GR única fuente oficial del huésped | ❌ |
| Información una sola vez | ❌ |
| Sin contaminación | ✅ (alcance token; residual código Airbnb) |
| Sin duplicidades | ❌ |
| Preparado SIRE | ❌ |
| Preparado TRA | ❌ |
| Preparado futuras integraciones | 🟡 modelo canónico documentado |
| Flujo Airbnb → GR → Admin → TTLock | ✅ (E2E previo; ops condicional) |
| Sin regresiones / sin impacto PMS | ✅ este ciclo |
| Menor impacto / reauditoría / pruebas reales post-fix | ⏸ diferido a V2 con migraciones autorizadas |

---

## Cierre

La ejecución de **auditoría (Fases 1–5, 7) + informe** está completa.  
La **implementación (Fase 6)** y el **Full Flow con firma/consentimiento (Fase 8 ampliada)** quedan **bloqueadas correctamente** por:

- necesidad de migraciones;  
- riesgo jurídico no mitigable solo con UI sin evidencia persistida;  
- mandato de no tocar módulos congelados ni desplegar.

**No se solicita Deploy.**  
**Próximo paso autorizado cuando el owner lo decida:** ciclo V2 — migración aditiva del modelo canónico + consentimiento + UI TRA mínima + LAT real + `GUEST-REGISTRATION-PRODUCTION-READINESS-V2.md`.

---

*Documento generado bajo el protocolo: auditar → evidencia → causa raíz → menor impacto → reauditar. Este V1 es el gate de no-deploy hasta cerrar gaps legales.*
