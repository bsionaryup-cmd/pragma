/**
 * Normaliza URLs de imagen para Next/Image.
 * Devuelve null si el valor no es una URL/ruta válida.
 */
export function normalizeInboxImageSrc(
  value: unknown,
): string | null {
  if (value == null) return null;

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (trimmed === "{}" || trimmed === "[object Object]") return null;
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
      try {
        const url = new URL(trimmed);
        return url.protocol === "http:" || url.protocol === "https:"
          ? url.toString()
          : null;
      } catch {
        return null;
      }
    }
    if (trimmed.startsWith("/")) return trimmed;
    return null;
  }

  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (typeof record.src === "string") {
      return normalizeInboxImageSrc(record.src);
    }
    if (typeof record.url === "string") {
      return normalizeInboxImageSrc(record.url);
    }
  }

  return null;
}
