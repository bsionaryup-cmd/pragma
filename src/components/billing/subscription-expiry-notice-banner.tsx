import { AlertTriangle } from "lucide-react";
import type { SubscriptionExpiryNotice } from "@/lib/billing/subscription-expiry-notice";

type SubscriptionExpiryNoticeBannerProps = {
  notice: SubscriptionExpiryNotice;
};

export function SubscriptionExpiryNoticeBanner({
  notice,
}: SubscriptionExpiryNoticeBannerProps) {
  return (
    <div className="border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-950">
      <div className="mx-auto flex max-w-7xl items-center justify-center gap-2 text-center">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <p>{notice.message}</p>
      </div>
    </div>
  );
}
