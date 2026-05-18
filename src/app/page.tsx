import type { Metadata } from "next";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { LandingPage } from "@/components/landing/landing-page";
import { APP_DESCRIPTION, APP_NAME } from "@/lib/constants";

export const metadata: Metadata = {
  title: `${APP_NAME} PMS — Gestión de propiedades y renta corta`,
  description: APP_DESCRIPTION,
};

export default async function HomePage() {
  const { userId } = await auth();
  if (userId) {
    redirect("/panel");
  }

  return <LandingPage />;
}
