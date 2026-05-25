import type { GuestPaymentLinkStatus } from "@prisma/client";

export function guestPaymentLinkStatusLabel(status: GuestPaymentLinkStatus): string {
  const labels: Record<GuestPaymentLinkStatus, string> = {
    DRAFT: "Borrador",
    SENT: "Enviado",
    PENDING: "Pendiente",
    PROCESSING: "Procesando",
    PAID: "Pagado",
    FAILED: "Fallido",
    EXPIRED: "Expirado",
    CANCELLED: "Cancelado",
    REFUNDED: "Reembolsado",
  };
  return labels[status];
}
