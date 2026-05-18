export function countNights(checkIn: string, checkOut: string): number {
  const start = parseDateOnly(checkIn);
  const end = parseDateOnly(checkOut);
  const ms = end.getTime() - start.getTime();
  const nights = Math.round(ms / (24 * 60 * 60 * 1000));
  return Math.max(0, nights);
}

export function parseDateOnly(value: string): Date {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}

export function formatStayRange(checkIn: string, checkOut: string): string {
  const opts: Intl.DateTimeFormatOptions = {
    day: "numeric",
    month: "short",
  };
  const inDate = parseDateOnly(checkIn).toLocaleDateString("es-CO", opts);
  const outDate = parseDateOnly(checkOut).toLocaleDateString("es-CO", opts);
  return `${inDate} → ${outDate}`;
}

export function totalGuests(adults: number, children: number, infants: number): number {
  return adults + children + infants;
}
