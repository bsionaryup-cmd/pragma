# Digital Receptionist — Deploy + prueba Airbnb (auto)

**Fecha:** 2026-07-30  
**Deploy:** `dpl_7gk2tDdkgn8QNbkZdzrETbq6YmkR` → https://www.pragmapms.com  
**Estado:** READY · migraciones OK · tests RD 15/15

## Pre-flight

| Check | Resultado |
|-------|-----------|
| Conflict markers | Ninguno |
| `prisma migrate deploy` | No pending |
| Tests RD | Pass |
| Exe local | Presente; Auto-enviar default ON en source |
| `.vercelignore` | `desktop/` + `extensions/` (no upload 73MB) |
| Smoke `/` | Verificar post-deploy |
| Smoke `/revenue` | Redirect a sign-in (no 404 protect) |

## Comportamiento prod

- Encender = **AUTÓNOMO** (`canSend=true`)
- Modo supervisado = solo borrador
- App: Auto-enviar ON + hilo abierto → claim + send en WebView Airbnb

## Prueba manual (tú)

1. Owner → Recepcionista → Generar token → **Encender (AUTÓNOMO)** → Airbnb ON  
2. Abrir portable / `npm start` → pegar URL/org/token → **Auto-enviar** marcado → Guardar  
3. Login **host** en WebView → abrir inbox con el hilo  
4. Desde otra cuenta/huésped: escribir consulta simple (wifi, check-in, parking)  
5. En la app: Encender o Esperar poll (~12s) / Ejecutar ahora  
6. Esperado: respuesta enviada en el hilo Airbnb  

**Apagar** en Owner corta envíos al instante.

## Limitaciones

- No es la app móvil nativa; es inbox web en PRAGMA.  
- El agente solo ve el hilo **abierto** en el WebView.  
- Yo (agente Cursor) no puedo autenticarme en Airbnb por ti.
