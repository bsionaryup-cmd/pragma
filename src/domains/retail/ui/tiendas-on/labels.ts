/** Etiquetas en español para estados internos de INTIENDAS. */
export const PURCHASE_STATUS_ES: Record<string, string> = {
  SUGGESTED: "Sugerido",
  DRAFT: "Editado",
  APPROVED: "Aprobado",
  SENT: "Enviado",
  RECEIVED: "Recibido",
  CANCELLED: "Cancelado",
};

export const SALE_STATUS_ES: Record<string, string> = {
  COMPLETED: "Completada",
  SUSPENDED: "En espera",
  CANCELLED: "Cancelada",
};

export const MOVEMENT_TYPE_ES: Record<string, string> = {
  INITIAL: "Inicial",
  SALE: "Venta",
  PURCHASE: "Compra",
  ADJUSTMENT: "Ajuste",
  RETURN: "Devolución",
  LOSS: "Pérdida",
  TRANSFER: "Traslado",
};

export function purchaseStatusLabel(status: string) {
  return PURCHASE_STATUS_ES[status] ?? status;
}

export function movementTypeLabel(type: string) {
  return MOVEMENT_TYPE_ES[type] ?? type;
}
