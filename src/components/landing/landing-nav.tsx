"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { APP_DEMO_CTA, APP_NAME } from "@/lib/constants";
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
      className="sticky top-0 z-50 border-b border-pragma-border/80 bg-white/90 backdrop-blur-xl"
    >
      <nav
        className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6"
        aria-label="Principal"
      >
        <Link href="/" className="flex items-center gap-2">
          <span className="font-accent text-lg font-bold tracking-tight text-pragma-black">
            {APP_NAME}
          </span>
          <span className="hidden rounded-md bg-pragma-soft-cyan px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-pragma-electric sm:inline">
            Airbnb OS
          </span>
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

        <div className="flex items-center gap-3">
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
