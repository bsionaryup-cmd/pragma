import { formatDateTime } from "@/lib/helpers/date";

export function formatPriceLabsDate(value: string | null | undefined) {
  return formatDateTime(value, "—", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function formatPriceLabsMoney(value: string | number | null | undefined, currency = "COP") {
  if (value == null || value === "") return "—";
  const n = typeof value === "number" ? value : Number.parseFloat(value);
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(n);
}

export function formatShortDate(isoDate: string) {
  return new Date(`${isoDate}T12:00:00.000Z`).toLocaleDateString("es-CO", {
    day: "numeric",
    month: "short",
  });
}

export function syncStatusLabel(status: string) {
  switch (status) {
    case "SYNCED":
      return "Sincronizado";
    case "ERROR":
      return "Error";
    case "PENDING":
    default:
      return "Pendiente";
  }
}

export function matchReasonLabel(reason: string | null) {
  switch (reason) {
    case "listing_id":
      return "Listing ID guardado";
    case "property_id":
      return "ID coincidente";
    case "name_city":
      return "Nombre + ciudad";
    case "fuzzy":
      return "Coincidencia aproximada";
    default:
      return reason ?? "—";
  }
}

export function formatPriceDelta(value: string | null | undefined) {
  if (value == null || value === "") return "—";
  const n = Number.parseFloat(value);
  if (!Number.isFinite(n)) return "—";
  const prefix = n > 0 ? "+" : "";
  return `${prefix}${formatPriceLabsMoney(n)}`;
}

export function pricingHealthClass(
  health: "healthy" | "attention" | "critical" | "unknown",
) {
  switch (health) {
    case "healthy":
      return "text-success";
    case "attention":
      return "text-warning";
    case "critical":
      return "text-destructive";
    default:
      return "text-muted-foreground";
  }
}

export function demandLevelClass(level: string | null | undefined) {
  if (!level) return "bg-muted/40";
  const normalized = level.toLowerCase();
  if (normalized.includes("high") || normalized.includes("alto")) {
    return "border-amber-500/30 bg-amber-500/10";
  }
  if (normalized.includes("low") || normalized.includes("bajo")) {
    return "border-sky-500/30 bg-sky-500/10";
  }
  if (normalized.includes("medium") || normalized.includes("medio")) {
    return "border-emerald-500/30 bg-emerald-500/10";
  }
  return "bg-muted/30";
}
