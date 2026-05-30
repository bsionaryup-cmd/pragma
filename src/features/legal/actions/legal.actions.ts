"use server";

import { headers } from "next/headers";
import { db } from "@/lib/db";
import { requireDbUser } from "@/lib/auth";
import {
  LEGAL_DOCUMENT_VERSION,
  SIGNUP_LEGAL_DOCUMENT_TYPES,
} from "@/lib/legal/documents";

async function readRequestMeta() {
  const headerStore = await headers();
  const forwarded = headerStore.get("x-forwarded-for");
  const ipAddress = forwarded?.split(",")[0]?.trim() ?? headerStore.get("x-real-ip");
  const userAgent = headerStore.get("user-agent");
  return { ipAddress: ipAddress ?? null, userAgent: userAgent ?? null };
}

export async function recordSignupLegalAcceptanceAction() {
  const user = await requireDbUser();
  const { ipAddress, userAgent } = await readRequestMeta();
  const acceptedAt = new Date();

  for (const documentType of SIGNUP_LEGAL_DOCUMENT_TYPES) {
    const existing = await db.legalDocumentAcceptance.findFirst({
      where: {
        userId: user.id,
        documentType,
        documentVersion: LEGAL_DOCUMENT_VERSION,
      },
      select: { id: true },
    });
    if (existing) continue;

    await db.legalDocumentAcceptance.create({
      data: {
        userId: user.id,
        documentType,
        documentVersion: LEGAL_DOCUMENT_VERSION,
        acceptedAt,
        ipAddress,
        userAgent,
      },
    });
  }

  return { ok: true as const };
}
