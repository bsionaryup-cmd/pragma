"use client";

import {
  ReservationSourceIcon,
  type ReservationSourceIconProps,
} from "@/components/reservations/reservation-source-icon";

export type PlatformIconProps = ReservationSourceIconProps;

/** Calendar-friendly alias; compact plain icons without badge frame. */
export function PlatformIcon({
  size = "xs",
  framed = false,
  ...props
}: PlatformIconProps) {
  return <ReservationSourceIcon size={size} framed={framed} {...props} />;
}
