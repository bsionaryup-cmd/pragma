"use client";

import { UserButton } from "@clerk/nextjs";
import { Menu, Store } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { PragmaLogo } from "@/components/brand/pragma-logo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { RETAIL_NAV } from "@/domains/retail/ui/nav";

export function RetailShell({
  children,
  storeName,
}: {
  children: React.ReactNode;
  storeName: React.ReactNode;
}) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  const links = (
    <nav className="space-y-1" aria-label="Navegación de INTIENDAS">
      {RETAIL_NAV.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            onClick={() => setMenuOpen(false)}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
              active
                ? "bg-pragma-electric text-white shadow-pragma-soft"
                : "text-foreground/70 hover:bg-pragma-soft-gray hover:text-pragma-black",
            )}
          >
            <Icon className="size-4" />
            {label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-dvh bg-pragma-soft-gray/60 text-foreground">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-border bg-card p-4 lg:flex lg:flex-col">
        <Link href="/intiendas/dashboard" className="mb-7 flex items-center gap-3 px-2">
          <PragmaLogo variant="mark" symbolClassName="h-9 w-8" priority />
          <div>
            <PragmaLogo variant="full" tone="light" fullClassName="h-5 w-auto" />
            <span className="mt-0.5 block text-[10px] font-bold tracking-[0.24em] text-pragma-electric">
              INTIENDAS
            </span>
          </div>
        </Link>
        <div className="min-h-0 flex-1 overflow-y-auto">{links}</div>
        <div className="mt-4 rounded-xl bg-pragma-soft-gray p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Tienda activa
          </p>
          <p className="mt-1 truncate text-sm font-semibold">{storeName}</p>
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border bg-card/95 px-4 backdrop-blur sm:px-6">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setMenuOpen((open) => !open)}
            aria-label="Abrir menú"
          >
            <Menu />
          </Button>
          <div className="flex min-w-0 flex-1 items-center gap-2 lg:hidden">
            <PragmaLogo variant="mark" symbolClassName="h-7 w-6" />
            <span className="text-sm font-bold tracking-[0.16em]">INTIENDAS</span>
          </div>
          <div className="hidden min-w-0 flex-1 items-center gap-2 lg:flex">
            <Store className="size-4 text-pragma-electric" />
            <span className="truncate text-sm font-medium">{storeName}</span>
          </div>
          <UserButton appearance={{ elements: { avatarBox: "h-9 w-9 ring-2 ring-border" } }} />
        </header>
        {menuOpen ? (
          <div className="fixed inset-x-0 top-16 z-20 border-b border-border bg-card p-4 shadow-lg lg:hidden">
            {links}
          </div>
        ) : null}
        <main className="mx-auto w-full max-w-[1500px] p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
