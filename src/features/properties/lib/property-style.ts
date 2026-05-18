import type { PropertyStatus, PropertyType } from "@prisma/client";
import { cn } from "@/lib/utils";

const COVER_GRADIENTS = [
  "from-rose-500/80 to-orange-400/80",
  "from-sky-500/80 to-indigo-500/80",
  "from-emerald-500/80 to-teal-400/80",
  "from-violet-500/80 to-fuchsia-400/80",
  "from-amber-500/80 to-yellow-400/80",
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
      return "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300";
    case "MAINTENANCE":
      return "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300";
    case "INACTIVE":
    default:
      return "border-border bg-muted text-muted-foreground";
  }
}

export function getPropertyTypeIconClass(type: PropertyType): string {
  switch (type) {
    case "HOUSE":
      return "text-orange-600";
    case "STUDIO":
      return "text-violet-600";
    case "ROOM":
      return "text-sky-600";
    case "OTHER":
      return "text-zinc-600";
    case "APARTMENT":
    default:
      return "text-rose-600";
  }
}

export function occupancyBarClass(percent: number): string {
  return cn(
    "h-1.5 rounded-full transition-all",
    percent >= 75
      ? "bg-rose-500"
      : percent >= 40
        ? "bg-amber-500"
        : "bg-emerald-500",
  );
}
