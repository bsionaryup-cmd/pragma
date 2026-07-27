import { GuestBrandMark } from "@/components/brand/guest-brand-mark";
import { StayPortalViewPanel } from "@/features/guests/components/stay-portal-view";
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
