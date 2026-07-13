"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export function TiendasOnScreenHeader({
  title,
  backHref = "/intiendas/dashboard",
  className,
  rightSlot,
}: {
  title: string;
  backHref?: string;
  className?: string;
  rightSlot?: React.ReactNode;
}) {
  return (
    <header
      className={cn(
        "flex h-14 shrink-0 items-center gap-3 border-b border-[#d9dee5] bg-white px-4",
        className,
      )}
    >
      <Link
        href={backHref}
        className="flex items-center gap-2 text-[#4a5568] transition hover:text-pragma-electric"
        aria-label="Volver"
      >
        <ArrowLeft className="size-5" strokeWidth={2.25} />
        <span className="text-lg font-medium text-[#2d3748]">{title}</span>
      </Link>
      <div className="ml-auto flex items-center gap-3 text-[#718096]">
        {rightSlot}
      </div>
    </header>
  );
}
