export type ParsedProspectImportRow = {
  companyName: string;
  phone: string | null;
  website: string | null;
  city: string | null;
  instagram: string | null;
};

export type ParseProspectImportResult = {
  rows: ParsedProspectImportRow[];
  skippedEmpty: number;
  skippedInvalid: number;
};

const MAX_IMPORT_ROWS = 200;
const MAX_COMPANY_NAME_LENGTH = 200;
const MAX_PHONE_LENGTH = 50;
const MAX_WEBSITE_LENGTH = 500;
const MAX_CITY_LENGTH = 100;
const MAX_INSTAGRAM_LENGTH = 100;
const UTF8_BOM = "\uFEFF";

const COMPANY_HEADER_ALIASES = new Set([
  "companyname",
  "company",
  "empresa",
  "nombre",
  "name",
  "title",
  "negocio",
  "razonsocial",
]);

const PHONE_HEADER_ALIASES = new Set(["phone", "telefono", "teléfono", "tel", "celular", "movil", "móvil"]);
const WEBSITE_HEADER_ALIASES = new Set(["website", "web", "sitio", "url", "pagina", "página"]);
const CITY_HEADER_ALIASES = new Set(["city", "ciudad", "municipio", "location"]);
const INSTAGRAM_HEADER_ALIASES = new Set(["instagram", "ig", "redsocial"]);

function normalizeHeader(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]/g, "");
}

function normalizeCell(value: string | undefined, maxLength?: number): string | null {
  const trimmed = value?.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").trim();
  if (!trimmed) return null;
  if (maxLength && trimmed.length > maxLength) {
    return trimmed.slice(0, maxLength);
  }
  return trimmed;
}

function isValidCompanyName(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length <= MAX_COMPANY_NAME_LENGTH;
}

function detectDelimiter(lines: string[]): "\t" | "|" | "," | null {
  const sample = lines.slice(0, 8);
  const tabHits = sample.filter((line) => line.includes("\t")).length;
  const pipeHits = sample.filter((line) => line.includes("|")).length;
  const commaHits = sample.filter((line) => line.includes(",")).length;

  if (tabHits >= 2 || (tabHits > 0 && tabHits >= pipeHits && tabHits >= commaHits)) {
    return "\t";
  }
  if (pipeHits >= 2 || (pipeHits > 0 && pipeHits >= commaHits)) {
    return "|";
  }
  if (commaHits >= 2) {
    return ",";
  }
  return null;
}

function splitRow(line: string, delimiter: string): string[] {
  if (delimiter === ",") {
    return line.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map((cell) => cell.replace(/^"|"$/g, "").trim());
  }
  return line.split(delimiter).map((cell) => cell.trim());
}

function resolveHeaderIndex(
  headers: string[],
): Partial<Record<keyof ParsedProspectImportRow, number>> {
  const map: Partial<Record<keyof ParsedProspectImportRow, number>> = {};

  headers.forEach((header, index) => {
    const normalized = normalizeHeader(header);
    if (COMPANY_HEADER_ALIASES.has(normalized)) map.companyName = index;
    else if (PHONE_HEADER_ALIASES.has(normalized)) map.phone = index;
    else if (WEBSITE_HEADER_ALIASES.has(normalized)) map.website = index;
    else if (CITY_HEADER_ALIASES.has(normalized)) map.city = index;
    else if (INSTAGRAM_HEADER_ALIASES.has(normalized)) map.instagram = index;
  });

  return map;
}

function looksLikeHeaderRow(cells: string[]): boolean {
  const normalized = cells.map((cell) => normalizeHeader(cell));
  return normalized.some((cell) => COMPANY_HEADER_ALIASES.has(cell));
}

function rowFromCells(
  cells: string[],
  headerMap: Partial<Record<keyof ParsedProspectImportRow, number>>,
): ParsedProspectImportRow | null {
  const companyName =
    headerMap.companyName !== undefined
      ? normalizeCell(cells[headerMap.companyName])
      : normalizeCell(cells[0]);

  if (!companyName || !isValidCompanyName(companyName)) {
    return null;
  }

  return {
    companyName: companyName.trim(),
    phone:
      headerMap.phone !== undefined
        ? normalizeCell(cells[headerMap.phone], MAX_PHONE_LENGTH)
        : normalizeCell(cells[1], MAX_PHONE_LENGTH),
    website:
      headerMap.website !== undefined
        ? normalizeCell(cells[headerMap.website], MAX_WEBSITE_LENGTH)
        : normalizeCell(cells[2], MAX_WEBSITE_LENGTH),
    city:
      headerMap.city !== undefined
        ? normalizeCell(cells[headerMap.city], MAX_CITY_LENGTH)
        : normalizeCell(cells[3], MAX_CITY_LENGTH),
    instagram:
      headerMap.instagram !== undefined
        ? normalizeCell(cells[headerMap.instagram], MAX_INSTAGRAM_LENGTH)
        : normalizeCell(cells[4], MAX_INSTAGRAM_LENGTH),
  };
}

function parseSimpleList(lines: string[]): ParseProspectImportResult {
  const rows: ParsedProspectImportRow[] = [];
  let skippedEmpty = 0;
  let skippedInvalid = 0;

  for (const line of lines) {
    const companyName = line.trim();
    if (!companyName) {
      skippedEmpty += 1;
      continue;
    }
    if (!isValidCompanyName(companyName)) {
      skippedInvalid += 1;
      continue;
    }
    rows.push({
      companyName,
      phone: null,
      website: null,
      city: null,
      instagram: null,
    });
  }

  return capParseResult({ rows, skippedEmpty, skippedInvalid });
}

function parseDelimitedText(lines: string[], delimiter: string): ParseProspectImportResult {
  const rows: ParsedProspectImportRow[] = [];
  let skippedEmpty = 0;
  let skippedInvalid = 0;

  const firstCells = splitRow(lines[0] ?? "", delimiter);
  const hasHeader = looksLikeHeaderRow(firstCells);
  const headerMap = hasHeader ? resolveHeaderIndex(firstCells) : {};
  const dataLines = hasHeader ? lines.slice(1) : lines;

  for (const line of dataLines) {
    if (!line.trim()) {
      skippedEmpty += 1;
      continue;
    }

    const cells = splitRow(line, delimiter);
    const parsed = rowFromCells(cells, headerMap);
    if (!parsed) {
      skippedInvalid += 1;
      continue;
    }
    rows.push(parsed);
  }

  return capParseResult({ rows, skippedEmpty, skippedInvalid });
}

function capParseResult(result: ParseProspectImportResult): ParseProspectImportResult {
  if (result.rows.length <= MAX_IMPORT_ROWS) {
    return result;
  }

  const overflow = result.rows.length - MAX_IMPORT_ROWS;
  return {
    rows: result.rows.slice(0, MAX_IMPORT_ROWS),
    skippedEmpty: result.skippedEmpty,
    skippedInvalid: result.skippedInvalid + overflow,
  };
}

export function parseProspectImportText(rawText: string): ParseProspectImportResult {
  const withoutBom = rawText.startsWith(UTF8_BOM) ? rawText.slice(UTF8_BOM.length) : rawText;
  const normalized = withoutBom.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
  if (!normalized) {
    return { rows: [], skippedEmpty: 0, skippedInvalid: 0 };
  }

  const lines = normalized.split("\n").map((line) => line.trimEnd());

  if (lines.length === 0) {
    return { rows: [], skippedEmpty: 0, skippedInvalid: 0 };
  }

  const delimiter = detectDelimiter(lines);
  if (!delimiter) {
    return parseSimpleList(lines);
  }

  return parseDelimitedText(lines, delimiter);
}

export const PROSPECT_IMPORT_MAX_ROWS = MAX_IMPORT_ROWS;
