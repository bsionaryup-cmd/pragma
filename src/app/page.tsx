import type { Metadata } from "next";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { LandingPage } from "@/components/landing/landing-page";
import { BRAND } from "@/lib/brand";
import { landingMetadata } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const { userId } = await auth();
  if (userId) {
    return { title: BRAND.productName };
  }
  return landingMetadata;
}

export default async function HomePage() {
  const { userId } = await auth();
  if (userId) {
    redirect("/panel");
  }

  return <LandingPage />;
}
