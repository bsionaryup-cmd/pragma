"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { useI18n } from "@/components/providers/i18n-provider";
import { SectionCard } from "@/components/ui/section-card";
import type { OperationalFeedCard } from "@/services/novedades/operational-feed.types";

type OperationsFeedSectionProps = {
  cards: OperationalFeedCard[];
};

export function OperationsFeedSection({ cards }: OperationsFeedSectionProps) {
  const { t } = useI18n();
  const router = useRouter();

  return (
    <SectionCard
      title={t("dashboard.sections.activity")}
      description={t("dashboard.sections.activityDesc")}
      headerAction={
        <Link
          href="/novedades"
          className="text-xs font-medium text-pragma-electric hover:underline"
        >
          {t("dashboard.activity.viewAll")}
        </Link>
      }
    >
      {cards.length === 0 ? (
        <p className="px-4 py-6 text-sm text-muted-foreground sm:px-6">
          {t("common.noRecordsDetail")}
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {cards.map((card) => {
            const href = card.reservationId
              ? `/novedades?reservation=${card.reservationId}`
              : "/novedades";

            return (
              <li key={card.id}>
                <button
                  type="button"
                  onClick={() => router.push(href)}
                  className="group flex w-full items-start gap-3 px-4 py-4 text-left transition-colors hover:bg-muted/30 sm:px-6"
                >
                  <span className="mt-0.5 text-base leading-none" aria-hidden>
                    {card.emoji}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground">{card.narrative}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {[card.propertyLabel, card.relativeTime].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </SectionCard>
  );
}
