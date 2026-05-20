"use client";

import { Building2 } from "lucide-react";
import Image from "next/image";
import { getPropertyCoverGradient } from "@/features/properties/lib/property-style";
import { cn } from "@/lib/utils";

type PropertyCoverProps = {
  id: string;
  name: string;
  coverImageUrl: string | null;
  className?: string;
};

export function PropertyCover({
  id,
  name,
  coverImageUrl,
  className,
}: PropertyCoverProps) {
  if (coverImageUrl) {
    return (
      <div className={cn("relative overflow-hidden bg-muted", className)}>
        <Image
          src={coverImageUrl}
          alt={name}
          fill
          className="object-cover"
          sizes="(max-width: 768px) 100vw, 320px"
          unoptimized
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative flex items-center justify-center overflow-hidden bg-gradient-to-br",
        getPropertyCoverGradient(id),
        className,
      )}
    >
      <Building2 className="h-10 w-10 text-primary-foreground/90 drop-shadow-sm" />
    </div>
  );
}
