/** Canonical PRAGMA brand asset paths (public/brand/). */

export const BRAND_ASSETS = {
  logoFull: "/brand/pragma-logo-full.png",
  logoFullSvg: "/brand/pragma-logo-full.svg",
  logoLight: "/brand/pragma-logo-light.svg",
  logoDark: "/brand/pragma-logo-dark.svg",
  symbol: "/brand/pragma-symbol-alpha.png",
  symbolSvg: "/brand/pragma-symbol.svg",
  symbolRaster: "/brand/pragma-symbol.png",
  symbolDark: "/brand/pragma-symbol-dark.png",
  loader: "/brand/pragma-loader.svg",
  favicon: "/brand/pragma-favicon.ico",
  faviconPng: "/brand/pragma-favicon-32.png",
  favicon16: "/brand/pragma-favicon-16.png",
  favicon32: "/brand/pragma-favicon-32.png",
  appleTouch: "/brand/pragma-apple-touch.png",
  pwa: "/brand/pragma-pwa-icon.png",
  og: "/brand/pragma-og-image.png",
  emptyState: "/brand/pragma-symbol-alpha.png",
} as const;

export type BrandLogoVariant =
  | "full"
  | "fullLight"
  | "fullDark"
  | "symbol"
  | "symbolDark";
