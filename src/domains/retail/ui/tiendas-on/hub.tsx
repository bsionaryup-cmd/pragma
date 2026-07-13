"use client";

import { LogOut, Network } from "lucide-react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { PragmaLogo } from "@/components/brand/pragma-logo";
import { ClerkSignOutButton } from "@/components/auth/clerk-sign-out-button";
import { INTIENDAS_MODULES } from "./modules";
import { TiendasOnScreenFooter } from "./screen-footer";

function ModuleTile({
  label,
  href,
  icon: Icon,
}: {
  label: string;
  href: string;
  icon: LucideIcon;
}) {
  return (
    <Link
      href={href}
      className="group relative flex min-h-[128px] flex-col rounded-md border border-[#d5dce6] bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition hover:border-pragma-electric/40 hover:shadow-md"
    >
      <span className="inline-flex items-center gap-2 text-base font-medium text-[#3d4a5c]">
        <span className="size-2.5 rounded-full bg-pragma-electric" />
        {label}
      </span>
      <div className="pointer-events-none absolute bottom-3 right-3 flex size-20 items-center justify-center">
        <div className="absolute inset-0 rounded-full border border-pragma-electric/25" />
        <div className="absolute inset-2 rounded-full border border-pragma-cyan/30" />
        <Icon className="relative size-9 text-pragma-electric/80" strokeWidth={1.5} />
      </div>
    </Link>
  );
}

export function TiendasOnHub({
  storeName,
  storeCode,
  userLabel,
}: {
  storeName: string;
  storeCode?: string;
  userLabel?: string;
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-[#eef3f9]">
      <header className="flex h-14 items-center justify-between border-b border-[#d9dee5] bg-white px-4">
        <div className="flex-1" />
        <p className="truncate px-4 text-center text-base font-semibold uppercase tracking-wide text-[#2d3748]">
          {storeName}
        </p>
        <div className="flex flex-1 items-center justify-end gap-3 text-[#5a6f85]">
          <span className="rounded bg-pragma-electric px-2.5 py-1 text-[11px] font-bold uppercase text-white">
            PRAGMA
          </span>
          <Network className="size-5 text-pragma-electric" />
          <ClerkSignOutButton
            redirectUrl="/intiendas/login"
            variant="ghost"
            className="h-8 w-8 p-0 text-[#5a6f85] hover:text-pragma-electric"
          >
            <LogOut className="size-5" />
          </ClerkSignOutButton>
        </div>
      </header>

      <div className="relative flex min-h-0 flex-1">
        <div className="pointer-events-none absolute -left-24 top-8 size-[420px] rounded-full bg-white/90 shadow-inner" />
        <div className="pointer-events-none absolute right-0 top-0 h-40 w-40 rounded-full bg-pragma-electric/5 blur-2xl" />

        <aside className="relative z-10 hidden w-[280px] shrink-0 flex-col justify-center px-8 lg:flex">
          <PragmaLogo variant="full" tone="light" fullClassName="h-10 w-auto" priority />
          <p className="mt-2 text-2xl font-bold tracking-[0.2em] text-pragma-electric">INTIENDAS</p>
          {userLabel ? (
            <p className="mt-4 text-sm uppercase tracking-wider text-[#718096]">{userLabel}</p>
          ) : null}
        </aside>

        <main className="relative z-10 flex min-w-0 flex-1 flex-col p-4 lg:p-6">
          <div className="mb-4 flex items-center gap-3 lg:hidden">
            <PragmaLogo variant="mark" symbolClassName="h-9 w-8" />
            <div>
              <PragmaLogo variant="full" tone="light" fullClassName="h-5 w-auto" />
              <p className="text-[10px] font-bold tracking-[0.24em] text-pragma-electric">INTIENDAS</p>
            </div>
          </div>

          <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {INTIENDAS_MODULES.map((module) => (
              <ModuleTile key={module.id} {...module} />
            ))}
          </div>
        </main>
      </div>

      <TiendasOnScreenFooter storeCode={storeCode} />
    </div>
  );
}
