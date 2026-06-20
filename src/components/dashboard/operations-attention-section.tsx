"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { useI18n } from "@/components/providers/i18n-provider";
import { SectionCard } from "@/components/ui/section-card";
import type { OperationsAttentionItem } from "@/services/dashboard/operations-center.types";
import { cn } from "@/lib/utils";

type OperationsAttentionSectionProps = {
  items: OperationsAttentionItem[];
};

export function OperationsAttentionSection({ items }: OperationsAttentionSectionProps) {
  const { t } = useI18n();

  return (
    <SectionCard
      title={t("dashboard.sections.alerts")}
      description={t("dashboard.sections.alertsDesc")}
    >
      {items.length === 0 ? (
        <p className="px-4 py-6 text-sm text-muted-foreground sm:px-6">
          {t("dashboard.alerts.none")}
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {items.map((item) => (
            <li key={item.id}>
              <Link
                href={item.href}
                className="group flex items-center justify-between gap-4 px-4 py-4 transition-colors hover:bg-muted/30 sm:px-6"
              >
                <div className="min-w-0">
                  <p
                    className={cn(
                      "text-sm font-medium text-foreground",
                      item.severity === "critical" && "text-destructive",
                    )}
                  >
                    {t(`dashboard.attention.${item.kind}`, { count: item.count })}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}
