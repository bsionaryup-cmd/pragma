"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogInButton } from "@/components/brand/auth-cta-buttons";
import { PragmaLogo } from "@/components/brand/pragma-logo";
import { BRAND } from "@/lib/brand";
import {
  isInPageAnchorHref,
  LANDING_FOOTER_ITEMS,
  LANDING_LEGAL_FOOTER_ITEMS,
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
        <div className="flex flex-col gap-10 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-sm space-y-4">
            <PragmaLogo
              variant="full"
              tone="light"
              fullClassName="h-8 w-auto max-w-[11rem]"
            />
            <p className="text-sm leading-relaxed text-pragma-mid-gray">
              {BRAND.positioning}
            </p>
            <p className="text-xs leading-relaxed text-pragma-mid-gray/90">
              © {year} {BRAND.productName}. Todos los derechos reservados.
            </p>
          </div>

          <div className="grid gap-8 sm:grid-cols-2">
            <nav aria-label="Pie de página">
              <p className="text-xs font-semibold uppercase tracking-wide text-pragma-black">
                Producto
              </p>
              <ul className="mt-3 flex flex-col gap-2">
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

            <nav aria-label="Legal">
              <p className="text-xs font-semibold uppercase tracking-wide text-pragma-black">
                Legal
              </p>
              <ul className="mt-3 flex flex-col gap-2">
                {LANDING_LEGAL_FOOTER_ITEMS.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-pragma-mid-gray transition-colors hover:text-pragma-electric"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        </div>
      </div>
    </footer>
  );
}
