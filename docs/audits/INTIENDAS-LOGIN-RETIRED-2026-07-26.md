# INTIENDAS login retired — solo PMS + Owner (2026-07-26)

## Problema

Tras login, algunos tenants caían en `/intiendas/*` porque existía lógica “retail-only org → POS”. El producto INTIENDAS ya no está activo; solo deben existir:

- `/sign-in` — tenants PMS
- `/owner-login` — platform owner

## Cambios

| Capa | Comportamiento |
|------|----------------|
| `src/proxy.ts` | `/intiendas/login*` → `/sign-in`; resto `/intiendas/*` → `/panel`; `/owner-dashboard/intiendas*` → owner home |
| `platform-dashboard-guards.tsx` | Eliminado redirect a `/intiendas/dashboard` |
| Impersonate API | Siempre `/panel` |
| Páginas login/recuperar INTIENDAS | `redirect("/sign-in")` / forgot-password |
| Layout POS INTIENDAS | `redirect("/panel")` |
| Owner admin INTIENDAS | redirect a owner dashboard |
| `sanitizeAuthRedirectPath` | Rechaza targets `/intiendas*` |

## Logins válidos

1. Tenant: https://www.pragmapms.com/sign-in → `/panel`
2. Owner: https://www.pragmapms.com/owner-login → `/owner-dashboard`
