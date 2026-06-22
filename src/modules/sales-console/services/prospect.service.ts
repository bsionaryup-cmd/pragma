import "server-only";

import type { ProspectSegment, ProspectSource, ProspectStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { PROSPECT_PIPELINE_STATUSES } from "@/features/sales-console/types/prospect";

export type ProspectFormInput = {
  companyName: string;
  phone?: string | null;
  website?: string | null;
  instagram?: string | null;
  city?: string | null;
  segment: ProspectSegment;
  source: ProspectSource;
  notes?: string | null;
  status?: ProspectStatus;
};

function normalizeOptional(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

const MAX_NOTES_LENGTH = 16_000;

function normalizeNotes(value: string | null | undefined): string | null {
  const trimmed = normalizeOptional(value);
  if (!trimmed) return null;
  if (trimmed.length <= MAX_NOTES_LENGTH) return trimmed;
  return `${trimmed.slice(0, MAX_NOTES_LENGTH - 1)}…`;
}

function validateCompanyName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error("El nombre de empresa es obligatorio");
  }
  if (trimmed.length > 200) {
    throw new Error("El nombre de empresa es demasiado largo");
  }
  return trimmed;
}

function validatePipelineStatus(status: ProspectStatus): ProspectStatus {
  if (!PROSPECT_PIPELINE_STATUSES.includes(status)) {
    throw new Error("Estado no válido");
  }
  return status;
}

export async function listProspects(options?: { includeArchived?: boolean }) {
  return db.prospect.findMany({
    where: options?.includeArchived ? undefined : { archived: false },
    orderBy: { createdAt: "desc" },
  });
}

export async function getProspectById(id: string) {
  return db.prospect.findUnique({ where: { id } });
}

export async function updateProspectNotes(id: string, notes: string | null) {
  return db.prospect.update({
    where: { id },
    data: { notes: normalizeNotes(notes) },
  });
}

export async function createProspect(
  input: ProspectFormInput & { createdById: string },
) {
  return db.prospect.create({
    data: {
      companyName: validateCompanyName(input.companyName),
      phone: normalizeOptional(input.phone),
      website: normalizeOptional(input.website),
      instagram: normalizeOptional(input.instagram),
      city: normalizeOptional(input.city),
      segment: input.segment,
      source: input.source,
      notes: normalizeNotes(input.notes),
      status: "NEW",
      archived: false,
      score: null,
      estimatedProperties: null,
      createdById: input.createdById,
    },
  });
}

export async function updateProspect(id: string, input: ProspectFormInput) {
  return db.prospect.update({
    where: { id },
    data: {
      companyName: validateCompanyName(input.companyName),
      phone: normalizeOptional(input.phone),
      website: normalizeOptional(input.website),
      instagram: normalizeOptional(input.instagram),
      city: normalizeOptional(input.city),
      segment: input.segment,
      source: input.source,
      notes: normalizeNotes(input.notes),
      ...(input.status ? { status: validatePipelineStatus(input.status) } : {}),
    },
  });
}

export async function setProspectArchived(id: string, archived: boolean) {
  return db.prospect.update({
    where: { id },
    data: { archived },
  });
}

const BULK_CREATE_CHUNK_SIZE = 100;

export async function bulkCreateProspects(
  rows: ProspectFormInput[],
  createdById: string,
): Promise<{ imported: number }> {
  if (rows.length === 0) {
    return { imported: 0 };
  }

  const data = rows.map((input) => ({
    companyName: validateCompanyName(input.companyName),
    phone: normalizeOptional(input.phone),
    website: normalizeOptional(input.website),
    instagram: normalizeOptional(input.instagram),
    city: normalizeOptional(input.city),
    segment: input.segment,
    source: input.source,
    notes: normalizeOptional(input.notes),
    status: "NEW" as const,
    archived: false,
    score: null,
    estimatedProperties: null,
    createdById,
  }));

  let imported = 0;

  await db.$transaction(async (tx) => {
    for (let offset = 0; offset < data.length; offset += BULK_CREATE_CHUNK_SIZE) {
      const chunk = data.slice(offset, offset + BULK_CREATE_CHUNK_SIZE);
      const result = await tx.prospect.createMany({ data: chunk });
      imported += result.count;
    }
  });

  return { imported };
}
