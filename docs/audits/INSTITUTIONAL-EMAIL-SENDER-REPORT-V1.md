# Informe Final — Estandarización del Remitente Institucional

## PRAGMA PMS

Fecha: 2026-07-16  
Estado: **COMPLETADO EN CÓDIGO** (infraestructura Resend pendiente de API key / dominio verificado)  
Auditoría previa: `docs/audits/INSTITUTIONAL-EMAIL-SENDER-AUDIT-V1.md`

---

## Remitente institucional

| Campo | Valor |
|-------|-------|
| Nombre | **PRAGMA PMS** |
| Correo | **noreply@pragmapms.com** |
| Formato Resend | `PRAGMA PMS <noreply@pragmapms.com>` |

Constante de código: `INSTITUTIONAL_EMAIL_FROM` en `src/lib/email/send-email.ts`.

---

## Análisis de impacto (Fase 2)

| Pregunta | Respuesta |
|----------|-----------|
| Riesgo arquitectónico | **Ninguno** — un solo `from` vía `sendEmail()` |
| Variables a modificar | `EMAIL_FROM` (env) + fallback en código |
| Nueva variable | No requerida |
| Dependencias externas | Resend debe autorizar `noreply@pragmapms.com` en dominio verificado |

Separación clara:

- **Remitente saliente:** `EMAIL_FROM` / `INSTITUTIONAL_EMAIL_FROM`
- **Contacto de facturación (no es From):** `PRAGMA_BILLING_EMAIL` (comprobantes / soporte de cobro)

---

## Archivos modificados

| Archivo | Cambio |
|---------|--------|
| `src/lib/email/send-email.ts` | Remitente institucional único; deja de usar `PRAGMA_BILLING_EMAIL` como From |
| `.env.example` | Documenta `EMAIL_FROM` y `PRAGMA_BILLING_EMAIL` separados |
| `.env` / `.env.local` | `EMAIL_FROM="PRAGMA PMS <noreply@pragmapms.com>"` |
| `tests/billing/send-email.test.ts` | Expectativas alineadas al nuevo fallback |
| `scripts/audit-resend-infrastructure.mjs` | Misma resolución de From |
| `src/modules/billing/domain/bank-transfer.ts` | Fallback contacto → `facturacion@pragmapms.com` |
| `src/modules/billing/services/billing-invoice-document.service.ts` | Placeholder → `cliente@pragmapms.com` |
| `src/features/billing/components/billing-dashboard.tsx` | Mailto soporte → `soporte@pragmapms.com` |

## Archivos revisados sin cambio funcional

- Guest Registration (admin + huésped) — usan `sendEmail()` → heredan From
- Billing receipt email — mismo
- Auth / password reset / invitaciones — Clerk (fuera de `sendEmail`)
- Inbound Airbnb — no es remitente saliente

---

## Referencias eliminadas

| Antes | Después |
|-------|---------|
| `PRAGMA Facturación <facturacion@pragma.co>` | `PRAGMA PMS <noreply@pragmapms.com>` |
| Fallback From vía `PRAGMA_BILLING_EMAIL` | Eliminado del remitente |
| `facturacion@pragma.co` (contacto banco) | `facturacion@pragmapms.com` |
| `cliente@pragma.co` | `cliente@pragmapms.com` |
| `soporte@pragma.co` | `soporte@pragmapms.com` |

**Búsqueda en código activo (`*.ts/tsx/mjs/example`):** cero coincidencias de `pragma.co`.

---

## Variables de entorno (estado)

| Variable | Rol | Valor esperado |
|----------|-----|----------------|
| `EMAIL_FROM` | Remitente saliente | `PRAGMA PMS <noreply@pragmapms.com>` |
| `PRAGMA_BILLING_EMAIL` | Contacto cobros (no From) | `facturacion@pragmapms.com` |
| `RESEND_API_KEY` | Proveedor | Debe ser válida (actualmente inválida en local) |

---

## Resultados de pruebas (Fase 5)

| Prueba | Resultado |
|--------|-----------|
| Typecheck | OK |
| Build | OK |
| Tests email + GR + operational contacts | **19/19 OK** |
| Log simulado | `from: 'PRAGMA PMS <noreply@pragmapms.com>'` |

---

## Infraestructura Resend (Fase 6)

| Check | Resultado |
|-------|-----------|
| `EMAIL_FROM` alineado | OK |
| Dominio `pragmapms.com` en Resend | **No verificable** — API key inválida |
| `noreply@pragmapms.com` autorizado | **Pendiente** de verificación en dashboard Resend |

**Sin soluciones temporales.** El código queda listo; el envío real requiere:

1. `RESEND_API_KEY` válida
2. Dominio `pragmapms.com` verificado en Resend
3. Remitente `noreply@pragmapms.com` permitido en ese dominio

---

## Riesgos

| Riesgo | Mitigación |
|--------|------------|
| Resend rechaza From no verificado | Código correcto; bloquear deploy hasta dominio/key OK |
| Confundir contacto de facturación con From | Documentado; variables separadas |
| Override accidental de `EMAIL_FROM` | Override permitido; fallback institucional siempre `noreply@pragmapms.com` |

---

## Auditoría posterior (Fase 7)

| Criterio | Cumple |
|----------|--------|
| Un único remitente institucional | Sí |
| Sin referencias activas a `pragma.co` | Sí |
| Sin duplicar pipelines | Sí |
| Sin cambios a flujos GR / Facturación / integraciones | Sí |
| Arquitectura consistente | Sí |
| Multi-tenant intacto | Sí |

---

## Criterios de aceptación

| Criterio | Estado |
|----------|--------|
| Remitente único PRAGMA PMS \<noreply@pragmapms.com\> | **Cumple** |
| Sin remitentes antiguos activos | **Cumple** |
| Sin regresiones / typecheck / build / tests | **Cumple** |
| Preparado para API key + dominio verificado | **Cumple** |
| Dominio/key Resend validados en vivo | **Pendiente infraestructura** |

---

## Veredicto

**Estandarización de código: COMPLETADA.**

**Operación productiva de correo: BLOQUEADA** solo por infraestructura Resend (API key inválida / dominio no verificado en esta sesión). No se requiere más cambio de aplicación para el remitente.
