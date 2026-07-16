# Auditoría Final — Flujo Guest Registration + Direct + TTLock

Fecha: **2026-07-16** (UTC)  
Estado: **APROBADA — LISTA PARA DEPLOY**  
Evidencia E2E: `docs/audits/evidence/full-gr-direct-ttlock-flow-evidence.json`  
Evidencia Resend: `docs/audits/evidence/full-flow-resend-summaries.json`  
HTML: `full-flow-welcome-email.html`, `full-flow-admin-email.html`, `full-flow-access-code-email.html`

Reserva de prueba: `cmrnguwf20004k0ty1hid4zk5` (propiedad 801 / Margarita) — cancelada tras la prueba.

---

## Fase 1 — Arquitectura

| Verificación | Resultado |
|--------------|-----------|
| Un solo transporte saliente | Sí — `src/lib/email/send-email.ts` → Resend REST |
| Sin SDK Resend / nodemailer paralelo | Confirmado (grep) |
| Branding PRAGMA | `pragmaEmailHeaderHtml` / footer en invite, admin y código |
| Guest Registration | Reutilizado (`ensure` + `complete`) |
| Contactos Operativos | `resolveGuestRegistrationAdminRecipients` |
| Historial / anti-duplicados | Invite log, admin log, `AccessCredential.deliveryStatus` |
| Dependencias circulares nuevas | No detectadas |
| Impacto QR Mobility / INTIENDAS | Ninguno (sin imports cruzados) |

**Conclusión Fase 1:** sin pipelines nuevos ni duplicación de transporte.

---

## Fase 2 — Reserva Directa + bienvenida

| Check | Evidencia |
|-------|-----------|
| Direct creada/confirmada | `cmrnguwf20004k0ty1hid4zk5` |
| Bienvenida auto | providerId `0631694f-3264-491b-a10b-eee66e596645` |
| Link GR | `/guest-registration/06c96c2d…` en HTML |
| Historial success | `guestRegistrationInviteLog` |
| Anti-dupe | 2º envío → `skipped: Correo de bienvenida ya enviado` |
| Resend | `last_event: delivered`, From institucional |

---

## Fase 3 — Guest Registration

| Check | Evidencia |
|-------|-----------|
| Titular | FullFlow Titular-68429DEF |
| Acompañante | FullFlow Acomp-68429DEF |
| COMPLETED | `guestRegistrationCompletedAt` 2026-07-16T12:09:35.474Z |
| Guests | 2 × REGISTERED |

---

## Fase 4 — Correo administración

| Check | Evidencia |
|-------|-----------|
| Auto | Sí, tras COMPLETED |
| Contacto Operativo | `bsionaryup@gmail.com` (`source: operational-contact`, key `administracion`) |
| Branding | `pragmaBrand: true` |
| Historial | status `success` |
| ProviderId | `d1c3c86f-04c3-4451-993e-7fbfd4303d96` |
| Resend | `last_event: delivered` |

---

## Fase 5 — TTLock (orden)

| Check | Evidencia |
|-------|-----------|
| Bloqueo antes de GR | `tryGenerate` → `null`; `generate` → *"aún no completó el registro"*; 0 credenciales |
| Generación solo post-GR | Credencial `cmrngv1pa0009k0tyr4mjdshk` tras COMPLETED |
| Código | `484300#` (sin `**…**`) |
| Valor original | Formato plain; email HTML contiene `484300` sin markdown bold |

---

## Fase 6 — Correo con código

| Destinatario | ProviderId | last_event |
|--------------|------------|------------|
| Huésped `magvillafuerte@gmail.com` | `4a39231d-3c69-4622-99e5-3558268efa41` | delivered |
| Ops `bsionaryup@gmail.com` | `19cdba6c-72e6-45d6-a0c7-b01db3b4f8b5` | delivered |

- Branding: OK  
- Código en HTML: `484300`  
- `deliveryStatus: SENT`  
- Reintento: `skipped — El código ya fue enviado`

---

## Fase 7 — Casos negativos

| Caso | Resultado |
|------|-----------|
| 7.1 Direct sin correo | No envía — *"no tiene email de huésped válido"* |
| 7.2 Airbnb | Skip — *"solo para reservas directas"* |
| 7.3 GR incompleto | Sin código / sin correo código |
| 7.4 Generar antes de GR | Impedido (mensaje explícito) |
| 7.5 Reintentos | Bienvenida y código: idempotentes |

---

## Fase 8 — Auditoría global

| Check | Resultado |
|-------|-----------|
| Migraciones | Up to date (75/75) |
| Typecheck | OK |
| Tests relevantes | 22/22 pass (invite log, admin notify, ops contacts, access message, send-email) |
| Build (`npm run build`) | OK |
| PMS / GR / Ops contacts | Intactos y ejercitados |
| Inbox Airbnb / Facturación / QR / INTIENDAS | Sin cambios de dominio en este flujo |
| Multi-tenant | Scope por propiedad/reserva preservado |

### Componentes modificados en esta auditoría

**Ninguno.** Solo se añadieron scripts/evidencias de auditoría (`scripts/audit-full-gr-direct-ttlock-flow.ts`, `scripts/fetch-full-flow-resend-evidence.ts`, docs/evidence).

### Riesgos

| Riesgo | Severidad | Estado |
|--------|-----------|--------|
| Código auditado aún **no committed** en git (`HEAD` = `458003a` INTIENDAS) | Alta para trazabilidad de deploy | Ver sección Deploy |
| `ttlockCodeId` null en credencial de prueba | Baja (código y envío OK) | Observación; no bloquea |

---

## Orden del flujo (validado)

1. Reserva Directa → Correo bienvenida ✅  
2. Guest Registration COMPLETED → Correo administración ✅  
3. GR COMPLETED → Generación código TTLock ✅  
4. Código generado → Correo a huésped + Contacto Operativo ✅  
5. Nunca código/email TTLock antes de GR ✅  
6. Airbnb no dispara bienvenida auto ✅  

---

## Conclusión técnica

**Auditoría integral SATISFACTORIA.** No se detectaron defectos que requieran cambio de código. El flujo cumple el criterio de aceptación.

---

## Autorización de Deploy

Criterios de producto/flujo: **cumplidos**.

### Condición de trazabilidad (bloqueante operativo)

El working tree local contiene el código auditado **sin commit**. Un deploy a producción debe:

1. **Committear** el conjunto auditado (GR invite, admin notify, ops contacts, TTLock access-code email, migraciones, tests).
2. Desplegar esa revisión.
3. Registrar commit SHA + URL de deployment.

Hasta ese commit, **no se ejecuta el deploy** en esta pasada para no violar “versión en producción = versión auditada” con un SHA reproducible.

**Acción siguiente recomendada (autorizada por este documento una vez exista el commit):** `vercel deploy --prod` (o el pipeline estándar del repo) desde la revisión certificada, con migraciones ya aplicadas en Neon.
