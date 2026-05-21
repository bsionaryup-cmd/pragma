"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { PragmaLogo } from "@/components/brand/pragma-logo";
import { APP_DEMO_CTA } from "@/lib/constants";
import { Button } from "@/components/ui/button";

const links = [
  { href: "#solution", label: "Solución" },
  { href: "#product", label: "Producto" },
  { href: "#integrations", label: "Integraciones" },
  { href: "#benefits", label: "Beneficios" },
];

export function LandingNav() {
  return (
    <motion.header
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.21, 0.47, 0.32, 0.98] }}
      className="sticky top-0 z-50 border-b border-pragma-border/80 bg-white/95 backdrop-blur-xl"
    >
      <nav
        className="mx-auto flex h-[4.25rem] max-w-7xl items-center justify-between gap-6 px-6"
        aria-label="Principal"
      >
        <Link
          href="/"
          className="flex min-w-0 items-center py-1"
          aria-label="PRAGMA — inicio"
        >
          <PragmaLogo
            variant="full"
            tone="light"
            priority
            fullClassName="h-8 w-auto max-w-[min(100%,11rem)] sm:h-9"
          />
        </Link>

        <ul className="hidden items-center gap-8 md:flex">
          {links.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                className="text-sm font-medium text-pragma-mid-gray transition-colors hover:text-pragma-black"
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <Button
            variant="ghost"
            size="sm"
            className="hidden text-pragma-mid-gray hover:bg-pragma-soft-gray hover:text-pragma-black sm:inline-flex"
            asChild
          >
            <Link href="/sign-in">Iniciar sesión</Link>
          </Button>
          <Button variant="brand" size="sm" asChild>
            <Link href="/sign-up">{APP_DEMO_CTA}</Link>
          </Button>
        </div>
      </nav>
    </motion.header>
  );
}
