import Link from "next/link";
import { DemoSandboxView } from "@/features/demo/components/demo-sandbox-view";
import { LandingFooter } from "@/components/landing/landing-footer";
import { LandingNav } from "@/components/landing/landing-nav";
import { PragmaLogo } from "@/components/brand/pragma-logo";
import { getLandingPrimaryCta } from "@/lib/landing-session";
import { getLandingSession } from "@/lib/landing-session.server";

export default async function DemoPage() {
  const session = await getLandingSession();
  const primary = getLandingPrimaryCta(session);

  return (
    <div className="min-h-screen bg-pragma-soft-gray text-pragma-black antialiased">
      <LandingNav session={session} />
      <header className="border-b bg-white px-6 py-6 text-center">
        <PragmaLogo variant="full" tone="light" fullClassName="mx-auto h-8 w-auto" />
        <p className="mt-3 text-sm text-pragma-mid-gray">
          Explora PRAGMA con datos de ejemplo ·{" "}
          <Link href={primary.href} className="font-medium text-pragma-electric underline">
            {primary.label}
          </Link>
        </p>
      </header>
      <DemoSandboxView />
      <LandingFooter />
    </div>
  );
}
