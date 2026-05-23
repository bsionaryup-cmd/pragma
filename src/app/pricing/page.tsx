import Link from "next/link";
import { LandingFooter } from "@/components/landing/landing-footer";
import { LandingNav } from "@/components/landing/landing-nav";
import { BackLink } from "@/components/ui/back-link";
import { LandingPricing } from "@/components/landing/landing-pricing";
import { LandingSocialProof } from "@/components/landing/landing-social-proof";
import { getLandingPrimaryCta } from "@/lib/landing-session";
import { getLandingSession } from "@/lib/landing-session.server";
import { Button } from "@/components/ui/button";

export default async function PricingPage() {
  const session = await getLandingSession();
  const primary = getLandingPrimaryCta(session);

  return (
    <div className="min-h-screen bg-white text-pragma-black antialiased">
      <LandingNav session={session} />
      <main className="pt-8">
        <div className="mx-auto max-w-6xl px-6">
          <BackLink href="/" label="Inicio" className="mb-4" />
        </div>
        <LandingPricing session={session} />
        <LandingSocialProof />
        <section className="border-t border-pragma-border py-16 text-center">
          <Button variant="brand" size="lg" className="h-12 px-8" asChild>
            <Link href={primary.href}>{primary.label}</Link>
          </Button>
        </section>
      </main>
      <LandingFooter />
    </div>
  );
}
