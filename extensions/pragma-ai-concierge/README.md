# PRAGMA AI Concierge — conector Chrome

La extensión no es una aplicación y no tiene configuración operativa. No
almacena secreto, usuario, organización, modo ni API base de forma persistente.

## Primera instalación

### Producción

Instalar desde Chrome Web Store. El ID público de la extensión se configura en
PRAGMA mediante `NEXT_PUBLIC_CONCIERGE_EXTENSION_ID`.

### Desarrollo local

1. Chrome → Extensiones → Modo desarrollador.
2. Cargar descomprimida → `extensions/pragma-ai-concierge`.
3. El manifest fija el ID de desarrollo
   `hpghhdnpbibmimbdlgpbkhpfdijabekg`; PRAGMA lo toma de
   `NEXT_PUBLIC_CONCIERGE_EXTENSION_ID`.
4. Reiniciar PRAGMA.

## Vinculación

1. Iniciar sesión en PRAGMA.
2. Abrir `/ai-concierge`.
3. Presionar **Reconectar extensión** (la primera apertura también intenta
   detectar y vincular automáticamente).

PRAGMA crea un challenge de un solo uso. La extensión conserva:

- `deviceId` no secreto en `chrome.storage.local`;
- sesión corta en `chrome.storage.session`;
- heartbeat/leader lease técnicos.

No existe popup.

## Operación

Modo, canales, propiedades, LLM, auditor y activación se administran únicamente
desde PRAGMA. La extensión:

- detecta mensajes entrantes;
- envía eventos por HTTPS REST;
- recibe decisiones;
- envía una respuesta solo si PRAGMA devuelve `mayAutoSend=true`;
- reporta heartbeat, versión, canal y último error.

Si PRAGMA no está vinculado, la sesión expira o el link es revocado, falla
cerrada y no responde.
