"use client";

import Link from "next/link";
import { Building2, Plus } from "lucide-react";
import { useI18n } from "@/components/providers/i18n-provider";
import { Button } from "@/components/ui/button";

type FirstPropertyBannerProps = {
  canCreate: boolean;
};

export function FirstPropertyBanner({ canCreate }: FirstPropertyBannerProps) {
  const { t } = useI18n();

  if (!canCreate) return null;

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-pragma-cyan/25 bg-pragma-gradient p-5 text-white shadow-pragma-card sm:flex-row sm:items-center sm:justify-between sm:p-6">
      <div className="flex items-start gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/15">
          <Building2 className="h-6 w-6" />
        </div>
        <div>
          <h2 className="font-heading text-lg font-semibold">
            {t("dashboard.emptyProperty.title")}
          </h2>
          <p className="mt-1 max-w-lg text-sm text-white/85">
            {t("dashboard.emptyProperty.description")}
          </p>
        </div>
      </div>
      <Button
        asChild
        variant="brandOutline"
        className="h-10 shrink-0 rounded-full border-white/40 bg-white px-5 text-pragma-black shadow-md hover:border-white/60 hover:bg-white/95 hover:text-pragma-black"
      >
        <Link href="/properties?create=true" className="text-pragma-black">
          <Plus className="mr-2 h-4 w-4 text-pragma-black" />
          {t("dashboard.emptyProperty.cta")}
        </Link>
      </Button>
    </div>
  );
}
