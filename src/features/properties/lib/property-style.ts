import type { PropertyStatus, PropertyType } from "@prisma/client";
import { cn } from "@/lib/utils";

const COVER_GRADIENTS = [
  "from-primary/80 to-info/80",
  "from-info/80 to-primary/60",
  "from-success/80 to-info/60",
  "from-primary/70 to-primary-hover/80",
  "from-warning/80 to-primary/60",
] as const;

export function getPropertyCoverGradient(id: string): string {
  const index =
    id.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0) %
    COVER_GRADIENTS.length;
  return COVER_GRADIENTS[index];
}

export function getPropertyStatusBadgeClass(status: PropertyStatus): string {
  switch (status) {
    case "ACTIVE":
      return "border-success/30 bg-success/10 text-success";
    case "MAINTENANCE":
      return "border-warning/30 bg-warning/10 text-warning";
    case "INACTIVE":
    default:
      return "border-border bg-muted text-muted-foreground";
  }
}

export function getPropertyTypeIconClass(type: PropertyType): string {
  switch (type) {
    case "HOUSE":
      return "text-warning";
    case "STUDIO":
      return "text-primary";
    case "ROOM":
      return "text-info";
    case "OTHER":
      return "text-text-subtle";
    case "APARTMENT":
    default:
      return "text-primary-hover";
  }
}

export function occupancyBarClass(percent: number): string {
  return cn(
    "h-1.5 rounded-full transition-all",
    percent >= 75
      ? "bg-danger"
      : percent >= 40
        ? "bg-warning"
        : "bg-success",
  );
}

export function getPropertyStatusDotClass(status: PropertyStatus): string {
  return cn(
    "h-2 w-2 shrink-0 rounded-full",
    status === "INACTIVE"
      ? "bg-text-subtle"
      : status === "MAINTENANCE"
        ? "bg-warning"
        : "bg-success",
  );
}
