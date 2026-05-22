import type { Metadata } from "next";
import { LandingPage } from "@/components/landing/landing-page";
import { landingMetadata } from "@/lib/seo";
import { getLandingSession } from "@/lib/landing-session.server";

export async function generateMetadata(): Promise<Metadata> {
  return landingMetadata;
}

export default async function HomePage() {
  const session = await getLandingSession();
  return <LandingPage session={session} />;
}
