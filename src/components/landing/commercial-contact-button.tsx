"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { landingHomeSectionHref } from "@/lib/landing-public-nav";

type CommercialContactButtonProps = {
  label?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
  variant?: "primary" | "outline";
};

const sizeStyles = {
  sm: "h-9 px-4 text-sm",
  md: "h-11 px-5 text-[15px]",
  lg: "h-12 px-7 text-base",
} as const;

export function CommercialContactButton({
  label = "Contactar asesor",
  size = "md",
  className,
  variant = "primary",
}: CommercialContactButtonProps) {
  const pathname = usePathname();
  const href = landingHomeSectionHref(pathname, "contact");

  const classNames = cn(
    "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-all duration-200",
    sizeStyles[size],
    variant === "primary"
      ? "bg-gradient-to-r from-pragma-electric via-[#0088ff] to-[#00c9a7] text-white shadow-[0_4px_24px_-4px_rgba(0,102,255,0.45)] hover:shadow-[0_8px_32px_-4px_rgba(0,245,160,0.35)]"
      : "border border-pragma-border bg-white text-pragma-black hover:border-pragma-electric/40 hover:bg-pragma-light-blue/60",
    className,
  );

  if (href.startsWith("#") || href.startsWith("/#")) {
    return (
      <a href={href} className={classNames}>
        {label}
        <ArrowRight className="h-4 w-4" strokeWidth={2.25} />
      </a>
    );
  }

  return (
    <Link href={href} className={classNames}>
      {label}
      <ArrowRight className="h-4 w-4" strokeWidth={2.25} />
    </Link>
  );
}
