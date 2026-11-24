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
  if (
    normalized.includes("high") ||
    normalized.includes("alto") ||
    normalized.includes("strong") ||
    normalized.includes("bien")
  ) {
    return "border-pragma-electric/35 bg-pragma-light-blue/70 text-pragma-electric";
  }
  if (normalized.includes("low") || normalized.includes("bajo")) {
    return "border-emerald-500/25 bg-emerald-500/10 text-emerald-800";
  }
  if (
    normalized.includes("medium") ||
    normalized.includes("medio") ||
    normalized.includes("normal")
  ) {
    return "border-emerald-600/20 bg-emerald-600/15 text-emerald-900";
  }
  return "bg-muted/30";
}

/** Compact money for calendar cells (e.g. 239.9K). */
export function formatCompactMoney(value: string | number | null | undefined) {
  if (value == null || value === "") return "—";
  const n = typeof value === "number" ? value : Number.parseFloat(value);
  if (!Number.isFinite(n)) return "—";
  if (Math.abs(n) >= 1000) {
    return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, "")}K`;
  }
  return String(Math.round(n));
}

export function formatRelativeSync(value: string | null | undefined) {
  if (!value) return "Sin sincronizar";
  const ts = Date.parse(value);
  if (!Number.isFinite(ts)) return "—";
  const diffMs = Date.now() - ts;
  const mins = Math.round(diffMs / 60_000);
  if (mins < 1) return "hace un momento";
  if (mins < 60) return `hace ${mins} min`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `hace ${hours} h`;
  const days = Math.round(hours / 24);
  return `hace ${days} d`;
}
