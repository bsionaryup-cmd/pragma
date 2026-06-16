import { notFound } from "next/navigation";

import { LandingProductScreenshotPreview } from "@/components/landing/landing-product-screenshot-preview";

/** Dev-only isolated preview for 0F-2 — returns 404 in production. */
export default function LandingProductScreenshotPreviewPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return <LandingProductScreenshotPreview />;
}
