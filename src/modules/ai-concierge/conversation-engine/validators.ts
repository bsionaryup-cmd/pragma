/**
 * Rule-based validators for Conversation Engine steps (no LLM).
 */
export type ValidationResult =
  | { ok: true; value?: string | number }
  | { ok: false; reason: string; reprompt: string };

export function validatePeopleCount(text: string): ValidationResult {
  const t = text.trim();
  const patterns = [
    /^(\d{1,2})$/,
    /(\d{1,2})\s*(?:personas?|pax|hu[eé]spedes?|adultos?)/i,
    /(?:para|somos)\s+(\d{1,2})\b/i,
  ];
  for (const re of patterns) {
    const m = t.match(re);
    if (m) {
      const n = Number(m[1]);
      if (n >= 1 && n <= 20) return { ok: true, value: n };
      return {
        ok: false,
        reason: "out_of_range",
        reprompt: "Indica un número de personas entre 1 y 20.",
      };
    }
  }
  return {
    ok: false,
    reason: "unparseable",
    reprompt: "¿Para cuántas personas es la reserva? (ej. 2)",
  };
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function validateIsoDate(text: string): ValidationResult {
  const t = text.trim();
  const iso = t.match(ISO_DATE);
  if (iso) {
    const y = Number(iso[1]);
    const m = Number(iso[2]);
    const d = Number(iso[3]);
    const dt = new Date(Date.UTC(y, m - 1, d));
    if (
      dt.getUTCFullYear() === y &&
      dt.getUTCMonth() === m - 1 &&
      dt.getUTCDate() === d
    ) {
      return { ok: true, value: `${iso[1]}-${iso[2]}-${iso[3]}` };
    }
  }
  // Accept dd/mm/yyyy
  const slash = t.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (slash) {
    const d = Number(slash[1]);
    const m = Number(slash[2]);
    let y = Number(slash[3]);
    if (y < 100) y += 2000;
    const dt = new Date(Date.UTC(y, m - 1, d));
    if (
      dt.getUTCFullYear() === y &&
      dt.getUTCMonth() === m - 1 &&
      dt.getUTCDate() === d
    ) {
      const pad = (n: number) => String(n).padStart(2, "0");
      return { ok: true, value: `${y}-${pad(m)}-${pad(d)}` };
    }
  }
  return {
    ok: false,
    reason: "unparseable",
    reprompt: "Necesito una fecha válida (ej. 21/07/2026 o 2026-07-21).",
  };
}

export function validateCheckoutAfterCheckin(
  checkIn: string,
  checkOut: string,
): ValidationResult {
  if (checkOut <= checkIn) {
    return {
      ok: false,
      reason: "order",
      reprompt: "La fecha de salida debe ser posterior a la de llegada.",
    };
  }
  return { ok: true, value: checkOut };
}

export function validateYesNo(text: string): ValidationResult {
  const t = text.trim();
  if (t.length > 80) {
    return {
      ok: false,
      reason: "too_long",
      reprompt: "Responde solo «sí» o «no».",
    };
  }
  // Avoid \b after accented chars (JS word-boundary breaks on "sí").
  if (
    /^(s[ií]|ok|okay|dale|confirmo|de una)([\s!.?]*)$/i.test(t) ||
    (/^(s[ií]|ok|okay|dale|confirmo|de una)([\s,.].*)?$/i.test(t) &&
      !/\bno\b/i.test(t) &&
      t.length <= 40)
  ) {
    return { ok: true, value: "yes" };
  }
  if (/^(no|nop|nel|mejor no|cancelar)[\s!.?]*$/i.test(t)) {
    return { ok: true, value: "no" };
  }
  return {
    ok: false,
    reason: "unparseable",
    reprompt: "Responde «sí» para confirmar o «no» para cancelar.",
  };
}

export function validateGuestName(text: string): ValidationResult {
  const t = text
    .trim()
    .replace(/^(me llamo|soy|mi nombre es|el titular es)\s+/i, "")
    .trim();
  if (t.length < 3 || t.length > 60) {
    return {
      ok: false,
      reason: "length",
      reprompt: "¿Me compartes el nombre completo del titular de la reserva?",
    };
  }
  if (/disponib|fecha|wifi|reserva|http|@|\d{3,}|confirmo|arm[ae]/i.test(t)) {
    return {
      ok: false,
      reason: "not_a_name",
      reprompt: "¿Me compartes el nombre completo del titular de la reserva?",
    };
  }
  if (!/^[a-záéíóúñü\s'.-]+$/i.test(t)) {
    return {
      ok: false,
      reason: "charset",
      reprompt: "¿Me compartes el nombre completo del titular de la reserva?",
    };
  }
  if (t.split(/\s+/).filter(Boolean).length > 5) {
    return {
      ok: false,
      reason: "too_many_words",
      reprompt: "¿Me compartes el nombre completo del titular de la reserva?",
    };
  }
  return { ok: true, value: t.replace(/\s+/g, " ") };
}

export function validateEmailOrSkip(text: string): ValidationResult {
  const t = text.trim();
  if (
    /^(continuar|seguir|omitir|skip|no|nop|sin correo|no tengo)[\s!.?]*$/i.test(
      t,
    )
  ) {
    return { ok: true, value: "skip" };
  }
  const m = t.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i);
  if (m) return { ok: true, value: m[0]! };
  return {
    ok: false,
    reason: "invalid_email",
    reprompt:
      "Necesito un correo válido (ej. nombre@correo.com) o escribe «continuar» para seguir sin correo.",
  };
}
