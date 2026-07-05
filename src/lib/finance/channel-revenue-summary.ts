import { BookingPlatform } from "@prisma/client";

export type ChannelRevenueSummary = {
  airbnbRevenue: number;
  airbnbReservations: number;
  directRevenue: number;
  directReservations: number;
  manualRevenue: number;
  totalRevenue: number;
  totalReservations: number;
};

export function computeChannelRevenueSummary(input: {
  reservationRows: Array<{ platform: BookingPlatform; amount: number }>;
  manualIncomeTotal?: number;
}): ChannelRevenueSummary {
  let airbnbRevenue = 0;
  let airbnbReservations = 0;
  let directRevenue = 0;
  let directReservations = 0;

  for (const row of input.reservationRows) {
    if (row.platform === BookingPlatform.AIRBNB) {
      airbnbRevenue += row.amount;
      airbnbReservations += 1;
      continue;
    }
    if (row.platform === BookingPlatform.DIRECT) {
      directRevenue += row.amount;
      directReservations += 1;
    }
  }

  const manualRevenue = Math.round(input.manualIncomeTotal ?? 0);
  const totalRevenue = Math.round(
    airbnbRevenue + directRevenue + manualRevenue,
  );

  return {
    airbnbRevenue: Math.round(airbnbRevenue),
    airbnbReservations,
    directRevenue: Math.round(directRevenue),
    directReservations,
    manualRevenue,
    totalRevenue,
    totalReservations: airbnbReservations + directReservations,
  };
}
