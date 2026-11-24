# PRAGMA PMS — Preparación y despliegue a producción

**Fecha:** 2026-11-24  
**Candidato:** `feat/pragma-web-builder` worktree `pragma-pms-web-builder`  
**Prod URL:** https://www.pragmapms.com  
**Neon operativa:** `ep-purple-block-apuk7v1k`  
**Neon staging:** `ep-dawn-union-bebo02dx`

---

## 1. Migraciones aditivas (no destructivas)

| Migration | Cambio |
|-----------|--------|
| `20260824120000_web_site_host_profile` | `tenant_web_sites.hostProfile` JSONB nullable |
| `20261124120000_reservation_guest_tra_fields` | `reservation_guests.cityOfResidence`, `cityOfOrigin`, `travelPurpose` TEXT nullable |

**No hay DROP, TRUNCATE ni ALTER destructivo.**

### Backup / recuperación

1. **Aplicación:** re-alias Vercel al deployment Ready anterior (`pragma-f22ol8t69` u otro listado en `vercel ls --prod`).
2. **Datos:** Neon Point-in-Time Restore sobre `purple-block` (ventana PITR del plan). Antes de `migrate deploy` prod, anotar timestamp UTC.
3. **Forward-only:** si una columna aditiva falla a medias, no hacer down destructivo; reintentar ALTER.

### Procedimiento migrate prod

```bash
# 1) Staging primero
npm run staging:assert
npm run staging:migrate

# 2) Anotar timestamp UTC
# 3) prisma migrate deploy contra purple-block (URL de Vercel / operativa)
# 4) vercel --prod
# 5) Smoke tests
```

---

## 2. Checklist pre-deploy

- [x] Auditoría + plan escritos
- [x] T4/T5 logout via `performFullSignOut`
- [x] T2 banner reliable count + Promise.all swap
- [x] T7/T8 integration health + recovery UI
- [x] T1 stay page + TRA fields + prefill
- [x] T2 donuts + T9 host section + T6 media category
- [x] T3 `/stay` público en proxy
- [x] Staging migrate OK (dawn-union)
- [x] Unit tests relevantes OK (30 pass)
- [x] Prod migrate aditivo (purple-block @ PITR marker 08:42:22Z)
- [x] Vercel prod deploy + smoke → `dpl_7FWqfgxZBMgauRwCfRqKQ6ZWR5Du` aliased www

---

## 3. Smoke post-deploy

1. `GET https://www.pragmapms.com/urbanovaloft` → 200 sin login  
2. `GET https://www.pragmapms.com/stay/invalid` → página “no disponible” (no 500)  
3. Login → Panel: sin banner falso “sin propiedades” si el tenant tiene props  
4. Logout → no acceso Back a dashboard  
5. `/integrations` → sección salud + PriceLabs no “desconectado” si sync OK  
6. Logs Vercel: sin pico 5xx

---

## 4. Rollback app

```bash
npx vercel alias set <previous-deployment-url> www.pragmapms.com
npx vercel alias set <previous-deployment-url> pragmapms.com
```

Columnas aditivas pueden permanecer (compatibles con código anterior si no las lee).
