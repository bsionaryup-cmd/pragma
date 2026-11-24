# ADR-001 — WhatsApp Cloud API como canal de producción

**Estado:** Aceptado  
**Fecha:** 2026-07-31  
**Contexto:** Recepcionista Digital debe atender miles de conversaciones WhatsApp.

## Decisión

Usar **WhatsApp Cloud API (Meta)** como canal de producción, detrás de un adapter `WhatsappProvider`.

Opera CDP / Chrome sobre WhatsApp Web quedan **legacy / lab**, no path SaaS.

Si el onboarding WABA atrasa el piloto, un BSP puede implementar el mismo adapter; la lógica de negocio no vive en el BSP.

## Consecuencias

- Webhook GET verify + POST firmado (`X-Hub-Signature-256`)
- Envío text / template (fuera de ventana 24h)
- Idempotencia por `wamid`
- Credenciales: env de plataforma (+ phone number id); multi-org vía `WHATSAPP_CLOUD_ORGANIZATION_ID` en piloto

## Alternativas rechazadas

| Opción | Motivo de rechazo |
|--------|-------------------|
| WA Web + Playwright/CDP | ToS, ban, SPOF, no multi-tenant |
| Extensión Chrome | Igual + fragilidad DOM |
| Solo BSP sin adapter | Vendor lock en dominio |
