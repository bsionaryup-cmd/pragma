# Informe Final — Deploy Definitivo y Congelamiento del Flujo

Fecha/hora (UTC): **2026-07-16 ~13:36**  
Estado: **DESPLEGADO · SMOKE PASS · FLUJO CONGELADO**

---

## 1. Verificación pre-deploy

| Check | Resultado |
|-------|-----------|
| Rama | `cursor/apify-prospecting-engine` |
| Commit definitivo | `993654b3494edb7d596f9f8a1a565bb067eb5afb` |
| Incluye feat auditado | `8238396` (Direct welcome + admin GR + TTLock code email) |
| Working tree para deploy | **Limpio** vía `git worktree` en `993654b` (sin probes/scripts locales sin auditar) |
| Typecheck | PASS |
| Tests críticos | 22/22 PASS |
| Build | PASS |

Cambios locales no auditados (probes, scripts temp, marketing) **excluidos** del paquete de deploy.

---

## 2. Despliegue

| Campo | Valor |
|-------|-------|
| Commit desplegado | `993654b3494edb7d596f9f8a1a565bb067eb5afb` |
| Deployment ID | `dpl_2NxVDdf7m8q5ekLH3oB5D9v45iRR` |
| URL deployment | https://pragma-7jjvnaebw-pragma-s-projects.vercel.app |
| URL producción | https://www.pragmapms.com |
| Inspect | https://vercel.com/pragma-s-projects/pragma-pms/2NxVDdf7m8q5ekLH3oB5D9v45iRR |
| Estado | **READY** / `status: ok` |
| Archivos subidos | 1576 (worktree limpio) |

---

## 3. Smoke test post-deploy

Evidencia: `docs/audits/evidence/smoke-prod-definitive-deploy.json`  
Reserva: `cmrnjyyj400009gtyk6plzpvn` (801) — cancelada tras la prueba.

| Paso | Resultado |
|------|-----------|
| Crear Reserva Directa de prueba | PASS |
| Correo de bienvenida | PASS — providerId `03d9f064-691e-4f9e-9087-164f7045d247` |
| Anti-dupe bienvenida | PASS — 2º auto skipped |
| Guest Registration COMPLETED | PASS — `2026-07-16T13:36:42.474Z` |
| TTLock **antes** de GR | PASS — bloqueado |
| TTLock **después** de GR | PASS — código `499987#` · credencial `cmrnjz2qp00049gtygilv9wjs` |
| Correo código | PASS — `deliveryStatus` → `SENT` |

**Smoke overall: PASS**

---

## 4. Congelamiento del flujo

A partir de este informe, el siguiente flujo queda **congelado** en producción (`993654b` / alias `www.pragmapms.com`):

1. Reserva Directa → Correo de bienvenida + link GR  
2. Guest Registration COMPLETED → Correo a Contacto Operativo  
3. GR COMPLETED → Generación código TTLock  
4. Código generado → Correo al huésped + Contacto Operativo  

### Qué significa “congelado”

Durante este periodo **no** se modifica:

- Lógica de Reservas Directas  
- Guest Registration  
- TTLock (generación / envío de código)  
- Contactos Operativos  
- Flujo de correos (bienvenida / admin / código)

**Solo** se autorizan cambios si:

1. Se detecta un **bug real** en producción.  
2. Cambia una **integración externa** (Resend, TTLock, Airbnb, etc.).  
3. Surge un **nuevo requisito de negocio** que no pueda resolverse sin tocar este flujo.

Cualquier excepción debe documentarse y re-auditarse antes de un nuevo deploy de este dominio.
