import { countNights } from "@/features/reservations/lib/reservation-dates";
import { formatCurrency } from "@/lib/helpers";

export type ReservationQuoteBreakdown = {
  checkIn: string;
  checkOut: string;
  accommodationTotal?: number | null;
  cleaningFee?: number | null;
  otherCharges?: { label: string; amount: number }[];
  totalAmount?: number | null;
  currency?: string;
  propertyLabel?: string | null;
};

export function formatReservationQuoteClipboard(
  input: ReservationQuoteBreakdown,
): string {
  const nights = countNights(input.checkIn, input.checkOut);
  const currency = input.currency ?? "COP";
  const lines: string[] = [];

  if (input.propertyLabel?.trim()) {
    lines.push(`Propiedad: ${input.propertyLabel.trim()}`);
  }

  lines.push(`Check-in: ${input.checkIn}`);
  lines.push(`Check-out: ${input.checkOut}`);
  lines.push(`Noches: ${nights}`);

  if (input.accommodationTotal != null && input.accommodationTotal > 0) {
    lines.push(`Alojamiento: ${formatCurrency(input.accommodationTotal, currency)}`);
  }

  if (input.cleaningFee != null && input.cleaningFee > 0) {
    lines.push(`Limpieza: ${formatCurrency(input.cleaningFee, currency)}`);
  }

  for (const charge of input.otherCharges ?? []) {
    if (charge.amount > 0) {
      lines.push(`${charge.label}: ${formatCurrency(charge.amount, currency)}`);
    }
  }

  if (input.totalAmount != null && input.totalAmount > 0) {
    lines.push(`Total: ${formatCurrency(input.totalAmount, currency)}`);
  } else {
    lines.push("Total: pendiente");
  }

  lines.push(`Moneda: ${currency}`);

  return lines.join("\n");
}

export async function copyReservationQuoteToClipboard(
  input: ReservationQuoteBreakdown,
): Promise<void> {
  const text = formatReservationQuoteClipboard(input);
  await navigator.clipboard.writeText(text);
}
