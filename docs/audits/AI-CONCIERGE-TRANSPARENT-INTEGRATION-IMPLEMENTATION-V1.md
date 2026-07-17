# PRAGMA AI Concierge — Integración Transparente con PRAGMA

## Informe de implementación, reauditoría y estado operativo

**Fecha:** 2026-07-17  
**Dominio OCP:** AI Concierge native integration  
**Baseline:** `docs/ocp/baselines/ai-concierge-native-integration-2026-07-17.md`  
**Auditoría previa:** `docs/audits/AI-CONCIERGE-TRANSPARENT-INTEGRATION-PRE-AUDIT-V1.md`  
**Estado:** IMPLEMENTACIÓN LOCAL PASS · LAT WHATSAPP/AIRBNB PENDIENTE  
**Release/Deploy:** NO AUTORIZADO

---

## 1. Objetivo

Administrar AI Concierge desde un módulo nativo de PRAGMA y reducir la
extensión a un conector técnico sin popup, credenciales ni configuración
operativa persistente.

## 2. Alcance

### Implementado

- ruta nativa `/ai-concierge`;
- RBAC, navegación e i18n;
- activar, desactivar, pausar y reanudar;
- modo, canales, propiedades, tools, LLM y auditor;
- estado general, extensión, canales, motor, conversaciones, métricas y logs;
- vinculación desde sesión PRAGMA;
- sesión de extensión corta y revocable;
- heartbeat, versión, sync, error y estado por canal;
- persistencia tenant-scoped;
- auto-send real cuando PRAGMA devuelve `mayAutoSend=true`;
- idempotencia por mensaje externo;
- allowlists de propiedades y tools.

### Fuera de alcance / no ejecutado

- publicación en Chrome Web Store;
- conversación real humana en WhatsApp Web;
- conversación real humana en Airbnb Web;
- release, tag o deploy de aplicación;
- migración de producción.

## 3. Auditoría inicial

La auditoría encontró:

- secreto/user/org/mode/apiBase en `chrome.storage.sync`;
- secreto global con identidad elegida por cliente;
- modo autónomo controlado por header;
- `knownFacts` controlado por cliente;
- health con audits/proposals globales;
- WhatsApp sin thread ID estable;
- auto-send que solo insertaba;
- métricas y estado en memoria;
- popup y panel inyectado como UX técnica.

## 4. Arquitectura final

```
Sesión Clerk PRAGMA
  → /ai-concierge
  → chrome.runtime.sendMessage(extensionId)
  → challenge single-use ligado a deviceId
  → ConciergeExtensionLink tenant-scoped
  → token HMAC 15 min en chrome.storage.session
  → HTTPS REST
  → scope/mode/canales/permisos resueltos en PRAGMA
```

No se añadió WebSocket ni un pipeline paralelo.

## 5. Persistencia

Migraciones aplicadas en la base configurada de desarrollo:

- `20260717090000_ai_concierge_native_integration`
- `20260717100000_ai_concierge_channel_status`

Modelos:

1. `ConciergeConfiguration`
2. `ConciergeExtensionLink`
3. `ConciergeConversationState`
4. `ConciergeAuditEvent`

No se persiste contenido completo de chats. Se guardan hashes de thread,
contadores, decisiones y metadata operativa mínima.

## 6. Autenticación y multi-tenant

### Antes

- Bearer global;
- `x-concierge-user-id`;
- `x-concierge-org-id`;
- `x-concierge-mode`.

### Después

- token firmado corto;
- link activo en BD;
- device hash;
- organización/usuario derivados en servidor;
- organización, usuario, link, device y expiración revalidados por request;
- modo/configuración derivados de `ConciergeConfiguration`;
- revocación inmediata server-side.

Headers legacy y `knownFacts` ya no son autoridad.

## 7. Extensión final

Eliminado:

- `popup.html`;
- `popup.js`;
- `chrome.storage.sync`;
- secret/user/org/mode/apiBase persistentes;
- panel inyectado y controles operativos.

Conservado:

- lectura/escritura DOM;
- HTTPS REST;
- `deviceId` no secreto;
- token en `chrome.storage.session`;
- leader election;
- heartbeat vía `chrome.alarms`;
- status técnico por canal;
- envío solo cuando PRAGMA autoriza.

ID estable de desarrollo:

`hpghhdnpbibmimbdlgpbkhpfdijabekg`

## 8. Panel nativo

Incluye:

- estado activo/inactivo/pausado;
- WhatsApp y Airbnb por separado;
- versión, heartbeat, sync y último error;
- motor determinístico, LLM y auditor;
- activas, escaladas, finalizadas, mensajes y pendientes;
- determinístico, LLM, escalamiento, errores y tiempo promedio;
- activar/desactivar, pausar/reanudar, conectar/reconectar, revocar y logs;
- modo, propiedades, canales y tools.

## 9. Hallazgos de reauditoría de seguridad

La revisión independiente no encontró hallazgos críticos ni altos. Reportó dos
hallazgos medios:

1. allowlist de propiedades no aplicada cuando el cliente no enviaba
   `propertyId`;
2. challenge no ligado al device y challenges pendientes concurrentes.

Correcciones:

- allowlist aplicada dentro de handlers/registry, incluidas reservas resueltas
  por ID y búsquedas sin `propertyId`;
- allowlist de tools aplicada en read/write registries y flujo comercial;
- challenge ligado al hash del `deviceId`;
- cada challenge nuevo revoca todos los pending anteriores;
- device distinto se rechaza;
- endpoint para revocar links.

## 10. Evidencias

### Chrome real

`docs/audits/evidence/ai-concierge-extension-linking.json`

- extensión cargada: PASS;
- ID estable: PASS;
- detectada desde web PRAGMA: PASS;
- storage.sync vacío: PASS;
- sin popup: PASS;
- solo device ID persistente: PASS.

### Pairing real extensión → HTTP → PRAGMA

`docs/audits/evidence/ai-concierge-extension-pairing-e2e.json`

- detectada: PASS;
- pairing: PASS;
- link ACTIVE persistido: PASS;
- token efímero: PASS;
- health autenticado HTTP 200: PASS;
- tenant derivado por servidor: PASS;
- modo derivado por PRAGMA: PASS.

### Seguridad y aislamiento BD

`docs/audits/evidence/ai-concierge-native-linking.json`

- pending anterior invalidado: PASS;
- device incorrecto rechazado: PASS;
- token válido autorizado: PASS;
- headers spoof ignorados: PASS;
- token alterado rechazado: PASS;
- sesión revocada rechazada: PASS;
- dashboard tenant-scoped: PASS.

## 11. Pruebas

| Prueba | Resultado |
|---|---|
| Prisma validate/generate | PASS |
| Migraciones configuradas | 77/77 aplicadas |
| Typecheck | PASS |
| Build Next.js | PASS · 112 páginas · rutas Concierge presentes |
| Tests AI Concierge | 26/26 PASS |
| JS extension `node --check` | PASS |
| IDE lints | 0 errores |
| Chrome detect/storage | PASS |
| Pairing end-to-end real | PASS |

## 12. Antes / después

| Comportamiento | Antes | Después |
|---|---|---|
| Configuración | popup técnico | PRAGMA |
| Credencial | secret persistente | sesión 15 min |
| Identidad | header cliente | link server-side |
| Modo | header cliente | tenant config |
| Estado | memoria/popup | BD + panel nativo |
| Canal status | no persistente | heartbeat por canal |
| Auto-send | solo insertaba | inserta y envía |
| Duplicados | fingerprint local | externalMessageId + unique key |
| Revocación | inexistente | inmediata |
| Tools/propiedades | tenant completo | allowlist server-side |

## 13. Regresiones

No se modificaron módulos congelados:

- PMS/Reservas;
- Guest Registration;
- TTLock;
- Inbox AI;
- QR Mobility;
- INTIENDAS;
- Facturación;
- Finanzas certificadas.

Build y suite Concierge permanecen PASS. No existe evidencia de regresión
técnica en los módulos congelados.

## 14. Riesgos residuales

| Riesgo | Nivel | Estado |
|---|---|---|
| Selectores DOM reales WhatsApp | Alto operacional | Requiere LAT humano |
| Selectores DOM reales Airbnb | Alto operacional | Requiere LAT humano |
| Cambio futuro del DOM | Medio | fail-closed + lastError/status |
| Chrome Web Store no publicado | Medio release | pendiente de release |
| Contexto conversacional en memoria | Medio | resumen persistente; estrategia V2 |

## 15. Persistencia de contexto

El store completo de conversación continúa en memoria con cota FIFO. Es
suficiente para validación inicial en un único proceso, pero no garantiza
continuidad de texto después de cold start o entre múltiples instancias.

Para esta versión se persistieron estado, métricas y auditoría, no el contenido
completo del chat. La persistencia integral de conversación permanece como V2.

## 16. Reauditoría

- arquitectura: íntegra;
- inteligencia: permanece en PRAGMA;
- extensión: conector técnico;
- secreto/user/mode manual: eliminados;
- multi-tenant: derivado y revalidado server-side;
- configuración duplicada: eliminada;
- transporte: HTTPS REST reutilizado;
- dependencias nuevas: ninguna;
- módulos congelados modificados: ninguno.

## 17. Certificación

- [x] Auditoría previa
- [x] Diseño de menor impacto
- [x] Implementación
- [x] Typecheck
- [x] Build
- [x] Tests
- [x] Chrome real / pairing real
- [x] Reauditoría de seguridad
- [ ] WhatsApp Web conversación humana real
- [ ] Airbnb Web conversación humana real
- [ ] Capturas live de ambos canales
- [ ] Release/Deploy autorizado

**CERTIFIED / CLOSED:** NO.  
**Motivo único:** falta LAT humana en los dos canales reales.

## 18. Estado final

La integración transparente está implementada y validada localmente. El
administrador ya no configura popup, secret, User ID, Org ID ni modo en Chrome.

El proyecto no puede declararse cerrado ni aprobado para producción hasta
ejecutar:

1. instalar/cargar la extensión una vez;
2. abrir `/ai-concierge`;
3. activar desde PRAGMA;
4. conversación real WhatsApp;
5. conversación real Airbnb;
6. confirmar un único envío, status/heartbeat/logs y cero duplicados.

Hasta entonces:

**NO COMMIT CERTIFICADO · NO TAG · NO RELEASE · NO DEPLOY.**
