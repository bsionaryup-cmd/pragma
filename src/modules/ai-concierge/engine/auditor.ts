/**
 * Auditor de respuestas: verifica que el draft no invente hechos.
 * Extensión omnicanal: políticas de negocio (parking, descuentos, early check-in, TTLock).
 */
export function auditConciergeCandidate(input: {
  draft: string | null;
  knownFacts: Record<string, string | number | boolean | null>;
  requiredFacts: string[];
  intent?: string;
}): { verified: boolean; issues: string[] } {
  const issues: string[] = [];

  if (!input.draft || !input.draft.trim()) {
    return { verified: false, issues: ["Sin draft que auditar"] };
  }

  const draft = input.draft;
  const lower = draft.toLowerCase();

  for (const key of input.requiredFacts) {
    const value = input.knownFacts[key];
    if (value === null || value === undefined || value === "") {
      issues.push(`Falta hecho requerido: ${key}`);
      continue;
    }
    const needle = String(value).trim();
    if (needle && !draft.includes(needle)) {
      issues.push(`Draft no contiene el hecho verificado: ${key}`);
    }
  }

  const unresolved = draft.match(/\{\{(\w+)\}\}/g);
  if (unresolved?.length) {
    issues.push(`Placeholders sin resolver: ${unresolved.join(", ")}`);
  }

  // Business policy validators (additive)
  if (
    /descuento|rebaja|% off|promo(ción)?/i.test(draft) &&
    input.intent !== "DISCOUNT"
  ) {
    const hasDiscountFact =
      input.knownFacts.discountApproved === true ||
      input.knownFacts.discountPercent != null;
    if (!hasDiscountFact) {
      issues.push("Draft ofrece descuento sin hecho autorizado");
    }
  }

  // Only block affirmative promises — policy text may say "no está garantizado".
  if (
    /early check|check[- ]?in temprano|llegar antes/i.test(lower) &&
    /(aprobad|confirmad|autoriz|sí puedes|puedes llegar|te esperamos antes)/i.test(
      lower,
    ) &&
    !/no (est[aá]|queda) (garantiz|aprob|autoriz)|sin garant[ií]|no garantiz/i.test(
      lower,
    )
  ) {
    if (input.knownFacts.earlyCheckInApproved !== true) {
      issues.push("Draft promete early check-in sin autorización");
    }
  }

  if (
    /late check[- ]?out|salida tard/i.test(lower) &&
    /(aprobad|confirmad|autoriz|sí puedes|puedes salir|quedarte hasta)/i.test(
      lower,
    ) &&
    !/no (est[aá]|queda) (garantiz|aprob|autoriz)|sin garant[ií]|no garantiz/i.test(
      lower,
    )
  ) {
    if (input.knownFacts.lateCheckOutApproved !== true) {
      issues.push("Draft promete late check-out sin autorización");
    }
  }

  if (
    /parqueadero|parking|estacionamiento/i.test(lower) &&
    (input.intent === "PARQUEADERO" || /sí (hay|tenemos) parqueadero/i.test(lower))
  ) {
    const parking = input.knownFacts.parkingInfo;
    if (
      parking == null ||
      parking === "" ||
      /no (hay|cuenta|dispone)|sin parqueadero/i.test(String(parking))
    ) {
      if (/sí (hay|tenemos)|incluido|gratis/i.test(lower)) {
        issues.push("Draft ofrece parqueadero inexistente o no confirmado");
      }
    }
  }

  if (
    /c[oó]digo de (acceso|puerta)|ttlock|llave digital/i.test(lower) &&
    (input.intent === "TTLOCK" || input.requiredFacts.includes("accessCode"))
  ) {
    const code = input.knownFacts.accessCode;
    if (code == null || code === "") {
      issues.push("Draft menciona código de acceso sin hecho accessCode");
    } else if (!draft.includes(String(code))) {
      issues.push("Draft de acceso no incluye el código verificado");
    }
  }

  return { verified: issues.length === 0, issues };
}
