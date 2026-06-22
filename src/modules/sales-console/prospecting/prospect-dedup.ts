type ProspectDedupFields = {
  companyName: string;
  city?: string | null;
};

function normalizeDedupPart(value: string | null | undefined): string {
  return value?.trim().toLowerCase().replace(/\s+/g, " ") ?? "";
}

export function buildProspectDedupKey(input: ProspectDedupFields): string {
  return `${normalizeDedupPart(input.companyName)}|${normalizeDedupPart(input.city)}`;
}

export function filterProspectsForInsert<T extends ProspectDedupFields>(
  candidates: T[],
  existingKeys: Set<string>,
): { rows: T[]; skippedDuplicate: number } {
  const seenInBatch = new Set<string>();
  const rows: T[] = [];
  let skippedDuplicate = 0;

  for (const candidate of candidates) {
    const key = buildProspectDedupKey(candidate);
    if (seenInBatch.has(key) || existingKeys.has(key)) {
      skippedDuplicate += 1;
      continue;
    }
    seenInBatch.add(key);
    rows.push(candidate);
  }

  return { rows, skippedDuplicate };
}
