# Fix: `/login` 404 al abrir Urbanova (2026-11-23)

## Hallazgo

- `https://www.pragmapms.com/urbanovaloft` ya respondía **200** (sitio público PUBLISHED).
- Apex `pragmapms.com` → 307 → `www` (correcto).
- `https://www.pragmapms.com/login?redirect_url=%2Furbanovaloft` devolvía **404** con `X-Clerk-Auth-Reason: protect-rewrite` porque:
  1. No existía ruta `/login` (canónica: `/sign-in`).
  2. `auth.protect()` de Clerk reescribía a `/login` en lugar de la app.

## Corrección (`11647d1`)

- Alias `src/app/(auth)/login/[[...rest]]/page.tsx` → redirect a `/sign-in?next=…` (soporta `redirect_url`).
- `proxy.ts`: `/login(.*)` público; unauthenticated → redirect explícito a `/sign-in` (sin `auth.protect()`).
- Soft-fail AES-GCM en `decryptTTLockSecret` (evita tumbar `/panel`).
- Tests acceptance alineados a piloto **PUBLISHED**.

## Smoke post-deploy

| Check | Resultado |
| --- | --- |
| www `/urbanovaloft` | 200 |
| apex → www `/urbanovaloft` | 307 → 200 |
| `/login?redirect_url=/urbanovaloft` | 307 → `/sign-in?next=/urbanovaloft` → 200 |
| availability API | 200 ok |
