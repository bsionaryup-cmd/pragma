import { LandingFooter } from "@/components/landing/landing-footer";
import { LandingNav } from "@/components/landing/landing-nav";
import { BackLink } from "@/components/ui/back-link";
import { LandingPricing } from "@/components/landing/landing-pricing";
import { CommercialContactButton } from "@/components/landing/commercial-contact-button";
import { LandingSocialProof } from "@/components/landing/landing-social-proof";
import { getLandingSession } from "@/lib/landing-session.server";

export default async function PricingPage() {
  const session = await getLandingSession();

  return (
    <div className="min-h-screen bg-white text-pragma-black antialiased">
      <LandingNav session={session} />
      <main className="pt-8">
        <div className="mx-auto max-w-6xl px-6">
          <BackLink href="/" label="Inicio" className="mb-4" />
        </div>
        <LandingPricing />
        <LandingSocialProof />
        <section className="border-t border-pragma-border py-16 text-center">
          <CommercialContactButton label="Solicitar demo" size="lg" />
        </section>
      </main>
      <LandingFooter />
    </div>
  );
}
