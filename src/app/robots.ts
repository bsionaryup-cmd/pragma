import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  const base = getSiteUrl();
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/panel", "/calendar", "/properties", "/integrations", "/settings", "/users", "/api/"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
