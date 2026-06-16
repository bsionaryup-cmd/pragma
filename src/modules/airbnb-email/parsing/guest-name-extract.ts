const INVALID_GUEST_NAME_RE =
  /^(ha\s+pagado|has\s+paid|paid|payment|confirmada?|reserva|guest|hu[eé]sped|viajero|traveler|\d+)$/i;

const INSTRUCTION_PHRASE_RE =
  /\b(sabe\s+c[oó]mo|llegar\s+al\s+alojamiento|consulta\s+las\s+instrucciones|puede\s+acceder|llega\s+ma[ñn]ana|aseg[uú]rate\s+de|env[ií]a\s+un\s+mensaje|indicaciones\s+sobre|prep[aá]rate\s+para|explica\s+c[oó]mo)\b/i;

const IMPERATIVE_LEADING_VERB_RE =
  /^(sabe|consulta|puede|llega|aseg[uú]rate|escribe|env[ií]a|verifica|prep[aá]rate|recuerda|indica|confirma|mostrar|explica|ten)\b/i;

const NAME_PARTICLES = new Set([
  "de",
  "del",
  "la",
  "las",
  "los",
  "y",
  "e",
  "van",
  "von",
  "da",
  "di",
]);

const SUBJECT_GUEST_RE =
  /(?:reserva confirmada|reservation confirmed|booking confirmed)\s*:?\s*([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s.'-]{1,50}?)\s+(?:llega|arrives|check[- ]?in|arrival|el\s+\d|on\s+\d|\d{1,2}\s+(?:ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec))/i;

export function normalizeSubjectForGuestExtraction(subject: string): string {
  return subject.replace(/^(?:(?:fwd|fw|rv|reenviado|re):\s*)+/gi, "").trim();
}

export function extractGuestNameFromSubject(subject: string): string | null {
  const normalized = normalizeSubjectForGuestExtraction(subject);
  const match = normalized.match(SUBJECT_GUEST_RE);
  const name = match?.[1]?.trim();
  if (!name || !isPlausibleGuestName(name)) return null;
  return name;
}

function stripTrailingGuestNamePunctuation(value: string): string {
  return value.replace(/[.,!?;:]+$/g, "").trim();
}

function looksLikeMultiWordPersonName(words: string[]): boolean {
  return words.every((word) => {
    const lower = word.toLowerCase();
    if (NAME_PARTICLES.has(lower)) return true;
    if (IMPERATIVE_LEADING_VERB_RE.test(lower)) return false;
    return /^[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ'.-]*$/.test(word);
  });
}

export function isPlausibleGuestName(value: string | null | undefined): boolean {
  if (!value?.trim()) return false;
  const cleaned = stripTrailingGuestNamePunctuation(value.trim());
  if (cleaned.length < 3) return false;
  if (INVALID_GUEST_NAME_RE.test(cleaned)) return false;
  if (INSTRUCTION_PHRASE_RE.test(cleaned)) return false;
  if (/^\d/.test(cleaned)) return false;
  if (!/[A-Za-zÀ-ÿ]/.test(cleaned)) return false;

  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length === 0) return false;

  const firstWord = words[0] ?? "";
  if (IMPERATIVE_LEADING_VERB_RE.test(firstWord)) return false;

  if (words.length > 4 && !looksLikeMultiWordPersonName(words)) {
    return false;
  }

  return true;
}

export function sanitizeGuestNameCandidate(
  raw: string | null | undefined,
): string | null {
  if (!raw?.trim()) return null;
  const cleaned =
    raw
      .trim()
      .split(/\n/)[0]
      ?.trim()
      .split(/\s+(?:alojamiento|listing|property)\s*:/i)[0]
      ?.trim() ?? raw.trim();
  if (
    /^(?:alojamiento|listing|lugar|check-?in|check-?out|c[oó]digo de confirmaci[oó]n|confirmation code)\s*:/i.test(
      cleaned,
    )
  ) {
    return null;
  }
  return isPlausibleGuestName(cleaned) ? cleaned : null;
}

export function resolveGuestNameFromSignals(input: {
  subject: string;
  mergedGuestName?: string | null;
  bodyGuestMatch?: string | null;
}): string | null {
  const fromSubject = extractGuestNameFromSubject(input.subject);
  if (fromSubject) return fromSubject;

  const fromMerged = sanitizeGuestNameCandidate(input.mergedGuestName);
  if (fromMerged) return fromMerged;

  return sanitizeGuestNameCandidate(input.bodyGuestMatch);
}

export function buildEmailMatchBlob(input: {
  subject: string;
  body: string;
  html?: string | null;
}): string {
  return [input.subject, input.body, input.html ?? ""]
    .filter(Boolean)
    .join("\n")
    .slice(0, 50_000)
    .toLowerCase();
}
