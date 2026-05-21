/** Canonical PRAGMA brand asset paths (public/branding/). */

export const BRAND_ASSETS = {
  logoFull: "/branding/logo-full.png",
  logoFullLight: "/branding/logo-full-light.png",
  logoFullDark: "/branding/logo-full-dark.png",
  logoStacked: "/branding/logo-stacked.png",
  logoMark: "/branding/logo-mark.png",
  loader: "/branding/loader.svg",
  loaderPng: "/branding/loader.png",
  favicon: "/branding/favicon.ico",
  favicon16: "/branding/manifest-icons/icon-16.png",
  favicon32: "/branding/manifest-icons/icon-32.png",
  appleTouch: "/branding/apple-touch-icon.png",
  og: "/branding/og-image.png",
  emptyState: "/branding/logo-mark.png",
  manifestIcons: {
    icon192: "/branding/manifest-icons/icon-192.png",
    icon512: "/branding/manifest-icons/icon-512.png",
  },
} as const;

export type BrandLogoVariant =
  | "full"
  | "fullLight"
  | "fullDark"
  | "stacked"
  | "mark";
