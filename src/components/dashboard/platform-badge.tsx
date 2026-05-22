import type { BookingPlatform } from "@prisma/client";
import { ReservationSourceBadge } from "@/components/reservations/reservation-source-badge";

type PlatformBadgeProps = {
  platform: BookingPlatform;
  className?: string;
};

/** Compact icon-only badge for tables, inbox, and dashboard rows. */
export function PlatformBadge({ platform, className }: PlatformBadgeProps) {
  return (
    <ReservationSourceBadge
      platform={platform}
      showLabel={false}
      className={className}
    />
  );
}
