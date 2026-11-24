# Auth — Owner en login único (hotfix)

**Fecha:** 2026-07-30  
**Deploy:** `dpl_J4WSnsHjg4TXWDcvWpXTVzvZnoq1` → https://www.pragmapms.com

## Causa raíz

Tras unificar login, el formulario enviaba a `/panel` por defecto. El Owner no es un usuario de tenant: debe ir a `/owner-dashboard` vía `resolvePostAuthHomePathForUser`. El mensaje “acceso exclusivo Owner” era del formulario legacy `OwnerLoginForm`, ya no usado.

## Fix

- `/post-login` resuelve el home por rol (Owner → owner-dashboard; Admin/Receptionist → panel).
- Misma UI de `EmailPasswordSignInForm` (correo + contraseña).
- Sin gate “Owner no puede / solo Owner”.

## Prueba

1. https://www.pragmapms.com/login  
2. Entrar con correo Owner + contraseña  
3. Debe aterrizar en `/owner-dashboard`
