"use client";

import dynamic from "next/dynamic";
import { LandingBackground } from "@/components/landing/landing-background";
import { LandingFooter } from "@/components/landing/landing-footer";
import { LandingHero } from "@/components/landing/landing-hero";
import { LandingNav } from "@/components/landing/landing-nav";
import {
  EMPTY_LANDING_SESSION,
  type LandingSession,
} from "@/lib/landing-session";

const LandingProblem = dynamic(() =>
  import("@/components/landing/landing-problem").then((m) => ({
    default: m.LandingProblem,
  })),
);
const LandingSolution = dynamic(() =>
  import("@/components/landing/landing-solution").then((m) => ({
    default: m.LandingSolution,
  })),
);
const LandingBenefits = dynamic(() =>
  import("@/components/landing/landing-benefits").then((m) => ({
    default: m.LandingBenefits,
  })),
);
const LandingShowcase = dynamic(() =>
  import("@/components/landing/landing-showcase").then((m) => ({
    default: m.LandingShowcase,
  })),
);
const LandingAutomation = dynamic(() =>
  import("@/components/landing/landing-automation").then((m) => ({
    default: m.LandingAutomation,
  })),
);
const LandingIntegrations = dynamic(() =>
  import("@/components/landing/landing-integrations").then((m) => ({
    default: m.LandingIntegrations,
  })),
);
const LandingPricing = dynamic(() =>
  import("@/components/landing/landing-pricing").then((m) => ({
    default: m.LandingPricing,
  })),
);
const LandingSocialProof = dynamic(() =>
  import("@/components/landing/landing-social-proof").then((m) => ({
    default: m.LandingSocialProof,
  })),
);
const LandingLeadCapture = dynamic(() =>
  import("@/components/landing/landing-lead-capture").then((m) => ({
    default: m.LandingLeadCapture,
  })),
);
const LandingCta = dynamic(() =>
  import("@/components/landing/landing-cta").then((m) => ({
    default: m.LandingCta,
  })),
);
type LandingPageProps = {
  session?: LandingSession;
};

export function LandingPage({ session = EMPTY_LANDING_SESSION }: LandingPageProps) {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-white text-pragma-black antialiased">
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
        <LandingPricing />
        <LandingSocialProof />
        <LandingLeadCapture />
        <LandingCta />
      </main>
      <LandingFooter />
    </div>
  );
}
