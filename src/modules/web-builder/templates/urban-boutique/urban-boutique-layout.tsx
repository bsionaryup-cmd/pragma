import { Montserrat, Poppins } from "next/font/google";
import type { ReactNode } from "react";
import type { PublicSitePayload } from "@/lib/web-builder/serialize-public-site";

/** Manual de marca: Montserrat (títulos) + Poppins (textos) */
const display = Montserrat({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--wb-font-display",
  display: "swap",
});

const body = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--wb-font-body",
  display: "swap",
});

type UrbanBoutiqueLayoutProps = {
  site: PublicSitePayload;
  children: ReactNode;
};

export function UrbanBoutiqueLayout({ site, children }: UrbanBoutiqueLayoutProps) {
  const style = {
    ["--wb-soft-white" as string]: site.softWhite || "#F6F4F1",
    ["--wb-sand-oak" as string]: site.sandOak || "#D8C7AE",
    ["--wb-urban-gray" as string]: site.urbanGray || "#7C7A78",
    ["--wb-stone-taupe" as string]: site.stoneTaupe || "#8B7E72",
    ["--wb-matte-black" as string]: site.matteBlack || "#1F1F1F",
    ["--wb-accent" as string]: site.accentColor || "#6E7862",
    ["--wb-primary" as string]: site.primaryColor || "#1F1F1F",
  };

  return (
    <div
      className={`${display.variable} ${body.variable} min-h-dvh bg-[var(--wb-soft-white)] font-[family-name:var(--wb-font-body)] text-[var(--wb-matte-black)] antialiased`}
      style={style}
    >
      {children}
    </div>
  );
}
