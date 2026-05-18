import type { InboxConversationStatus } from "@/types/inbox";
import { cn } from "@/lib/utils";

type InboxStatusBadgeProps = {
  status: InboxConversationStatus;
  label: string;
};

export function InboxStatusBadge({ status, label }: InboxStatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex rounded-md px-2 py-0.5 text-xs font-medium",
        status === "open"
          ? "bg-[#e8f5e9] text-[#2e7d32]"
          : "bg-[#fce8ec] text-[#c62828]",
      )}
    >
      {label}
    </span>
  );
}
