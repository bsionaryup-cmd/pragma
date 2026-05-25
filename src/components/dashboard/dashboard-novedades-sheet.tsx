"use client";

import { useState } from "react";
import { Megaphone } from "lucide-react";
import { useI18n } from "@/components/providers/i18n-provider";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type {
  SystemAnnouncement,
  SystemAnnouncementCategory,
} from "@/lib/system-announcements";
import { cn } from "@/lib/utils";

type DashboardNovedadesSheetProps = {
  announcements: SystemAnnouncement[];
};

function categoryLabel(
  category: SystemAnnouncementCategory,
  t: ReturnType<typeof useI18n>["t"],
): string {
  switch (category) {
    case "maintenance":
      return t("dashboard.novedades.categories.maintenance");
    case "update":
      return t("dashboard.novedades.categories.update");
    default:
      return t("dashboard.novedades.categories.info");
  }
}

function categoryTone(category: SystemAnnouncementCategory): string {
  switch (category) {
    case "maintenance":
      return "bg-amber-500/10 text-amber-800 dark:text-amber-200";
    case "update":
      return "bg-pragma-electric/10 text-pragma-electric";
    default:
      return "bg-muted text-muted-foreground";
  }
}

function formatAnnouncementDate(date: Date, locale: "es" | "en"): string {
  return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "es-CO", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function DashboardNovedadesSheet({
  announcements,
}: DashboardNovedadesSheetProps) {
  const { t, locale } = useI18n();
  const [open, setOpen] = useState(false);
  const hasNews = announcements.length > 0;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="relative inline-flex h-10 items-center gap-2 rounded-full border border-border bg-card px-4 text-sm font-medium shadow-pragma-soft transition-colors hover:bg-accent"
        aria-label={t("dashboard.novedadesButton")}
      >
        <Megaphone className="h-4 w-4" strokeWidth={1.75} />
        {t("dashboard.novedadesButton")}
        {hasNews ? (
          <span
            className="absolute top-2 right-3 h-2 w-2 rounded-full bg-danger"
            aria-hidden
          />
        ) : null}
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          className="w-full gap-0 border-l border-border p-0 sm:max-w-md"
        >
          <SheetHeader className="border-b border-border px-6 py-5 text-start">
            <SheetTitle className="text-lg font-semibold">
              {t("dashboard.novedades.title")}
            </SheetTitle>
            <SheetDescription>
              {t("dashboard.novedades.description")}
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-6 py-5">
            {announcements.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t("dashboard.novedades.empty")}
              </p>
            ) : (
              <ul className="space-y-4">
                {announcements.map((item) => (
                  <li
                    key={item.id}
                    className="rounded-xl border border-border bg-card p-4 shadow-pragma-soft"
                  >
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      <span
                        className={cn(
                          "inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
                          categoryTone(item.category),
                        )}
                      >
                        {categoryLabel(item.category, t)}
                      </span>
                      <time
                        dateTime={item.publishedAt}
                        className="text-xs text-muted-foreground"
                      >
                        {formatAnnouncementDate(new Date(item.publishedAt), locale)}
                      </time>
                    </div>
                    <h3 className="text-sm font-semibold text-foreground">
                      {item.title}
                    </h3>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                      {item.body}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
