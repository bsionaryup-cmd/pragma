# Digital Receptionist — Windows App · Pre-deploy audit

**Fecha:** 2026-07-30  
**Deploy:** **NO ejecutado** — pendiente aprobación explícita del owner  
**Alcance:** App Electron + Owner power/canales/descarga + Encender SUPERVISED

---

## Verdict

Listo para **probar en SUPERVISED** con el portable local.  
**No listo** para botón “Descargar” en producción hasta publicar el `.exe` en un host externo y setear `NEXT_PUBLIC_RECEPCIONISTA_APP_DOWNLOAD_URL`.

---

## Qué se implementó (additive)

| Cambio | Detalle |
|--------|---------|
| Encender | `SUPERVISED` + kill OFF (Loft aplica factory + Airbnb ON) |
| Modo autónomo | `POST …/power` action `autonomous` → `AUTONOMOUS` + `canSend` |
| `isPoweredOn` | SUPERVISED **o** AUTONOMOUS con kill OFF |
| Owner UI | Checklist, Org ID, canales Airbnb/WA, mint token, download si hay URL |
| App launcher | Copy de primer uso; `autoSend=false` sin cambios |
| Env | `NEXT_PUBLIC_RECEPCIONISTA_APP_DOWNLOAD_URL` en `.env.example` |

## Artefacto local

| Campo | Valor |
|-------|--------|
| Path | `desktop/pragma-recepcionista-app/dist/PRAGMA-Recepcionista-1.0.0-portable.exe` |
| SHA256 | `C18C8801649734616981CD73421A5ED44D0F5A39DEDC4DD9AB4CF6F513FC8FAF` |
| Plataforma | Windows x64 only (no Android/iPad; no app nativa Airbnb) |

## Flujo de prueba segura (recomendado)

1. Copiar portable al PC/tablet Windows.  
2. Owner: **Generar token** → Encender (SUPERVISED) → Canal Airbnb ON → Guardar.  
3. App: Base URL `https://www.pragmapms.com` + Org + token → login host → hilo → Ejecutar ahora.  
4. Esperado: borrador en panel; **sin** envío.  
5. Solo después: Modo autónomo + checkbox Auto-enviar en app.

## No tocado

- TTLock, GR, iCal, airbnb-email, billing  
- `desktop/recepcionista-digital` (WhatsApp Opera)  
- Decision/Context/Skills (contrato runtime)

## Riesgos residuales

| Riesgo | Mitigación |
|--------|------------|
| DOM Airbnb frágil | SUPERVISED + draft-only |
| SmartScreen (exe sin firmar) | “Ejecutar de todas formas” / firma futura |
| Autónomo + autoSend | Doble gate Owner + app |
| Exe no en Vercel `public/` | ~73MB; host externo obligatorio |

## Checklist pre-deploy (Owner UI a prod)

- [x] Tests RD (incl. Loft SUPERVISED)  
- [x] Power API `on` / `off` / `autonomous`  
- [ ] Publicar exe (Release/R2/Blob) + env URL en Vercel  
- [ ] Aprobación owner para `npx vercel --prod`  
- [ ] Smoke SUPERVISED en prod tras deploy  

## Decisión deploy

**HOLD** hasta: (1) aprobación owner, (2) opcionalmente URL de descarga publicada.
