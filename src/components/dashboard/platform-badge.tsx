import { BookingPlatform } from "@prisma/client";
import { cn } from "@/lib/utils";

const platformStyles: Record<
  BookingPlatform,
  { label: string; className: string }
> = {
  AIRBNB: {
    label: "Airbnb",
    className: "bg-[#ff5a5f] text-primary-foreground",
  },
  BOOKING: {
    label: "B.",
    className: "bg-[#003580] text-primary-foreground",
  },
  DIRECT: {
    label: "P",
    className: "bg-[#f5d547] text-foreground",
  },
};

type PlatformBadgeProps = {
  platform: BookingPlatform;
  className?: string;
};

export function PlatformBadge({ platform, className }: PlatformBadgeProps) {
  const style = platformStyles[platform];

  return (
    <span
      className={cn(
        "inline-flex h-7 min-w-7 items-center justify-center rounded-md px-1.5 text-[11px] font-bold",
        style.className,
        className,
      )}
      title={style.label}
    >
      {platform === "AIRBNB" ? (
        <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden>
          <path d="M12 2c1.5 3.2 4.8 7.1 4.8 11.2 0 2.2-1.8 4-4 4s-4-1.8-4-4c0-4.1 3.3-8 3.3-8.1C11.5 4.4 12 2 12 2zm-6.5 9.5c-2.5 0-4.5 2-4.5 4.5S3 20.5 5.5 20.5 10 18.5 10 16s2-4.5 4.5-4.5zm13 0c2.5 0 4.5 2 4.5 4.5S20.5 20.5 18 20.5 14 18.5 14 16s2-4.5 4.5-4.5z" />
        </svg>
      ) : (
        style.label
      )}
    </span>
  );
}
