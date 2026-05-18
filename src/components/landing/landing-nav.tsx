"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { APP_NAME } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const links = [
  { href: "#features", label: "Funciones" },
  { href: "#airbnb", label: "Airbnb" },
  { href: "#inbox", label: "Bandeja" },
  { href: "#operations", label: "Operaciones" },
];

export function LandingNav() {
  return (
    <motion.header
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.21, 0.47, 0.32, 0.98] }}
      className="sticky top-0 z-50 border-b border-white/5 bg-[#09090b]/80 backdrop-blur-xl"
    >
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link
          href="/"
          className="text-lg font-semibold tracking-tight text-zinc-50"
        >
          {APP_NAME}
          <span className="ml-1.5 font-normal text-zinc-500">PMS</span>
        </Link>

        <ul className="hidden items-center gap-8 md:flex">
          {links.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                className="text-sm text-zinc-400 transition-colors hover:text-zinc-50"
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
            className={cn(
              "hidden text-zinc-400 hover:bg-white/5 hover:text-zinc-50 sm:inline-flex",
            )}
            asChild
          >
            <Link href="/sign-in">Iniciar sesión</Link>
          </Button>
          <Button
            size="sm"
            className="bg-zinc-50 text-zinc-950 hover:bg-zinc-200"
            asChild
          >
            <Link href="/sign-up">Comenzar gratis</Link>
          </Button>
        </div>
      </nav>
    </motion.header>
  );
}

