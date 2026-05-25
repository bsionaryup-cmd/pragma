import type { Locale } from "@/i18n/types";

export type SystemAnnouncementCategory = "maintenance" | "update" | "info";

export type SystemAnnouncement = {
  id: string;
  category: SystemAnnouncementCategory;
  title: string;
  body: string;
  publishedAt: string;
  expiresAt?: string | null;
};

/** Mensajes del sistema (mantenimiento, actualizaciones, avisos). Editar aquí o vía SYSTEM_NOVEDADES_JSON. */
const STATIC_ANNOUNCEMENTS: Record<Locale, SystemAnnouncement[]> = {
  es: [],
  en: [],
};

function parseEnvAnnouncements(): SystemAnnouncement[] {
  const raw = process.env.SYSTEM_NOVEDADES_JSON;
  if (!raw?.trim()) return [];

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidAnnouncement);
  } catch {
    return [];
  }
}

function isValidAnnouncement(value: unknown): value is SystemAnnouncement {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<SystemAnnouncement>;
  return (
    typeof item.id === "string" &&
    typeof item.title === "string" &&
    typeof item.body === "string" &&
    typeof item.publishedAt === "string" &&
    (item.category === "maintenance" ||
      item.category === "update" ||
      item.category === "info")
  );
}

function isActiveAnnouncement(
  announcement: SystemAnnouncement,
  now: number,
): boolean {
  const publishedAt = new Date(announcement.publishedAt).getTime();
  if (!Number.isFinite(publishedAt) || publishedAt > now) return false;

  if (announcement.expiresAt) {
    const expiresAt = new Date(announcement.expiresAt).getTime();
    if (Number.isFinite(expiresAt) && expiresAt < now) return false;
  }

  return true;
}

export function getActiveSystemAnnouncements(
  locale: Locale,
): SystemAnnouncement[] {
  const now = Date.now();
  const items = [
    ...(STATIC_ANNOUNCEMENTS[locale] ?? STATIC_ANNOUNCEMENTS.es),
    ...parseEnvAnnouncements(),
  ];

  const seen = new Set<string>();
  return items
    .filter((item) => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return isActiveAnnouncement(item, now);
    })
    .sort(
      (a, b) =>
        new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
    );
}
