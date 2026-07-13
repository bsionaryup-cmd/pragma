# INTIENDAS Pedidos — Centro Inteligente de Abastecimiento

**Fecha:** 2026-07-13  
**Estado:** READY FOR USER TESTING  
**Alcance:** Reutiliza `/intiendas/pedidos` existente. Sin módulo nuevo. Sin PMS/QR/Core.

---

## Entregado

| Criterio | Estado |
|----------|--------|
| Pedidos auto por venta/inventario (outbox → perfiles → plan por proveedor) | ✓ |
| UI solo sugeridos (SUGGESTED/DRAFT), agrupados por proveedor | ✓ |
| Líneas: existencia, IA recomienda, cobertura, total | ✓ |
| Editar qty / quitar / agregar / cambiar proveedor / observaciones | ✓ |
| WhatsApp `wa.me` con mensaje generado (humano confirma) | ✓ |
| Correo `mailto:` con mismo cuerpo | ✓ |
| Feedback aprendizaje (qty, remove, add, supplier, dismiss, approve) | ✓ |
| Bias de cantidades desde historial (sin LLM) | ✓ |
| Proveedor: WhatsApp, correo, días habituales, lead time, notas | ✓ |
| Isolation / tests | ✓ |

---

## Cómo probar

1. Proveedores: cargar WhatsApp y/o correo.
2. Bajar stock o vender hasta riesgo de agotamiento (o “Actualizar inteligencia”).
3. Pedidos: ver tarjeta por proveedor → Editar / Aprobar / WhatsApp / Correo / Descartar.
4. WhatsApp abre chat con mensaje listo; no envía solo.

Migración: `20260713180000_intiendas_supplier_whatsapp`
