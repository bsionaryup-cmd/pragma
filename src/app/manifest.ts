import type { MetadataRoute } from "next";
import { BRAND_ASSETS } from "@/lib/brand-assets";
import { BRAND } from "@/lib/brand";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: BRAND.productName,
    short_name: BRAND.name,
    description: BRAND.tagline,
    start_url: "/panel",
    display: "standalone",
    background_color: BRAND.colors.white,
    theme_color: BRAND.colors.darkNavy,
    icons: [
      {
        src: BRAND_ASSETS.manifestIcons.icon512,
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: BRAND_ASSETS.manifestIcons.icon192,
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: BRAND_ASSETS.appleTouch,
        sizes: "180x180",
        type: "image/png",
      },
    ],
  };
}
