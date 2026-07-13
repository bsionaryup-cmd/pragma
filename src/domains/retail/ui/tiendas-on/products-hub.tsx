"use client";

import {
  ArrowLeft,
  ArrowLeftRight,
  ClipboardList,
  HardHat,
  ListChecks,
  Package,
  ShoppingBag,
  Wine,
} from "lucide-react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { TiendasOnScreenFooter } from "./screen-footer";
import { cn } from "@/lib/utils";

const PRODUCT_SUBMODULES = [
  {
    id: "productos",
    label: "Productos",
    href: "/intiendas/inventario/lista",
    icon: ClipboardList,
  },
  {
    id: "proveedores",
    label: "Proveedores",
    href: "/intiendas/proveedores",
    icon: HardHat,
  },
  {
    id: "devoluciones",
    label: "Devoluciones",
    href: "/intiendas/inventario/devoluciones",
    icon: ShoppingBag,
  },
  {
    id: "ajuste",
    label: "Ajuste de inventario",
    href: "/intiendas/inventario/ajuste",
    icon: ListChecks,
  },
  {
    id: "traslado",
    label: "Traslado de Productos",
    href: "/intiendas/inventario/traslado",
    icon: ArrowLeftRight,
  },
] as const;

function ArcIcon({
  icon: Icon,
  className,
  size = "md",
}: {
  icon: LucideIcon;
  className?: string;
  size?: "md" | "lg";
}) {
  const box = size === "lg" ? "size-28" : "size-20";
  const iconSize = size === "lg" ? "size-14" : "size-10";
  return (
    <div className={cn("relative flex items-center justify-center", box, className)}>
      <div className="absolute inset-0 rounded-full border border-[#b8c9de]/70" />
      <div className="absolute inset-[10%] rounded-full border border-[#c9d7e8]/80" />
      <Icon className={cn("relative text-[#5a6f85]", iconSize)} strokeWidth={1.35} />
    </div>
  );
}

function SubmoduleCard({
  label,
  href,
  icon,
}: {
  label: string;
  href: string;
  icon: LucideIcon;
}) {
  return (
    <Link
      href={href}
      className="group relative flex min-h-[132px] flex-col overflow-hidden rounded-lg border border-[#d5dce6] bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition hover:border-pragma-electric/35 hover:shadow-md"
    >
      <span className="inline-flex items-center gap-2.5 pr-16 text-[17px] font-medium leading-snug text-[#3d4a5c]">
        <span className="size-2.5 shrink-0 rounded-full bg-pragma-electric" />
        {label}
      </span>
      <div className="pointer-events-none absolute bottom-2 right-2">
        <ArcIcon icon={icon} />
      </div>
    </Link>
  );
}

export function TiendasOnProductsHub({ storeCode }: { storeCode?: string }) {
  return (
    <div className="flex min-h-dvh flex-col bg-[#f0f2f4]">
      <header className="flex h-14 shrink-0 items-center border-b border-[#d9dee5] bg-white px-4">
        <Link
          href="/intiendas/dashboard"
          className="flex size-10 items-center justify-center text-[#4a5568] transition hover:text-pragma-electric"
          aria-label="Volver"
        >
          <ArrowLeft className="size-6" strokeWidth={2.25} />
        </Link>
      </header>

      <div className="relative flex min-h-0 flex-1">
        {/* Left featured module marker */}
        <aside className="relative hidden w-[38%] shrink-0 items-center justify-center lg:flex">
          <div className="pointer-events-none absolute -left-40 top-1/2 size-[520px] -translate-y-1/2 rounded-full bg-white/95" />
          <div className="relative z-10 flex flex-col items-center px-6 text-center">
            <div className="relative flex size-44 items-center justify-center">
              <div className="absolute inset-0 rounded-full border-[1.5px] border-dashed border-[#9eb2c9]" />
              <div className="absolute -right-3 -top-2 size-16 rounded-full border border-[#c5d5e8]/80" />
              <div className="absolute -bottom-1 -left-4 size-12 rounded-full border border-[#c5d5e8]/70" />
              <div className="relative flex items-end gap-0.5 text-[#5a6f85]">
                <Package className="size-11" strokeWidth={1.35} />
                <Wine className="mb-0.5 size-14" strokeWidth={1.35} />
              </div>
            </div>
            <p className="mt-5 text-3xl font-semibold tracking-tight text-[#3d4a5c]">Productos</p>
          </div>
        </aside>

        {/* Right submodule grid */}
        <main className="relative z-10 flex min-w-0 flex-1 flex-col p-4 lg:p-6">
          <div className="mb-5 flex items-center gap-3 lg:hidden">
            <div className="flex size-14 items-center justify-center rounded-full border border-dashed border-[#9eb2c9]">
              <Package className="size-7 text-[#5a6f85]" strokeWidth={1.35} />
            </div>
            <p className="text-2xl font-semibold text-[#3d4a5c]">Productos</p>
          </div>

          <div className="grid flex-1 content-start grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {PRODUCT_SUBMODULES.map((item) => (
              <SubmoduleCard key={item.id} {...item} />
            ))}
          </div>
        </main>
      </div>

      <TiendasOnScreenFooter storeCode={storeCode} />
    </div>
  );
}
