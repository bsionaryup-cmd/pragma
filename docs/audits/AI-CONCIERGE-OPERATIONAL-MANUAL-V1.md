# PRAGMA AI Concierge — Manual Operativo (Fase 13)

Para un desarrollador que no conoce el módulo.

---

## Instalación

### Backend (PRAGMA)

```bash
npm install
# Configurar .env.local (ver sección Variables)
npm run dev
```

### Extensión

1. Abrir Chrome → `chrome://extensions`
2. Activar Developer mode
3. Load unpacked → carpeta del repo `extensions/pragma-ai-concierge`
4. Pin la extensión

---

## Variables de entorno

| Variable | Obligatoria | Uso |
|----------|-------------|-----|
| `CONCIERGE_EXTENSION_SECRET` | Sí (para canal) | Bearer de la extensión |
| `DATABASE_URL` | Sí | Tools / PMS |
| `OPENAI_API_KEY` | No para Concierge actual | L3 aún no invocado |
| `RESEND_API_KEY` | Si se usan write tools de email | GR / TTLock email |

Añadir en `.env.local` (nunca commit):

```
CONCIERGE_EXTENSION_SECRET=cambia-este-valor
```

---

## Configuración de la extensión (popup)

| Campo | Valor típico local |
|-------|--------------------|
| API base | `http://127.0.0.1:3000` |
| Secret | mismo que env |
| Org ID | `organizationId` del tenant |
| User ID | id interno `User.id` (scope tools) |
| Mode | `observe` / `manual` / `assisted` / `autonomous` |

Obtener Org/User: DB o UI interna del tenant piloto.

---

## Activación / desactivación

| Acción | Cómo |
|--------|------|
| Activar | Dev server + extensión + Health OK |
| Desactivar | Mode `observe` o Disable extensión |
| Cambiar modo | Popup → Mode → Guardar → refresh chat |
| Verificar | Popup “Probar conexión” o `GET /api/concierge/health` |

---

## Operación diaria

1. Abrir WhatsApp Web o Airbnb en Chrome con la extensión.
2. El panel inferior derecho muestra sugerencias.
3. Mode `manual`/`assisted`: Copiar o Insertar → enviar en el chat.
4. Mode `autonomous`: inserta solo si `mayAutoSend` (FAQs low).
5. Revisar auditorías: Health → `recentToolAudits` / `metrics`.
6. Learning proposals: Health → `learningProposals` (candidatos a nuevas intenciones).

### Endpoints

| Método | Path | Uso |
|--------|------|-----|
| POST | `/api/concierge/channel/ingest` | F7 detect |
| POST | `/api/concierge/channel/turn` | F8–12 compose |
| POST | `/api/concierge/commercial/book` | F11 flujo Direct |
| GET | `/api/concierge/health` | Estado |

Headers: `Authorization: Bearer …`, `x-concierge-user-id`, `x-concierge-org-id?`, `x-concierge-mode?`.

---

## Mantenimiento

### Nueva intención

1. `types/intent.ts` — agregar enum  
2. `intent/library.ts` — plantilla + requiredFacts  
3. `intent/detect.ts` — regla regex  
4. Test en `tests/ai-concierge/`

### Nueva tool

1. Catalog read o write  
2. Handler con Zod + `assert*InScope`  
3. `enabledFromPhase`  
4. Nunca Prisma desde orchestrator

### Nuevo canal

1. Content script + match en `manifest.json`  
2. `ConciergeChannel` type  
3. Misma API turn/ingest

### Problemas frecuentes

| Síntoma | Acción |
|---------|--------|
| 503 secret | Definir `CONCIERGE_EXTENSION_SECRET` |
| 401 | Secret mismatch |
| Panel vacío | DOM no detecta mensaje / no es leader tab |
| OFFLINE | Dev server caído / CORS / API base mal |
| Doble respuesta | Cerrar pestañas extra del mismo WA |

### Scripts de auditoría

```bash
npx tsx --require ./scripts/preload-stub-server-only.cjs scripts/audit-ai-concierge-phase6-read-tools.ts
npx tsx --require ./scripts/preload-stub-server-only.cjs scripts/audit-ai-concierge-phase7-12-local.ts
npx tsx --require ./scripts/preload-stub-server-only.cjs scripts/audit-ai-concierge-phase13-scenarios.ts
npx tsx --test tests/ai-concierge/*.test.ts
npm run typecheck
npm run build
```

---

## Seguridad operativa

- No compartir el extension secret.
- Mode `autonomous` solo tras validar FAQs.
- Reembolsos/descuentos/emergencias siempre escalan.
- No hay acceso Prisma desde el “cerebro”; solo tools.
