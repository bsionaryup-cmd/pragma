# Auditoría de Paridad Localhost ↔ Producción — 2026-07-27

## Veredicto

**Producción ya refleja exactamente el código aprobado de localhost.**

| Capa | Localhost | Producción | Paridad |
|------|-----------|------------|---------|
| Git HEAD | `f77bf18` | Deploy `dpl_GVM5ZXrx8gFcnDdLKCzufK53jiva` desde misma tip | ✅ |
| Branch remote | `origin/cursor/apify-prospecting-engine` = `f77bf18` | Alias `www.pragmapms.com` | ✅ |
| Working tree `src/` / `prisma/` | Limpio (0 diffs) | N/A | ✅ |
| Stay Portal | Operativo | Operativo | ✅ |
| TTLock decrypt + códigos visibles (DB/DTO) | OK | Misma DB Neon + mismo código | ✅ |
| GR→TTLock assert | OK | Misma base | ✅ |

**No se requiere commit ni deploy adicional** para alcanzar paridad funcional aprobada.

---

## FASE 1–3 — Evidencia de paridad

### Git / Deploy

```
HEAD local:  f77bf181a5751e5028a6a703c41834b3b80fa605
origin tip:  f77bf181a5751e5028a6a703c41834b3b80fa605
Prod deploy: dpl_GVM5ZXrx8gFcnDdLKCzufK53jiva (Ready)
             https://pragma-3l0iufawb-pragma-s-projects.vercel.app
             aliased → www.pragmapms.com
```

Ancestros críticos ya en producción:

| Commit | Contenido | En prod tip |
|--------|-----------|-------------|
| `0995c7f` | GR/TTLock UI visibility + emails restore | ✅ ancestor |
| `a4152c7` | Soft-fail TTLock decrypt en /panel | ✅ ancestor |
| `bb9d048` | Auth redirect-loop fix | ✅ ancestor |
| `f77bf18` | Guest Stay Portal | ✅ HEAD = prod |

### Working tree (no-código)

Solo untracked (documentación/evidencia/scripts locales), **no funcionalidad**:

- `docs/audits/STAY-PORTAL-DEPLOY-REPORT-2026-07-27.md`
- `docs/audits/evidence/*` (stay-portal + auth)
- `scripts/_evidence-stay-portal-*.ts`

**Clasificación:** P3 docs — justificado **no** desplegar.

### HTTP público — campo a campo (Stay Portal)

Token real `ed2bad77739fc2b2f3bc9e7ca0a95f3f9d3607f31be7dd22`:

| Campo | Local | Prod | Paridad |
|-------|-------|------|---------|
| Mi estadía | ✅ | ✅ | ✅ |
| WiFi / SOMOSAPTO | ✅ | ✅ | ✅ |
| Código de acceso | ✅ | ✅ | ✅ |
| Dirección / Laureles | ✅ | ✅ | ✅ |
| Check-in | ✅ | ✅ | ✅ |
| Contacto | ✅ | ✅ | ✅ |
| Runtime Error | No | No | ✅ |
| Token falso → "Portal no disponible" | ✅ | ✅ | ✅ |

Rutas públicas (`/stay`, `/sign-in`, `/guest-registration`): **200 ambos lados**, sin TypeError.

### TTLock (P0 histórico)

Códigos visibles vía SSOT `accessCredentials` (misma Neon):

| Reserva | Status | Código | ttlockCodeId | Vigencia |
|---------|--------|--------|--------------|----------|
| German Oviedo | SENT | 860162# | 98041910 | ✅ |
| Angie Suarez | SENT | 976796# | 98041876 | ✅ |
| … | … | … | … | ✅ |

UI `AccessCodeDisplay` (ojo/copiar/vigencia) está en `0995c7f`, ancestro de prod.

`gr-ttlock-flow assert OK`.

> Nota: `docs/audits/GR-TTLOCK-UI-EMAILS-RESTORE-2026-07-27.md` aún dice “Pendiente Deploy”. Eso es **documentación desactualizada**, no un gap de código. El restore ya está en producción vía `0995c7f`+.

---

## FASE 4 — Clasificación de diferencias

| ID | Diferencia | Clase | Acción |
|----|------------|-------|--------|
| D1 | Untracked docs/evidence/scripts | P3 | No deploy (correcto) |
| D2 | Doc GR-TTLOCK dice “pendiente deploy” | P3 docs | Actualizar doc en commit docs futuro (opcional) |
| D3 | Código fuente localhost ≠ prod | — | **No existe** |
| D4 | Stay Portal ausente en prod | — | **Resuelto** (`f77bf18`) |
| D5 | TTLock UI ausente en prod | — | **No existe** (en `0995c7f`) |

**P0/P1 abiertos: 0.**

---

## FASE 5–6 — Implementación

**No aplica.** No hay diferencias funcionales aprobadas pendientes.

---

## FASE 7–9 — Validación / E2E / no regresión

| Prueba | Resultado |
|--------|-----------|
| Source tree limpio (`src/`, `prisma/`) | ✅ |
| Stay Portal local vs prod (campos) | ✅ 8/8 |
| Stay Portal seguridad (token falso) | ✅ ambos |
| GR→TTLock flow assert | ✅ |
| Stay portal unit tests | ✅ 2/2 |
| Access credentials decrypt + vigencia | ✅ ≥6 reservas |
| Auth pages `/sign-in` | ✅ 200 ambos |

Sistemas congelados: sin cambios de código en esta auditoría → sin regresión introducida.

---

## FASE 10–12 — Commit / Migración / Deploy

| Paso | Decisión |
|------|----------|
| Commit | **No** — sin cambios de código |
| Migración | **No** — `stay_portal_tokens` ya aplicada |
| Deploy | **No** — prod = tip aprobada `f77bf18` |

---

## FASE 13 — Smoke (confirmación post-auditoría)

| Endpoint prod | Resultado |
|---------------|-----------|
| `GET /stay` | 200 |
| `GET /stay/[token]` | 200 + WiFi + código + dirección + contacto |
| `GET /stay/[fake]` | 200 + “Portal no disponible”, sin PII |
| `GET /sign-in` | 200 |
| Deploy Ready | `dpl_GVM5ZXrx8gFcnDdLKCzufK53jiva` |

---

## Criterios de éxito

| Criterio | Estado |
|----------|--------|
| Paridad funcional aprobada localhost ↔ prod | ✅ |
| Código TTLock visible (DTO/DB + UI en tip) | ✅ |
| Sin diferencias funcionales no justificadas | ✅ |
| Sin regresiones introducidas | ✅ |
| Sin alterar congelados | ✅ |
| Pendientes documentados y justificados | ✅ (solo P3 docs) |

---

## Conclusión

La paridad **ya está alcanzada**. Localhost y producción corren el mismo commit (`f77bf18`) con la misma base Neon. Stay Portal, Guest Registration, TTLock (códigos + vigencia) y auth están alineados. No hay deploy adicional seguro ni necesario.
