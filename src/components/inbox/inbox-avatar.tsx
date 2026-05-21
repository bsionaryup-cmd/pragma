"use client";

import Image from "next/image";
import { normalizeInboxImageSrc } from "@/lib/inbox/resolve-image-src";
import { cn } from "@/lib/utils";

type InboxAvatarProps = {
  imageUrl: unknown;
  name: string;
  initials?: string;
  className?: string;
  imageClassName?: string;
  sizes?: string;
};

export function InboxAvatar({
  imageUrl,
  name,
  initials,
  className,
  imageClassName,
  sizes = "48px",
}: InboxAvatarProps) {
  const src = normalizeInboxImageSrc(imageUrl);
  const label = name.trim() || "Participante";
  const fallbackInitial =
    initials?.trim().slice(0, 1).toUpperCase() ||
    label.charAt(0).toUpperCase() ||
    "?";

  return (
    <div
      className={cn(
        "relative shrink-0 overflow-hidden rounded-md bg-muted",
        className,
      )}
      aria-label={src ? undefined : `Avatar de ${label}`}
    >
      {src ? (
        <Image
          src={src}
          alt={label}
          fill
          className={cn("object-cover", imageClassName)}
          sizes={sizes}
        />
      ) : (
        <div
          className="flex h-full w-full items-center justify-center rounded-md bg-pragma-soft-gray text-sm font-semibold text-pragma-mid-gray dark:bg-muted dark:text-muted-foreground"
          role="img"
          aria-label={label}
        >
          {fallbackInitial}
        </div>
      )}
    </div>
  );
}
