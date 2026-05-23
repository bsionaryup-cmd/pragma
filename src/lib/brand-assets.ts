/** Canonical PRAGMA brand asset paths (public/branding/). */

export const BRAND_ASSETS = {
  logoFull: "/branding/logo-full.png",
  logoFullLight: "/branding/logo-full-light.png",
  logoFullDark: "/branding/logo-full-dark.png",
  logoStacked: "/branding/logo-stacked.png",
  logoMark: "/branding/logo-mark.png",
  logoPMark: "/branding/logo-p-mark.png",
  airbnbMark: "/branding/airbnb-mark.png",
  loader: "/branding/loader.svg",
  loaderPng: "/branding/loader.png",
  /** Next.js app/favicon.ico — canonical tab icon */
  favicon: "/favicon.ico",
  faviconBranding: "/branding/favicon.ico",
  favicon16: "/branding/manifest-icons/icon-16.png",
  favicon32: "/branding/manifest-icons/icon-32.png",
  /** Public root — iOS/iPad Safari probes this path directly */
  appleTouch: "/apple-touch-icon.png",
  appleTouchBranding: "/branding/apple-touch-icon.png",
  icon192: "/icon-192.png",
  icon512: "/icon-512.png",
  og: "/branding/og-image.png",
  emptyState: "/branding/logo-mark.png",
  manifestIcons: {
    icon192: "/icon-192.png",
    icon512: "/icon-512.png",
    icon192Maskable: "/branding/manifest-icons/icon-192-maskable.png",
    icon512Maskable: "/branding/manifest-icons/icon-512-maskable.png",
  },
} as const;

export type BrandLogoVariant =
  | "full"
  | "fullLight"
  | "fullDark"
  | "stacked"
  | "mark";
