"use client";

import { LandingAirbnb } from "@/components/landing/landing-airbnb";
import { LandingBackground } from "@/components/landing/landing-background";
import { LandingCta } from "@/components/landing/landing-cta";
import { LandingFeatures } from "@/components/landing/landing-features";
import { LandingFooter } from "@/components/landing/landing-footer";
import { LandingHero } from "@/components/landing/landing-hero";
import { LandingInbox } from "@/components/landing/landing-inbox";
import { LandingNav } from "@/components/landing/landing-nav";
import { LandingOperations } from "@/components/landing/landing-operations";

export function LandingPage() {
  return (
    <div className="relative min-h-screen bg-[#09090b] text-zinc-50 antialiased">
      <LandingBackground />
      <LandingNav />
      <main>
        <LandingHero />
        <LandingFeatures />
        <LandingAirbnb />
        <LandingInbox />
        <LandingOperations />
        <LandingCta />
      </main>
      <LandingFooter />
    </div>
  );
}
