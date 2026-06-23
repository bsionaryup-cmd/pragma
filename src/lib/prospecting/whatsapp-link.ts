/** Build a wa.me link for human-driven WhatsApp outreach (no API). */
export function buildWhatsAppLink(phone: string | null | undefined): string | null {
  if (!phone?.trim()) return null;

  const digits = phone.replace(/\D/g, "");
  if (!digits) return null;

  let normalized = digits;
  if (digits.length === 10 && digits.startsWith("3")) {
    normalized = `57${digits}`;
  } else if (digits.length === 11 && digits.startsWith("0")) {
    normalized = `57${digits.slice(1)}`;
  }

  return `https://wa.me/${normalized}`;
}

export function buildWhatsAppLinkWithMessage(
  phone: string | null | undefined,
  message: string,
): string | null {
  const base = buildWhatsAppLink(phone);
  if (!base || !message.trim()) return base;
  return `${base}?text=${encodeURIComponent(message.trim())}`;
}
