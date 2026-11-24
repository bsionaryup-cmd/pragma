import { redirect } from "next/navigation";
import { GuestBrandMark } from "@/components/brand/guest-brand-mark";
import { StayPortalViewPanel } from "@/features/guests/components/stay-portal-view";
import { getGuestRegistrationLookupResult } from "@/services/guests/guest-registration.service";
import { getStayPortalByToken } from "@/services/guests/stay-portal.service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type StayPortalTokenPageProps = {
  params: Promise<{ token: string }>;
};

export default async function StayPortalTokenPage({
  params,
}: StayPortalTokenPageProps) {
  const { token } = await params;
  const portal = await getStayPortalByToken(token);

  // Legacy links: /stay/{guestRegistrationToken} (WEB BUILDER / older emails).
  // Resolve to the secure stay-portal token — never expose by reservationCode.
  if (portal.state === "not_found") {
    const legacy = await getGuestRegistrationLookupResult(token).catch(() => null);
    if (legacy?.state === "completed" && legacy.stayPortalUrl) {
      redirect(legacy.stayPortalUrl);
    }
  }

  return (
    <main className="min-h-screen bg-[#f7f9fc] px-4 py-6 text-foreground sm:py-10">
      <div className="mx-auto max-w-3xl space-y-4">
        <header className="flex justify-center py-1">
          <GuestBrandMark />
        </header>
        <StayPortalViewPanel portal={portal} />
      </div>
    </main>
  );
}
