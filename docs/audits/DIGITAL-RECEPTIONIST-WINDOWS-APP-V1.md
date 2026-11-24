# Digital Receptionist — App Windows (no-regresión)

**Fecha:** 2026-07-30  
**Alcance:** `desktop/pragma-recepcionista-app` + Owner SUPERVISED/canales/descarga  
**Deploy:** Ver `DIGITAL-RECEPTIONIST-WINDOWS-APP-PREDEPLOY-AUDIT.md` (HOLD)

## Qué se añadió

| Pieza | Rol |
|-------|-----|
| Electron app | Launcher Encender/Apagar + BrowserView Airbnb + poll runtime |
| Owner UI | Checklist, mint token, canales, Encender=SUPERVISED, autónomo opcional |
| Download | `NEXT_PUBLIC_RECEPCIONISTA_APP_DOWNLOAD_URL` o path local del portable |
| Runtime / brain | Sin cambios de contrato de plan |

## Gates de envío

1. Owner kill / OFF → `canPerceive` false  
2. Encender → SUPERVISED → `canSend` false (borrador)  
3. App `autoSend=false` por defecto  
4. Autónomo + autoSend + ledger fingerprint → send  

## Cómo probar (SUPERVISED)

1. Owner: canal Airbnb ON, Encender (SUPERVISED), mint token  
2. Abrir `dist/PRAGMA-Recepcionista-1.0.0-portable.exe`  
3. Config + login Airbnb + hilo con mensaje entrante  
4. Ejecutar ahora → panel borrador; sin envío automático  
