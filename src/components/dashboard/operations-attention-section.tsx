"use client";

import Link from "next/link";
import { CreditCard, KeyRound, MessageSquare, UserCheck } from "lucide-react";
import { useI18n } from "@/components/providers/i18n-provider";
import type {
  OperationsAttentionItem,
  OperationsAttentionKind,
} from "@/services/dashboard/operations-center.types";
import { cn } from "@/lib/utils";

const PRIORITY_KINDS: OperationsAttentionKind[] = [
  "messages",
  "registration",
  "ttlock",
  "payment",
];

const KIND_META: Record<
  OperationsAttentionKind,
  { icon: typeof MessageSquare; accent: string }
> = {
  messages: { icon: MessageSquare, accent: "text-pragma-caramel" },
  registration: { icon: UserCheck, accent: "text-pragma-sand-oak" },
  ttlock: { icon: KeyRound, accent: "text-pragma-olive-leaf" },
  payment: { icon: CreditCard, accent: "text-pragma-caramel" },
  cleaning: { icon: MessageSquare, accent: "text-muted-foreground" },
  sync: { icon: MessageSquare, accent: "text-muted-foreground" },
};

type OperationsAttentionSectionProps = {
  items: OperationsAttentionItem[];
};

export function OperationsAttentionSection({ items }: OperationsAttentionSectionProps) {
  const { t } = useI18n();
  const visible = items.filter((item) => PRIORITY_KINDS.includes(item.kind)).slice(0, 4);

  return (
    <section className="relative overflow-hidden rounded-2xl border border-border/80 bg-card shadow-pragma-soft">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-pragma-caramel/40 to-transparent"
        aria-hidden
      />
      <div className="border-b border-border/60 px-5 py-4 sm:px-6">
        <h2 className="font-heading text-lg font-semibold tracking-tight text-foreground">
          {t("dashboard.sections.alerts")}
        </h2>
      </div>

      {visible.length === 0 ? (
        <p className="px-5 py-8 text-sm text-muted-foreground sm:px-6">
          {t("dashboard.alerts.none")}
        </p>
      ) : (
        <ul className="divide-y divide-border/60">
          {visible.map((item) => {
            const meta = KIND_META[item.kind];
            const Icon = meta.icon;

            return (
              <li key={item.id}>
                <Link
                  href={item.href}
                  className="group flex items-center gap-4 px-5 py-4 transition-colors hover:bg-muted/20 sm:px-6"
                >
                  <span
                    className={cn(
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted/40",
                      meta.accent,
                    )}
                  >
                    <Icon className="h-4 w-4" strokeWidth={1.75} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        "text-sm font-medium leading-snug text-foreground",
                        item.severity === "critical" && "text-destructive",
                      )}
                    >
                      {t(`dashboard.attention.${item.kind}`, { count: item.count })}
                    </p>
                  </div>
                  {item.count > 1 ? (
                    <span className="shrink-0 rounded-full bg-pragma-caramel/15 px-2.5 py-0.5 text-xs font-semibold tabular-nums text-pragma-caramel">
                      {item.count}
                    </span>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
