"use client";

import { LandingAutomation } from "@/components/landing/landing-automation";
import { LandingBackground } from "@/components/landing/landing-background";
import { LandingBenefits } from "@/components/landing/landing-benefits";
import { LandingCta } from "@/components/landing/landing-cta";
import { LandingFooter } from "@/components/landing/landing-footer";
import { LandingHero } from "@/components/landing/landing-hero";
import { LandingIntegrations } from "@/components/landing/landing-integrations";
import { LandingLeadCapture } from "@/components/landing/landing-lead-capture";
import { LandingNav } from "@/components/landing/landing-nav";
import { LandingPricing } from "@/components/landing/landing-pricing";
import { LandingProblem } from "@/components/landing/landing-problem";
import { LandingShowcase } from "@/components/landing/landing-showcase";
import { LandingSocialProof } from "@/components/landing/landing-social-proof";
import { LandingSolution } from "@/components/landing/landing-solution";
import {
  EMPTY_LANDING_SESSION,
  type LandingSession,
} from "@/lib/landing-session";

type LandingPageProps = {
  session?: LandingSession;
};

export function LandingPage({ session = EMPTY_LANDING_SESSION }: LandingPageProps) {
  return (
    <div className="relative min-h-screen bg-white text-pragma-black antialiased">
      <LandingBackground />
      <LandingNav session={session} />
      <main>
        <LandingHero session={session} />
        <LandingProblem />
        <LandingSolution />
        <LandingBenefits />
        <LandingShowcase />
        <LandingAutomation />
        <LandingIntegrations />
        <LandingPricing session={session} />
        <LandingSocialProof />
        <LandingLeadCapture session={session} />
        <LandingCta session={session} />
      </main>
      <LandingFooter />
    </div>
  );
}
