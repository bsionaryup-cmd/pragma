# PRAGMA PMS — Guest Registration Recovery

**Fecha:** 2026-08-11  
**Principio:** Restaurar, no reinventar.  
**Deploy:** no ejecutado en este recorte. El deploy previo (`dpl_4VeNhKk9XS9k22cJv9zKd1kf6G2J`) incluía capas extra que **se revirtieron** en código local.

El incidente **no se declara cerrado** solo porque `https://www.pragmapms.com/guest-registration` abre. Cierre = flujo completo equivalente al pre-regresión.

---

## Objetivo

Restablecer Guest Registration al comportamiento funcional previo a la falla, con el menor cambio posible.

```
Reserva → generar GR → enviar enlace → huésped abre → formulario →
completa datos → persistencia → COMPLETED → automatizaciones existentes
```

---

## 1. Auditoría — qué cambió

| Momento | Enlace Airbnb “Copiar mensaje” |
|---------|--------------------------------|
| Antes de `0995c7f` (2026-07-27) | Token URL vía `buildGuestRegistrationUrl` → `getPublicAppUrl()` → **HTTPS** |
| `0995c7f` | `${window.location.origin}/guest-registration` (entrada universal Airbnb) |
| Falla | Si el staff tenía PMS en `http://`, el mensaje copiado era `http://www.pragmapms.com/guest-registration` → Android `ERR_CLEARTEXT_NOT_PERMITTED` |

Evidencia git: `0995c7f` en `reservation-detail-panel.tsx` sustituyó `url` (SSOT servidor) por `appOrigin = window.location.origin`.

`getPublicAppUrl()` / `buildGuestRegistrationUrl()` **no** se rompieron: email Direct, “Copiar link” con token y `redirect(result.url)` post-código seguían HTTPS.

`?hide_nav=true&platform=android` **no existe en este repo**; lo inyecta el WebView sobre la URL que recibió.

No se tocaron env secrets. SSOT servidor ya canoniza producción a `https://www.pragmapms.com`.

---

## 2. Causa raíz (evidencia)

```
ROOT CAUSE
----------
Commit:  0995c7f (2026-07-27)
Archivo: src/features/reservations/components/reservation-detail-panel.tsx
Función: onClick “Copiar mensaje” (Airbnb)
Cambio:  token URL HTTPS  →  `${window.location.origin}/guest-registration`
Valor defectuoso: http://www.pragmapms.com/guest-registration
Valor esperado:   https://www.pragmapms.com/guest-registration
Flujo:   Airbnb → mensaje WhatsApp → WebView Android
Razón:   Android bloquea cleartext antes del redirect HTTP→HTTPS de Vercel
```

La entrada universal Airbnb (código de reserva, sin token) **se conserva**: era el diseño de `0995c7f` / `178929f`, no la regresión. La regresión es solo el **scheme**.

---

## 3. Fix mínimo (single-root-cause)

**Una sustitución en el punto de la regresión:**

```
`${window.location.origin}/guest-registration`
        ↓
getAirbnbUniversalGuestRegistrationUrl(origin)
        ↓
https://www.pragmapms.com/guest-registration
(localhost http solo en dev)
```

Direct, email, token, `redirect(result.url)`, TTLock, Resend, iCal, Welcome Invite, Prisma, Clerk: **sin cambios de comportamiento**.

### Recorte de lo que reinventía (esta sesión)

El intento previo añadió `canonicalizePublicAppUrl`, redirect relativo, HSTS en `proxy.ts` y wrappers en Stay/occupancy. Eso **no** era el flujo anterior. Se revirtió.

| Conservado (como antes de la falla) | Única diferencia aceptable |
|-------------------------------------|----------------------------|
| Formato token: `{origin}/guest-registration/{token}` | Airbnb WhatsApp: universal **https://www…/guest-registration** (mismo path que 0995c7f, scheme correcto) |
| Direct Welcome Invite | — |
| Airbnb sin Welcome Invite | — |
| Formulario, validaciones, persistencia, COMPLETED | — |
| Comms post-GR: TTLock → recepción → código → tenant | — |
| `redirect(result.url)` tras código Airbnb | — |

---

## 4. Before vs after

| Paso | Antes de 0995c7f / SSOT sano | Con la falla | Tras fix mínimo |
|------|------------------------------|--------------|-----------------|
| Generar GR | `buildGuestRegistrationUrl` | igual | igual |
| Direct email | HTTPS token | HTTPS token | HTTPS token |
| Airbnb copiar mensaje | token HTTPS, luego universal + origin | universal **HTTP** si origin HTTP | universal **HTTPS** |
| Huésped abre | formulario | Android cleartext | HTTPS (link **nuevo**) |
| Completar / persistir / COMPLETED | igual | no llegaba | igual (código intacto) |
| Automatizaciones | igual | no se disparaban | igual (código intacto) |

---

## 5. Tests

| Suite | Resultado |
|-------|-----------|
| `guest-registration-https-url.test.ts` | 6/6 PASS |
| Airbnb universal access / capacity / admin notify / completion comms / canonical guest / occupancy / stay helpers | PASS |
| **Total esta corrida** | **39/39 PASS** |
| Flujo E2E reserva→COMPLETED→TTLock en prod | **no ejecutado aquí** |
| Android dispositivo con link nuevo | **no ejecutado aquí** |

---

## 6. Seguridad

- No `usesCleartextTraffic`.
- GR sigue público.
- No nuevas dependencias.
- Middleware restaurado (sin HSTS/308 extra).

---

## 7. Reauditoría

¿Volvió a funcionar **como antes** y el fix no alteró el producto?

- Generación token / email / Direct invite: **sí, SSOT original**.
- Airbnb universal + código: **sí, diseño 0995c7f**, solo scheme HTTPS.
- Formulario / validaciones / persistencia / TTLock pipeline: **sí, no tocados**.
- Capas extra (canonicalize, HSTS, redirect path): **eliminadas**.

El incidente **no está cerrado** hasta smoke Owner:

1. Calendario → Copiar mensaje (Airbnb) → el texto debe contener `https://www.pragmapms.com/guest-registration` (nunca `http://`).
2. Abrir ese **link nuevo** en Android.
3. Ingresar código → formulario → completar → COMPLETED.
4. Direct: generar/enviar token → abrir → completar → invite + TTLock según reglas actuales.

---

## 8. Scorecard

```
ROOT CAUSE:         PASS  (0995c7f window.location.origin)
FIX:                PASS  (sustitución mínima; capas extra revertidas)
REGRESSION (unit):  PASS  (39/39)
GUEST REGISTRATION: PENDING  (E2E completo = smoke Owner)
ANDROID:            PENDING  (dispositivo, link nuevo https)
SECURITY:           PASS
POST-AUDIT:         PASS  (restore, no reinvent)

READY FOR DEPLOY: YES
DEPLOY:           PENDING APPROVAL

Incidente CERRADO: NO  (falta smoke flujo completo + Android)
```

Producción aún tiene el deploy amplio anterior hasta que se apruebe este recorte.
