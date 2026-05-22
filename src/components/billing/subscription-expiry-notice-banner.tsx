import { AlertTriangle } from "lucide-react";
import { getSubscriptionExpiryNotice } from "@/lib/billing/subscription-expiry-notice";

export async function SubscriptionExpiryNoticeBanner() {
  const notice = await getSubscriptionExpiryNotice();
  if (!notice) return null;

  return (
    <div className="border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-950">
      <div className="mx-auto flex max-w-7xl items-center justify-center gap-2 text-center">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <p>{notice.message}</p>
      </div>
    </div>
  );
}
