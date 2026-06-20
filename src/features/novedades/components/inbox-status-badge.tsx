"use client";

import type { InboxThreadStatus } from "@/features/novedades/lib/inbox-thread-status";
import { INBOX_THREAD_STATUS_LABELS } from "@/features/novedades/lib/inbox-thread-status";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<InboxThreadStatus, string> = {
  consulta: "bg-muted text-muted-foreground",
  reservada: "bg-emerald-500/10 text-emerald-800 dark:text-emerald-200",
  hospedado: "bg-emerald-500/10 text-emerald-800 dark:text-emerald-200",
  finalizada: "bg-muted/80 text-muted-foreground",
};

type InboxStatusBadgeProps = {
  status: InboxThreadStatus;
  className?: string;
};

export function InboxStatusBadge({ status, className }: InboxStatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium",
        STATUS_STYLES[status],
        className,
      )}
    >
      {INBOX_THREAD_STATUS_LABELS[status]}
    </span>
  );
}
