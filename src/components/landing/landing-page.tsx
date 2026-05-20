"use client";

import { LandingBackground } from "@/components/landing/landing-background";
import { LandingBenefits } from "@/components/landing/landing-benefits";
import { LandingCta } from "@/components/landing/landing-cta";
import { LandingFeatures } from "@/components/landing/landing-features";
import { LandingFooter } from "@/components/landing/landing-footer";
import { LandingHero } from "@/components/landing/landing-hero";
import { LandingNav } from "@/components/landing/landing-nav";
import { LandingShowcase } from "@/components/landing/landing-showcase";

export function LandingPage() {
  return (
    <div className="relative min-h-screen bg-white text-[#111111] antialiased">
      <LandingBackground />
      <LandingNav />
      <main>
        <LandingHero />
        <LandingFeatures />
        <LandingShowcase />
        <LandingBenefits />
        <LandingCta />
      </main>
      <LandingFooter />
    </div>
  );
}
