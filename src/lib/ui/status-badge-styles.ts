import { cn } from "@/lib/utils";

export type SemanticBadgeVariant =
  | "primary"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "neutral";

const SEMANTIC_BADGE_CLASSES: Record<SemanticBadgeVariant, string> = {
  primary: "border-primary/30 bg-primary/10 text-primary",
  success: "border-success/30 bg-success/10 text-success",
  warning: "border-warning/40 bg-warning/15 text-warning",
  danger: "border-danger/30 bg-danger/10 text-danger",
  info: "border-info/30 bg-info/10 text-info",
  neutral: "border-border bg-muted text-muted-foreground",
};

export function getSemanticBadgeClass(variant: SemanticBadgeVariant): string {
  return SEMANTIC_BADGE_CLASSES[variant];
}

export function getPricingReasonBadgeClass(
  reason: "underpriced" | "overpriced" | "sync_error" | "pending_sync" | string,
): string {
  switch (reason) {
    case "underpriced":
      return getSemanticBadgeClass("warning");
    case "overpriced":
      return getSemanticBadgeClass("info");
    case "sync_error":
      return getSemanticBadgeClass("danger");
    case "pending_sync":
      return getSemanticBadgeClass("neutral");
    default:
      return getSemanticBadgeClass("neutral");
  }
}

export function getAccessStageBadgeClass(
  stage: string,
): string {
  switch (stage) {
    case "generated":
      return getSemanticBadgeClass("success");
    case "awaiting_registration":
      return getSemanticBadgeClass("warning");
    case "pending_approval":
    case "ready_to_generate":
      return getSemanticBadgeClass("info");
    case "revoked":
    case "expired":
      return getSemanticBadgeClass("neutral");
    default:
      return getSemanticBadgeClass("warning");
  }
}

export function cnSemanticBadge(
  variant: SemanticBadgeVariant,
  className?: string,
): string {
  return cn(getSemanticBadgeClass(variant), className);
}
