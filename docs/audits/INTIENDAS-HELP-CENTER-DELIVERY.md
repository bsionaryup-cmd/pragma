# INTIENDAS — Centro de Ayuda + Manual PDF + Contraseñas

**Fecha:** 2026-07-14  
**Versión producto/manual:** `1.3.0`  
**Estado:** Implementado (SSOT en código)

## Problema
No existía documentación de usuario integrada; el login no ofrecía recuperación ni cambio de clave autónomos.

## Solución
- SSOT: `src/domains/retail/help/catalog.ts` (artículos auditéados vs rutas reales).
- UI: Configuración → Centro de Ayuda (+ búsqueda, categorías, navegación, esquemas anotados).
- PDF: `/api/intiendas/ayuda/manual.pdf` generado con pdfkit desde el catálogo.
- Clerk: `/intiendas/login/recuperar` + Configuración → Seguridad.

## Restricciones respetadas
- Solo pantallas existentes documentadas.
- PDF no editable a mano.
- Sin sistema propio de contraseñas (Clerk).
- Sin contaminación PMS.
