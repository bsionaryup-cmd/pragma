"use client";

import { LandingAutomation } from "@/components/landing/landing-automation";
import { LandingBackground } from "@/components/landing/landing-background";
import { LandingBenefits } from "@/components/landing/landing-benefits";
import { LandingCta } from "@/components/landing/landing-cta";
import { LandingFooter } from "@/components/landing/landing-footer";
import { LandingHero } from "@/components/landing/landing-hero";
import { LandingIntegrations } from "@/components/landing/landing-integrations";
import { LandingNav } from "@/components/landing/landing-nav";
import { LandingProblem } from "@/components/landing/landing-problem";
import { LandingShowcase } from "@/components/landing/landing-showcase";
import { LandingSolution } from "@/components/landing/landing-solution";

export function LandingPage() {
  return (
    <div className="relative min-h-screen bg-white text-pragma-black antialiased">
      <LandingBackground />
      <LandingNav />
      <main>
        <LandingHero />
        <LandingProblem />
        <LandingSolution />
        <LandingBenefits />
        <LandingShowcase />
        <LandingAutomation />
        <LandingIntegrations />
        <LandingCta />
      </main>
      <LandingFooter />
    </div>
  );
}
