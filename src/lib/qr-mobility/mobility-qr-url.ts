import { randomBytes } from "node:crypto";
import { getPublicAppUrl } from "@/lib/app-url";

const MOBILITY_PUBLIC_PATH = "/m";

export function generateMobilityQrToken(): string {
  return randomBytes(24).toString("base64url");
}

export function buildMobilityPublicUrl(token: string): string {
  const base = getPublicAppUrl().replace(/\/$/, "");
  return `${base}${MOBILITY_PUBLIC_PATH}/${token}`;
}

export function slugifyAllyCode(name: string): string {
  const base = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);
  const suffix = randomBytes(3).toString("hex").toUpperCase();
  return base ? `${base}-${suffix}` : `ALLY-${suffix}`;
}
