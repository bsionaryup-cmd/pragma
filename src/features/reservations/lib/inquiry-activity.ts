import { isPreReservationInquirySubject } from "@/services/novedades/novedades-unlinked-inquiry.logic";

export { isPreReservationInquirySubject };

export function readActivityMetadataSubject(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const subject = (metadata as { subject?: unknown }).subject;
  return typeof subject === "string" && subject.trim() ? subject.trim() : null;
}

export function isInquiryActivityMetadata(metadata: unknown): boolean {
  const subject = readActivityMetadataSubject(metadata);
  return subject ? isPreReservationInquirySubject(subject) : false;
}

export function resolveReservationActivityDisplayTitle(input: {
  title: string;
  metadata?: unknown;
}): string {
  if (input.title === "Consulta") return input.title;
  if (isInquiryActivityMetadata(input.metadata)) return "Consulta";
  return input.title;
}
