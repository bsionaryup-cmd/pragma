# PRAGMA AI Concierge — Integración Transparente con PRAGMA

## Auditoría previa obligatoria

**Fecha:** 2026-07-17  
**Estado:** AUDITORÍA CERRADA · IMPLEMENTACIÓN DETENIDA POR STOP CRITERIA OCP  
**Baseline:** `docs/ocp/baselines/ai-concierge-native-integration-2026-07-17.md`  
**Transporte real:** HTTPS REST (no existe WebSocket)

---

## Conclusión ejecutiva

Ocultar el popup no resuelve la causa raíz. La configuración operativa, la
autoridad del modo y la autenticación viven actualmente en el cliente. Además,
el panel solicitado necesita estado persistente por organización, pero las
sesiones, métricas, auditorías y propuestas actuales viven en memoria de un
proceso.

La solución de menor impacto que cumple seguridad y UX es:

1. módulo nativo `/ai-concierge` protegido por sesión Clerk y permisos;
2. configuración y estado persistentes por organización en PRAGMA;
3. vinculación desde la página autenticada mediante
   `externally_connectable`;
4. token de extensión corto y efímero en `chrome.storage.session`;
5. solo un identificador técnico de dispositivo en `chrome.storage.local`;
6. ningún secreto, user ID, organización, modo o API base en
   `chrome.storage.sync`;
7. scope, modo, canales y permisos resueltos únicamente en servidor;
8. extensión reducida a DOM + transporte + heartbeat + inserción/envío
   autorizado por PRAGMA.

Esta alternativa requiere **schema, contrato de autenticación y contrato
web↔extensión nuevos**. El protocolo OCP obliga a detener la implementación en
este punto y presentar la decisión antes de modificar código.

---

## 1. ¿Qué configuraciones existen actualmente en la extensión?

### Persistidas en `chrome.storage.sync`

| Campo | Origen | Uso actual | Hallazgo |
|---|---|---|---|
| `apiBase` | popup | URL de todas las APIs | Editable; puede desviar el secreto a otro host |
| `secret` | popup | Bearer global | Credencial persistente y sincronizada por Chrome |
| `orgId` | popup | Header `x-concierge-org-id` | Ya es ignorado por el servidor; configuración muerta |
| `userId` | popup | Header `x-concierge-user-id` | Identidad elegida por el cliente |
| `mode` | popup | Header `x-concierge-mode` | El cliente puede elevarse a `autonomous` |

Archivos: `popup.html`, `popup.js`, `background.js`.

### Persistidas en `chrome.storage.local`

- `conciergeLastHealth`: estado técnico del último health.
- `concierge-leader:<channel>`: lease de liderazgo entre pestañas.

Estos datos son técnicos, no contienen lógica de negocio y pueden permanecer
locales (con caducidad/limpieza).

### Estado solo en memoria

- fingerprint del último mensaje;
- conectividad;
- liderazgo de pestaña;
- texto mostrado en el panel inyectado.

---

## 2. ¿Cuáles deben trasladarse a PRAGMA?

| Configuración | Autoridad recomendada |
|---|---|
| Activo/inactivo/pausado | Configuración por organización en PRAGMA |
| Modo observe/manual/assisted/autonomous | PRAGMA; nunca header cliente |
| Canales habilitados | PRAGMA |
| Propiedades incluidas | PRAGMA |
| Permisos de operación | RBAC de PRAGMA |
| Horarios | PRAGMA |
| Tools habilitadas | PRAGMA |
| Política LLM | PRAGMA |
| Auditor activo | PRAGMA |
| Plantillas e intenciones | Biblioteca versionada en PRAGMA |
| Links/dispositivos/revocación | PRAGMA |
| Heartbeat, versión, error y sync | PRAGMA |
| Conversaciones/estadísticas/auditorías | Scope persistente de organización |

`apiBase` no es configuración de usuario: debe provenir del origen PRAGMA que
vincula la extensión y mantenerse solo durante la sesión del navegador.

---

## 3. ¿Qué configuraciones están duplicadas?

- `orgId`: el popup lo guarda y envía, pero el servidor lo ignora.
- `userId`: duplica la identidad de la sesión PRAGMA y permite suplantarla.
- `mode`: vive en el popup y en el request, sin SSOT server-side.
- `secret`: vive en env del servidor y en storage sincronizado de Chrome.
- health/config: parte en popup, parte en panel DOM, parte en API.
- estado “AUTO-SEND”: la extensión lo muestra aunque solo inserta texto.

---

## 4. ¿Qué información puede eliminarse?

Eliminar de storage/popup/headers:

- `secret`;
- `orgId`;
- `userId`;
- `mode`;
- `apiBase` persistente;
- formulario de configuración;
- controles operativos del panel inyectado.

Conservar:

- `deviceId` aleatorio no secreto en `chrome.storage.local`;
- token de sesión corto en `chrome.storage.session`;
- lease de líder y último health técnicos;
- versión proveniente del manifest.

---

## 5. Hallazgos

| ID | Severidad | Hallazgo | Evidencia |
|---|---|---|---|
| H1 | CRÍTICA | Secreto global + user ID controlado por cliente permite asumir otro tenant | `background.js`, `auth.ts` |
| H2 | CRÍTICA | `knownFacts` del body puede pasar al auditor como hecho verificado | `channel/turn/route.ts`, `compose-reply.ts` |
| H3 | ALTA | `mode` controlado por extensión permite solicitar `autonomous` | `background.js`, `auth.ts` |
| H4 | ALTA | Secret/user/apiBase se guardan en `chrome.storage.sync` | `popup.js` |
| H5 | ALTA | Health mezcla tool audits y learning proposals de todos los tenants | `health/route.ts`, buffers sin filtro |
| H6 | ALTA | WhatsApp usa `location.href` como thread ID; normalmente no identifica el chat | `content-whatsapp.js` |
| H7 | ALTA | “AUTO-SEND” solo inserta; no envía el mensaje | content scripts |
| H8 | MEDIA | Si falla API después de fijar fingerprint, el mensaje puede no reintentarse | content scripts |
| H9 | MEDIA | Métricas/sesiones/audits en memoria no sirven como dashboard confiable serverless | stores de Concierge |
| H10 | MEDIA | Manifest solo permite API localhost; falta origen de producción | `manifest.json` |
| H11 | MEDIA | Lectores DOM genéricos pueden confundir mensajes propios/entrantes | content scripts |
| H12 | BAJA | Popup y panel inyectado exponen una UX técnica duplicada | popup/content-shared |

---

## 6. Alternativas evaluadas

### A. Ocultar popup y reutilizar secreto global

**Rechazada.** Menor esfuerzo visual, pero conserva H1, H3, H4 y H5. No existe
vinculación real ni autoridad server-side.

### B. Usar directamente cookies/SDK de Clerk desde la extensión

**Rechazada.** Acopla la extensión a Clerk, depende del comportamiento
cross-origin/cookies de Chrome y amplía el impacto de cambios de sesión.

### C. Pairing único + refresh token persistente en la extensión

**Rechazada para este requisito.** Es viable, pero contradice “sin credenciales
persistentes” y aumenta el impacto de robo del perfil Chrome.

### D. Página PRAGMA autenticada como broker + sesión efímera

**Seleccionada.**

- `externally_connectable` limitado a orígenes PRAGMA exactos;
- PRAGMA detecta la extensión usando el ID publicado;
- la sesión Clerk crea un challenge de un solo uso;
- background completa el link y recibe token de corta duración;
- token solo en `chrome.storage.session`;
- cada apertura del módulo renueva la sesión silenciosamente;
- el link/dispositivo y su revocación viven en BD;
- sin PRAGMA abierto o token vigente, la extensión falla cerrada.

Es la opción de menor impacto que cumple UX, seguridad y separación
arquitectónica.

---

## 7. Diseño propuesto

### Flujo de primera vinculación

```
Administrador autenticado
  → /ai-concierge
  → Conectar extensión
  → PRAGMA crea challenge corto, single-use y tenant-scoped
  → página envía challenge con chrome.runtime.sendMessage(extensionId)
  → background valida sender.origin y completa link
  → servidor registra dispositivo y emite sesión corta
  → token queda en chrome.storage.session
```

### Operación diaria

```
Abrir PRAGMA /ai-concierge
  → página detecta extensión
  → sesión Clerk renueva token silenciosamente
  → Activar AI actualiza configuración server-side
  → extensión obtiene estado efectivo
  → Airbnb/WhatsApp envían eventos con token corto
  → servidor deriva org/user/mode/permisos
```

### Persistencia mínima necesaria

1. `ConciergeConfiguration`
   - organización, enabled, paused, mode;
   - canales, propiedades, tools/policy;
   - updatedBy/updatedAt.
2. `ConciergeExtensionLink`
   - organización, usuario vinculador, device ID hash;
   - versión, estado, lastHeartbeat, lastSync, lastError, revokedAt.
3. `ConciergeConversationState`
   - organización, canal, thread hash, estado;
   - contadores, intención/path, tiempos, último evento.
4. `ConciergeAuditEvent`
   - organización, link/run/conversation;
   - acción, resultado, tool, duración y metadata segura.

No se persiste el contenido completo de chats en esta versión.

### APIs

- Sesión Clerk:
  - configuración/status del módulo;
  - activar/desactivar/pausar;
  - crear challenge y revocar links;
  - dashboard/logs.
- Auth de extensión:
  - completar link;
  - heartbeat/config efectivo;
  - ingest/turn/commercial existentes.

Los endpoints de canal dejan de aceptar identidad, organización, modo y
`knownFacts` como autoridad cliente.

---

## 8. Módulo nativo PRAGMA

Ruta propuesta: `/ai-concierge`.

Integración mínima:

- nuevo permiso `concierge:read` / `concierge:manage`;
- navegación e i18n;
- página server-protected y vista cliente para estado en vivo;
- botones de operación conectados a configuración server-side;
- estado general, canales, extensión, motor, conversaciones, métricas y logs;
- polling moderado; no WebSocket nuevo.

Administrador: manage. Recepcionista: sin acceso inicialmente (fail-closed).

---

## 9. Riesgos y mitigaciones

| Riesgo | Nivel | Mitigación |
|---|---|---|
| Replay del pairing | Alto | challenge hash, TTL corto, usedAt, audience/device |
| Mensajes externos falsos | Alto | `externally_connectable` y sender origin exactos |
| Robo de token | Alto | storage.session, TTL corto, revocación de link |
| Cross-tenant | Crítico | scope de link/config en servidor; sin IDs cliente |
| Elevación de modo | Alto | modo solo desde configuración de organización |
| Estado serverless inconsistente | Alto | resúmenes/audits persistentes |
| Heartbeat excesivo | Medio | intervalo ≥30–60s y writes throttled |
| DOM cambiante | Alto | fail-closed, selectores versionados, lastError visible |
| Loops/duplicados | Alto | externalMessageId + idempotencia server-side |
| Privacidad | Alto | thread hash y metadata mínima; no chat completo |

---

## 10. Archivos/módulos congelados

No es necesario modificar:

- Guest Registration;
- TTLock;
- Inbox AI;
- QR Mobility;
- INTIENDAS;
- Facturación;
- Reservas/Finanzas certificadas.

La implementación se limita a Concierge, extensión, navegación/RBAC, nuevas
rutas y schema/migración específicos.

---

## 11. Criterios de validación posteriores

- popup no contiene configuración;
- storage.sync no contiene credenciales/configuración;
- link desde PRAGMA sin copiar IDs/secreto;
- activar/desactivar en PRAGMA modifica comportamiento del conector;
- token expirado/revocado falla cerrado;
- dos tenants no ven status/audits recíprocos;
- modo cliente no puede elevar permisos;
- facts cliente no pueden aprobar respuestas;
- WhatsApp usa thread estable por chat;
- auto-send envía exactamente una vez cuando PRAGMA lo autoriza;
- typecheck, build, tests, replay y canales live.

---

## 12. Decisión OCP / estado final de la auditoría

La auditoría está completa y selecciona la alternativa D. La implementación
requiere:

- migración Prisma (cuatro modelos);
- nuevo contrato de autenticación de extensión;
- contrato `externally_connectable`;
- cambio del contrato de los endpoints Concierge.

Estos puntos activan el stop criteria del protocolo OCP. Por tanto:

**IMPLEMENTACIÓN: NO INICIADA.**  
**MÓDULOS CONGELADOS MODIFICADOS: NINGUNO.**  
**SIGUIENTE PASO:** aprobación explícita de la arquitectura y migración
propuestas; después registrar dominio IN_PROGRESS e implementar por fases
pequeñas.
