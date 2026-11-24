import { pragmaEmailFooterHtml, pragmaEmailHeaderHtml } from "@/lib/brand-email";
import { getGuestDocumentTypeLabel } from "@/lib/guest-document-types";

export type GuestRegistrationAdminCompanion = {
  fullName: string;
  documentType: string;
  documentNumber: string;
  nationality: string | null;
  dateOfBirth: string | null;
};

export type GuestRegistrationAdminEmailPayload = {
  reservationCode: string | null;
  propertyLabel: string;
  checkIn: string;
  checkOut: string;
  guestCount: number;
  primaryGuest: {
    fullName: string;
    documentType: string;
    documentNumber: string;
    nationality: string | null;
    dateOfBirth: string | null;
    email: string | null;
    phone: string | null;
  };
  companions: GuestRegistrationAdminCompanion[];
  /** TTLock guest code when already persisted for this reservation. */
  accessCode: string | null;
  accessValidFrom: string | null;
  accessValidTo: string | null;
};

/** Asunto operativo: identificación sin abrir el mensaje. */
export function buildGuestRegistrationAdminEmailSubject(
  propertyLabel: string,
  guestName: string | null,
  reservationCode?: string | null,
): string {
  const property = propertyLabel.trim() || "Alojamiento";
  const guest = guestName?.trim() || "Huésped";
  const code = reservationCode?.trim();
  const base = `Check-in registrado | ${property} | ${guest}`;
  return code ? `${base} (${code})` : base;
}

export function buildGuestRegistrationAdminEmailHtml(
  payload: GuestRegistrationAdminEmailPayload,
): string {
  const codeRow = payload.reservationCode?.trim()
    ? infoRow("Reserva", `<strong>${escapeHtml(payload.reservationCode.trim())}</strong>`)
    : "";

  const companionsSection =
    payload.companions.length > 0
      ? `
        <h2 style="font-size:15px;margin:24px 0 12px;color:#111827">Acompañantes</h2>
        <table style="border-collapse:collapse;font-size:13px;line-height:1.5;width:100%;border:1px solid #e5e7eb">
          <thead>
            <tr style="background:#f9fafb">
              <th align="left" style="padding:8px 10px;border-bottom:1px solid #e5e7eb;color:#6b7280">Nombre</th>
              <th align="left" style="padding:8px 10px;border-bottom:1px solid #e5e7eb;color:#6b7280">Documento</th>
              <th align="left" style="padding:8px 10px;border-bottom:1px solid #e5e7eb;color:#6b7280">Nacionalidad</th>
              <th align="left" style="padding:8px 10px;border-bottom:1px solid #e5e7eb;color:#6b7280">Nacimiento</th>
            </tr>
          </thead>
          <tbody>
            ${payload.companions
              .map(
                (guest) => `
              <tr>
                <td style="padding:8px 10px;border-bottom:1px solid #f3f4f6"><strong>${escapeHtml(guest.fullName)}</strong></td>
                <td style="padding:8px 10px;border-bottom:1px solid #f3f4f6">${escapeHtml(getGuestDocumentTypeLabel(guest.documentType))} ${escapeHtml(guest.documentNumber)}</td>
                <td style="padding:8px 10px;border-bottom:1px solid #f3f4f6">${escapeHtml(guest.nationality ?? "—")}</td>
                <td style="padding:8px 10px;border-bottom:1px solid #f3f4f6">${escapeHtml(guest.dateOfBirth ?? "—")}</td>
              </tr>
            `,
              )
              .join("")}
          </tbody>
        </table>
      `.trim()
      : `<p style="margin:16px 0 0;font-size:13px;color:#6b7280">Sin acompañantes registrados.</p>`;

  const accessStatus = payload.accessCode
    ? "Código TTLock generado y listo"
    : "Código TTLock pendiente";

  return `
    <div style="font-family:Arial,Helvetica,sans-serif;color:#111827;max-width:640px">
      ${pragmaEmailHeaderHtml()}
      <h1 style="font-size:20px;margin:0 0 8px">Check-in registrado</h1>
      <p style="margin:0 0 20px;font-size:13px;color:#6b7280;line-height:1.5">
        Notificación operativa de registro de huéspedes.
      </p>

      <h2 style="font-size:15px;margin:0 0 12px;color:#111827">Información de la reserva</h2>
      <table style="border-collapse:collapse;font-size:14px;line-height:1.5;width:100%">
        ${codeRow}
        ${infoRow("Alojamiento", `<strong>${escapeHtml(payload.propertyLabel)}</strong>`)}
        ${infoRow("Entrada", escapeHtml(payload.checkIn))}
        ${infoRow("Salida", escapeHtml(payload.checkOut))}
        ${infoRow("Cantidad de huéspedes", `<strong>${payload.guestCount}</strong>`)}
        ${infoRow("Estado del acceso", escapeHtml(accessStatus))}
      </table>

      <h2 style="font-size:15px;margin:24px 0 12px;color:#111827">Huésped principal</h2>
      <table style="border-collapse:collapse;font-size:14px;line-height:1.5;width:100%">
        ${infoRow("Nombre", `<strong>${escapeHtml(payload.primaryGuest.fullName)}</strong>`)}
        ${infoRow(
          "Documento",
          `${escapeHtml(getGuestDocumentTypeLabel(payload.primaryGuest.documentType))} ${escapeHtml(payload.primaryGuest.documentNumber)}`,
        )}
        ${infoRow("Nacionalidad", escapeHtml(payload.primaryGuest.nationality ?? "—"))}
        ${infoRow("Fecha de nacimiento", escapeHtml(payload.primaryGuest.dateOfBirth ?? "—"))}
        ${infoRow("Teléfono", escapeHtml(payload.primaryGuest.phone ?? "—"))}
        ${infoRow("Correo", escapeHtml(payload.primaryGuest.email ?? "—"))}
      </table>

      ${companionsSection}

      <h2 style="font-size:15px;margin:24px 0 12px;color:#111827">Código de acceso TTLock</h2>
      <table style="border-collapse:collapse;font-size:14px;line-height:1.5;width:100%">
        ${infoRow(
          "Código",
          payload.accessCode
            ? `<strong style="font-family:ui-monospace,Menlo,Consolas,monospace;font-size:18px;letter-spacing:0.04em">${escapeHtml(payload.accessCode)}</strong>`
            : "Pendiente de generación",
        )}
        ${
          payload.accessValidFrom || payload.accessValidTo
            ? infoRow(
                "Vigencia",
                escapeHtml(
                  `${payload.accessValidFrom ?? "—"} → ${payload.accessValidTo ?? "—"}`,
                ),
              )
            : ""
        }
      </table>

      ${pragmaEmailFooterHtml()}
    </div>
  `.trim();
}

export function buildGuestRegistrationAdminEmailText(
  payload: GuestRegistrationAdminEmailPayload,
): string {
  const lines = [
    "Check-in registrado",
    payload.reservationCode?.trim()
      ? `Reserva: ${payload.reservationCode.trim()}`
      : null,
    `Alojamiento: ${payload.propertyLabel}`,
    `Entrada: ${payload.checkIn}`,
    `Salida: ${payload.checkOut}`,
    `Cantidad de huéspedes: ${payload.guestCount}`,
    `Estado del acceso: ${
      payload.accessCode
        ? "Código TTLock generado y listo"
        : "Código TTLock pendiente"
    }`,
    "",
    "Huésped principal:",
    `- Nombre: ${payload.primaryGuest.fullName}`,
    `- Documento: ${getGuestDocumentTypeLabel(payload.primaryGuest.documentType)} ${payload.primaryGuest.documentNumber}`,
    `- Nacionalidad: ${payload.primaryGuest.nationality ?? "—"}`,
    `- Fecha de nacimiento: ${payload.primaryGuest.dateOfBirth ?? "—"}`,
    `- Teléfono: ${payload.primaryGuest.phone ?? "—"}`,
    `- Correo: ${payload.primaryGuest.email ?? "—"}`,
    "",
    payload.companions.length > 0 ? "Acompañantes:" : "Sin acompañantes registrados.",
    ...payload.companions.map(
      (guest) =>
        `- ${guest.fullName} · ${getGuestDocumentTypeLabel(guest.documentType)} ${guest.documentNumber} · ${guest.nationality ?? "—"} · ${guest.dateOfBirth ?? "—"}`,
    ),
    "",
    "Código de acceso TTLock:",
    `- Código: ${payload.accessCode ?? "Pendiente de generación"}`,
    payload.accessValidFrom || payload.accessValidTo
      ? `- Vigencia: ${payload.accessValidFrom ?? "—"} → ${payload.accessValidTo ?? "—"}`
      : null,
  ];

  return lines.filter((line) => line !== null).join("\n");
}

function infoRow(label: string, value: string): string {
  return `<tr><td style="padding:6px 12px 6px 0;color:#6b7280;vertical-align:top;width:38%">${escapeHtml(label)}</td><td style="padding:6px 0">${value}</td></tr>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
