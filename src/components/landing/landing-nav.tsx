"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { PragmaLogo } from "@/components/brand/pragma-logo";
import { LogInButton } from "@/components/brand/auth-cta-buttons";
import {
  isInPageAnchorHref,
  LANDING_NAV_ITEMS,
  landingHomeSectionHref,
} from "@/lib/landing-public-nav";
import { type LandingSession } from "@/lib/landing-session";

type LandingNavProps = {
  session: LandingSession;
};

export function LandingNav({ session: _session }: LandingNavProps) {
  const pathname = usePathname();
  const links = LANDING_NAV_ITEMS.map((item) => ({
    label: item.label,
    href: landingHomeSectionHref(pathname, item.section),
  }));

  return (
    <motion.header
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.21, 0.47, 0.32, 0.98] }}
      className="sticky top-0 z-50 border-b border-pragma-border/80 bg-white/95 backdrop-blur-xl"
    >
      <nav
        className="mx-auto flex h-[4.25rem] max-w-7xl items-center justify-between gap-3 px-4 sm:gap-4 sm:px-6"
        aria-label="Principal"
      >
        <Link href="/" className="flex min-w-0 items-center py-1" aria-label="PRAGMA — inicio">
          <PragmaLogo
            variant="full"
            tone="light"
            priority
            fullClassName="h-8 w-auto max-w-[min(100%,11rem)] sm:h-9"
          />
        </Link>

        <ul className="hidden items-center gap-8 md:flex">
          {links.map((link) => (
            <li key={`${link.href}-${link.label}`}>
              {isInPageAnchorHref(link.href) ? (
                <a
                  href={link.href}
                  className="text-sm font-medium text-pragma-mid-gray transition-colors hover:text-pragma-black"
                >
                  {link.label}
                </a>
              ) : (
                <Link
                  href={link.href}
                  className="text-sm font-medium text-pragma-mid-gray transition-colors hover:text-pragma-black"
                >
                  {link.label}
                </Link>
              )}
            </li>
          ))}
        </ul>

        <div className="flex shrink-0 items-center">
          <LogInButton size="sm" className="whitespace-nowrap" label="Iniciar sesión" />
        </div>
      </nav>
    </motion.header>
  );
}
