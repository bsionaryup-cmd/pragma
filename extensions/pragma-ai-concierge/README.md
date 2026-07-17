# PRAGMA AI Concierge — Extensión (canal)

## Carga local (Chrome)

1. Abrir `chrome://extensions`
2. Activar “Developer mode”
3. “Load unpacked” → carpeta `extensions/pragma-ai-concierge`
4. Configurar popup: API `http://127.0.0.1:3000`, secret = `CONCIERGE_EXTENSION_SECRET`, org/user IDs del tenant
5. Abrir WhatsApp Web o Airbnb Web con `npm run dev` corriendo

## Modos

| Mode | Fase | Comportamiento |
|------|------|----------------|
| observe | 7 | Solo ingest; sin sugerencia |
| manual | 8 | Sugiere; humano copia/inserta/envía |
| assisted | 9 | Sugiere; `autoEligible` en FAQs low |
| autonomous | 12 | Inserta texto si `mayAutoSend` |

La extensión **nunca** decide negocio: solo transporta mensajes y muestra/inserta lo que PRAGMA responde.
