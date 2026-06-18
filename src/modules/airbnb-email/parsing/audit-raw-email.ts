import type { Prisma } from "@prisma/client";
import type { InboundAirbnbEmailPayload } from "@/modules/airbnb-email/types";

/** Persist full email body + provider ids for Resend re-fetch. */
export function buildAuditRawEmailPayload(
  payload: Pick<
    InboundAirbnbEmailPayload,
    "from" | "to" | "subject" | "html" | "text" | "raw"
  >,
): Prisma.InputJsonValue {
  const base: Record<string, unknown> = {
    from: payload.from,
    to: payload.to,
    subject: payload.subject,
    html: payload.html ?? null,
    text: payload.text ?? null,
  };

  if (payload.raw && typeof payload.raw === "object" && !Array.isArray(payload.raw)) {
    Object.assign(base, payload.raw as Record<string, unknown>);
  }

  return base as Prisma.InputJsonValue;
}

export function readResendEmailIdFromAuditRaw(rawEmail: unknown): string | null {
  if (!rawEmail || typeof rawEmail !== "object" || Array.isArray(rawEmail)) return null;
  const record = rawEmail as Record<string, unknown>;
  if (typeof record.emailId === "string" && record.emailId.trim()) {
    return record.emailId.trim();
  }
  return null;
}
