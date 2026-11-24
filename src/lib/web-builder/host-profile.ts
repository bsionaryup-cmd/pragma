import { z } from "zod";

/**
 * Optional editorial host profile for tenant public sites.
 * Stored as JSON on TenantWebSite.hostProfile. No external scraping:
 * every value is typed in by the host/tenant.
 */

const trimmedOrNull = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null));

const photoUrl = z
  .string()
  .trim()
  .max(2048)
  .optional()
  .nullable()
  .transform((v) => {
    if (!v) return null;
    if (v.startsWith("/")) return v;
    try {
      const url = new URL(v);
      return url.protocol === "https:" || url.protocol === "http:" ? v : null;
    } catch {
      return null;
    }
  });

export const hostTestimonialSchema = z.object({
  quote: z.string().trim().min(1).max(600),
  guestName: z.string().trim().min(1).max(120),
});

export const hostProfileSchema = z.object({
  hostName: trimmedOrNull(120),
  hostPhotoUrl: photoUrl,
  hostBio: trimmedOrNull(4000),
  hostExperience: trimmedOrNull(1000),
  hostRating: z
    .number()
    .min(0)
    .max(5)
    .optional()
    .nullable()
    .transform((v) => (v == null || v <= 0 ? null : v)),
  hostReviewCount: z
    .number()
    .int()
    .min(0)
    .max(1_000_000)
    .optional()
    .nullable()
    .transform((v) => (v == null || v <= 0 ? null : v)),
  hostTestimonials: z
    .array(hostTestimonialSchema)
    .max(6)
    .optional()
    .nullable()
    .transform((v) => v ?? []),
});

export type HostProfile = {
  hostName: string | null;
  hostPhotoUrl: string | null;
  hostBio: string | null;
  hostExperience: string | null;
  hostRating: number | null;
  hostReviewCount: number | null;
  hostTestimonials: Array<{ quote: string; guestName: string }>;
};

export const EMPTY_HOST_PROFILE: HostProfile = {
  hostName: null,
  hostPhotoUrl: null,
  hostBio: null,
  hostExperience: null,
  hostRating: null,
  hostReviewCount: null,
  hostTestimonials: [],
};

/** Tolerant parse of the stored JSON; invalid pieces are dropped, never thrown. */
export function parseHostProfile(raw: unknown): HostProfile | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;

  const testimonials = Array.isArray(record.hostTestimonials)
    ? record.hostTestimonials.flatMap((item) => {
        const parsed = hostTestimonialSchema.safeParse(item);
        return parsed.success ? [parsed.data] : [];
      })
    : [];

  const parsed = hostProfileSchema.safeParse({
    ...record,
    hostTestimonials: testimonials,
  });
  if (!parsed.success) return null;
  return hostProfileHasContent(parsed.data) ? parsed.data : null;
}

export function hostProfileHasContent(profile: HostProfile | null | undefined): boolean {
  if (!profile) return false;
  return Boolean(
    profile.hostName ||
      profile.hostPhotoUrl ||
      profile.hostBio ||
      profile.hostExperience ||
      profile.hostRating ||
      profile.hostReviewCount ||
      profile.hostTestimonials.length > 0,
  );
}
