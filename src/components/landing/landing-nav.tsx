"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { APP_NAME } from "@/lib/constants";
import { Button } from "@/components/ui/button";

const links = [
  { href: "#features", label: "Funciones" },
  { href: "#product", label: "Producto" },
  { href: "#benefits", label: "Beneficios" },
];

export function LandingNav() {
  return (
    <motion.header
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.21, 0.47, 0.32, 0.98] }}
      className="sticky top-0 z-50 border-b border-[#E9ECEF]/80 bg-white/90 backdrop-blur-xl"
    >
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <Link
          href="/"
          className="text-lg font-bold tracking-tight text-[#111111]"
        >
          {APP_NAME}
          <span className="ml-1.5 font-normal text-[#6B7280]">PMS</span>
        </Link>

        <ul className="hidden items-center gap-10 md:flex">
          {links.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                className="text-sm font-medium text-[#6B7280] transition-colors hover:text-[#111111]"
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
            className="hidden text-[#6B7280] hover:bg-[#F7F8FA] hover:text-[#111111] sm:inline-flex"
            asChild
          >
            <Link href="/sign-in">Iniciar sesión</Link>
          </Button>
          <Button
            size="sm"
            className="rounded-lg bg-[#0E9F8D] text-white hover:bg-[#0B7A6E]"
            asChild
          >
            <Link href="/sign-up">Comenzar gratis</Link>
          </Button>
        </div>
      </nav>
    </motion.header>
  );
}
