import { getGuestDocumentTypeLabel } from "@/lib/guest-document-types";

export type GuestRegistrationAdminEmailPayload = {
  reservationCode: string | null;
  propertyLabel: string;
  checkIn: string;
  checkOut: string;
  primaryGuestName: string;
  documentType: string;
  documentNumber: string;
  email: string | null;
  phone: string | null;
  guestCount: number;
};

export function buildGuestRegistrationAdminEmailSubject(
  propertyLabel: string,
  reservationCode: string | null,
): string {
  const code = reservationCode?.trim();
  return code
    ? `Registro de huéspedes — ${propertyLabel} (${code})`
    : `Registro de huéspedes — ${propertyLabel}`;
}

export function buildGuestRegistrationAdminEmailHtml(
  payload: GuestRegistrationAdminEmailPayload,
): string {
  const codeRow = payload.reservationCode?.trim()
    ? `<tr><td style="padding:6px 12px 6px 0;color:#6b7280">Reserva</td><td style="padding:6px 0"><strong>${escapeHtml(payload.reservationCode.trim())}</strong></td></tr>`
    : "";

  return `
    <div style="font-family:Arial,Helvetica,sans-serif;color:#111827;max-width:560px">
      <h1 style="font-size:18px;margin:0 0 16px">Registro de huéspedes completado</h1>
      <table style="border-collapse:collapse;font-size:14px;line-height:1.5;width:100%">
        ${codeRow}
        <tr><td style="padding:6px 12px 6px 0;color:#6b7280">Propiedad</td><td style="padding:6px 0"><strong>${escapeHtml(payload.propertyLabel)}</strong></td></tr>
        <tr><td style="padding:6px 12px 6px 0;color:#6b7280">Check-in</td><td style="padding:6px 0">${escapeHtml(payload.checkIn)}</td></tr>
        <tr><td style="padding:6px 12px 6px 0;color:#6b7280">Check-out</td><td style="padding:6px 0">${escapeHtml(payload.checkOut)}</td></tr>
        <tr><td style="padding:6px 12px 6px 0;color:#6b7280">Huésped principal</td><td style="padding:6px 0"><strong>${escapeHtml(payload.primaryGuestName)}</strong></td></tr>
        <tr><td style="padding:6px 12px 6px 0;color:#6b7280">Documento</td><td style="padding:6px 0">${escapeHtml(getGuestDocumentTypeLabel(payload.documentType))} ${escapeHtml(payload.documentNumber)}</td></tr>
        <tr><td style="padding:6px 12px 6px 0;color:#6b7280">Teléfono</td><td style="padding:6px 0">${escapeHtml(payload.phone ?? "—")}</td></tr>
        <tr><td style="padding:6px 12px 6px 0;color:#6b7280">Correo</td><td style="padding:6px 0">${escapeHtml(payload.email ?? "—")}</td></tr>
        <tr><td style="padding:6px 12px 6px 0;color:#6b7280">Huéspedes registrados</td><td style="padding:6px 0"><strong>${payload.guestCount}</strong></td></tr>
      </table>
      <p style="margin:24px 0 0;font-size:12px;color:#9ca3af">PRAGMA · Property Management</p>
    </div>
  `.trim();
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
