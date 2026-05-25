"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FreeTrialButton, LogInButton } from "@/components/brand/auth-cta-buttons";
import { PragmaLogo } from "@/components/brand/pragma-logo";
import { BRAND } from "@/lib/brand";
import {
  isInPageAnchorHref,
  LANDING_FOOTER_ITEMS,
  landingHomeSectionHref,
} from "@/lib/landing-public-nav";

export function LandingFooter() {
  const pathname = usePathname();
  const footerLinks = LANDING_FOOTER_ITEMS.map((item) => ({
    label: item.label,
    href: landingHomeSectionHref(pathname, item.section),
  }));
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-pragma-border bg-white py-14">
      <div className="mx-auto max-w-7xl px-6">
        <div className="flex flex-col gap-10 md:flex-row md:items-start md:justify-between">
          <div className="max-w-sm space-y-4">
            <PragmaLogo
              variant="full"
              tone="light"
              fullClassName="h-8 w-auto max-w-[11rem]"
            />
            <p className="text-sm leading-relaxed text-pragma-mid-gray">
              {BRAND.positioning}
            </p>
            <div className="flex flex-wrap gap-3 pt-1">
              <FreeTrialButton size="sm" />
              <LogInButton size="sm" />
            </div>
            <p className="text-xs leading-relaxed text-pragma-mid-gray/90">
              © {year} {BRAND.productName}. Todos los derechos reservados.
            </p>
          </div>

          <nav aria-label="Pie de página">
            <ul className="flex flex-wrap gap-x-8 gap-y-3">
              {footerLinks.map((link) => (
                <li key={`${link.href}-${link.label}`}>
                  {isInPageAnchorHref(link.href) ? (
                    <a
                      href={link.href}
                      className="text-sm text-pragma-mid-gray transition-colors hover:text-pragma-electric"
                    >
                      {link.label}
                    </a>
                  ) : (
                    <Link
                      href={link.href}
                      className="text-sm text-pragma-mid-gray transition-colors hover:text-pragma-electric"
                    >
                      {link.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </div>
    </footer>
  );
}
