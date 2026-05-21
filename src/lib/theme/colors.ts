import { BRAND } from "@/lib/brand";

/** PRAGMA premium SaaS palette — mirrors globals.css */
export const pragmaColors = {
  primary: BRAND.colors.electricBlue,
  primaryHover: BRAND.colors.midBlue,
  accent: BRAND.colors.cyan,
  white: BRAND.colors.white,
  softBackground: BRAND.colors.softGray,
  borderLight: BRAND.colors.borderGray,
  text: BRAND.colors.black,
  textSecondary: BRAND.colors.midGray,
  tealSoft: BRAND.colors.softCyan,
  success: "#0d9488",
  warning: "#f59e0b",
  danger: "#dc2626",
  gradient: BRAND.gradient,
} as const;

export const pragmaColorsDark = {
  background: BRAND.colors.darkNavy,
  surface: "#0f1f33",
  card: "#102238",
  text: "#f8fafc",
  textMuted: "#94a3b8",
  border: "#1e3a5f",
} as const;

export const pragmaCalendarWorkspace = {
  background: BRAND.colors.darkNavy,
  surface: "#102238",
  border: "#1e3a5f",
  text: "#f8fafc",
} as const;
