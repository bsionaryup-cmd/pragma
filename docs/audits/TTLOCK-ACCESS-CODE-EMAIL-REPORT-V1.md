# Informe — Envío automático del código TTLock por correo

Fecha: 2026-07-16  
Estado: **IMPLEMENTADO Y VALIDADO**  
Auditoría previa: `docs/audits/TTLOCK-ACCESS-CODE-EMAIL-AUDIT-V1.md`

---

## Arquitectura

| Pieza | Reutilización |
|-------|---------------|
| Transporte | `sendEmail` / Resend |
| Branding | `brand-email.ts` |
| Contenido | Mensaje existente `buildAccessCodeGuestMessage` con `codeStyle: "plain"` |
| Destinatarios | Huésped (`guestEmail`) + Contacto Operativo (`resolveGuestRegistrationAdminRecipients`) |
| Gate | `TTLockAutomationSettings.autoSendCode` |
| Anti-duplicados | `AccessCredential.deliveryStatus` (`NOT_SENT`/`FAILED` → `PENDING` → `SENT`) |
| Trigger | Tras generación/restauración exitosa en `ttlock-access.service.ts` |

**No** se creó un segundo pipeline ni se alteró Guest Registration / QR / INTIENDAS / Airbnb inbound.

### Código visible

- WhatsApp/clipboard: sigue usando `**12345#**` (markdown).
- Correo: **`12345#` tal cual**, sin asteriscos markdown ni negrita confusa.

---

## Archivos

| Archivo | Rol |
|---------|-----|
| `src/services/integrations/ttlock/ttlock-access-code-email.service.ts` | **Nuevo** — envío + claim |
| `src/services/integrations/ttlock/ttlock-access.service.ts` | Schedule tras éxito |
| `src/lib/access-code-guest-message.ts` | Opción `codeStyle: "plain"` |
| `tests/access/access-code-guest-message.test.ts` | Tests plain vs markdown |

---

## Validación real (Margarita / Loft 801)

| Campo | Valor |
|-------|-------|
| Credencial | `cmrm2821q000304jmuq2x5rfu` |
| Huésped | `magvillafuerte@gmail.com` → providerId `5c2bce5f-7a5e-47c9-a0f1-2575c64f0c71` |
| Contacto Operativo | `bsionaryup@gmail.com` → providerId `97be5496-9685-4c74-9c65-46b6dd687ff0` |
| From | `PRAGMA PMS <noreply@pragmapms.com>` |
| Subject | `Tu código de acceso — 801 — Loft moderno…` |
| Resend last_event (huésped) | **delivered** |
| Reintento | `skipped: true` — “El código ya fue enviado” |
| `autoSendCode` | Habilitado en la integración TTLock de la propiedad |

---

## Auditoría posterior

| Check | Resultado |
|-------|-----------|
| Typecheck | OK |
| Tests mensaje acceso | 2/2 OK |
| Duplicación de lógica de correo | No |
| Impacto QR / INTIENDAS / Facturación / SIRE / TRA | Ninguno |
| Multi-tenant | Intacta (settings por integración TTLock) |

---

## Criterio de aceptación

| Criterio | Cumple |
|----------|--------|
| Envío automático al huésped | Sí (con `autoSendCode`) |
| Mismo correo al Contacto Operativo | Sí |
| Código sin `**…**` | Sí |
| Sin duplicados | Sí |
| Infra existente reutilizada | Sí |
| Sin regresiones de dominio | Sí |

### Nota operativa

El envío automático queda gobernado por **Integraciones → TTLock → “Enviar código automáticamente”** (`autoSendCode`). Debe permanecer activo en las integraciones donde se desee este comportamiento.
