import type { CommandCenterData } from "@/services/dashboard/command-center.service";
import type { OperationalFeedCard } from "@/services/novedades/operational-feed.types";

export type OperationsAttentionKind =
  | "messages"
  | "registration"
  | "ttlock"
  | "payment"
  | "cleaning"
  | "sync";

export type OperationsAttentionItem = {
  id: string;
  kind: OperationsAttentionKind;
  count: number;
  href: string;
  severity: "critical" | "warning";
};

export type OperationsFinanceSummary = {
  netProfitFormatted: string;
  revenueFormatted: string;
  pendingIncomeFormatted: string;
  revenueTrend: number;
  expenseTrend: number;
  netTrend: number;
};

export type OperationsCenterSnapshot = {
  commandCenter: CommandCenterData;
  attention: OperationsAttentionItem[];
  attentionTotal: number;
  inboxAttentionCount: number;
  feedCards: OperationalFeedCard[];
  finance: OperationsFinanceSummary | null;
  smartAccessPending: number;
  /**
   * Cheap property count independent of command-center soft-fail.
   * `null` = unknown (do not show “empty org” banner).
   */
  reliablePropertyCount: number | null;
  /** True when command-center fell back to empty snapshot. */
  commandCenterDegraded: boolean;
};
