import { decodeHtmlEntities } from "@/lib/text/decode-html-entities";
import { isPlausibleGuestName } from "@/modules/airbnb-email/parsing/guest-name-extract";

const PLACEHOLDER_GUEST_NAMES = new Set([
  "huésped airbnb",
  "huesped airbnb",
  "airbnb guest",
  "airbnb",
  "reserved",
  "reservado",
]);

const SUBJECT_NOISE_PATTERNS: RegExp[] = [
  /^.+\s+te envi[oó] un mensaje\b/i,
  /^a\s+.+\s+envi[oó]\s+un\s+mensaje\b/i,
  /^message from\s+.+\s+about\b/i,
  /^new message about your reservation\b/i,
  /^nuevo mensaje sobre tu reserva\b/i,
  /^mensaje sobre (tu|su) reserva\b/i,
  /^re:\s*/i,
  /^fwd?:\s*/i,
];

const LINE_NOISE_PATTERNS: RegExp[] = [
  /^(responder|reply|respond|view message|ver mensaje|see message)/i,
  /^(unsubscribe|darse de baja)/i,
  /^(get the app|descarga la app)/i,
  /^(airbnb,?\s*inc\.?)/i,
  /^(fechas originales|fechas solicitadas|original dates|requested dates)/i,
  /^(©|copyright)/i,
  /^\(?https?:\/\//i,
  /airbnb\.com(?:\.[a-z]{2,3})?\/(?:ac\/)?account-settings\/email-unsubscribe/i,
  /^(help center|centro de ayuda)/i,
  /^(do not reply|no responder)/i,
  /^(sent from my iphone|enviado desde)/i,
  /^(this message was sent|este mensaje fue)/i,
  /^(you have a new message|tienes un nuevo mensaje)/i,
  /^(tap to reply|toca para responder)/i,
  /^(manage your reservations|administra tus reservas)/i,
  /^(reservation code|código de confirmación|código de reserva)/i,
  /^(listing|anuncio|propiedad)\s*:/i,
  /^(check[- ]?in|check[- ]?out|llegada|salida)\s*:/i,
  /^(confirmation|confirmaci[oó]n)\s*:/i,
  /^persona que reserva$/i,
  /^person who(?:'s| is) booking$/i,
  /^>\s*/,
  /^(—|--|___+)$/,
];

const GUEST_ROLE_LABEL =
  /\b(?:persona que reserva|person who(?:'s| is) booking|guest booker)\b/gi;

const AIRBNB_PLATFORM_BOILERPLATE: RegExp[] = [
  /por tu seguridad y protecci[oó]n/i,
  /comun[ií]cate siempre a trav[eé]s de la plataforma de airbnb/i,
  /cuanto antes respondas/i,
  /m[aá]s tiempo tendr[aá]n los viajeros/i,
  /ratio de respuesta/i,
  /lugar que ocupa tu anuncio/i,
  /resultados de b[uú]squeda/i,
  /si no contestas a la solicitud/i,
  /env[ií]a un mensaje a\b/i,
  /send a message to\b/i,
  /for your safety and protection/i,
  /always communicate through airbnb/i,
  /respond to .+ within 24 hours/i,
  /within 24 hours.*response rate/i,
  /your response rate/i,
  /search ranking/i,
  /organizar el viaje/i,
];

export type GuestMessageParseOptions = {
  guestName?: string | null;
};

export function stripMessageHtml(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function unwrapQuotedMessage(value: string | null | undefined): string | null {
  const text = value?.trim();
  if (!text) return null;
  const unwrapped = text.replace(/^[“"']+|[”"']+$/g, "").trim();
  return unwrapped || null;
}

export function isPlaceholderGuestName(name: string | null | undefined): boolean {
  if (!name?.trim()) return true;
  return PLACEHOLDER_GUEST_NAMES.has(
    name
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .toLowerCase()
      .trim(),
  );
}

export function isAirbnbPlatformBoilerplate(text: string | null | undefined): boolean {
  const normalized = text?.trim();
  if (!normalized) return true;
  return AIRBNB_PLATFORM_BOILERPLATE.some((pattern) => pattern.test(normalized));
}

export function looksLikeSubjectNoise(text: string): boolean {
  const normalized = text.trim();
  if (!normalized) return true;
  return /te envi[oó] un mensaje|message from|about your reservation|sobre (tu|su) reserva|mensaje de airbnb|new message about|envi[oó]\s+un\s+mensaje a|env[ií]a un mensaje a/i.test(
    normalized,
  );
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function stripGuestRoleLabels(text: string): string {
  return text.replace(GUEST_ROLE_LABEL, " ").replace(/\s+/g, " ").trim();
}

function stripLeadingGuestName(text: string, guestName?: string | null): string {
  if (!guestName?.trim()) return text.trim();
  const firstName = guestName.trim().split(/\s+/)[0] ?? guestName.trim();
  return text
    .replace(new RegExp(`^${escapeRegExp(guestName.trim())}\\s+`, "i"), "")
    .replace(new RegExp(`^${escapeRegExp(firstName)}\\s+`, "i"), "")
    .trim();
}

const HOST_MESSAGE_BOILERPLATE =
  /^(responder|revisa la consulta|para confirmar los detalles de la llegada|env[ií]a un mensaje a|%opentrack%|preaprobar o rechazar|identidad verificada|tiene(?:s)? 24 horas para responder)$/i;

function isWeakGuestMessageFragment(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 4) return true;
  if (HOST_MESSAGE_BOILERPLATE.test(trimmed)) return true;
  if (/para confirmar los detalles de la llegada/i.test(trimmed)) return true;
  if (/^de junio en su apartamento$/i.test(trimmed)) return true;
  if (/^https?:\/\//i.test(trimmed)) return true;
  if (/^re:\s*reserva de/i.test(trimmed)) return true;
  if (/^reserva confirmada:/i.test(trimmed)) return true;
  if (/^fwd:\s*reserva confirmada:/i.test(trimmed)) return true;
  if (/^consulta (?:sobre|para una estancia)/i.test(trimmed)) return true;
  if (/preaprobar o rechazar/i.test(trimmed)) return true;
  if (/identidad verificada/i.test(trimmed)) return true;
  if (/airbnb ireland/i.test(trimmed)) return true;
  if (/preguntas frecuentes/i.test(trimmed)) return true;
  if (/descarga la aplicaci[oó]n/i.test(trimmed)) return true;
  if (/^(llegada|salida|viajeros|casa\/apto)/i.test(trimmed)) return true;
  if (/^loft .+ \| /i.test(trimmed)) return true;
  if (/^[A-ZÁÉÍÓÚÑ0-9\s|·.,-]+$/.test(trimmed) && trimmed.length < 80) return true;
  if (/^[A-ZÁÉÍÓÚÑ]{2,12}$/.test(trimmed)) return true;
  if (/^[\p{L}]{2,12}$/u.test(trimmed) && !/[.!?¿?,]/.test(trimmed)) {
    if (/^(hola|hi|ok|si|sí|dale|gracias|thanks)$/i.test(trimmed)) return false;
    return true;
  }
  return false;
}

function filterQualityGuestMessageBodies(bodies: string[]): string[] {
  return bodies.filter((body) => {
    const trimmed = body.trim();
    if (isWeakGuestMessageFragment(trimmed)) return false;
    if (/^reserva de «/i.test(trimmed)) return false;
    if (/tambi[eé]n puedes responder directamente/i.test(trimmed)) return false;
    if (/actualiza tus preferencias/i.test(trimmed)) return false;
    if (/^[\p{L}\s,.-]{0,40}\d{4}$/u.test(trimmed)) return false;
    if (/casa\/apto\. entero/i.test(trimmed)) return false;
    if (/^\d+ de [a-z]+ de \d{4}/i.test(trimmed)) return false;
    if (/^[\p{L}\s]+, [A-ZÁÉÍÓÚÑ][a-záéíóúñ]+$/u.test(trimmed)) return false;
    if (trimmed.length >= 4 && /^(hola|hi|hello|buenos|gracias|dale|ok|sí|si)\b/i.test(trimmed)) {
      return true;
    }
    if (trimmed.length < 10) return false;
    const letters = (trimmed.match(/\p{L}/gu) ?? []).length;
    if (letters < 8) return false;
    return true;
  });
}

function inferGuestNameFromMessageContent(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  const decoded = decodeHtmlEntities(raw);
  const wroteMatch = decoded.match(
    /(?:^|\n)\s*([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s.'-]{1,40}?)\s+escribi[oó]\s*:/i,
  );
  const wroteName = wroteMatch?.[1]?.trim();
  if (wroteName && isPlausibleGuestName(wroteName)) return wroteName;

  const lines = decoded
    .split(/\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  for (let index = 1; index < lines.length; index += 1) {
    if (!/^persona que reserva$/i.test(lines[index] ?? "")) continue;
    const candidate = lines[index - 1]?.trim();
    if (
      candidate &&
      /^[\p{L}][\p{L}\s'.-]{0,40}$/u.test(candidate) &&
      !looksLikeSubjectNoise(candidate) &&
      !isAirbnbPlatformBoilerplate(candidate) &&
      !/^https?:\/\//i.test(candidate)
    ) {
      return candidate;
    }
  }
  return null;
}

function isGenericSenderName(name: string | null | undefined): boolean {
  if (!name?.trim()) return true;
  if (isPlaceholderGuestName(name)) return true;
  return /^hu[eé]sped$/i.test(name.trim());
}

export function resolveGuestMessageParseName(input: {
  raw?: string | null;
  guestName?: string | null;
  senderName?: string | null;
}): string | null {
  const inferred = inferGuestNameFromMessageContent(input.raw);
  if (inferred) return inferred;

  const sender = input.senderName?.trim();
  if (sender && !isGenericSenderName(sender) && !/te envi[oó] un mensaje/i.test(sender)) {
    return sender;
  }

  const guest = input.guestName?.trim();
  if (guest && !isPlaceholderGuestName(guest) && !guest.startsWith("Reserva ")) {
    return guest;
  }

  return guest ?? sender ?? null;
}

function isUsefulGuestFragment(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 2) return false;
  if (isWeakGuestMessageFragment(trimmed)) return false;
  if (looksLikeSubjectNoise(trimmed)) return false;
  if (isAirbnbPlatformBoilerplate(trimmed)) return false;
  if (isIncoherentFeedText(trimmed)) return false;
  return true;
}

function guestNameLineMatches(line: string, guestName?: string | null): boolean {
  if (!guestName?.trim()) return false;
  const trimmed = guestName.trim();
  const firstName = trimmed.split(/\s+/)[0] ?? trimmed;
  return (
    new RegExp(`^${escapeRegExp(trimmed)}$`, "i").test(line) ||
    new RegExp(`^${escapeRegExp(firstName)}$`, "i").test(line)
  );
}

function appendGuestMessageContinuation(
  lines: string[],
  startIndex: number,
  firstLine: string,
  guestName?: string | null,
): { message: string; nextIndex: number } {
  let message = stripLeadingGuestName(stripGuestRoleLabels(firstLine), guestName).trim();
  let look = startIndex;

  while (look < lines.length) {
    const candidate = lines[look]?.trim();
    if (!candidate) {
      look += 1;
      continue;
    }
    if (
      guestNameLineMatches(candidate, guestName) ||
      /^persona que reserva$/i.test(candidate) ||
      /^person who(?:'s| is) booking$/i.test(candidate)
    ) {
      break;
    }
    if (
      /^(responder|reservation|loft |llegada|salida|viajeros|descarga la aplic)/i.test(candidate) ||
      /^https?:\/\//i.test(candidate) ||
      isAirbnbPlatformBoilerplate(candidate) ||
      isWeakGuestMessageFragment(candidate)
    ) {
      break;
    }
    if (candidate.length <= 24 && !/[.!?¿?]$/.test(message)) {
      message = `${message} ${candidate}`.trim();
      look += 1;
      continue;
    }
    break;
  }

  return { message, nextIndex: look };
}

function parseGmailStyleGuestBlocks(
  text: string,
  guestName?: string | null,
): string[] {
  const lines = text
    .split(/\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const messages: string[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    const next = lines[index + 1];
    const afterRole = lines[index + 2];

    if (/^persona que reserva$/i.test(line) || /^person who(?:'s| is) booking$/i.test(line)) {
      if (afterRole && isUsefulGuestFragment(afterRole)) {
        const merged = appendGuestMessageContinuation(lines, index + 3, afterRole, guestName);
        if (isUsefulGuestFragment(merged.message)) {
          messages.push(merged.message);
        }
        index = merged.nextIndex;
      } else {
        index += 3;
      }
      continue;
    }

    if (
      guestNameLineMatches(line, guestName) &&
      next &&
      (/^persona que reserva$/i.test(next) || /^person who(?:'s| is) booking$/i.test(next))
    ) {
      if (afterRole && isUsefulGuestFragment(afterRole)) {
        const merged = appendGuestMessageContinuation(lines, index + 3, afterRole, guestName);
        if (isUsefulGuestFragment(merged.message)) {
          messages.push(merged.message);
        }
        index = merged.nextIndex;
      } else {
        index += 3;
      }
      continue;
    }

    index += 1;
  }

  return messages;
}

function splitConcatenatedGuestMessages(
  text: string,
  guestName?: string | null,
): string[] {
  const cleaned = stripGuestRoleLabels(stripInlineSubjectPrefixes(text));
  const splitPattern = guestName
    ? new RegExp(
        `(?:^|\\s)${escapeRegExp(guestName.trim())}\\s+(?:Persona que reserva|person who(?:'s| is) booking)\\s*`,
        "gi",
      )
    : /\b[\p{L}][\p{L}\s'.-]{0,40}\s+(?:Persona que reserva|person who(?:'s| is) booking)\s*/giu;

  const parts = cleaned
    .split(splitPattern)
    .map((part) => stripLeadingGuestName(stripGuestRoleLabels(part), guestName))
    .map((part) => part.trim())
    .filter(Boolean);

  return parts.filter((part) => isUsefulGuestFragment(part));
}

function extractGuestMessageBlocks(
  text: string,
  guestName?: string | null,
): string[] {
  const gmailBlocks = parseGmailStyleGuestBlocks(text, guestName);
  if (gmailBlocks.length > 0) return gmailBlocks;

  const concatenated = splitConcatenatedGuestMessages(text, guestName);
  if (concatenated.length > 0) return concatenated;

  return [];
}

function extractQuotedBody(text: string): string | null {
  const patterns = [
    /"([^"]{4,800})"/,
    /[“"]([^”"]{4,800})[”"]/,
    /'([^']{4,800})'/,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]?.trim()) return match[1].trim();
  }
  return null;
}

function extractWroteBody(text: string): string | null {
  const patterns = [
    /(?:escribió|wrote|dijo|said)[:\s]+[“"']?([\s\S]{4,800})/i,
    /(?:guest wrote|el hu[eé]sped escribi[oó])[:\s]+[“"']?([\s\S]{4,800})/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    const body = match?.[1]
      ?.split(/\n-{2,}\n/)[0]
      ?.trim()
      .replace(/[”"']+$/g, "")
      .trim();
    if (body && !looksLikeSubjectNoise(body) && !isAirbnbPlatformBoilerplate(body)) {
      return body;
    }
  }
  return null;
}

function stripQuotedReplyChain(text: string): string {
  return text
    .split(/\n/)
    .filter((line) => !line.trim().startsWith(">"))
    .join("\n")
    .trim();
}

function stripAirbnbEmailWrapper(text: string): string {
  const cutMarkers = [
    /\n-{2,}\s*\n/i,
    /\n(?:reply on airbnb|responder en airbnb)/i,
    /\n(?:view (?:your )?reservation|ver (?:tu )?reserva)/i,
    /\n(?:unsubscribe|darse de baja)/i,
  ];
  let result = text;
  for (const marker of cutMarkers) {
    const index = result.search(marker);
    if (index > 20) {
      result = result.slice(0, index).trim();
    }
  }
  return result;
}

function stripInlineSubjectPrefixes(text: string): string {
  return text
    .replace(/^.+\s+te envi[oó] un mensaje[^\n]*/gim, "")
    .replace(/^a\s+.+\s+envi[oó]\s+un\s+mensaje[^\n]*/gim, "")
    .replace(/^message from .+ about your reservation[^\n]*/gim, "")
    .replace(/^nuevo mensaje sobre tu reserva[^\n]*/gim, "")
    .replace(/\benv[ií]a un mensaje a\s+[\p{L}\s'.-]{2,40}\b/giu, "")
    .replace(/\bsend a message to\s+[\p{L}\s'.-]{2,40}\b/giu, "")
    .trim();
}

function cleanMessageLines(text: string): string {
  const lines = text
    .split(/\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => line.length > 0)
    .filter((line) => !LINE_NOISE_PATTERNS.some((pattern) => pattern.test(line)))
    .filter((line) => !SUBJECT_NOISE_PATTERNS.some((pattern) => pattern.test(line)))
    .filter((line) => !looksLikeSubjectNoise(line))
    .filter((line) => !isAirbnbPlatformBoilerplate(line));

  return lines
    .join("\n")
    .trim()
    .replace(/^[“"']+/, "")
    .replace(/[”"']+$/, "")
    .trim();
}

function clipMessage(text: string, max = 800): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trim()}…`;
}

function scoreContentLine(line: string): number {
  let score = line.length;
  if (/[?¿]/.test(line)) score += 24;
  if (/\b(hola|gracias|thanks|wifi|check[- ]?in|llegar|llegamos)\b/i.test(line)) {
    score += 12;
  }
  return score;
}

function pickBestContentLine(text: string): string | null {
  const lines = cleanMessageLines(text).split("\n").filter(Boolean);
  let best = "";
  let bestScore = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!isUsefulGuestFragment(trimmed)) continue;
    const score = scoreContentLine(trimmed);
    if (score > bestScore) {
      best = trimmed;
      bestScore = score;
    }
  }

  return best.length >= 2 ? best : null;
}

function joinGuestBlocks(blocks: string[]): string | null {
  const unique = collectUniqueGuestFragments(blocks);
  if (unique.length === 0) return null;
  return clipMessage(unique.join("\n\n"));
}

function dedupeFragmentSubsets(fragments: string[]): string[] {
  return fragments.filter(
    (fragment, index) =>
      !fragments.some(
        (other, otherIndex) =>
          otherIndex !== index &&
          other.length > fragment.length &&
          other.toLowerCase().includes(fragment.toLowerCase()),
      ),
  );
}

function decodeBasicHtmlEntities(text: string): string {
  return text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&aacute;/gi, "á")
    .replace(/&eacute;/gi, "é")
    .replace(/&iacute;/gi, "í")
    .replace(/&oacute;/gi, "ó")
    .replace(/&uacute;/gi, "ú")
    .replace(/&ntilde;/gi, "ñ")
    .replace(/&Aacute;/gi, "Á")
    .replace(/&Eacute;/gi, "É")
    .replace(/&Iacute;/gi, "Í")
    .replace(/&Oacute;/gi, "Ó")
    .replace(/&Uacute;/gi, "Ú")
    .replace(/&Ntilde;/gi, "Ñ");
}

function collectUniqueGuestFragments(blocks: string[], guestName?: string | null): string[] {
  const unique: string[] = [];
  const seen = new Set<string>();

  for (const block of blocks) {
    const cleaned = decodeBasicHtmlEntities(
      stripLeadingGuestName(stripGuestRoleLabels(block), guestName).trim(),
    );
    if (!isUsefulGuestFragment(cleaned)) continue;
    const key = cleaned.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(cleaned);
  }

  return dedupeFragmentSubsets(unique);
}

function prepareGuestMessageText(
  raw: string,
  guestName?: string | null,
): string {
  const decoded = decodeHtmlEntities(raw);
  const multiline = decoded.includes("<")
    ? stripMessageHtml(decoded)
    : decoded.replace(/\r\n/g, "\n").replace(/[ \t]+\n/g, "\n");

  return stripQuotedReplyChain(stripAirbnbEmailWrapper(multiline));
}

/** Extrae el texto real del huésped, sin asunto ni encabezados de correo Airbnb. */
export function normalizeGuestMessageBody(
  raw: string | null | undefined,
  options?: GuestMessageParseOptions,
): string | null {
  if (!raw?.trim()) return null;

  const guestName = options?.guestName?.trim() || null;
  const prepared = prepareGuestMessageText(raw, guestName);
  const guestBlocks = joinGuestBlocks(extractGuestMessageBlocks(prepared, guestName));
  const quoted = extractQuotedBody(prepared);
  const wrote = extractWroteBody(prepared);
  const lineCleaned = cleanMessageLines(stripInlineSubjectPrefixes(prepared));
  const bestLine = pickBestContentLine(lineCleaned || prepared);

  let stripped = prepared.trim();
  for (const pattern of SUBJECT_NOISE_PATTERNS) {
    stripped = stripped.replace(pattern, "").trim();
  }
  stripped = stripInlineSubjectPrefixes(stripped);

  const candidates = [
    guestBlocks,
    wrote,
    quoted,
    bestLine,
    lineCleaned,
    looksLikeSubjectNoise(stripped) ? null : cleanMessageLines(stripped),
  ].filter((value): value is string => Boolean(value?.trim()));

  const seen = new Set<string>();
  for (const candidate of candidates) {
    const cleaned = clipMessage(
      stripLeadingGuestName(stripGuestRoleLabels(cleanMessageLines(candidate)), guestName),
    );
    const key = cleaned.toLowerCase();
    if (!cleaned || seen.has(key)) continue;
    seen.add(key);
    if (!isUsefulGuestFragment(cleaned)) continue;
    return cleaned;
  }

  return null;
}

/** Para timeline: uno o más textos del huésped (p. ej. bloques «Persona que reserva»). */
export function resolveGuestMessageBodiesForDisplay(
  raw: string | null | undefined,
  options?: GuestMessageParseOptions,
): string[] {
  if (!raw?.trim()) return [];

  const guestName =
    resolveGuestMessageParseName({
      raw,
      guestName: options?.guestName,
    }) ?? options?.guestName?.trim() ?? null;
  const prepared = prepareGuestMessageText(raw, guestName);
  const fragments = collectUniqueGuestFragments(
    extractGuestMessageBlocks(prepared, guestName),
    guestName,
  ).map((fragment) => clipMessage(fragment));

  if (fragments.length > 0) {
    return filterQualityGuestMessageBodies(fragments);
  }

  const single = normalizeGuestMessageBody(raw, { guestName });
  return single && !isWeakGuestMessageFragment(single)
    ? filterQualityGuestMessageBodies([single])
    : [];
}

/** Para timeline: solo texto del huésped; sin fallback permisivo. */
export function resolveGuestMessageForDisplay(
  raw: string | null | undefined,
  options?: GuestMessageParseOptions,
): string | null {
  const bodies = resolveGuestMessageBodiesForDisplay(raw, options);
  if (bodies.length === 0) return null;
  return bodies.length === 1 ? bodies[0]! : clipMessage(bodies.join("\n\n"));
}

/** Texto sin sentido operativo: basura, HTML, solo URLs o códigos. */
export function isIncoherentFeedText(value: string | null | undefined): boolean {
  const text = unwrapQuotedMessage(stripMessageHtml(value ?? "")) ?? "";
  if (text.length < 2) return true;

  const letters = (text.match(/\p{L}/gu) ?? []).length;
  if (letters < 2) return true;
  if (text.length >= 12 && letters / text.length < 0.25) return true;

  const normalizedUrlLike = text
    .replace(/^[([{<\s"']+/, "")
    .replace(/[)\]}>.,\s"']+$/, "");
  if (/^https?:\/\/\S+$/i.test(normalizedUrlLike)) return true;
  if (/airbnb\.com(?:\.[a-z]{2,3})?\/(?:ac\/)?account-settings\/email-unsubscribe/i.test(text)) {
    return true;
  }
  if (!/\s/.test(text) && /^[A-Za-z0-9+/=_-]{48,}$/.test(text)) return true;
  if (/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+\./.test(text)) return true;
  if (/^[A-Z0-9]{6,12}$/.test(text)) return true;
  if (/^(null|undefined|n\/a|sin datos)$/i.test(text)) return true;

  if (/(\b\w+\b)(\s+\1){3,}/i.test(text)) return true;

  return false;
}
